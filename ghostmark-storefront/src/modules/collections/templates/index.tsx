import { Suspense } from "react"

import SkeletonProductGrid from "@modules/skeletons/templates/skeleton-product-grid"
import RefinementList from "@modules/store/components/refinement-list"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import PaginatedProducts from "@modules/store/templates/paginated-products"
import { HttpTypes } from "@medusajs/types"
import { Heading, Text, Button } from "@medusajs/ui"
import CollectionsTiles from "@modules/store/templates/sections/collections-tiles"
import { listCollections } from "@lib/data/collections"
import { listCategories } from "@lib/data/categories"
import { getProductTypesForFilter } from "@lib/data/product-types"

export default async function CollectionTemplate({
  sortBy,
  collection,
  page,
  countryCode,
  productType,
}: {
  sortBy?: SortOptions
  collection: HttpTypes.StoreCollection
  page?: string
  countryCode: string
  productType?: string
}) {
  const pageNumber = page ? parseInt(page) : 1
  const sort = sortBy || "created_at"
  
  // Fetch data for sidebar filters
  const [{ collections }, product_categories, productTypes] = await Promise.all([
    listCollections({
      limit: "200",
      fields: "id,handle,title",
    }).catch(() => ({ collections: [] })),
    listCategories().catch(() => []),
    getProductTypesForFilter().catch(() => []),
  ])

  return (
    <div className="flex flex-col">
      {/* Hero band for the category page, inspired by Gelato /custom/cards */}
      <div className="border-b border-ui-border-base bg-ui-bg-subtle">
        <div className="content-container py-10 md:py-14">
          <div className="max-w-3xl">
            <Heading
              level="h1"
              className="text-3xl sm:text-4xl md:text-5xl tracking-tight"
            >
              {collection.title}
            </Heading>
            {collection.metadata?.description || collection.description ? (
              <Text className="mt-4 text-ui-fg-subtle">
                {(collection.metadata as any)?.description || collection.description}
              </Text>
            ) : (
              <Text className="mt-4 text-ui-fg-subtle">
                Discover customizable {collection.title?.toLowerCase()} produced on demand
                and delivered fast.
              </Text>
            )}
            <div className="mt-6">
              <Button size="large">Start creating</Button>
            </div>
          </div>
        </div>
      </div>

      {/* Optional categories tiles to help exploration */}
      <div className="content-container py-8 md:py-12">
        <CollectionsTiles />
      </div>

      {/* Product grid with refinements */}
      <div className="content-container flex flex-col small:flex-row small:items-start py-6">
        <RefinementList
          sortBy={sort}
          collections={collections}
          activeCollectionHandle={collection.handle}
          categories={product_categories?.map((c: any) => ({
            id: c.id,
            handle: c.handle,
            name: c.name,
          }))}
          productType={productType}
          productTypes={productTypes}
        />
        <div className="w-full">
          <div className="mb-8">
            <h2 className="text-2xl-semi">All products</h2>
          </div>
          <Suspense
            fallback={
              <SkeletonProductGrid numberOfProducts={collection.products?.length} />
            }
          >
            <PaginatedProducts
              sortBy={sort}
              page={pageNumber}
              collectionId={collection.id}
              productType={productType}
              countryCode={countryCode}
            />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
