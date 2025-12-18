"use client"

/**
 * Client-side helper for adding a customized product line item to the Medusa cart.
 * This wraps the Next.js API route /api/custom-cart, which safely executes
 * server-only logic (auth headers, Medusa SDK access) on the server.
 */
export type DesignMetadata = {
  designDataJson: string
  previewImageUrl: string
  isCustomized: true
  // allow any additional fields
  [key: string]: unknown
}

export async function addToCustomProductCart(
  params: {
    cartId?: string
    variantId: string
    designMetadata: DesignMetadata
    quantity?: number
    countryCode?: string
  }
): Promise<void> {
  const { cartId, variantId, designMetadata, quantity = 1, countryCode } = params || ({} as any)

  if (!variantId) {
    throw new Error("variantId is required")
  }
  if (!designMetadata || typeof designMetadata !== "object") {
    throw new Error("designMetadata is required and must be an object")
  }

  const res = await fetch('/api/custom-cart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cartId, variantId, designMetadata, quantity, countryCode }),
  })

  if (!res.ok) {
    let message = `Failed to add customized item to cart (${res.status})`
    try {
      const j = await res.json()
      if (j?.message) message = j.message
    } catch {
      // ignore JSON parse errors
    }
    throw new Error(message)
  }
}
