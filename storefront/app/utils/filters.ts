/**
 * Shared filter taxonomy for the merchery PLP filter bar.
 *
 * STATIC + LIVE COEXISTENCE
 * -------------------------
 * Two exports live in this file and they are intentionally NOT redundant:
 *
 *   1. `filterOptions`: the original static lists. These are still imported
 *      directly by every PLP (`/products`, `/categories/*`, `/collections/*`,
 *      `/shop`). The values are the hard-coded baseline / fallback used when
 *      the backend has nothing to say (e.g. SSR before `ensureResolved()`,
 *      a Medusa outage, or an empty catalogue).
 *
 *   2. `useFilterOptions()`: the live composable. Wraps `useFilterFacets`
 *      and returns the same `{ category, price, quantity, leadTime, color,
 *      brand, sort }` shape, but with `category | color | brand` populated
 *      from Medusa when data exists. Pages can migrate at their own pace by
 *      switching:
 *        - import { filterOptions }  from '~/utils/filters'
 *        + const { liveOptions, ensureResolved } = useFilterOptions()
 *        + await ensureResolved()
 *
 * CATALOG-DERIVED vs DOMAIN-SPECIFIC
 * ----------------------------------
 *  - Catalog-derived (live-eligible):
 *      category  → `sdk.store.category.list` (root tier)
 *      color     → unique values of variant option titled /colou?r/i
 *      brand     → `product.metadata.brand` or title-case `tags[].value`
 *
 *  - Domain-specific (ALWAYS STATIC: these are commerce decisions, not
 *    catalog data, and changing them requires merchandising sign-off, not a
 *    schema migration):
 *      price     → bucket UX (£0-25 / £25-50 / £50-100 / £100+). A
 *                  min/max slider was rejected for the merchery pill bar;
 *                  buckets keep the visual rhythm consistent with the other
 *                  pills.
 *      quantity  → MOQ / bulk tier bands (1-50, 50-100, 100-500, 500+).
 *                  Driven by the pod commerce model, not catalogue data.
 *      leadTime  → SLA promise (within 1w / 2w / 4w). A merchandising
 *                  commitment, not derived from product fields.
 *      sort      → algorithmic sort keys, hand-curated.
 */
export interface FilterOption {
  value: string
  label: string
}

export const filterOptions = {
  category: [
    { value: 'apparel', label: 'Apparel' },
    { value: 'bags', label: 'Bags' },
    { value: 'headwear', label: 'Headwear' },
    { value: 'office', label: 'Office' },
    { value: 'drinkware', label: 'Drinkware' },
    { value: 'home', label: 'Home' },
  ] satisfies FilterOption[],
  price: [
    { value: '0-25', label: 'Under €25' },
    { value: '25-50', label: '€25 – €50' },
    { value: '50-100', label: '€50 – €100' },
    { value: '100+', label: '€100+' },
  ] satisfies FilterOption[],
  quantity: [
    { value: '1-50', label: '1 – 50 pieces' },
    { value: '50-100', label: '50 – 100 pieces' },
    { value: '100-500', label: '100 – 500 pieces' },
    { value: '500+', label: '500+ pieces' },
  ] satisfies FilterOption[],
  leadTime: [
    { value: '1w', label: 'Within 1 week' },
    { value: '2w', label: 'Within 2 weeks' },
    { value: '4w', label: 'Within 4 weeks' },
  ] satisfies FilterOption[],
  color: [
    { value: 'black', label: 'Black' },
    { value: 'white', label: 'White' },
    { value: 'cream', label: 'Cream' },
    { value: 'sage', label: 'Sage' },
    { value: 'navy', label: 'Navy' },
  ] satisfies FilterOption[],
  brand: [
    { value: 'as-colour', label: 'AS Colour' },
    { value: 'stanley', label: 'Stanley' },
    { value: 'yeti', label: 'Yeti' },
    { value: 'kaweco', label: 'Kaweco' },
  ] satisfies FilterOption[],
  sort: [
    { value: 'relevance', label: 'Relevance' },
    { value: 'price-asc', label: 'Price: low to high' },
    { value: 'price-desc', label: 'Price: high to low' },
    { value: 'newest', label: 'Newest first' },
  ] satisfies FilterOption[],
} as const

/**
 * Pull the cheapest variant price (in minor units) off a Medusa StoreProduct
 * payload. Used by the `sortedProducts` computed in every PLP page so we can
 * client-side sort by price without mutating the upstream array. Returns
 * `Number.POSITIVE_INFINITY` when no priced variant exists so `price-asc`
 * keeps unpriced rows at the tail and `price-desc` at the head, never
 * accidentally interleaved into the priced list.
 */
