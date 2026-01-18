"use server"

import { sdk } from "@lib/config"
import { HttpTypes } from "@medusajs/types"
import { getCacheOptions } from "./cookies"

export const listProductTypes = async (
  queryParams: Record<string, string> = {}
): Promise<{ product_types: HttpTypes.StoreProductType[]; count: number }> => {
  const next = {
    ...(await getCacheOptions("product-types")),
  }

  // Set defaults and ensure we get essential fields
  const enhancedParams = {
    limit: "100",
    offset: "0",
    fields: "id,value,metadata",
    ...queryParams,
  }

  return sdk.client
    .fetch<{ product_types: HttpTypes.StoreProductType[]; count: number }>(
      "/store/product-types",
      {
        query: enhancedParams,
        next,
        cache: "force-cache",
      }
    )
    .then(({ product_types, count }) => ({ 
      product_types, 
      count: count || product_types.length 
    }))
}

export const getProductTypeByValue = async (
  value: string
): Promise<HttpTypes.StoreProductType | null> => {
  const next = {
    ...(await getCacheOptions("product-types")),
  }

  try {
    const response = await sdk.client
      .fetch<{ product_types: HttpTypes.StoreProductType[] }>("/store/product-types", {
        query: { 
          value: value.toLowerCase(),
          fields: "id,value,metadata",
          limit: "1"
        },
        next,
        cache: "force-cache",
      })

    return response.product_types[0] || null
  } catch (error) {
    console.warn(`Failed to fetch product type for value "${value}":`, error)
    return null
  }
}

/**
 * Get all available product types for use in filters
 */
export const getProductTypesForFilter = async (): Promise<string[]> => {
  try {
    const { product_types } = await listProductTypes({ limit: "200" })
    return product_types
      .map(type => type.value)
      .filter(Boolean)
      .sort()
  } catch (error) {
    console.warn("Failed to fetch product types for filter:", error)
    return []
  }
}