/**
 * Shared filter taxonomy for the merchery PLP filter bar.
 *
 * The lists are intentionally hard-coded placeholders — the live backend
 * doesn't yet expose facet taxonomies (no category-tree endpoint, no
 * price/quantity bucket facets, no brand vocabulary). This file exists so
 * every PLP page (`/products`, `/categories/*`, `/collections/*`) renders the
 * same merchery-style pill set without each page redeclaring the same arrays.
 *
 * When backend facet support lands the shape `{ value, label }` is the same
 * one Medusa's product-tags + custom facet endpoint returns, so the swap is
 * a one-line `import { filterOptions } from '~/utils/filters'` ->
 * `import { useFilterOptions } from '~/composables/useFilterOptions'` rename.
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
 * keeps unpriced rows at the tail and `price-desc` at the head — never
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
 * (never mutates the input) — the PLP `sortedProducts` computed depends on
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
 * Legacy shim — the canonical implementation now lives in
 * {@link useProductTypes} (`~/composables/useProductTypes`). This wrapper
 * preserves the original `{ typeIds, ensureTypeIds, ready }` contract used
 * by `/shop` and `/shop/canon` so they continue to compile while the next
 * round of refactor migrates them to call `useProducts({ type: 'apparel' })`
 * directly.
 *
 * The returned `typeIds` is a `ComputedRef<Record<string, string | null>>`
 * that mirrors the new map. Legacy callers reading `typeIds.value['apparel']`
 * still work — they just get the value from the new state container.
 *
 * Do not add new callers — use `useProductTypes` (or, better, `useProducts`)
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
