/**
 * useProducts: type-aware facade over `sdk.store.product.list`.
 *
 * Replaces the duplicated `sdk.store.product.list({ fields: '...,*type,...' })`
 * pattern that has cropped up across /shop, /shop/canon, /products, PDP
 * relateds, search, collections, and category pages. Centralising it gives us:
 *
 *   - A canonical `fields` glob: bump it once, every PLP gets the new
 *     expansion. No more "this page is missing *tags, that page is missing
 *     metadata" drift.
 *   - Server-side type filtering: `type: 'apparel' | 'pod'` resolves to a
 *     real `type_id` via {@link useProductTypes} and is pushed to Medusa,
 *     so the backend narrows the result set instead of every PLP shipping
 *     the full catalogue + client-side filter.
 *   - SSR-correct region wiring: every call awaits `useRegion().ensureRegion`
 *     so the `region_id` query param is populated before the first SSR
 *     `useAsyncData` resolves. No client-side price hydration flicker.
 *   - Stable cache keys: keyed on `(type, offset, region, custom key)` so
 *     two pages requesting the same view share the SSR payload.
 *
 * Non-goals:
 *   - This composable does NOT handle category / collection page taxonomy
 *     beyond passing through `category_id` / `collection_id` filters. Those
 *     pages still own their taxonomy resolution (slug → id lookup).
 *   - It does NOT implement client-side sort / facet filtering. Use
 *     `~/utils/filters` (`applySort`, `productMinPrice`) downstream.
 *
 * SSR contract: all reactivity is via Nuxt auto-imports (`useState`,
 * `useAsyncData`, `computed`, `unref`). No `window` / `document` references.
 */

import type { StoreProduct } from '@medusajs/types'
import type { MaybeRef } from 'vue'

/**
 * Canonical field selection for product list queries. Includes everything
 * the PLP card and PDP related-products grid need:
 *   - core: id, handle, title, subtitle, description, thumbnail
 *   - media: *images (full image relation, not just URLs)
 *   - pricing: *variants.calculated_price (region-scoped price)
 *   - option matrix: *variants.options.value, *options.values (for swatches)
 *   - taxonomy: *type (id + value, drives type-aware filtering)
 *   - editorial: metadata, *tags (chips taxonomy)
 *
 * If a page needs a richer expansion (e.g. PDP variant inventory), pass
 * `fields` explicitly to {@link useProducts} or {@link useProduct}.
 */
// `*options.title` is load-bearing and its absence fails SILENTLY.
//
// Medusa v2 expands only what you ask for, one level at a time: `*options.values`
// returns each option's VALUES and no `title`, so a product came back as
//     options: [ { values: [ { value: "220g" } ] } ]
// with no way to know that option is "Size" rather than "Gender" or "Denomination".
//
// ProductCardVariant keys on that title to decide whether a product's option is
// a colourway (render swatches) or a measure (render a mono spec token). Without
// it every option-derived differentiator resolved to `none` and simply did not
// render: no error, no warning, no console message, just Atelier Hoodie missing
// its 4 colour dots and Studio Candle missing "220 G" on a page that otherwise
// looked completely correct. Verified against :9000 both ways before changing it.
//
// The pattern matches what app/composables/useFilterFacets.ts:177 already does
// (`*options.title,*options.values.value`), so this brings the list fields into
// line with the one place in the repo that had it right.
export const PRODUCT_LIST_FIELDS
  = 'id,handle,title,subtitle,description,thumbnail,*images,*variants.calculated_price,*variants.options.value,*options.title,*options.values,*type,metadata,*tags'

export interface UseProductsOptions {
  /** Filter to a single commerce type, server-side via `type_id`. */
  type?: 'apparel' | 'pod'
  /** Filter to one or more Medusa category IDs (server-side). */
  categoryId?: string | string[]
  /** Filter to one or more Medusa collection IDs (server-side). */
  collectionId?: string | string[]
  /** Page size (default 24). */
  limit?: number
  /** Page offset for pagination (default 0). */
  offset?: number
  /** Override the canonical field glob. Defaults to {@link PRODUCT_LIST_FIELDS}. */
  fields?: string
  /** Server-side ordering, e.g. `'created_at'` / `'-created_at'`. */
  order?: string
  /** Free-text query (Medusa Store API `q` param). */
  q?: string
  /** Cache key disambiguation when two pages share the same option shape. */
  key?: string
}

