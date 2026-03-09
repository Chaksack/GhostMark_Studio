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
import { isStrapiEnabled, strapiFetch, StrapiBanner } from "@lib/strapi"

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

  // Optional: fetch a banner configured for this collection from Strapi
  let banner: StrapiBanner | null = null
  if (isStrapiEnabled()) {
    try {
      const res = await strapiFetch<{ data: StrapiBanner[] }>(
        `api/banners?filters[placement][$eq]=collection:${collection.handle}&populate=image`
      )
      const list = (res?.data as unknown as any)?.data || (res?.data as unknown as any[])
      const item = Array.isArray(list) ? list[0] : null
      banner = (item || res?.data) as unknown as StrapiBanner
    } catch (e) {
      // ignore errors to keep page resilient
    }
  }

  return (
    <div className="flex flex-col">

      {/* Optional categories tiles to help exploration */}
      {/*<div className="content-container py-8 md:py-12">*/}
      {/*  <CollectionsTiles />*/}
      {/*</div>*/}

      {/* Product grid with refinements */}
      <div className="content-container flex flex-col small:flex-row small:items-start py-2">
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
          {/* Optional CMS banner per collection */}
          {banner?.attributes?.text && (
            <div
              className="mb-6 rounded p-4 text-white"
              style={{
                backgroundColor: banner.attributes.backgroundColor || "#111827",
              }}
            >
              <div className="text-sm uppercase opacity-80">
                {banner.attributes.title || collection.title}
              </div>
              <div className="text-base">
                {banner.attributes.link ? (
                  <a href={banner.attributes.link} className="underline">
                    {banner.attributes.text}
                  </a>
                ) : (
                  banner.attributes.text
                )}
              </div>
            </div>
          )}
          <div className="mb-2">
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
