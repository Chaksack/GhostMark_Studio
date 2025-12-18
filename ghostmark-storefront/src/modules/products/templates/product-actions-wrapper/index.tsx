import { listProducts } from "@lib/data/products"
import { HttpTypes } from "@medusajs/types"
import ProductActions from "@modules/products/components/product-actions"

/**
 * Fetches real time pricing for a product and renders the product actions component.
 */
export default async function ProductActionsWrapper({
  id,
  region,
}: {
  id: string
  region: HttpTypes.StoreRegion
}) {
  const product = await listProducts({
    queryParams: {
      id: [id],
      limit: 1,
      // Ensure variants and their option types are loaded for the PDP option selectors
      // Note: Passing fields here overrides the default in listProducts, so include all needed ones
      fields:
        "+metadata,+tags,*images,*variants,*variants.options,*variants.images,*variants.calculated_price,+variants.inventory_quantity,*options",
    },
    regionId: region.id,
  }).then(({ response }) => response.products[0])

  if (!product) {
    return null
  }

  return <ProductActions product={product} region={region} />
}
