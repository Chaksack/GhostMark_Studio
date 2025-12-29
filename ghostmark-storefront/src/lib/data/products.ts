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
    // Optimized field selection for better performance - start with essential fields
    // and gradually add more complex joins if needed
    const fieldAttempts: (string | null)[] = customFields && customFields.trim().length
      ? [
          // Try exactly what the caller requested
          customFields,
          // Essential fields without problematic type expansion
          "*variants.calculated_price,+variants.inventory_quantity,+metadata,+options,+variants.options,+images,+type_id",
          // Add variant images
          "*variants.calculated_price,+variants.inventory_quantity,*variants.images,+metadata,+options,+variants.options,+images",
          // Basic fallback
          "*variants.calculated_price,+variants.inventory_quantity,+metadata,+options,+variants.options",
          // Fallback to no explicit fields
          null,
        ]
      : [
          // Essential fields without problematic type expansion
          "*variants.calculated_price,+variants.inventory_quantity,+metadata,+options,+variants.options,+images,+type_id",
          // Add variant images
          "*variants.calculated_price,+variants.inventory_quantity,*variants.images,+metadata,+options,+variants.options,+images",
          // Basic fallback
          "*variants.calculated_price,+variants.inventory_quantity,+metadata,+options,+variants.options",
          // Fallback to no explicit fields
          null,
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
 * Enhanced product listing with sorting and optional type filtering
 * Uses backend pagination and ordering for better performance
 */
export const listProductsWithSort = async ({
  page = 0,
  queryParams,
  sortBy = "created_at",
  countryCode,
  productType,
}: {
  page?: number
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductParams
  sortBy?: SortOptions
  countryCode: string
  productType?: string
}): Promise<{
  response: { products: HttpTypes.StoreProduct[]; count: number }
  nextPage: number | null
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductParams
}> => {
  // Use backend pagination and ordering to avoid fetching large datasets (which may time out)
  const limit = queryParams?.limit || 12

  // Build enhanced query params with optional type filtering
  let enhancedQueryParams = {
    ...queryParams,
    limit,
    // Prefer backend ordering when available; fallback to created_at
    order: (queryParams as any)?.order || (sortBy as string) || "created_at",
  }

  // Try to add type filtering at the backend level if productType is specified
  // This reduces the need for client-side filtering
  if (productType && !queryParams?.collection_id && !queryParams?.category_id) {
    // For global product type searches, try backend filtering first
    try {
      const typeFilteredParams = {
        ...enhancedQueryParams,
        type: productType,
      }
      
      const { response, nextPage: serverNextPage } = await listProducts({
        pageParam: Math.max(page, 1),
        queryParams: typeFilteredParams,
        countryCode,
      })

      // If backend filtering worked (returned some products), use it
      if (response.products.length > 0 || response.count > 0) {
        return {
          response,
          nextPage: serverNextPage,
          queryParams: typeFilteredParams,
        }
      }
    } catch (error) {
      // Backend type filtering failed, fall back to standard approach
      if (process.env.NODE_ENV !== "production") {
        console.warn("Backend type filtering failed, falling back to standard approach:", error)
      }
    }
  }

  const { response, nextPage: serverNextPage } = await listProducts({
    pageParam: Math.max(page, 1),
    queryParams: enhancedQueryParams,
    countryCode,
  })

  return {
    response,
    nextPage: serverNextPage,
    queryParams: enhancedQueryParams,
  }
}