interface ProductListResult {
  products: StoreProduct[]
  count: number
  offset: number
  limit: number
}

/**
 * Reactive product list. Wraps `sdk.store.product.list` with type-id
 * resolution, region wiring, and a stable `useAsyncData` cache key.
 *
 * @example
 *   const { data, pending } = useProducts({ type: 'apparel', limit: 12 })
 *   const products = computed(() => data.value?.products ?? [])
 */
export const useProducts = (opts: MaybeRef<UseProductsOptions> = {}) => {
  const sdk = useMedusaClient()
  const regionState = useRegion()
  const typeRes = useProductTypes()

  const resolved = computed<UseProductsOptions>(() => unref(opts) ?? {})

  const args = computed<Record<string, unknown>>(() => {
    const o = resolved.value
    const out: Record<string, unknown> = {
      limit: o.limit ?? 24,
      offset: o.offset ?? 0,
      fields: o.fields ?? PRODUCT_LIST_FIELDS,
    }
    if (regionState.regionId.value) out.region_id = regionState.regionId.value
    if (o.type) {
      const typeId = o.type === 'pod' ? typeRes.podId.value : typeRes.apparelId.value
      if (typeId) out.type_id = [typeId]
    }
    if (o.categoryId) out.category_id = Array.isArray(o.categoryId) ? o.categoryId : [o.categoryId]
    if (o.collectionId) out.collection_id = Array.isArray(o.collectionId) ? o.collectionId : [o.collectionId]
    if (o.order) out.order = o.order
    if (o.q) out.q = o.q
    return out
  })

  const cacheKey = computed(() => {
    const o = resolved.value
    return [
      'products',
      o.key ?? 'default',
      o.type ?? 'all',
      o.categoryId ? (Array.isArray(o.categoryId) ? o.categoryId.join('+') : o.categoryId) : 'no-cat',
      o.collectionId ? (Array.isArray(o.collectionId) ? o.collectionId.join('+') : o.collectionId) : 'no-col',
      o.q ?? 'no-q',
      o.order ?? 'no-order',
      o.offset ?? 0,
      o.limit ?? 24,
      regionState.regionId.value ?? 'no-region',
    ].join('|')
  })

  return useAsyncData<ProductListResult>(
    () => cacheKey.value,
    async () => {
      await regionState.ensureRegion()
      // Resolve the type map before the SDK call so `type_id` makes it onto
      // the query string. If the resolution failed silently the call still
      // goes out as an unfiltered list. Callers should defensively client-
      // side filter on `type.value` when `type` is specified.
      if (resolved.value.type) await typeRes.ensureResolved()
      const res = await sdk.store.product.list(args.value as Parameters<typeof sdk.store.product.list>[0])
      return {
        products: (res?.products ?? []) as StoreProduct[],
        count: (res?.count ?? 0) as number,
        offset: (res?.offset ?? 0) as number,
        limit: (res?.limit ?? args.value.limit) as number,
      }
    },
    { watch: [args, () => regionState.regionId.value] },
  )
}

/**
 * Fetch a single product by handle. Mirrors {@link useProducts} for region +
 * field handling, but always returns the first match (or `null`).
 *
 * @example
 *   const route = useRoute()
 *   const { data: product } = useProduct(() => route.params.handle as string)
 */
export const useProduct = (handle: MaybeRef<string>) => {
  const sdk = useMedusaClient()
  const regionState = useRegion()
  const h = computed(() => unref(handle))

  return useAsyncData<StoreProduct | null>(
    () => `product-${h.value}-${regionState.regionId.value ?? 'no-region'}`,
    async () => {
      await regionState.ensureRegion()
      const args: Record<string, unknown> = {
        handle: h.value,
        limit: 1,
        fields: PRODUCT_LIST_FIELDS,
      }
      if (regionState.regionId.value) args.region_id = regionState.regionId.value
      const res = await sdk.store.product.list(args as Parameters<typeof sdk.store.product.list>[0])
      const first = (res?.products ?? [])[0]
      return (first as StoreProduct | undefined) ?? null
    },
    { watch: [h, () => regionState.regionId.value] },
  )
}
