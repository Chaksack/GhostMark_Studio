import { notFound } from "next/navigation"
import { Suspense } from "react"

import InteractiveLink from "@modules/common/components/interactive-link"
import SkeletonProductGrid from "@modules/skeletons/templates/skeleton-product-grid"
import RefinementList from "@modules/store/components/refinement-list"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import PaginatedProducts from "@modules/store/templates/paginated-products"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { HttpTypes } from "@medusajs/types"
import { listCollections } from "@lib/data/collections"
import { listCategories } from "@lib/data/categories"

export default async function CategoryTemplate({
  category,
  sortBy,
  page,
  countryCode,
  productType,
}: {
  category: HttpTypes.StoreProductCategory
  sortBy?: SortOptions
  page?: string
  countryCode: string
  productType?: string
}) {
  const pageNumber = page ? parseInt(page) : 1
  const sort = sortBy || "created_at"

  if (!category || !countryCode) notFound()

  const parents = [] as HttpTypes.StoreProductCategory[]

  const getParents = (category: HttpTypes.StoreProductCategory) => {
    if (category.parent_category) {
      parents.push(category.parent_category)
      getParents(category.parent_category)
    }
  }

  getParents(category)

  // Fetch collections and categories server-side for sidebar lists
  // Note: this component is a server component, so we can call server utilities directly
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const dataPromise = Promise.all([
    listCollections({ limit: "200", fields: "id,handle,title" }).catch(() => ({ collections: [] })),
    // Fetch a larger set to ensure deep category trees are fully available
    // for building the parent->children map used to aggregate descendants.
    listCategories({ limit: "1000" }).catch(() => []),
  ])

  const [collectionsRes, allCategories] = await dataPromise

  return (
    <div
      className="flex flex-col small:flex-row small:items-start py-6 content-container"
      data-testid="category-container"
    >
      <RefinementList
        sortBy={sort}
        data-testid="sort-by-container"
        collections={collectionsRes.collections}
        categories={allCategories?.map((c: any) => ({ id: c.id, handle: c.handle, name: c.name }))}
        activeCategoryHandle={category.handle}
        productType={productType}
      />
      <div className="w-full">
        <div className="flex flex-row mb-8 text-2xl-semi gap-4">
          {parents &&
            parents.map((parent) => (
              <span key={parent.id} className="text-ui-fg-subtle">
                <LocalizedClientLink
                  className="mr-4 hover:text-black"
                  href={`${(() => {
                    const base = `/categories/${parent.handle}`
                    return productType ? `${base}?type=${encodeURIComponent(productType)}` : base
                  })()}`}
                  data-testid="sort-by-link"
                >
                  {parent.name}
                </LocalizedClientLink>
                /
              </span>
            ))}
          <h1 data-testid="category-page-title">{category.name}</h1>
        </div>
        {category.description && (
          <div className="mb-8 text-base-regular">
            <p>{category.description}</p>
          </div>
        )}
        {category.category_children && (
          <div className="mb-8 text-base-large">
            <ul className="grid grid-cols-1 gap-2">
              {category.category_children?.map((c) => (
                <li key={c.id}>
                  <InteractiveLink
                    href={`${(() => {
                      const base = `/categories/${c.handle}`
                      return productType ? `${base}?type=${encodeURIComponent(productType)}` : base
                    })()}`}
                  >
                    {c.name}
                  </InteractiveLink>
                </li>
              ))}
            </ul>
          </div>
        )}
        <Suspense
          fallback={
            <SkeletonProductGrid
              numberOfProducts={category.products?.length ?? 8}
            />
          }
        >
          <PaginatedProducts
            sortBy={sort}
            page={pageNumber}
            // If no specific product type is selected, show all products
            // in this category including its descendant categories.
            // Otherwise, keep the single category filter and let the
            // client-side type refinement do its work.
            {...(() => {
              if (!productType) {
                // Build a robust parent->children map from all categories to
                // ensure we include descendants at any depth, even if the
                // current category object doesn't have deeply populated children.
                const childrenByParent = new Map<string, string[]>()
                ;(allCategories || []).forEach((cat: any) => {
                  const parentId = cat?.parent_category?.id
                  if (parentId) {
                    const arr = childrenByParent.get(parentId) || []
                    arr.push(cat.id)
                    childrenByParent.set(parentId, arr)
                  }
                })

                const visited = new Set<string>()
                const collectIds = (id: string): string[] => {
                  if (!id || visited.has(id)) return []
                  visited.add(id)
                  const direct = childrenByParent.get(id) || []
                  const deeper = direct.flatMap((cid) => collectIds(cid))
                  return [id, ...deeper]
                }

                const ids = collectIds(category.id)
                return { categoryIds: ids }
              }
              return { categoryId: category.id }
            })()}
            productType={productType}
            countryCode={countryCode}
          />
        </Suspense>
      </div>
    </div>
  )
}
