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

  // Some backends interpret category_id[]=A&category_id[]=B as an AND filter,
  // which drastically under-returns results (only products that belong to ALL
  // categories). To ensure Men/Women parent categories show ALL products across
  // their descendant categories, aggregate per-category and union client-side
  // when multiple categoryIds are provided.
  let products: any[] = []
  let count = 0

  if (Array.isArray(queryParams.category_id) && queryParams.category_id.length > 1) {
    if (process.env.NODE_ENV !== "production") {
      console.log(
        "[PaginatedProducts] Union path active. category_ids=",
        queryParams.category_id,
        "page=",
        page,
        "sortBy=",
        sortBy
      )
    }
    const ids = queryParams.category_id
    const AGG_LIMIT = 100
    const AGG_MAX = 800 // cap total to prevent excessive load

    const seen = new Map<string, any>()

    for (const id of ids) {
      let serverPage = 1
      let nextPage: number | null = 1
      while (nextPage) {
        const { response, nextPage: np } = await listProductsWithSort({
          page: serverPage,
          // Fetch per-category to force an OR-like union across categories
          queryParams: { ...queryParams, category_id: [id], limit: AGG_LIMIT },
          sortBy,
          countryCode,
        })
        const batch = Array.isArray(response.products) ? response.products : []
        if (process.env.NODE_ENV !== "production") {
          console.log(
            `[PaginatedProducts] Fetched ${batch.length} products for category ${id} (page ${serverPage}).`
          )
        }
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

    // Convert to array and sort by created_at desc (default storefront behavior)
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
    if (process.env.NODE_ENV !== "production") {
      console.log(
        `[PaginatedProducts] Union size after de-duplication: ${count}. Performing local pagination for page ${page}.`
      )
    }
    const start = (page - 1) * PRODUCT_LIMIT
    const end = start + PRODUCT_LIMIT
    products = union.slice(start, end)
  } else {
    // Default path: rely on backend pagination
    const res = await listProductsWithSort({
      page,
      queryParams,
      sortBy,
      countryCode,
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

  const matchesType = (p: any, needle: string): boolean => {
    const fields: string[] = []
    // Title/description/handle/subtitle
    fields.push(normalize(p?.title))
    fields.push(normalize(p?.description))
    fields.push(normalize((p as any)?.handle))
    fields.push(normalize((p as any)?.subtitle))

    // Product type fields in different shapes across backends
    const t = (p as any)?.type ?? (p as any)?.product_type
    if (t && typeof t === "object") {
      fields.push(normalize((t as any)?.value))
      fields.push(normalize((t as any)?.name))
      fields.push(normalize((t as any)?.title))
      fields.push(normalize((t as any)?.handle))
    } else if (t) {
      fields.push(normalize(t))
    }

    // Variants: titles, SKU, option values
    const variants = Array.isArray((p as any)?.variants) ? (p as any).variants : []
    for (const v of variants) {
      fields.push(normalize((v as any)?.title))
      fields.push(normalize((v as any)?.sku))
      const options = Array.isArray((v as any)?.options) ? (v as any).options : []
      for (const opt of options) {
        fields.push(normalize((opt as any)?.value))
        fields.push(normalize((opt as any)?.title))
      }
    }

    // Tags (various shapes depending on backend)
    const tags = Array.isArray(p?.tags) ? p.tags : []
    for (const t of tags) {
      fields.push(normalize((t as any)?.value))
      fields.push(normalize((t as any)?.name))
    }
    const productTags = Array.isArray((p as any)?.product_tags)
      ? (p as any).product_tags
      : []
    for (const pt of productTags) {
      fields.push(normalize((pt as any)?.value))
      fields.push(normalize((pt as any)?.name))
      fields.push(normalize((pt as any)?.tag?.value))
      fields.push(normalize((pt as any)?.tag?.name))
    }

    // Metadata keys and values
    const metadata = (p as any)?.metadata || {}
    if (metadata && typeof metadata === "object") {
      for (const key of Object.keys(metadata)) {
        fields.push(normalize(key))
        fields.push(normalize((metadata as any)[key]))
      }
    }

    // Build additional slugified variants for matching tolerant to punctuation
    const fieldSlugs = fields.map((f) => slugify(f))
    const needleSlug = slugify(needle)

    // Try simple plural/singular variants to increase recall (e.g., apparel/clothes)
    const variantsToTry = new Set<string>([needle])
    if (needle.endsWith("s")) {
      variantsToTry.add(needle.slice(0, -1))
    } else {
      variantsToTry.add(`${needle}s`)
    }
    const slugVariants = Array.from(variantsToTry).map((n) => slugify(n))

    // Plain includes or slug includes
    return (
      fields.some((f) => f && Array.from(variantsToTry).some((n) => f.includes(n))) ||
      fieldSlugs.some((fs) => fs && slugVariants.some((sn) => fs.includes(sn)))
    )
  }

  // If we're on a category or collection page and have a productType context,
  // apply a safe client-side refinement to approximate type-based filtering
  // without sending unsupported fields to the backend.
  if (productType && (collectionId || categoryId) && Array.isArray(products)) {
    const needle = productType.toLowerCase()
    products = products.filter((p) => matchesType(p, needle))
  }

  // For the generic All-products view with a selected productType, we need to
  // show ALL products belonging to that type. Since backend type filters are
  // unreliable in this setup, fetch a broader set and refine client-side, then
  // paginate locally.
  if (productType && !collectionId && !categoryId) {
    const needle = productType.toLowerCase()

    // Aggregate multiple pages to approximate "all" without sending type filters
    const AGG_LIMIT = 100 // per request
    const AGG_MAX = 400   // safety cap

    // Start by fetching a larger page to reduce round-trips
    let aggregated: any[] = []
    let serverPage = 1
    let nextPage: number | null = 1

    while (nextPage) {
      const { response, nextPage: np } = await listProductsWithSort({
        page: serverPage,
        queryParams: { ...queryParams, limit: AGG_LIMIT },
        sortBy,
        countryCode,
      })
      aggregated = aggregated.concat(response.products || [])
      nextPage = np
      serverPage = np || 0
      if (!nextPage || aggregated.length >= AGG_MAX) {
        break
      }
    }

    const filtered = aggregated.filter((p) => matchesType(p, needle))

    // Local pagination on the filtered result set
    const filteredCount = filtered.length
    const start = (page - 1) * PRODUCT_LIMIT
    const end = start + PRODUCT_LIMIT
    products = filtered.slice(start, end)
    count = filteredCount
  }

  const totalPages = Math.ceil(count / PRODUCT_LIMIT)

  return (
    <>
      <ul
        className="grid grid-cols-2 w-full small:grid-cols-3 medium:grid-cols-4 gap-x-6 gap-y-8"
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
