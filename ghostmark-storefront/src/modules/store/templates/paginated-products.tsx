import { listProductsWithSort } from "@lib/data/products"
import { getRegion } from "@lib/data/regions"
import ProductPreview from "@modules/products/components/product-preview"
import { Pagination } from "@modules/store/components/pagination"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"

const PRODUCT_LIMIT = 12

type PaginatedProductsParams = {
  limit: number
  collection_id?: string[]
  category_id?: string[]
  id?: string[]
  // Use text search fallback to avoid unsupported field errors on some backends
  q?: string
  order?: string
}

export default async function PaginatedProducts({
  sortBy,
  page,
  collectionId,
  categoryId,
  categoryIds,
  productType,
  productsIds,
  countryCode,
}: {
  sortBy?: SortOptions
  page: number
  collectionId?: string
  categoryId?: string
  categoryIds?: string[]
  productType?: string
  productsIds?: string[]
  countryCode: string
}) {
  const queryParams: PaginatedProductsParams = {
    limit: 12,
  }

  if (collectionId) {
    queryParams["collection_id"] = [collectionId]
  }

  if (categoryIds && categoryIds.length > 0) {
    // When multiple category IDs are provided, include all of them so that
    // visiting a parent category shows products from all its descendants too.
    queryParams["category_id"] = categoryIds
  } else if (categoryId) {
    queryParams["category_id"] = [categoryId]
  }

  // Do NOT add any type filter to backend query. We'll refine client-side.
  // This avoids under-matching and backend errors due to unsupported fields.

  if (productsIds) {
    queryParams["id"] = productsIds
  }

  if (sortBy === "created_at") {
    queryParams["order"] = "created_at"
  }

  const region = await getRegion(countryCode)

  if (!region) {
    return null
  }

  // Improved category handling - try backend filtering first, fall back to union if needed
  let products: any[] = []
  let count = 0

  if (Array.isArray(queryParams.category_id) && queryParams.category_id.length > 1) {
    // Try backend filtering with multiple category IDs first (works with some backends)
    try {
      const res = await listProductsWithSort({
        page,
        queryParams,
        sortBy,
        countryCode,
        productType,
      })
      
      // If backend returned products, use them
      if (res.response.products.length > 0 || res.response.count > 0) {
        products = res.response.products
        count = res.response.count
        
        if (process.env.NODE_ENV !== "production") {
          console.log(`[PaginatedProducts] Backend multi-category filtering succeeded. Count: ${count}`)
        }
      } else {
        throw new Error("Backend multi-category filtering returned no results")
      }
    } catch (error) {
      // Fall back to client-side union for backends that don't support multi-category filtering
      if (process.env.NODE_ENV !== "production") {
        console.log("[PaginatedProducts] Falling back to client-side union for categories:", queryParams.category_id)
      }
      
      const ids = queryParams.category_id
      const AGG_LIMIT = 100
      const AGG_MAX = 600 // Reduced from 800 for better performance
      const seen = new Map<string, any>()

      for (const id of ids) {
        let serverPage = 1
        let nextPage: number | null = 1
        while (nextPage && seen.size < AGG_MAX) {
          const { response, nextPage: np } = await listProductsWithSort({
            page: serverPage,
            queryParams: { ...queryParams, category_id: [id], limit: AGG_LIMIT },
            sortBy,
            countryCode,
            productType,
          })
          
          const batch = Array.isArray(response.products) ? response.products : []
          for (const p of batch) {
            if (!seen.has(p.id)) {
              seen.set(p.id, p)
            }
          }
          nextPage = np
          serverPage = np || 0
          if (!nextPage || seen.size >= AGG_MAX) {
            break
          }
        }
        if (seen.size >= AGG_MAX) {
          break
        }
      }

      // Convert to array and sort
      const union = Array.from(seen.values())
      try {
        union.sort((a: any, b: any) => {
          const ad = new Date(a?.created_at || a?.createdAt || 0).getTime()
          const bd = new Date(b?.created_at || b?.createdAt || 0).getTime()
          return bd - ad
        })
      } catch (_) {
        // no-op if dates are missing
      }

      // Local pagination on the union
      count = union.length
      const start = (page - 1) * PRODUCT_LIMIT
      const end = start + PRODUCT_LIMIT
      products = union.slice(start, end)
    }
  } else {
    // Single category or collection - use standard backend pagination
    const res = await listProductsWithSort({
      page,
      queryParams,
      sortBy,
      countryCode,
      productType,
    })
    products = res.response.products
    count = res.response.count
  }

  // Helpers used for client-side matching of a product against a type text
  const normalize = (val: unknown): string => {
    if (val == null) return ""
    try {
      return String(val).toLowerCase()
    } catch {
      return ""
    }
  }

  const slugify = (str: string): string =>
    str
      .toLowerCase()
      .trim()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")

  // Strict product-type matcher: only match on the product's type fields
  // Avoid fuzzy matching on title/description/tags to prevent mixing categories.
  const strictMatchesType = (p: any, needle: string): boolean => {
    const n = normalize(needle)
    // Some backends return { type: { value } }, others { product_type: { value } }
    const t = (p as any)?.type ?? (p as any)?.product_type
    if (t && typeof t === "object") {
      const v = normalize((t as any)?.value)
      const name = normalize((t as any)?.name)
      const title = normalize((t as any)?.title)
      const handle = normalize((t as any)?.handle)
      if ([v, name, title, handle].some((x) => x === n || slugify(x) === slugify(n))) {
        return true
      }
    } else if (t) {
      const tv = normalize(t)
      if (tv === n || slugify(tv) === slugify(n)) return true
    }

    // Consider an explicit metadata key if present, but do not use free-form values
    const meta = (p as any)?.metadata
    if (meta && typeof meta === "object") {
      const metaType = normalize((meta as any)["product_type"] ?? (meta as any)["type_value"]) 
      if (metaType && (metaType === n || slugify(metaType) === slugify(n))) {
        return true
      }
    }

    return false
  }

  // Apply client-side product type filtering with STRICT matching to prevent mixing types
  // Always enforce this when productType is specified to guarantee correctness, even if
  // backend also attempted filtering. Double-filtering is idempotent for exact matches.
  if (productType && Array.isArray(products) && products.length > 0) {
    const needle = productType.toLowerCase()

    // Since backend already paginated the results, applying a filter here may reduce
    // the number of visible products for this page. For correctness (no mixing), we
    // strictly filter and keep the current page size; count is adjusted conservatively.
    const before = products.length
    products = products.filter((p) => strictMatchesType(p, needle))

    // Best-effort count adjustment: if the page got filtered, lower the count accordingly.
    if (before > 0 && products.length <= before) {
      // At minimum, reflect the number of items we actually show on this page.
      if (count < products.length) {
        count = products.length
      }
    }

    if (process.env.NODE_ENV !== "production") {
      console.log(`[PaginatedProducts] Strict type filter enforced for "${productType}". Results on page: ${products.length}`)
    }
  }

  const totalPages = Math.ceil(count / PRODUCT_LIMIT)

  return (
    <>
      <ul
        className="grid grid-cols-2 w-full small:grid-cols-3 medium:grid-cols-4 large:grid-cols-5 gap-4 small:gap-6"
        data-testid="products-list"
      >
        {products.map((p) => {
          return (
            <li key={p.id}>
              <ProductPreview product={p} region={region} />
            </li>
          )
        })}
      </ul>
      {totalPages > 1 && (
        <Pagination
          data-testid="product-pagination"
          page={page}
          totalPages={totalPages}
        />
      )}
    </>
  )
}
