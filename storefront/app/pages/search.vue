<script setup lang="ts">
/**
 * /search: full-page search results, fed by `?q=` and (v22) `?type=`.
 *
 * Reads the `q` query param reactively (so the same page handles navigation
 * between successive searches without remount) and calls
 * `sdk.store.product.list({ q, limit: 24 })`.
 *
 * ---------------------------------------------------------------------------
 * "No matches" is a claim about the catalog, and we must have earned it
 * ---------------------------------------------------------------------------
 * This page used to swallow the fetch in `catch { return { products: [] } }`,
 * which made "backend down" indistinguishable from "no match", the two were
 * handled identically, by design, and that design was wrong. Reproduced live
 * with the API blocked, `/search?q=hoodie` rendered:
 *
 *     NO MATCHES: No products match 'hoodie'.
 *     Try different keywords, or browse the full catalog.
 *
 * Thirty seconds earlier that query returned two hoodies. The store blamed the
 * customer's search term for its own outage and then sent them away.
 *
 * The catch is gone. `useAsyncData` surfaces `error`, and the template branches
 * three ways (pending / error / resolved) with the resolved branch splitting
 * into results and a genuine zero-result state. The invariant: **if `error` is
 * set we never say "no matches", never echo a count, and never suggest a
 * different keyword**, because a keyword was never the problem. That is the
 * line Etsy and Amazon both hold; a failed load gets a retry, not spelling
 * advice.
 *
 * The header form posts to /search?q=... so URLs are shareable.
 *
 * v22: Type-aware narrowing:
 *   `?type=pod` and `?type=apparel` mirror the `/products` PLP scoping so
 *   /search?q=tee&type=apparel returns only the D2C own-brand tees, and
 *   /search?q=tote&type=pod returns only the custom-print catalog. Slug →
 *   type_id resolution goes through `useProductTypes`. When the resolver
 *   hasn't returned an id yet (cold cache, endpoint not exposed), we fall
 *   back to a client-side `product.type.value` filter so the page never
 *   accidentally renders mixed types. The `q` parameter is OR-combined by
 *   the SDK with `type_id`, so the two filters compose additively.
 */
defineOptions({ name: 'PageSearch' })

const route = useRoute()
const sdk = useMedusaClient()
const regionState = useRegion()

// Resolve the active region so the result-card grid renders prices. Without
// `region_id` + `fields=*variants.calculated_price`, ProductCard suppresses
// the "From £X" line entirely (formatVariantPrice returns the em-dash and
// the card hides it). The header dropdown gets prices because it always
// requests the calculated_price field, but the field alone isn't enough
// without a region to compute against on this seeded data.
await regionState.ensureRegion()

// Normalize the param. `route.query.q` can be string | string[] | undefined.
const queryParam = computed<string>(() => {
  const raw = route.query.q
  if (Array.isArray(raw)) return (raw[0] ?? '').toString().trim()
  return (raw ?? '').toString().trim()
})

// `?type=pod|apparel`: symmetric with the /products PLP. Anything else is
// treated as no filter so a typo doesn't collapse the result set to zero.
const typeFilter = computed<'pod' | 'apparel' | null>(() => {
  const raw = route.query.type
  const v = (Array.isArray(raw) ? raw[0] : raw)?.toString().toLowerCase() ?? ''
  if (v === 'pod' || v === 'apparel') return v
  return null
})

// Resolve slug → type_id once. Same pattern as /products/index.vue so the
// two surfaces share the cached resolution and never double-fetch.
const typeRes = useProductTypes()
await typeRes.ensureResolved()

const activeTypeId = computed<string | undefined>(() => {
  if (typeFilter.value === 'pod') return typeRes.podId.value
  if (typeFilter.value === 'apparel') return typeRes.apparelId.value
  return undefined
})

useHead(() => ({
  title: queryParam.value
    ? `Search · ${queryParam.value} · GhostMark Studio`
    : 'Search · GhostMark Studio',
  meta: [
    {
      name: 'description',
      content: queryParam.value
        ? `Search results for "${queryParam.value}" across the GhostMark Studio catalog.`
        : 'Search the GhostMark Studio catalog for blanks, drops, and bespoke pieces.',
    },
    // Search-result pages are infinite-permutation: keep them out of
    // the index so we don't pollute the SERP with thin pages.
    { name: 'robots', content: 'noindex, follow' },
  ],
}))

// Reactive fetch keyed by the query string + type filter. `useAsyncData`'s
// `watch` re-runs the handler whenever queryParam OR typeFilter OR the
// resolved type_id changes, so client-side navigation
// /search?q=tee -> /search?q=tee&type=pod refreshes results without an SSR
// round-trip. `*type` is added to `fields` so the resulting ProductCard
// chip overlay (which reads product.type.value) renders correctly without
// a second fetch.
const { data, pending, error, refresh } = await useAsyncData(
  'search-results',
  async () => {
    const q = queryParam.value
    if (!q) return { products: [] as any[] }
    const args: Record<string, unknown> = {
      q,
      limit: 24,
      fields: 'id,handle,title,subtitle,description,thumbnail,*images,*variants.calculated_price,*variants.options.value,*options.values,*type,metadata,*tags',
    }
    if (regionState.regionId.value) args.region_id = regionState.regionId.value
    if (activeTypeId.value) args.type_id = [activeTypeId.value]
    // Deliberately unguarded. A throw here populates `error` below, which is
    // the only way the template can tell "the catalog has nothing" apart from
    // "we never got an answer". Do not reintroduce a try/catch.
    const res = await sdk.store.product.list(args as any)
    return { products: res.products ?? [] }
  },
  { watch: [queryParam, () => regionState.regionId.value, typeFilter, activeTypeId] },
)

