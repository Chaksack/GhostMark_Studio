<script setup lang="ts">
/**
 * /search — full-page search results, fed by `?q=`.
 *
 * Reads the `q` query param reactively (so the same page handles
 * navigation between successive searches without remount) and calls
 * `sdk.store.product.list({ q, limit: 24 })`. Failures collapse to
 * an empty result set so the page never throws — the empty state
 * handles "no match" and "backend down" identically.
 *
 * The header form posts to /search?q=... so URLs are shareable.
 */
defineOptions({ name: 'PageSearch' })

const route = useRoute()
const sdk = useMedusaClient()
const regionState = useRegion()

// Resolve the active region so the result-card grid renders prices. Without
// `region_id` + `fields=*variants.calculated_price`, ProductCard suppresses
// the "From £X" line entirely (formatVariantPrice returns the em-dash and
// the card hides it). The header dropdown gets prices because it always
// requests the calculated_price field — but the field alone isn't enough
// without a region to compute against on this seeded data.
await regionState.ensureRegion()

// Normalize the param. `route.query.q` can be string | string[] | undefined.
const queryParam = computed<string>(() => {
  const raw = route.query.q
  if (Array.isArray(raw)) return (raw[0] ?? '').toString().trim()
  return (raw ?? '').toString().trim()
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
    // Search-result pages are infinite-permutation — keep them out of
    // the index so we don't pollute the SERP with thin pages.
    { name: 'robots', content: 'noindex, follow' },
  ],
}))

// Reactive fetch keyed by the query string. `useAsyncData`'s third-arg
// `watch` re-runs the handler whenever `queryParam` changes, so client-side
// navigation /search?q=tee -> /search?q=hat refreshes results without an
// SSR round-trip.
const { data, pending, error } = await useAsyncData(
  'search-results',
  async () => {
    const q = queryParam.value
    if (!q) return { products: [] as any[] }
    try {
      const res = await sdk.store.product.list({
        q,
        limit: 24,
        fields: 'id,handle,title,subtitle,description,thumbnail,*images,*variants.calculated_price,*variants.options.value,*options.values,metadata,*tags',
        ...(regionState.regionId.value ? { region_id: regionState.regionId.value } : {}),
      } as any)
      return { products: res.products ?? [] }
    }
    catch {
      return { products: [] as any[] }
    }
  },
  { watch: [queryParam, () => regionState.regionId.value] },
)

const products = computed(() => (data.value?.products ?? []) as any[])
const count = computed<number>(() => products.value.length)
</script>

<template>
  <div class="bg-white text-ink-950">
    <!-- ============================================================
         1. Hero — eyebrow + serif label, query echoed
         ============================================================ -->
    <section
      class="bg-cream-tile"
      aria-labelledby="search-hero-heading"
    >
      <div class="mx-auto flex max-w-[1320px] flex-col gap-6 px-gutter py-section">
        <p class="text-eyebrow font-body uppercase text-ink-500">
          Search
        </p>
        <h1
          id="search-hero-heading"
          class="font-display text-display-lg font-normal text-ink-950"
        >
          <template v-if="queryParam">
            Search results for &lsquo;{{ queryParam }}&rsquo;
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
         2. Results grid — 4-up, ProductCard
         ============================================================ -->
    <section
      class="bg-white"
      aria-labelledby="search-results-heading"
    >
      <div class="mx-auto max-w-[1320px] px-gutter py-section">
        <h2 id="search-results-heading" class="sr-only">
          Search results
        </h2>

        <div v-if="pending" class="py-20 text-center font-body text-caption text-ink-500">
          Searching&hellip;
        </div>

        <div v-else-if="error" class="py-20 text-center font-body text-caption text-ink-500">
          Couldn't load search results.
        </div>

        <ul
          v-else-if="products.length"
          class="grid grid-cols-2 gap-[1.6rem] md:grid-cols-4 lg:gap-[3rem]"
        >
          <ProductCard
            v-for="p in products"
            :key="p.id"
            :product="p"
          />
        </ul>

        <!-- Empty state -->
        <div
          v-else-if="queryParam"
          class="mx-auto flex max-w-[44ch] flex-col items-center gap-4 py-section text-center"
        >
          <p class="text-eyebrow font-body uppercase text-ink-500">
            No matches
          </p>
          <h3 class="font-display text-display-md font-normal text-ink-950">
            No products match &lsquo;{{ queryParam }}&rsquo;.
          </h3>
          <p class="font-body text-body text-ink-700">
            Try different keywords, or browse the full catalog.
          </p>
          <NuxtLink
            to="/products"
            class="mt-2 inline-flex h-[48px] items-center justify-center bg-ink-900 px-7 font-body text-[14px] font-medium tracking-wide text-white transition-colors duration-base ease-emphasis hover:bg-ink-800"
          >
            Browse all products
          </NuxtLink>
        </div>
      </div>
    </section>
  </div>
</template>
