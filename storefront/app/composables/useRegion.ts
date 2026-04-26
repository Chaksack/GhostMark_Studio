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
 * Public API stays synchronous — callers continue to do
 * `const { region, ensureRegion, setRegion } = useRegion()`.
 */
export const useRegion = () => {
  const regionId = useCookie<string | null>('gms_region_id', { sameSite: 'lax' })
  const region = useState<Record<string, unknown> | null>('gms_region', () => null)

  const sdk = useMedusaClient()

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
          const match = ((res as any)?.regions?.[0] as Record<string, unknown> | undefined) || null
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

  const ensureRegion = async () => {
    if (region.value && regionId.value) return { region: region.value, regionId: regionId.value }
    try {
      // Prefer a cookie-targeted fetch when we have an id but the object
      // wasn't populated (e.g. SSR fetch failed and we're now on client).
      if (regionId.value && !region.value) {
        const targeted = await sdk.store.region.list({ id: regionId.value } as any)
        const match = ((targeted as any)?.regions?.[0] as Record<string, unknown> | undefined) || undefined
        if (match) {
          region.value = match
          return { region: match, regionId: regionId.value }
        }
      }
      const res = await sdk.store.region.list({ limit: 50 } as any)
      const regions = ((res as any)?.regions ?? []) as Array<{ id?: string }>
      const cookieMatch = regions.find(r => r.id === regionId.value)
      const first = (cookieMatch ?? regions[0]) as Record<string, unknown> & { id?: string } | undefined
      if (!first?.id) return { region: null, regionId: null }
      regionId.value = first.id
      region.value = first as unknown as Record<string, unknown>
      return { region: region.value, regionId: first.id }
    } catch {
      return { region: null, regionId: null }
    }
  }

  const setRegion = (next: (Record<string, unknown> & { id?: string }) | null) => {
    region.value = next
    regionId.value = next?.id ?? null
  }

  return { regionId, region, ensureRegion, setRegion }
}