export function productMinPrice(product: any): number {
  const variants = product?.variants ?? []
  let min = Number.POSITIVE_INFINITY
  for (const v of variants) {
    const calc = v?.calculated_price?.calculated_amount
    const fallback = v?.prices?.[0]?.amount
    const amt = typeof calc === 'number' ? calc : (typeof fallback === 'number' ? fallback : null)
    if (amt == null) continue
    if (amt < min) min = amt
  }
  return min
}

/**
 * Apply the active sort key to a product list. Always returns a fresh array
 * (never mutates the input): the PLP `sortedProducts` computed depends on
 * referential change to retrigger downstream `<ProductCard>` keys.
 */
export function applySort<T extends { created_at?: string | Date | null }>(
  list: readonly T[] | null | undefined,
  sort: string,
): T[] {
  const arr = [...(list ?? [])]
  switch (sort) {
    case 'price-asc':
      return arr.sort((a, b) => productMinPrice(a) - productMinPrice(b))
    case 'price-desc':
      return arr.sort((a, b) => productMinPrice(b) - productMinPrice(a))
    case 'newest':
      return arr.sort((a, b) => {
        const ta = a.created_at ? new Date(a.created_at as any).getTime() : 0
        const tb = b.created_at ? new Date(b.created_at as any).getTime() : 0
        return tb - ta
      })
    default:
      return arr
  }
}

/**
 * Resolve a single-select sort key to its human-readable label. The Sort by
 * pill uses this as its dynamic label suffix ("Sort by: Newest first").
 */
export function sortLabel(value: string): string {
  return filterOptions.sort.find(o => o.value === value)?.label ?? 'Relevance'
}

/**
 * Live filter options bound to the active Medusa catalogue. Composable form
 * so it can lean on `useFilterFacets`'s SSR-safe `useState` cache: the
 * first PLP to call `ensureResolved()` pays the round-trip, every subsequent
 * caller reads the cached payload.
 *
 * Migration path for PLP pages:
 *
 *   <script setup lang="ts">
 *   const { liveOptions, ensureResolved } = useFilterOptions()
 *   await ensureResolved()  // SSR-friendly; promise resolves before render
 *   </script>
 *
 *   <FilterPill :options="liveOptions.category" ... />
 *
 * The branch logic is "live where we have it, static otherwise":
 *   - category / color / brand are catalog-derived and swap in once the
 *     backend returns a non-empty set.
 *   - price / quantity / leadTime / sort are domain-specific (see header
 *     docblock) and ALWAYS read from the static `filterOptions`.
 *
 * `liveOptions` is a `ComputedRef` so consumers stay reactive: if the facet
 * cache invalidates and re-resolves (future: webhook-driven refresh), the
 * pills update without the page having to re-mount.
 */
export function useFilterOptions() {
  const { facets, ensureResolved, error } = useFilterFacets()

  const liveOptions = computed(() => {
    const f = facets.value
    return {
      // Live with static fallback: once Medusa returns at least one entry
      // we trust the live set entirely. Mixing live + static would risk
      // showing a category that doesn't exist in the catalogue.
      category: f.category.length ? f.category : filterOptions.category,
      color: f.color.length ? f.color : filterOptions.color,
      brand: f.brand.length ? f.brand : filterOptions.brand,
      // Domain-specific: always static (see header docblock for rationale).
      price: filterOptions.price,
      quantity: filterOptions.quantity,
      leadTime: filterOptions.leadTime,
      sort: filterOptions.sort,
    }
  })

  return { liveOptions, ensureResolved, error }
}

/**
 * Legacy shim: the canonical implementation now lives in
 * {@link useProductTypes} (`~/composables/useProductTypes`). This wrapper
 * preserves the original `{ typeIds, ensureTypeIds, ready }` contract used
 * by `/shop` and `/shop/canon` so they continue to compile while the next
 * round of refactor migrates them to call `useProducts({ type: 'apparel' })`
 * directly.
 *
 * The returned `typeIds` is a `ComputedRef<Record<string, string | null>>`
 * that mirrors the new map. Legacy callers reading `typeIds.value['apparel']`
 * still work; they just get the value from the new state container.
 *
 * Do not add new callers: use `useProductTypes` (or, better, `useProducts`)
 * for new code.
 *
 * @deprecated use `useProductTypes` from `~/composables/useProductTypes`
 */
export function useProductTypeIds() {
  const inner = useProductTypes()
  const ready = useState<boolean>('gms_product_type_ids_ready', () => false)

  const typeIds = computed<Record<string, string | null>>(() => {
    const m = inner.map.value
    return {
      apparel: m.apparel ?? null,
      pod: m.pod ?? null,
    }
  })

  async function ensureTypeIds(): Promise<Record<string, string | null>> {
    await inner.ensureResolved()
    ready.value = true
    return typeIds.value
  }

  return { typeIds, ensureTypeIds, ready }
}
