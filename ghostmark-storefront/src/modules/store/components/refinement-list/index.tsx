"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback } from "react"

import SortProducts, { SortOptions } from "./sort-products"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { HttpTypes } from "@medusajs/types"

type RefinementListProps = {
  sortBy: SortOptions
  search?: boolean
  'data-testid'?: string
  collections?: Pick<HttpTypes.StoreCollection, "id" | "handle" | "title">[]
  activeCollectionHandle?: string
  categories?: Pick<HttpTypes.StoreProductCategory, "id" | "handle" | "name">[]
  activeCategoryHandle?: string
  // Optional product type to persist across navigation (fallback when URL lacks ?type)
  productType?: string
}

const RefinementList = ({
  sortBy,
  'data-testid': dataTestId,
  collections,
  activeCollectionHandle,
  categories,
  activeCategoryHandle,
  productType,
}: RefinementListProps) => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const createQueryString = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams(searchParams)
      params.set(name, value)

      return params.toString()
    },
    [searchParams]
  )

  const setQueryParams = (name: string, value: string) => {
    const query = createQueryString(name, value)
    router.push(`${pathname}?${query}`)
  }

  return (
    <aside className="flex small:flex-col gap-8 py-4 mb-8 small:px-0 pl-6 small:min-w-[250px] small:ml-[1.675rem]">
      {/* Collections list */}
      {collections && collections.length > 0 && (
        <div>
          <h3 className="text-small-plus mb-3 text-ui-fg-muted">Collections</h3>
          <ul className="flex small:flex-col flex-wrap gap-2 small:gap-1">
            {/* All products link */}
            <li>
              <LocalizedClientLink
                href={`${(() => {
                  const type = searchParams.get("type") || productType || undefined
                  const base = `/products`
                  return type ? `${base}?type=${encodeURIComponent(type)}` : base
                })()}`}
                className={`block rounded-md px-3 py-1 text-sm hover:text-ui-fg-base hover:bg-ui-bg-subtle border border-transparent ${
                  !activeCollectionHandle ? "text-ui-fg-base bg-ui-bg-subtle border-ui-border-base" : "text-ui-fg-muted"
                }`}
              >
                All products
              </LocalizedClientLink>
            </li>
            {collections.map((c) => {
              const active = activeCollectionHandle === c.handle
              return (
                <li key={c.id}>
                  <LocalizedClientLink
                    href={`${(() => {
                      const type = searchParams.get("type") || productType || undefined
                      const base = `/collections/${c.handle}`
                      return type ? `${base}?type=${encodeURIComponent(type)}` : base
                    })()}`}
                    className={`block rounded-md px-3 py-1 text-sm hover:text-ui-fg-base hover:bg-ui-bg-subtle border ${
                      active
                        ? "text-ui-fg-base bg-ui-bg-subtle border-ui-border-base"
                        : "text-ui-fg-muted border-transparent"
                    }`}
                  >
                    {c.title}
                  </LocalizedClientLink>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* Product categories list */}
      {categories && categories.length > 0 && (
        <div>
          <h3 className="text-small-plus mb-3 text-ui-fg-muted">Categories</h3>
          <ul className="flex small:flex-col flex-wrap gap-2 small:gap-1">
            {categories.map((cat) => {
              const active = activeCategoryHandle === cat.handle
              return (
                <li key={cat.id}>
                  <LocalizedClientLink
                    href={`${(() => {
                      const type = searchParams.get("type") || productType || undefined
                      const base = `/categories/${cat.handle}`
                      return type ? `${base}?type=${encodeURIComponent(type)}` : base
                    })()}`}
                    className={`block rounded-md px-3 py-1 text-sm hover:text-ui-fg-base hover:bg-ui-bg-subtle border ${
                      active
                        ? "text-ui-fg-base bg-ui-bg-subtle border-ui-border-base"
                        : "text-ui-fg-muted border-transparent"
                    }`}
                  >
                    {cat.name}
                  </LocalizedClientLink>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* Sort control */}
      <SortProducts sortBy={sortBy} setQueryParams={setQueryParams} data-testid={dataTestId} />
    </aside>
  )
}

export default RefinementList
