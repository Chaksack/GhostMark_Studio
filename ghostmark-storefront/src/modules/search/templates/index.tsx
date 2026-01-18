import { Suspense } from "react"
import { Heading, Text } from "@medusajs/ui"
import { Search } from "lucide-react"
import SkeletonProductGrid from "@modules/skeletons/templates/skeleton-product-grid"
import SearchResults from "@modules/search/components/search-results"
import SearchFilters from "@modules/search/components/search-filters"

type SearchTemplateProps = {
  query?: string
  page?: string
  sortBy?: string
  countryCode: string
}

const SearchTemplate = ({
  query = "",
  page = "1",
  sortBy = "relevance",
  countryCode,
}: SearchTemplateProps) => {
  const pageNumber = parseInt(page) || 1
  const searchQuery = query.trim()

  return (
    <div className="content-container py-6">
      {/* Search Header */}
      <div className="mb-8">
        {searchQuery ? (
          <>
            <Heading level="h1" className="text-2xl mb-2">
              Search results for "{searchQuery}"
            </Heading>
            <Text className="text-ui-fg-subtle">
              Showing products that match your search
            </Text>
          </>
        ) : (
          <div className="text-center py-12">
            <Search className="w-16 h-16 text-ui-fg-muted mx-auto mb-4" />
            <Heading level="h1" className="text-2xl mb-2">
              Search Products
            </Heading>
            <Text className="text-ui-fg-subtle">
              Enter a search term to find products
            </Text>
          </div>
        )}
      </div>

      {searchQuery ? (
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Search Filters - Left Sidebar */}
          <div className="lg:w-64 flex-shrink-0">
            <SearchFilters query={searchQuery} sortBy={sortBy} />
          </div>

          {/* Search Results - Main Content */}
          <div className="flex-1">
            <Suspense fallback={<SkeletonProductGrid />}>
              <SearchResults
                query={searchQuery}
                page={pageNumber}
                sortBy={sortBy}
                countryCode={countryCode}
              />
            </Suspense>
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <Text className="text-ui-fg-muted">
            Use the search bar above to find products, or browse our{" "}
            <a href="/products" className="text-ui-fg-base hover:underline">
              all products
            </a>
            .
          </Text>
        </div>
      )}
    </div>
  )
}

export default SearchTemplate