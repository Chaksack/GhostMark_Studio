import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

// GET /admin/products/:id/metadata
// Lightweight debug endpoint to inspect a product's metadata, including POD print_areas.
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const { id: productId } = req.params
    if (!productId) {
      return res.status(400).json({ message: "Missing product ID" })
    }

    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as any

    const { data: products } = await query.graph({
      entity: "product",
      filters: { id: productId },
      fields: ["id", "title", "type_id", "metadata"],
    })

    if (!products || products.length === 0) {
      return res.status(404).json({ message: "Product not found" })
    }

    const product = products[0]
    const metadata = (product as any)?.metadata || {}
    const pod = (metadata?.pod || {}) as any
    const printAreas = pod?.print_areas || null

    return res.json({
      product: { id: product.id, title: product.title, type_id: product.type_id },
      metadata,
      pod,
      print_areas: printAreas,
    })
  } catch (e: any) {
    return res.status(500).json({ message: e?.message || "Failed to load product metadata" })
  }
}
