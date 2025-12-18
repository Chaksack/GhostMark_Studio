"use server"

import { sdk } from "@lib/config"
import { sortProducts } from "@lib/util/sort-products"
import { HttpTypes } from "@medusajs/types"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import { getAuthHeaders, getCacheOptions } from "./cookies"
import { getRegion, retrieveRegion } from "./regions"

export const listProducts = async ({
  pageParam = 1,
  queryParams,
  countryCode,
  regionId,
}: {
  pageParam?: number
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductListParams
  countryCode?: string
  regionId?: string
}): Promise<{
  response: { products: HttpTypes.StoreProduct[]; count: number }
  nextPage: number | null
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductListParams
}> => {
  if (!countryCode && !regionId) {
    throw new Error("Country code or region ID is required")
  }

  const limit = queryParams?.limit || 12
  const _pageParam = Math.max(pageParam, 1)
  const offset = _pageParam === 1 ? 0 : (_pageParam - 1) * limit

  let region: HttpTypes.StoreRegion | undefined | null

  if (countryCode) {
    region = await getRegion(countryCode)
  } else {
    region = await retrieveRegion(regionId!)
  }

  if (!region) {
    return {
      response: { products: [], count: 0 },
      nextPage: null,
    }
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  const next = {
    ...(await getCacheOptions("products")),
  }

  try {
    // Respect caller-supplied `fields` (e.g., PDP needs options/variants.options)
    const customFields = (queryParams as any)?.fields as string | undefined
    // Build a retry mechanism that starts with the safest request first to avoid
    // MikroORM joined filter issues on some backends. We gradually increase richness.
    const fieldAttempts: (string | null)[] = customFields && customFields.trim().length
      ? [
          // Try exactly what the caller requested
          customFields,
          // Then try with no explicit fields to let backend defaults apply
          null,
          // Then a minimal essential set
          "*variants.calculated_price,+metadata",
          // Then add common variant fields still considered safe
          "*variants.calculated_price,+variants.inventory_quantity,*variants.images,+metadata,+tags",
          // Last resort (most join heavy) — include product_tags joins which some setups can't handle
          "*variants.calculated_price,+variants.inventory_quantity,*variants.images,+metadata,+tags,+product_tags,+product_tags.tag",
        ]
      : [
          // Start safest: omit fields entirely
          null,
          // Minimal essentials (price + metadata)
          "*variants.calculated_price,+metadata",
          // Add images/inventory and tags (but avoid product_tags join)
          "*variants.calculated_price,+variants.inventory_quantity,*variants.images,+metadata,+tags",
          // Heaviest last: include product_tags join shapes that may cause 500s
          "*variants.calculated_price,+variants.inventory_quantity,*variants.images,+metadata,+tags,+product_tags,+product_tags.tag",
        ]

    let lastError: any = null
    for (const fieldsAttempt of fieldAttempts) {
      try {
        const { products, count } = await sdk.client.fetch<{
          products: HttpTypes.StoreProduct[]
          count: number
        }>(`/store/products`, {
          method: "GET",
          query: {
            limit,
            offset,
            region_id: region?.id,
            // Never forward `expand` as the backend rejects it in this setup
            ...((() => {
              const qp: any = queryParams || {}
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const { expand: _omitExpand, fields: _omitFields, ...rest } = qp
              return rest
            })()),
            ...(fieldsAttempt ? { fields: fieldsAttempt } : {}),
          },
          headers,
          next,
          cache: "force-cache",
        })

        const nextPage = count > offset + limit ? pageParam + 1 : null

        return {
          response: {
            products,
            count,
          },
          nextPage: nextPage,
          queryParams,
        }
      } catch (e: any) {
        lastError = e
        const status: number | undefined = e?.response?.status || e?.status
        const code: number | string | undefined = e?.code
        const name: string | undefined = e?.name
        const retriable =
          (typeof status === "number" && status >= 500) ||
          code === 23 || // TimeoutError code seen in logs
          (typeof name === "string" && /Timeout/i.test(name))

        if (!retriable) {
          // Do not keep retrying for 4xx etc.
          break
        }
        // Otherwise, continue to next fieldsAttempt
      }
    }

    // If we reach here, all attempts failed
    if (process.env.NODE_ENV !== "production") {
      console.error("Failed to list products after retries:", lastError)
    }
    return {
      response: { products: [], count: 0 },
      nextPage: null,
      queryParams,
    }
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      // Surface details in development to help diagnose backend/query issues
      console.error("Failed to list products:", e)
    }
    // Fail gracefully by returning an empty result set to avoid runtime crashes
    return {
      response: { products: [], count: 0 },
      nextPage: null,
      queryParams,
    }
  }
}

/**
 * This will fetch 100 products to the Next.js cache and sort them based on the sortBy parameter.
 * It will then return the paginated products based on the page and limit parameters.
 */
export const listProductsWithSort = async ({
  page = 0,
  queryParams,
  sortBy = "created_at",
  countryCode,
}: {
  page?: number
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductParams
  sortBy?: SortOptions
  countryCode: string
}): Promise<{
  response: { products: HttpTypes.StoreProduct[]; count: number }
  nextPage: number | null
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductParams
}> => {
  // Use backend pagination and ordering to avoid fetching large datasets (which may time out)
  const limit = queryParams?.limit || 12

  const { response, nextPage: serverNextPage } = await listProducts({
    pageParam: Math.max(page, 1),
    queryParams: {
      ...queryParams,
      limit,
      // Prefer backend ordering when available; fallback to created_at
      order: (queryParams as any)?.order || (sortBy as string) || "created_at",
    },
    countryCode,
  })

  return {
    response,
    nextPage: serverNextPage,
    queryParams,
  }
}
