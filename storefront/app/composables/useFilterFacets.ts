/**
 * useFilterFacets — single-flight facet harvester for PLP filter pills.
 *
 * The merchery filter bar shows Category / Color / Brand pills whose option
 * sets used to be hardcoded in `utils/filters.ts`. The live Medusa catalogue
 * publishes its own taxonomy through `product_categories`, variant option
 * values, and (eventually) product metadata / tags. This composable harvests
 * those values once per app boot and surfaces them as `{ value, label }`
 * tuples — the exact shape `<FilterPill>` already consumes, so the static
 * `filterOptions` import can be swapped for a live source without touching
 * the JSX.
 *
 * Why a sample, not a full crawl:
 *   Medusa v2's Store API doesn't expose a dedicated facet endpoint, so the
 *   only way to enumerate variant option values catalog-wide is to walk
 *   products. We cap the sample at 200 — large enough to cover the current
 *   24-product catalogue with headroom, small enough to stay inside the SSR
 *   budget (one round-trip, no pagination). If/when the catalogue grows past
 *   a few hundred SKUs this becomes paged or moved to a custom Store API
 *   route that aggregates server-side. The dedupe is set-backed so the
 *   storage cost stays linear in unique values, not total products.
 *
 * Resolution strategy:
 *   1. Categories — `sdk.store.category.list({ parent_category_id: null })`
 *      returns the live root tier. We surface `handle` as the value and
 *      `name` as the label so the URL stays human-readable.
 *   2. Color — walk the product sample, find each product's option titled
 *      `/colou?r/i` (Medusa's option titles are author-controlled, both
 *      spellings allowed), collect the unique `values[].value` strings.
 *   3. Brand — prefer `product.metadata.brand` (explicit author intent);
 *      fall back to short title-case `tags[].value` strings. The heuristic
 *      is deliberately conservative — generic descriptors like `cotton` or
 *      `organic` are excluded by the leading-uppercase / TitleCase regex.
 *      KNOWN RISK: a tag like `Cotton` would still match. Acceptable until
 *      brands get a proper field.
 *
 * SSR contract:
 *   - State lives on `useState` so the server-resolved facets replay onto
 *     the client without a re-fetch.
 *   - Inflight promise is also held in `useState` so two concurrent
 *     `ensureResolved()` calls (e.g. two PLPs mid-navigation) share one
 *     network round-trip.
 *   - No `window` / `document` access — safe in the node renderer.
 *   - On error we mark `resolved = true` anyway so a backend outage doesn't
 *     trigger an infinite retry loop on every page navigation; callers fall
 *     back to the static `filterOptions` baked into `utils/filters.ts`.
 */

import type { ComputedRef } from 'vue'

export interface FilterFacet {
  /** Machine-readable value used in query strings & filter logic. */
  value: string
  /** Display label rendered inside the pill option list. */
  label: string
  /** Optional product count — reserved for future facet-count UX. */
  count?: number
}

export interface FilterFacets {
  category: FilterFacet[]
  color: FilterFacet[]
  brand: FilterFacet[]
}

interface FilterFacetsState {
  facets: FilterFacets
  resolved: boolean
  error: string | null
}

export interface UseFilterFacetsReturn {
  facets: ComputedRef<FilterFacets>
  ensureResolved: () => Promise<FilterFacets>
  error: ComputedRef<string | null>
}

/** Empty facet set used as the initial `useState` seed. */
const emptyFacets = (): FilterFacets => ({ category: [], color: [], brand: [] })

/** Convert a free-form display label into a URL-safe machine value. */
const slugify = (raw: string): string =>
  raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

/**
 * Heuristic test for "this tag looks like a brand name" — short string that
 * starts with an uppercase letter or contains an internal capital. Excludes
 * lowercase descriptors (`cotton`, `organic`) and overly long marketing
 * phrases. False positives (e.g. `Cotton`) are tolerated until brand gets a
 * dedicated field on the product model.
 */
const looksLikeBrand = (raw: string): boolean => {
  if (typeof raw !== 'string') return false
  const v = raw.trim()
  if (!v || v.length > 40) return false
  return /^[A-Z]/.test(v) || /[A-Z][a-z]+/.test(v)
}

