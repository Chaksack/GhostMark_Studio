"use server"

import { sdk } from "@lib/config"
import { HttpTypes } from "@medusajs/types"
import { getCacheOptions } from "./cookies"

export const retrieveCollection = async (id: string) => {
  const next = {
    ...(await getCacheOptions("collections")),
  }

  try {
    const { collection } = await sdk.client
      .fetch<{ collection: HttpTypes.StoreCollection }>(
        `/store/collections/${id}`,
        {
          next,
          // Avoid stale/mismatched cache in production
          cache: "no-store",
        }
      )
    return collection
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error("retrieveCollection failed, returning fallback {}:", e)
    }
    return {} as unknown as HttpTypes.StoreCollection
  }
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

  try {
    const { collections, count } = await sdk.client
      .fetch<{ collections: HttpTypes.StoreCollection[]; count: number }>(
        "/store/collections",
        {
          query: enhancedParams,
          next,
          cache: "no-store",
        }
      )
    return {
      collections: collections || [],
      count: count || (collections ? collections.length : 0),
    }
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error("listCollections failed, returning []:", e)
    }
    return { collections: [], count: 0 }
  }
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

  try {
    const { collections } = await sdk.client
      .fetch<HttpTypes.StoreCollectionListResponse>(`/store/collections`, {
        query: { handle, fields },
        next,
        cache: "no-store",
      })
    return (collections && collections[0]) as HttpTypes.StoreCollection
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error("getCollectionByHandle failed, returning undefined:", e)
    }
    return undefined as unknown as HttpTypes.StoreCollection
  }
}
