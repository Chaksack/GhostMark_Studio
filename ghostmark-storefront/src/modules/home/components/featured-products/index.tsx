import { HttpTypes } from "@medusajs/types"
import ProductRail from "@modules/home/components/featured-products/product-rail"
import TypeProductRail from "@modules/home/components/featured-products/type-rail"
import { listTypes } from "@lib/data/types"

export default async function FeaturedProducts({
  collections,
  region,
}: {
  collections: HttpTypes.StoreCollection[]
  region: HttpTypes.StoreRegion
}) {
  // Prefer showcasing by product types if available
  const { types } = await listTypes().catch(() => ({ types: [] }))

  if (types && types.length) {
    return types.map((t) => (
      <li key={t.handle}>
        <TypeProductRail type={t} region={region} />
      </li>
    ))
  }

  // Fallback to collections-based rails if no types endpoint/data is available
  return (collections || []).map((collection) => (
    <li key={collection.id}>
      <ProductRail collection={collection} region={region} />
    </li>
  ))
}
