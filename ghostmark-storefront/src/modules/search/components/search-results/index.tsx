import { listProducts } from "@lib/data/products"
import { getRegion } from "@lib/data/regions"
import ProductPreview from "@modules/products/components/product-preview"
import { Pagination } from "@modules/store/components/pagination"
import { Text } from "@medusajs/ui"

const PRODUCTS_PER_PAGE = 12

type SearchResultsProps = {
  query: string
  page: number
  sortBy: string
  countryCode: string
}

export default async function SearchResults({
  query,
  page,
  sortBy,
  countryCode,
}: SearchResultsProps) {
  const region = await getRegion(countryCode)
  
  if (!region) {
    return (
      <div className="text-center py-8">
        <Text>Unable to load search results</Text>
      </div>
    )
  }

  // Get order parameter based on sortBy
  const getOrder = (sortBy: string) => {
    switch (sortBy) {
      case "price_asc":
        return "created_at" // MedusaJS doesn't support price sorting directly
      case "price_desc":
        return "created_at"
      case "name_asc":
        return "title"
      case "name_desc":
        return "-title"
      case "newest":
        return "-created_at"
      case "oldest":
        return "created_at"
      default:
        return "created_at" // Default relevance
    }
  }

  try {
    const { response } = await listProducts({
      pageParam: page,
      queryParams: {
        q: query,
        limit: PRODUCTS_PER_PAGE,
        order: getOrder(sortBy),
        // Avoid requesting unsupported 'type' field to prevent Medusa validation errors
        fields: "*variants.calculated_price,+metadata,+options,+variants.options,+images",
      },
      countryCode,
    })

    const { products, count } = response
    const totalPages = Math.ceil(count / PRODUCTS_PER_PAGE)
    const startResult = ((page - 1) * PRODUCTS_PER_PAGE) + 1
    const endResult = Math.min(page * PRODUCTS_PER_PAGE, count)

    if (products.length === 0) {
      return (
        <div className="text-center py-12">
          <Text className="text-lg mb-4">No products found for "{query}"</Text>
          <div className="space-y-2">
            <Text className="text-ui-fg-muted text-sm">Try:</Text>
            <ul className="text-ui-fg-muted text-sm space-y-1">
              <li>• Checking your spelling</li>
              <li>• Using fewer words</li>
              <li>• Using more general terms</li>
            </ul>
          </div>
        </div>
      )
    }

    return (
      <>
        {/* Results Summary */}
        <div className="mb-6 flex items-center justify-between">
          <Text className="text-sm text-ui-fg-subtle">
            Showing {startResult}-{endResult} of {count} results
          </Text>
        </div>

        {/* Products Grid */}
        <ul
          className="grid grid-cols-2 w-full small:grid-cols-3 medium:grid-cols-4 large:grid-cols-5 gap-4 small:gap-6"
          data-testid="search-results-list"
        >
          {products.map((product) => (
            <li key={product.id}>
              <ProductPreview product={product} region={region} />
            </li>
          ))}
        </ul>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-12">
            <Pagination
              data-testid="search-pagination"
              page={page}
              totalPages={totalPages}
            />
          </div>
        )}
      </>
    )
  } catch (error) {
    console.error("Search results error:", error)
    return (
      <div className="text-center py-8">
        <Text>Failed to load search results. Please try again.</Text>
      </div>
    )
  }
}