export const useFilterFacets = (): UseFilterFacetsReturn => {
  const state = useState<FilterFacetsState>('gms_filter_facets', () => ({
    facets: emptyFacets(),
    resolved: false,
    error: null,
  }))

  // Mirrors `useProductTypes`: a single-flight promise stored on `useState`
  // so concurrent callers share one resolution pass instead of racing.
  const inflight = useState<Promise<FilterFacets> | null>(
    'gms_filter_facets_inflight',
    () => null,
  )

  const resolve = async (): Promise<FilterFacets> => {
    const sdk = useMedusaClient() as unknown as {
      store: {
        category: {
          list: (args: Record<string, unknown>) => Promise<{
            product_categories?: Array<{
              id?: unknown
              name?: unknown
              handle?: unknown
              parent_category_id?: unknown
            }>
          }>
        }
        product: {
          list: (args: Record<string, unknown>) => Promise<{
            products?: Array<{
              options?: Array<{
                title?: unknown
                values?: Array<{ value?: unknown } | string>
              }>
              metadata?: Record<string, unknown> | null
              tags?: Array<{ value?: unknown } | string>
            }>
          }>
        }
      }
    }

    const next: FilterFacets = emptyFacets()

    // 1. Live categories. We surface only the root tier so the pill list
    //    matches the user's mental model — "where do I start browsing" — not
    //    every leaf. Sub-categories belong on the category page, not the
    //    global filter bar.
    try {
      const catRes = await sdk.store.category.list({
        limit: 100,
        fields: 'id,name,handle,parent_category_id',
      })
      const cats = catRes.product_categories ?? []
      next.category = cats
        .filter(c => !c.parent_category_id)
        .map<FilterFacet | null>((c) => {
          const handle = typeof c.handle === 'string' ? c.handle : null
          const name = typeof c.name === 'string' ? c.name : null
          if (!handle || !name) return null
          return { value: handle, label: name }
        })
        .filter((c): c is FilterFacet => Boolean(c))
    }
    catch {
      // Categories endpoint down — leave the array empty so the caller
      // falls back to the static taxonomy.
    }

    // 2. Color + brand harvest from a single moderate product sample. One
    //    round-trip, dedupe-as-we-go via Sets so the storage cost stays
    //    bounded.
    try {
      const sampleRes = await sdk.store.product.list({
        limit: 200,
        fields: 'id,*options.title,*options.values.value,metadata,*tags.value',
      })
      const products = sampleRes.products ?? []

      const colorSet = new Set<string>()
      const brandSet = new Set<string>()

      for (const p of products) {
        // Color: case-insensitive title match, both UK ("colour") and US
        // ("color") spellings allowed because Medusa option titles are
        // author-controlled.
        const colorOpt = (p.options ?? []).find((o) => {
          const t = typeof o?.title === 'string' ? o.title : ''
          return /^colou?r$/i.test(t.trim())
        })
        if (colorOpt) {
          for (const v of (colorOpt.values ?? [])) {
            const raw = typeof v === 'string' ? v : (typeof v?.value === 'string' ? v.value : '')
            const trimmed = raw.trim()
            if (trimmed) colorSet.add(trimmed)
          }
        }

        // Brand precedence: explicit `metadata.brand` first (highest
        // confidence), then fall through to tag heuristic.
        const meta = p.metadata
        if (meta && typeof meta === 'object') {
          const metaBrand = (meta as Record<string, unknown>).brand
          if (typeof metaBrand === 'string' && metaBrand.trim()) {
            brandSet.add(metaBrand.trim())
          }
        }
        for (const t of (p.tags ?? [])) {
          const raw = typeof t === 'string' ? t : (typeof t?.value === 'string' ? t.value : '')
          if (looksLikeBrand(raw)) brandSet.add(raw.trim())
        }
      }

      // Sort alphabetically for stable UX — pills shouldn't reshuffle on
      // every navigation. Lowercase slug is the storage value; original
      // casing is the display label.
      next.color = [...colorSet]
        .sort((a, b) => a.localeCompare(b))
        .map(label => ({ value: slugify(label), label }))
      next.brand = [...brandSet]
        .sort((a, b) => a.localeCompare(b))
        .map(label => ({ value: slugify(label), label }))
    }
    catch (err) {
      // Re-throw so `ensureResolved` records the error on state — categories
      // may still have succeeded above and are preserved in `next`.
      const message = err instanceof Error ? err.message : 'Facet harvest failed'
      state.value.facets = next
      throw new Error(message)
    }

    return next
  }

  const ensureResolved = async (): Promise<FilterFacets> => {
    if (state.value.resolved) return state.value.facets
    if (inflight.value) return inflight.value

    const promise = (async () => {
      try {
        const facets = await resolve()
        state.value.facets = facets
        state.value.error = null
        return facets
      }
      catch (err) {
        const message = err instanceof Error ? err.message : 'Facet resolution failed'
        state.value.error = message
        return state.value.facets
      }
      finally {
        // Mark resolved even on failure: a transient outage shouldn't
        // re-fetch on every page navigation. The error field flags the
        // failure for any caller that wants to observe it.
        state.value.resolved = true
        inflight.value = null
      }
    })()

    inflight.value = promise
    return promise
  }

  return {
    facets: computed(() => state.value.facets),
    ensureResolved,
    error: computed(() => state.value.error),
  }
}
