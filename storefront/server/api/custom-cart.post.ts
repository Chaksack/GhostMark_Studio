// Server route that proxies a "customised" line-item add to Medusa.
//
// Mirrors the Next.js `addToCustomProductCart` flow: we attach the design
// payload (positions/scale/rotation + a preview URL) onto the line-item's
// `metadata` so the admin / fulfilment side can render the production proof.
//
// Cart resolution order:
//   1. body.cart_id (caller already has one)
//   2. gms_cart_id cookie (same name useCart() uses on the client)
//   3. POST /store/carts to mint a fresh cart
//
// Backend-offline degradation: if Medusa is unreachable, we return
// `{ ok: false, _offline: true, ... }` instead of a 5xx so the client can
// surface a friendly toast and the UI flow can still be exercised in dev
// without a running Medusa instance.
import {
  defineEventHandler,
  readBody,
  createError,
  getCookie,
  setCookie,
} from 'h3'

interface CustomCartBody {
  variant_id: string
  quantity?: number
  cart_id?: string | null
  region_id?: string | null
  design_data?: Record<string, unknown>
  preview_url?: string | null
}

interface MedusaCartResponse {
  cart?: { id?: string } | null
}

const baseUrl = (): string =>
  (process.env.MEDUSA_URL || 'http://localhost:9000').replace(/\/$/, '')

const pubKey = (): string => process.env.MEDUSA_PUBLISHABLE_KEY || ''

const medusaHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const key = pubKey()
  if (key) headers['x-publishable-api-key'] = key
  return headers
}

export default defineEventHandler(async (event) => {
  const body = await readBody<CustomCartBody>(event)

  if (!body?.variant_id) {
    throw createError({ statusCode: 400, statusMessage: 'variant_id required' })
  }

  const quantity = body.quantity && body.quantity > 0 ? body.quantity : 1

  try {
    let cartId: string | null =
      body.cart_id || getCookie(event, 'gms_cart_id') || null

    // Step 1 — ensure a cart exists.
    if (!cartId) {
      const createRes = await fetch(`${baseUrl()}/store/carts`, {
        method: 'POST',
        headers: medusaHeaders(),
        body: JSON.stringify(body.region_id ? { region_id: body.region_id } : {}),
      })
      if (!createRes.ok) {
        throw new Error(`Could not create cart (${createRes.status})`)
      }
      const created = (await createRes.json()) as MedusaCartResponse
      cartId = created.cart?.id ?? null
      if (cartId) {
        setCookie(event, 'gms_cart_id', cartId, {
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          path: '/',
          maxAge: 60 * 60 * 24 * 30,
        })
      }
    }

    if (!cartId) {
      throw new Error('Cart id missing after create')
    }

    // Step 2 — add line item with design metadata.
    const lineRes = await fetch(`${baseUrl()}/store/carts/${cartId}/line-items`, {
      method: 'POST',
      headers: medusaHeaders(),
      body: JSON.stringify({
        variant_id: body.variant_id,
        quantity,
        metadata: {
          isCustomized: true,
          designDataJson: JSON.stringify(body.design_data ?? {}),
          previewImageUrl: body.preview_url ?? null,
        },
      }),
    })
    if (!lineRes.ok) {
      throw new Error(`Could not add line item (${lineRes.status})`)
    }
    const result = (await lineRes.json()) as MedusaCartResponse
    return { ok: true, cart_id: cartId, cart: result.cart ?? null }
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : 'Backend unreachable'
    // Don't 5xx — surface a structured "offline" payload so the UI can
    // distinguish a Medusa outage from a real client-side bug.
    return {
      ok: false,
      error: message,
      _offline: true,
      cart_id: null,
      cart: null,
    }
  }
})
