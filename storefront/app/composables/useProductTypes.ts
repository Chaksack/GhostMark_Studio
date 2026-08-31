/**
 * useProductTypes: single-flight resolver for Medusa product-type IDs.
 *
 * Why this exists:
 *   Medusa's Store API filters product lists by `type_id`, but our taxonomy is
 *   authored against the human-friendly `type.value` slug (`apparel`, `pod`).
 *   Every PLP / type-aware fetch needs the slug→id bridge. This composable
 *   resolves the lookup once per app boot and shares the result via `useState`
 *   so SSR and CSR see the same map.
 *
 * Resolution strategy (cheapest-first):
 *   1. Try `sdk.store.productType.list()`: the dedicated endpoint. Per
 *      Medusa v2 docs this is officially an admin-only route, but some
 *      Medusa builds (and our custom Store API extension surface) expose it,
 *      so we attempt it defensively and fall through on 404 / undefined.
 *   2. Fallback: harvest `type` from a small product list with `*type`
 *      expanded. Capped at one round-trip (20–50 products) so SSR budget
 *      stays predictable: the catalogue's only 2 commerce types today
 *      (`apparel`, `pod`).
 *   3. If both fail, leave the cache empty and surface the error. Callers
 *      that depend on a specific type ID should fall back to client-side
 *      filtering on `type.value`.
 *
 * SSR contract:
 *   - `useState` is replayed across SSR → CSR, so once the server resolves
 *     the map the client never re-fetches.
 *   - No `window` / `document` access: pure SDK calls, safe in node.
 */

import type { ComputedRef } from 'vue'

export interface ProductTypeMap {
  apparel?: string
  pod?: string
}

interface ProductTypeState {
  map: ProductTypeMap
  resolved: boolean
  error: string | null
}

export interface UseProductTypesReturn {
  ensureResolved: () => Promise<ProductTypeMap>
  apparelId: ComputedRef<string | undefined>
  podId: ComputedRef<string | undefined>
  map: ComputedRef<ProductTypeMap>
  error: ComputedRef<string | null>
}

export const useProductTypes = (): UseProductTypesReturn => {
  const state = useState<ProductTypeState>('gms_product_types', () => ({
    map: {},
    resolved: false,
    error: null,
  }))

  // In-flight promise dedupe: if `ensureResolved` is invoked from two
  // concurrent async contexts (e.g. two pages mid-navigation) we want both
  // to await the same network round-trip rather than racing duplicate
  // requests. Stored on the same `useState` so SSR replay is consistent.
  const inflight = useState<Promise<ProductTypeMap> | null>(
    'gms_product_types_inflight',
    () => null,
  )

  const assignFromTypes = (types: Array<{ id?: unknown, value?: unknown }>): ProductTypeMap => {
    const map: ProductTypeMap = {}
    for (const t of types) {
      const id = typeof t?.id === 'string' ? t.id : undefined
      const v = typeof t?.value === 'string' ? t.value.toLowerCase() : undefined
      if (!id || !v) continue
      if (v === 'apparel' && !map.apparel) map.apparel = id
      else if (v === 'pod' && !map.pod) map.pod = id
    }
    return map
  }

  const resolve = async (): Promise<ProductTypeMap> => {
    const sdk = useMedusaClient() as unknown as {
      store: {
        product: { list: (args: Record<string, unknown>) => Promise<{ products?: Array<{ type?: { id?: unknown, value?: unknown } }> }> }
        productType?: { list?: (args: Record<string, unknown>) => Promise<{ product_types?: Array<{ id?: unknown, value?: unknown }> }> }
      }
    }

    // 1. Preferred path: dedicated product-types endpoint.
    try {
      const list = sdk?.store?.productType?.list
      if (typeof list === 'function') {
        const res = await list({ limit: 50 })
        const types = res?.product_types ?? []
        if (types.length) {
          const map = assignFromTypes(types)
          if (Object.keys(map).length) return map
        }
      }
    }
    catch {
      // Endpoint not exposed on Store API: fall through.
    }

    // 2. Fallback: harvest from a small product page with `*type` expanded.
    try {
      const sample = await sdk.store.product.list({ limit: 20, fields: 'id,*type' })
      const types = (sample.products ?? [])
        .map(p => p?.type)
        .filter((t): t is { id?: unknown, value?: unknown } => Boolean(t))
      return assignFromTypes(types)
    }
    catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to resolve product types'
      throw new Error(message)
    }
  }

  const ensureResolved = async (): Promise<ProductTypeMap> => {
    if (state.value.resolved) return state.value.map
    if (inflight.value) return inflight.value

    const promise = (async () => {
      try {
        const map = await resolve()
        state.value.map = map
        state.value.error = null
        return map
      }
      catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to resolve product types'
        state.value.error = message
        return state.value.map
      }
      finally {
        state.value.resolved = true
        inflight.value = null
      }
    })()

    inflight.value = promise
    return promise
  }

  return {
    ensureResolved,
    apparelId: computed(() => state.value.map.apparel),
    podId: computed(() => state.value.map.pod),
    map: computed(() => state.value.map),
    error: computed(() => state.value.error),
  }
}
