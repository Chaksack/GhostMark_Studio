"use server"

import { sdk } from "@lib/config"
import { getCacheOptions } from "./cookies"

export type StoreProductTypeLite = {
  id?: string
  handle: string
  title: string
}

const slugify = (str: string) =>
  (str || "")
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

/**
 * Attempts to list product types from the backend.
 * Primary attempt: GET /store/product-types (if available in your backend).
 * If the endpoint is missing or fails, returns an empty list so the caller can gracefully degrade.
 */
export const listTypes = async (
  queryParams: Record<string, string | number> = {}
): Promise<{ types: StoreProductTypeLite[]; count: number }> => {
  const next = {
    ...(await getCacheOptions("product-types")),
  }

  const qp: Record<string, string | number> = {
    limit: 100,
    offset: 0,
    ...queryParams,
  }

  try {
    // Try conventional store endpoint
    const res = await sdk.client.fetch<any>("/store/product-types", {
      method: "GET",
      query: qp,
      next,
      cache: "force-cache",
    })

    const raw: any[] =
      (res && (res.product_types || res.types || res.data || res.items)) || []

    const types: StoreProductTypeLite[] = raw
      .map((t) => {
        const id = t?.id
        const title = t?.title || t?.value || t?.name || t?.handle || "Type"
        const handle = t?.handle || slugify(title)
        return { id, title, handle }
      })
      // de-duplicate by handle
      .filter((v, i, arr) => arr.findIndex((x) => x.handle === v.handle) === i)

    return { types, count: types.length }
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("listTypes: falling back to empty due to error:", e)
    }
    return { types: [], count: 0 }
  }
}
