import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { generateInvoicePdf } from "../../../../../../services/invoice-pdf"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const draftOrderId = (req.params as any)?.draftOrderId

  if (!draftOrderId) {
    return res.status(400).json({ message: "Missing draftOrderId" })
  }

  const query = req.scope.resolve("query") as any

  const { data } = await query.graph({
    entity: "order",
    fields: [
      "*",
      "customer.*",
      "billing_address.*",
      "shipping_address.*",
      "items.*",
      "items.variant.product.title",
    ],
    filters: { id: draftOrderId },
  })

  const order = Array.isArray(data) ? data[0] : null

  if (!order) {
    return res.status(404).json({ message: "Draft order not found" })
  }

  const pdf = await generateInvoicePdf(order, {
    branding: {
      issuerName: process.env.INVOICE_ISSUER_NAME || "GhostMark Studio",
    },
  })

  const displayId = String((order as any).display_id || order.id)
  const filename = `invoice-${displayId}.pdf`

  res.setHeader("Content-Type", "application/pdf")
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`)

  return res.status(200).send(pdf)
}
