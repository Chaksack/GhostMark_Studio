/**
 * useRegion — single source of truth for the active store region.
 *
 * SSR contract:
 *   - The selected region id is persisted in the `gms_region_id` cookie
 *     (set by `setRegion` / GeoModal). `useCookie()` is SSR-safe and
 *     returns the same value on server and client during the initial
 *     request, which lets us seed `regionId` deterministically before
 *     first paint.
 *   - When a cookie is present we issue a `sdk.store.region.list({ id })`
 *     fetch via `useAsyncData` so the resolved region object is part of
 *     the SSR payload. AppFooter (and any other component reading
 *     `region.value` during render) therefore gets the real label on the
 *     server pass — no "Choose region" → "EN · GBP" hydration swap.
 *   - The fetch is wrapped in try/catch so an offline Medusa cannot
 *     500 the page; we degrade gracefully to the "Choose region" copy.
 *
 * Public API:
 *   - `regionId`        — reactive cookie ref (string | null)
 *   - `region`          — active region object (or null)
 *   - `regions`         — computed list of all live regions (cached)
 *   - `loadRegions()`   — idempotent fetch of the full region catalogue
 *   - `ensureRegion()`  — resolves the active region (cookie → first → null)
 *   - `setRegion(idOrObj)` — switches active region; updates cookie + cart
 *
 * Notes:
 *   - Zero hardcoded fallbacks. If Medusa is offline the resolved region is
 *     `null` and the UI degrades to its "Choose region" copy. This is the
 *     correct posture: faking a region with a stale id corrupts pricing.
 *   - `setRegion` issues a best-effort `sdk.store.cart.update(cartId, { region_id })`
 *     when a cart cookie exists so prices, currency, and tax recompute
 *     in lockstep. Failure is swallowed (the cookie still flips and the
 *     next cart read picks up the change).
 */
import type { StoreRegion } from '@medusajs/types'

type RegionLike = (Record<string, unknown> & { id?: string }) | StoreRegion

const REGION_COOKIE = 'gms_region_id'
const CART_COOKIE = 'gms_cart_id'

export const useRegion = () => {
  const regionId = useCookie<string | null>(REGION_COOKIE, { sameSite: 'lax' })
  const region = useState<StoreRegion | null>('gms_region', () => null)
  const regionsList = useState<StoreRegion[]>('gms_regions', () => [])
  const loaded = useState<boolean>('gms_regions_loaded', () => false)

  const sdk = useMedusaClient()

  // Computed view onto the cached catalogue — keeps callers reactive even
  // when `loadRegions` resolves later.
  const regions = computed<StoreRegion[]>(() => regionsList.value)

  // SSR seed: when a cookie is present and we don't yet have a hydrated
  // region object in `useState`, fetch it through `useAsyncData` so the
  // result is serialized into the SSR payload and replayed on the client
  // without a second network round-trip.
  if (import.meta.server && regionId.value && !region.value) {
    const cookieValue = regionId.value
    // `useAsyncData` is sync-callable; Nuxt awaits the underlying promise
    // before flushing the SSR response, so `region.value` is populated by
    // the time `<AppFooter>` (or any consumer) renders.
    useAsyncData(
      `gms_region:${cookieValue}`,
      async () => {
        try {
          const res = await sdk.store.region.list({ id: cookieValue } as any)
          const match = ((res as any)?.regions?.[0] as StoreRegion | undefined) || null
          if (match) region.value = match
          return match
        } catch {
          // Offline / 5xx — keep `region` null so the UI degrades to the
          // "Choose region" fallback rather than throwing.
          return null
        }
      },
      { server: true, lazy: false },
    )
  }

  /**
   * loadRegions — idempotent fetch of the full region catalogue.
   * Safe to call from every component; only hits the network on first call
   * per session (or when `force` is true).
   */
  const loadRegions = async (force = false): Promise<StoreRegion[]> => {
    if (loaded.value && !force && regionsList.value.length) return regionsList.value
    try {
      const res = await sdk.store.region.list({ limit: 50 } as any)
      const next = (((res as any)?.regions ?? []) as StoreRegion[])
      regionsList.value = next
      loaded.value = true
      // Opportunistically populate the active region object if we have a
      // cookie id but no resolved object yet (covers the case where SSR
      // fetch failed and the client is making its first round-trip).
      if (regionId.value && !region.value) {
        const match = next.find(r => (r as any).id === regionId.value)
        if (match) region.value = match
      }
      return next
    } catch {
      return regionsList.value
    }
  }

  const ensureRegion = async () => {
    if (region.value && regionId.value) return { region: region.value, regionId: regionId.value }
    try {
      // Prefer a cookie-targeted fetch when we have an id but the object
      // wasn't populated (e.g. SSR fetch failed and we're now on client).
      if (regionId.value && !region.value) {
        const targeted = await sdk.store.region.list({ id: regionId.value } as any)
        const match = ((targeted as any)?.regions?.[0] as StoreRegion | undefined) || undefined
        if (match) {
          region.value = match
          return { region: match, regionId: regionId.value }
        }
      }
      const list = await loadRegions()
      const cookieMatch = list.find(r => (r as any).id === regionId.value)
      const first = (cookieMatch ?? list[0]) as (StoreRegion & { id?: string }) | undefined
      if (!first?.id) return { region: null, regionId: null }
      regionId.value = first.id
      region.value = first
      return { region: region.value, regionId: first.id }
    } catch {
      return { region: null, regionId: null }
    }
  }

  /**
   * setRegion — switch the active region.
   *
   * Accepts either a region id string (RegionSelector) or a region object
   * (legacy GeoModal path) for backwards compatibility. Writes the cookie,
   * updates the in-memory `region` ref, and best-effort patches the cart's
   * region_id so prices recompute against the new region.
   *
   * Returns the resolved region object (or null on failure).
   */
  const setRegion = async (next: string | RegionLike | null): Promise<StoreRegion | null> => {
    if (next == null) {
      region.value = null
      regionId.value = null
      return null
    }

    // Normalize input: string id → resolve from cached catalogue; object → use as-is.
    let resolved: StoreRegion | null = null
    if (typeof next === 'string') {
      const list = regionsList.value.length ? regionsList.value : await loadRegions()
      resolved = list.find(r => (r as any).id === next) ?? null
    } else {
      resolved = next as StoreRegion
    }
    if (!resolved || !(resolved as any).id) return null

    region.value = resolved
    regionId.value = (resolved as any).id

    // Best-effort cart region sync. If no cart exists yet, the next
    // `useCart().getOrCreateCart()` call will create one in the new region.
    if (import.meta.client) {
      try {
        const cartId = useCookie<string | null>(CART_COOKIE).value
        if (cartId) {
          await sdk.store.cart.update(cartId, { region_id: (resolved as any).id } as any)
        }
      } catch {
        // Swallow — cookie flip is authoritative; next cart read picks it up.
      }
    }

    return resolved
  }

  return { regionId, region, regions, loadRegions, ensureRegion, setRegion }
}
