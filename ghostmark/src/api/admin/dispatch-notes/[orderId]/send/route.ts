import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { generateDispatchNotePdf, computeDispatchNoteNumber } from "../../../../../services/dispatch-note-pdf"
import { ORDER_DOCUMENT_FIELDS } from "../../../../../services/pdf-utils"

type SendDispatchNoteBody = {
  to?: string
  volumeLtrs?: number | string
  weightKg?: number | string
}

// Persists the dispatch note number on first generation so repeat
// downloads/sends return the same number (mirrors the `order_number`
// idempotency pattern in src/subscribers/order-notifications.ts).
async function resolveDispatchNoteNumber(req: MedusaRequest, order: any): Promise<string> {
  const existing = order?.metadata?.dispatch_note_number
  if (existing) return String(existing)

  const number = computeDispatchNoteNumber(order)
  try {
    const orderModule = req.scope.resolve(Modules.ORDER) as any
    await orderModule.updateOrders(order.id, {
      metadata: {
        ...(order.metadata ?? {}),
        dispatch_note_number: number,
      },
    })
  } catch (err) {
    console.warn(`[dispatch-notes] failed to persist dispatch_note_number for ${order.id}:`, err)
  }
  return number
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const orderId = (req.params as any)?.orderId

    if (!orderId) {
      return res.status(400).json({ message: "Missing orderId" })
    }

    const body = (req.body || {}) as SendDispatchNoteBody
    const query = req.scope.resolve("query") as any

    const { data } = await query.graph({
      entity: "order",
      fields: ORDER_DOCUMENT_FIELDS,
      filters: { id: orderId },
    })

    const order = Array.isArray(data) ? data[0] : null

    if (!order) {
      return res.status(404).json({ message: "Order not found" })
    }

    // Packing slips go to the fulfilment team by default, not the customer.
    const to =
      body.to ||
      process.env.DISPATCH_FULFILMENT_EMAIL ||
      process.env.SUPPORT_ADMIN_EMAIL ||
      process.env.INVOICE_ISSUER_EMAIL

    if (!to) {
      return res.status(400).json({
        message: "No recipient email provided and no DISPATCH_FULFILMENT_EMAIL/SUPPORT_ADMIN_EMAIL configured",
      })
    }

    const dispatchNoteNumber = await resolveDispatchNoteNumber(req, order)

    const pdf = await generateDispatchNotePdf(order, {
      dispatchNoteNumber,
      volumeLtrs: body.volumeLtrs,
      weightKg: body.weightKg,
    })

    const displayId = String((order as any).display_id || order.id)
    const filename = `dispatch-note-${displayId}.pdf`

    const notificationModuleService = req.scope.resolve(Modules.NOTIFICATION) as any

    const subject = `Dispatch Note ${dispatchNoteNumber} | ${process.env.INVOICE_ISSUER_NAME || "GhostMark Studio"}`
    const html = `
      <p style="margin:0 0 12px;">Hi,</p>
      <p style="margin:0 0 12px;">Attached is the dispatch note for order <strong>${displayId}</strong>.</p>
      <p style="margin:0;">Please check this delivery carefully.</p>
    `

    await notificationModuleService.createNotifications({
      to,
      channel: "email",
      template: undefined,
      data: {
        order_display_id: displayId,
        dispatch_note_number: dispatchNoteNumber,
      },
      content: {
        subject,
        html,
        attachments: [
          {
            filename,
            content: pdf.toString("base64"),
            contentType: "application/pdf",
          },
        ],
      },
    })

    return res.json({
      success: true,
      to,
      order_id: order.id,
      dispatch_note_number: dispatchNoteNumber,
    })
  } catch (error: any) {
    console.error("Error sending dispatch note:", error)
    return res.status(500).json({
      success: false,
      message: error?.message || "Failed to send dispatch note",
    })
  }
}
