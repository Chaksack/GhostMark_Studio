import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { generateReceiptPdf } from "../../../../../services/receipt-pdf"
import { ORDER_DOCUMENT_FIELDS } from "../../../../../services/pdf-utils"

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

  const pdf = await generateReceiptPdf(order)

  const displayId = String((order as any).display_id || order.id)
  const filename = `receipt-${displayId}.pdf`

  res.setHeader("Content-Type", "application/pdf")
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`)

  return res.status(200).send(pdf)
}
