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
  
  // Optimize fields - only include products if specifically requested
  const defaultFields = "*category_children,*parent_category,*parent_category.parent_category"
  const fieldsWithProducts = "*category_children,*products,*parent_category,*parent_category.parent_category"
  const fields = query?.includeProducts ? fieldsWithProducts : defaultFields

  return sdk.client
    .fetch<{ product_categories: HttpTypes.StoreProductCategory[] }>(
      "/store/product-categories",
      {
        query: {
          fields,
          limit,
          ...query,
        },
        next,
        cache: "force-cache",
      }
    )
    .then(({ product_categories }) => product_categories)
}

export const getCategoryByHandle = async (
  categoryHandle: string[],
  includeProducts = false
) => {
  const handle = `${categoryHandle.join("/")}`

  const next = {
    ...(await safeGetCacheOptions("categories")),
  }

  // Optimize fields - only include products if specifically requested
  const fields = includeProducts 
    ? "*category_children,*products,*parent_category" 
    : "*category_children,*parent_category"

  return sdk.client
    .fetch<HttpTypes.StoreProductCategoryListResponse>(
      `/store/product-categories`,
      {
        query: {
          fields,
          handle,
        },
        next,
        cache: "force-cache",
      }
    )
    .then(({ product_categories }) => product_categories[0])
}
