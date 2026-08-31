import { ref, watch } from 'vue'
import type { StoreProduct } from '@medusajs/types'

/**
 * useSearch: debounced product search backed by Medusa's
 * `GET /store/products?q=...` endpoint.
 *
 * Why a hand-rolled debounce instead of `@vueuse/core`'s `useDebounceFn`?
 *   - `useDebounceFn` lives in `@vueuse/shared`, which `@vueuse/core` consumes
 *     internally but does not re-export. Importing it directly would couple
 *     us to a transitive dep that isn't hoisted under pnpm's strict layout.
 *     A 12-line local debounce is safer, fully typed, and SSR-inert.
 *
 * Failure mode (frontend-only / backend down):
 *   - Any error from the SDK is captured into `error` and `results` is reset
 *     to `[]`. The dropdown will render the empty state ("No products
 *     match.") rather than throwing.
 *
 * Usage:
 *   const { query, results, loading, error } = useSearch()
 *   <input v-model="query" />
 *   // query mutations are debounced (250ms) before the SDK call fires.
 */

export const useSearch = () => {
  const sdk = useMedusaClient()
  const regionState = useRegion()

  const query = ref<string>('')
  const results = ref<StoreProduct[]>([])
  const loading = ref<boolean>(false)
  const error = ref<Error | null>(null)

  // Track the latest pending request so out-of-order responses (slow request
  // resolves AFTER a faster, newer one) can be discarded. Without this, a
  // user typing "tshi" -> "tshirt" can end up showing "tshi" results.
  let requestId = 0

  const runSearch = async (q: string): Promise<void> => {
    const trimmed = q.trim()
    if (trimmed.length < 2) {
      results.value = []
      loading.value = false
      error.value = null
      return
    }

    const myId = ++requestId
    loading.value = true
    error.value = null

    try {
      // Make sure a region is resolved so `calculated_price` is populated on
      // every variant. Without `region_id` the SDK can return null prices on
      // catalogues with no default-region pricing context.
      await regionState.ensureRegion()
      const res = await sdk.store.product.list({
        q: trimmed,
        limit: 8,
        fields: 'id,handle,title,subtitle,description,thumbnail,*images,*variants.calculated_price,*variants.options.value,*options.values,metadata,*tags',
        ...(regionState.regionId.value ? { region_id: regionState.regionId.value } : {}),
      } as any)
      // Drop the response if a newer query has been issued in the meantime.
      if (myId !== requestId) return
      results.value = res.products ?? []
    }
    catch (e) {
      if (myId !== requestId) return
      error.value = e instanceof Error ? e : new Error(String(e))
      results.value = []
    }
    finally {
      if (myId === requestId) loading.value = false
    }
  }

  // Minimal trailing-edge debounce: clears the pending timer on every new
  // input and only fires `runSearch` after the user has paused for `delay` ms.
  const DEBOUNCE_MS = 250
  let timer: ReturnType<typeof setTimeout> | null = null

  watch(query, (next) => {
    if (timer) clearTimeout(timer)

    // Clear results immediately when the input is emptied so the dropdown
    // collapses without waiting for the debounce window.
    if (!next || next.trim().length < 2) {
      results.value = []
      loading.value = false
      error.value = null
      return
    }

    // Surface the loading state during the debounce window so the UI shows
    // immediate feedback rather than a 250ms dead zone.
    loading.value = true

    timer = setTimeout(() => {
      void runSearch(next)
    }, DEBOUNCE_MS)
  })

  return { query, results, loading, error }
}