// Retry from the error state. `refresh()` re-runs the handler and flips
// `pending`, which drives the button's busy state.
const retrying = ref(false)

const onRetry = async () => {
  if (retrying.value) return
  retrying.value = true
  try {
    await refresh()
  }
  finally {
    retrying.value = false
  }
}

// Defensive client-side narrowing for the case where ?type= is set but the
// type-id resolver hasn't returned yet (cold cache / endpoint unavailable).
// Mirrors the fallback in /products/index.vue so search never leaks mixed
// types just because the lookup is unresolved.
const products = computed(() => {
  const list = (data.value?.products ?? []) as any[]
  if (typeFilter.value && !activeTypeId.value) {
    return list.filter(
      p => (p?.type?.value as string | undefined)?.toLowerCase() === typeFilter.value,
    )
  }
  return list
})
const count = computed<number>(() => products.value.length)

// Headline suffix so users can tell at-a-glance whether they're searching
// inside a type-narrowed scope or the full catalogue.
const scopeLabel = computed(() => {
  if (typeFilter.value === 'pod') return ' in Customise & POD'
  if (typeFilter.value === 'apparel') return ' in Studio Canon'
  return ''
})
</script>

<template>
  <div class="bg-white text-ink-950">
    <!-- ============================================================
         1. Hero: eyebrow + serif label, query echoed
         ============================================================ -->
    <section
      class="bg-cream-tile"
      aria-labelledby="search-hero-heading"
    >
      <div class="mx-auto flex max-w-rail flex-col gap-6 px-gutter py-section">
        <p class="text-eyebrow font-body uppercase text-ink-500">
          Search{{ scopeLabel }}
        </p>
        <h1
          id="search-hero-heading"
          class="font-display text-display-lg font-normal text-ink-950"
        >
          <!--
            The count is an assertion about the catalog. When `error` is set we
            have no idea what the count is, so we drop it rather than print the
            length of an empty array we never filled, "· 0 products" beside a
            failed request is the same lie as "no matches", just quieter.
          -->
          <template v-if="queryParam && error">
            Search results for &lsquo;{{ queryParam }}&rsquo;{{ scopeLabel }}
          </template>
          <template v-else-if="queryParam">
            Search results for &lsquo;{{ queryParam }}&rsquo;{{ scopeLabel }}
            &middot; {{ count }} {{ count === 1 ? 'product' : 'products' }}
          </template>
          <template v-else>
            Search the studio.
          </template>
        </h1>
        <p v-if="!queryParam" class="max-w-[52ch] font-body text-body text-ink-700">
          Use the search bar in the header above to find a blank,
          colour, or finish across the catalog.
        </p>
      </div>
    </section>

    <!-- ============================================================
         2. Results grid: 4-up, ProductCard
         ============================================================ -->
    <section
      class="bg-white"
      aria-labelledby="search-results-heading"
    >
      <div class="mx-auto max-w-rail px-gutter py-section">
        <h2 id="search-results-heading" class="sr-only">
          Search results
        </h2>

        <!-- 1 of 3: pending ------------------------------------------- -->
        <div
          v-if="pending"
          role="status"
          class="py-20 text-center font-body text-caption text-ink-500"
        >
          Searching&hellip;
        </div>

        <!--
          2 of 3: the request failed. Note what is absent: no query echo, no
          count, no "try different keywords". We do not know that the catalog
          lacks a match, so we do not imply it, and we certainly do not put the
          fault on what the customer typed.
        -->
        <UiEmptyState
          v-else-if="error"
          variant="error"
          heading-tag="h3"
          title="We couldn't run that search."
          description="This is on us, not you. The catalog didn't answer. Try again in a moment."
          :busy="retrying || pending"
          @retry="onRetry"
        >
          <template #extra-actions>
            <UiButton as="NuxtLink" to="/products" variant="outline" size="md">
              Browse all products
            </UiButton>
          </template>
        </UiEmptyState>

        <!-- 3a of 3: resolved, with results ---------------------------- -->
        <ul
          v-else-if="products.length"
          class="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-5 lg:gap-y-10 xl:grid-cols-5"
        >
          <ProductCard
            v-for="p in products"
            :key="p.id"
            :product="p"
          />
        </ul>

        <!--
          3b of 3: resolved, and the catalog genuinely has nothing. Only here
          have we earned the phrase "no matches" and the keyword suggestion.
          Selfridges' zero-result page is the model: state the miss plainly,
          then hand over a route back into real inventory rather than ending
          the page.
        -->
        <UiEmptyState
          v-else-if="queryParam"
          variant="empty"
          heading-tag="h3"
          :boxed="false"
          eyebrow="No matches"
          :title="`No products match ‘${queryParam}’${scopeLabel}.`"
          description="Try different keywords, or browse the full catalog."
        >
          <template #actions>
            <UiButton as="NuxtLink" to="/products" variant="merchery" size="md">
              Browse all products
            </UiButton>
          </template>
        </UiEmptyState>
      </div>
    </section>
  </div>
</template>
