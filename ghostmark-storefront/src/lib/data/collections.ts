"use server"

import { sdk } from "@lib/config"
import { HttpTypes } from "@medusajs/types"
import { getCacheOptions } from "./cookies"

export const retrieveCollection = async (id: string) => {
  const next = {
    ...(await getCacheOptions("collections")),
  }

  return sdk.client
    .fetch<{ collection: HttpTypes.StoreCollection }>(
      `/store/collections/${id}`,
      {
        next,
        cache: "force-cache",
      }
    )
    .then(({ collection }) => collection)
}

export const listCollections = async (
  queryParams: Record<string, string> = {}
): Promise<{ collections: HttpTypes.StoreCollection[]; count: number }> => {
  const next = {
    ...(await getCacheOptions("collections")),
  }

  // Set defaults and ensure we get essential fields
  const enhancedParams = {
    limit: "100",
    offset: "0",
    fields: "id,handle,title,description,metadata",
    ...queryParams,
  }

  return sdk.client
    .fetch<{ collections: HttpTypes.StoreCollection[]; count: number }>(
      "/store/collections",
      {
        query: enhancedParams,
        next,
        cache: "force-cache",
      }
    )
    .then(({ collections, count }) => ({ 
      collections, 
      count: count || collections.length 
    }))
}

export const getCollectionByHandle = async (
  handle: string,
  includeProducts = false
): Promise<HttpTypes.StoreCollection> => {
  const next = {
    ...(await getCacheOptions("collections")),
  }

  // Optimize fields - only include products if specifically requested
  const fields = includeProducts 
    ? "id,handle,title,description,metadata,*products" 
    : "id,handle,title,description,metadata"

  return sdk.client
    .fetch<HttpTypes.StoreCollectionListResponse>(`/store/collections`, {
      query: { handle, fields },
      next,
      cache: "force-cache",
    })
    .then(({ collections }) => collections[0])
}
