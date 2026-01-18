import { Suspense } from "react"

import SkeletonProductGrid from "@modules/skeletons/templates/skeleton-product-grid"
import RefinementList from "@modules/store/components/refinement-list"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import { Heading, Text, Button } from "@medusajs/ui"
import CollectionsTiles from "@modules/store/templates/sections/collections-tiles"
import { listCollections } from "@lib/data/collections"
import { listCategories } from "@lib/data/categories"
import { getProductTypesForFilter } from "@lib/data/product-types"

import PaginatedProducts from "./paginated-products"

const StoreTemplate = async ({
  sortBy,
  page,
  countryCode,
  productType,
  titleOverride,
}: {
  sortBy?: SortOptions
  page?: string
  countryCode: string
  productType?: string
  titleOverride?: string
}) => {
  const pageNumber = page ? parseInt(page) : 1
  const sort = sortBy || "created_at"
  
  // Fetch data for sidebar filters
  const [{ collections }, rawCategories, productTypes] = await Promise.all([
    listCollections({
      limit: "200",
      fields: "id,handle,title",
    }).catch(() => ({ collections: [] })),
    // Fetch categories and normalize to a simple, serializable shape
    listCategories({
      limit: 200,
      fields: "id,handle,name,parent_category",
    }).catch(() => []),
    getProductTypesForFilter().catch(() => []),
  ])

  // Prefer top-level categories for the left panel (to match expectations)
  const simpleCategories = (Array.isArray(rawCategories) ? rawCategories : [])
    .filter((c: any) => !c.parent_category)
    .map((c: any) => ({ id: c.id, handle: c.handle, name: c.name }))

  return (
    <div className="flex flex-col">
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
          productType={productType}
          productTypes={productTypes}
        />
        <div className="w-full">
          <div className="mb-8">
            <h2 className="text-2xl-semi" data-testid="store-page-title">
              {titleOverride
                ? titleOverride
                : productType
                ? `All ${productType}`
                : "All products"}
            </h2>
          </div>
          <Suspense fallback={<SkeletonProductGrid />}>
            <PaginatedProducts
              sortBy={sort}
              page={pageNumber}
              countryCode={countryCode}
              productType={productType}
            />
          </Suspense>
        </div>
      </div>
    </div>
  )
}

export default StoreTemplate
