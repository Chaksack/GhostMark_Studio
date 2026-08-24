import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { generateDispatchNotePdf, computeDispatchNoteNumber } from "../../../../../services/dispatch-note-pdf"
import { ORDER_DOCUMENT_FIELDS } from "../../../../../services/pdf-utils"

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

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const orderId = (req.params as any)?.orderId

  if (!orderId) {
    return res.status(400).json({ message: "Missing orderId" })
  }

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

  const dispatchNoteNumber = await resolveDispatchNoteNumber(req, order)

  const pdf = await generateDispatchNotePdf(order, { dispatchNoteNumber })

  const displayId = String((order as any).display_id || order.id)
  const filename = `dispatch-note-${displayId}.pdf`

  res.setHeader("Content-Type", "application/pdf")
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`)

  return res.status(200).send(pdf)
}
