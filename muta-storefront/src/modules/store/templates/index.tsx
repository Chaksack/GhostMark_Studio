import { Suspense } from "react"

import SkeletonProductGrid from "@modules/skeletons/templates/skeleton-product-grid"
import RefinementList from "@modules/store/components/refinement-list"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import { Heading, Text, Button } from "@medusajs/ui"
import CollectionsTiles from "@modules/store/templates/sections/collections-tiles"
import { listCollections } from "@lib/data/collections"
import { listCategories } from "@lib/data/categories"

import PaginatedProducts from "./paginated-products"

const StoreTemplate = async ({
  sortBy,
  page,
  countryCode,
}: {
  sortBy?: SortOptions
  page?: string
  countryCode: string
}) => {
  const pageNumber = page ? parseInt(page) : 1
  const sort = sortBy || "created_at"
  const { collections } = await listCollections({
    limit: "200",
    fields: "id,handle,title",
  })
  // Fetch categories and normalize to a simple, serializable shape
  const rawCategories = await listCategories({
    limit: 200,
    fields: "id,handle,name,parent_category",
  }).catch(() => [])

  // Prefer top-level categories for the left panel (to match expectations)
  const simpleCategories = (Array.isArray(rawCategories) ? rawCategories : [])
    .filter((c: any) => !c.parent_category)
    .map((c: any) => ({ id: c.id, handle: c.handle, name: c.name }))

  return (
    <div className="flex flex-col">
      {/* Hero band */}
      <div className="border-b border-ui-border-base bg-ui-bg-subtle">
        <div className="content-container py-10 md:py-14">
          <div className="max-w-3xl">
            <Heading level="h1" className="text-3xl sm:text-4xl md:text-5xl tracking-tight">
              Create custom products, on demand
            </Heading>
            <Text className="mt-4 text-ui-fg-subtle">
              Explore our catalog of customizable products. Produced locally and delivered fast with a global network.
            </Text>
            <div className="mt-6">
              <Button size="large">Start creating</Button>
            </div>
          </div>
        </div>
      </div>

      {/* Collections tiles */}
      {/*<div className="content-container py-8 md:py-12">*/}
      {/*  <CollectionsTiles />*/}
      {/*</div>*/}

      {/* Product grid with refinements */}
      <div
        className="content-container flex flex-col small:flex-row small:items-start py-6"
        data-testid="category-container"
      >
        <RefinementList
          sortBy={sort}
          collections={collections}
          categories={simpleCategories}
        />
        <div className="w-full">
          <div className="mb-8">
            <h2 className="text-2xl-semi" data-testid="store-page-title">
              All products
            </h2>
          </div>
          <Suspense fallback={<SkeletonProductGrid />}>
            <PaginatedProducts
              sortBy={sort}
              page={pageNumber}
              countryCode={countryCode}
            />
          </Suspense>
        </div>
      </div>
    </div>
  )
}

export default StoreTemplate
