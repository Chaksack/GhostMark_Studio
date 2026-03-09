import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { DEFAULT_DPI } from "../../../../utils/units"

/**
 * PATCH /admin/products/[id]
 * Minimal handler to support updating POD print areas via product.metadata.pod
 * This addresses 404s from clients that PATCH the product directly when assigning print areas.
 */
export async function PATCH(req: MedusaRequest, res: MedusaResponse) {
  const { id: productId } = req.params
  const body = ((req as any).body ?? {}) as any
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as any

  try {
    if (!productId) {
      return res.status(400).json({ message: "Missing product ID" })
    }

    // Load current product and metadata (Query API returns an object with a `data` array)
    const { data: products } = await query.graph({
      entity: "product",
      filters: { id: productId },
      fields: ["id", "title", "type_id", "metadata"],
    })

    if (!products || products.length === 0) {
      return res.status(404).json({ message: "Product not found" })
    }

    const current = products[0]
    const currentMeta = (current?.metadata as any) || {}

    // Accept various shapes from clients
    const incomingPod = body.pod || body?.metadata?.pod || body?.pod_config || null
    const incomingPrintAreas = body.print_areas || body.printAreas || body?.pod_print_areas || null

    if (!incomingPod && !incomingPrintAreas && !body.metadata) {
      // Nothing to update that we recognize
      return res.status(400).json({
        message: "Nothing to update. Provide 'pod' or 'metadata.pod' or 'print_areas' in body.",
      })
    }

    const now = new Date().toISOString()
    const prevPod = (currentMeta.pod || {}) as any

    // Build next pod object
    let nextPod: any = { ...prevPod }

    // Merge explicit pod object if provided
    if (incomingPod && typeof incomingPod === "object") {
      nextPod = {
        ...nextPod,
        ...incomingPod,
      }
    }

    // If separate print areas provided, merge them
    if (incomingPrintAreas && typeof incomingPrintAreas === "object") {
      nextPod = {
        ...nextPod,
        print_areas: incomingPrintAreas,
      }
    }

    // Ensure dpi and version
    const dpi = Number(nextPod?.dpi || DEFAULT_DPI)
    // Auto bump version when caller updates pod/print areas
    const prevVersion = Number(prevPod?.version || 0)
    const callerVersion = Number(nextPod?.version || prevVersion)
    const nextVersion = Number.isFinite(callerVersion)
      ? Math.max(prevVersion + 1, callerVersion)
      : prevVersion + 1

    nextPod = {
      ...nextPod,
      dpi,
      version: nextVersion,
      updated_at: now,
    }

    const updatedMeta = {
      ...currentMeta,
      ...(body?.metadata && typeof body.metadata === "object" ? body.metadata : {}),
      pod: nextPod,
    }

    // Persist metadata
    // Use Product module service to perform the update (update() is not available on graph builder)
    const productModuleService = req.scope.resolve(Modules.PRODUCT) as any
    // Some Medusa versions expect a single DTO object instead of an array.
    // Passing an array here led to MikroORM trying to interpret filters as
    // an array (Product.0), causing: "Trying to query by not existing property Product.0".
    await productModuleService.updateProducts({
      id: productId,
      metadata: updatedMeta,
    })

    return res.status(200).json({
      message: "Product updated",
      product: { id: productId },
      pod: updatedMeta.pod,
      metadata: updatedMeta,
    })
  } catch (error: any) {
    console.error("Error updating product (PATCH /admin/products/:id):", error)
    return res.status(500).json({ message: error?.message || "Failed to update product" })
  }
}
