import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { generateInvoicePdf } from "../../../../../../services/invoice-pdf"
import { ORDER_DOCUMENT_FIELDS } from "../../../../../../services/pdf-utils"

type SendInvoiceBody = {
  to?: string
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const draftOrderId = (req.params as any)?.draftOrderId

    if (!draftOrderId) {
      return res.status(400).json({ message: "Missing draftOrderId" })
    }

    const body = (req.body || {}) as SendInvoiceBody
    const query = req.scope.resolve("query") as any

    const { data } = await query.graph({
      entity: "order",
      fields: ORDER_DOCUMENT_FIELDS,
      filters: { id: draftOrderId },
    })

    const order = Array.isArray(data) ? data[0] : null

    if (!order) {
      return res.status(404).json({ message: "Draft order not found" })
    }

    const customerEmail = body.to || order?.customer?.email || order?.email
    if (!customerEmail) {
      return res.status(400).json({ message: "Draft order has no customer email" })
    }

    const pdf = await generateInvoicePdf(order, {
      branding: {
        issuerName: process.env.INVOICE_ISSUER_NAME || "GhostMark Studio",
      },
    })

    const displayId = String((order as any).display_id || order.id)
    const filename = `invoice-${displayId}.pdf`

    const notificationModuleService = req.scope.resolve(Modules.NOTIFICATION) as any

    const subject = `Invoice ${displayId} | ${process.env.INVOICE_ISSUER_NAME || "GhostMark Studio"}`
    const html = `
      <p style="margin:0 0 12px;">Hi,</p>
      <p style="margin:0 0 12px;">Attached is your invoice <strong>${displayId}</strong>.</p>
      <p style="margin:0;">Thank you for your business.</p>
    `

    await notificationModuleService.createNotifications({
      to: customerEmail,
      channel: "email",
      template: undefined,
      data: {
        invoice_display_id: displayId,
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
      to: customerEmail,
      draft_order_id: order.id,
      invoice_display_id: displayId,
    })
  } catch (error: any) {
    console.error("Error sending draft invoice:", error)
    return res.status(500).json({
      success: false,
      message: error?.message || "Failed to send invoice",
    })
  }
}
