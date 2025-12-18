import { sdk } from "@lib/config"
import { HttpTypes } from "@medusajs/types"

// IMPORTANT: Do not statically import server-only utilities here.
// This module is consumed by Client Components (e.g., Nav), and a static
// import of next/headers (via ./cookies) will break the client bundle.
// Instead, use a tiny dynamic helper that only imports server utilities
// on the server and returns a no-op on the client.
async function safeGetCacheOptions(tag: string): Promise<{ tags: string[] } | {}> {
  if (typeof window !== "undefined") {
    return {}
  }
  try {
    const mod = await import("./cookies")
    return await mod.getCacheOptions(tag)
  } catch {
    return {}
  }
}

export const listCategories = async (query?: Record<string, any>) => {
  const next = {
    ...(await safeGetCacheOptions("categories")),
  }

  const limit = query?.limit || 100

  return sdk.client
    .fetch<{ product_categories: HttpTypes.StoreProductCategory[] }>(
      "/store/product-categories",
      {
        query: {
          fields:
            "*category_children, *products, *parent_category, *parent_category.parent_category",
          limit,
          ...query,
        },
        next,
        cache: "force-cache",
      }
    )
    .then(({ product_categories }) => product_categories)
}

export const getCategoryByHandle = async (categoryHandle: string[]) => {
  const handle = `${categoryHandle.join("/")}`

  const next = {
    ...(await safeGetCacheOptions("categories")),
  }

  return sdk.client
    .fetch<HttpTypes.StoreProductCategoryListResponse>(
      `/store/product-categories`,
      {
        query: {
          fields: "*category_children, *products",
          handle,
        },
        next,
        cache: "force-cache",
      }
    )
    .then(({ product_categories }) => product_categories[0])
}
