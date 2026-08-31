<template>
  <div>
    <div class="relative mx-auto w-full max-w-rail px-gutter">
      <!-- Breadcrumb: static at <md so it can't collide with a wrapping H1
           at 320; floats absolute at md+ where there's room. -->
      <!--
        `md:z-10` is load bearing and is not decoration.

        At md+ this nav goes `absolute` while the H1 below it is `relative`,
        and BOTH carry `z-index: auto`. Two positioned elements with auto
        z-index paint in DOM order, so the H1, being later, painted OVER the
        breadcrumb. The H1's box extends up across this row even though its
        glyphs do not, so the link looked completely normal and was not
        clickable. Measured with elementFromPoint at the link's centre: the hit
        returned `H1.relative`, not the anchor, at 768, 1024 and 1440 on
        /shop, /products and /shop/canon. It worked at 390 only because the nav
        is `static` there and the two never overlap.

        Raised by STUDIO-QA, who also caught the trap that nearly hid it: a
        page-wide `getByRole('link', {name:'Home'}).first()` matches the
        HEADER's home link, which is fine, and reports a false pass. Scope
        breadcrumb assertions to `main`.
      -->
      <nav class="pt-[2rem] md:absolute md:top-[2rem] md:z-10 md:pt-0" aria-label="breadcrumbs">
        <ol class="flex flex-wrap items-center gap-x-1 gap-y-0">
          <li><NuxtLink to="/" class="text-sm text-greyText hover:text-ink-950 hover:underline">Home</NuxtLink></li>
          <li class="text-sm text-greyText" aria-hidden="true">/</li>
          <li><span class="text-sm text-ink-950" aria-current="page">Shop</span></li>
        </ol>
      </nav>

      <h1 class="relative mb-[3rem] max-w-[1100px] pt-[2rem] md:pt-[6rem] lg:pt-[10rem] mt-0 lg:mb-[6rem] text-[40px] sm:text-[44px] lg:text-[80px] leading-[44px] sm:leading-[48px] lg:leading-[88px] tracking-[-0.01em]">
        Shop the Studio
      </h1>

      <p class="mb-[6rem] max-w-[560px]">
        The GhostMark Canon: pieces designed in our Bordeaux studio and ready to order. Per-unit prices, no minimums. Restocked irregularly, gone when they're gone.
      </p>

      <!-- Featured: Studio Canon collection callout: stacks at <sm so the CTA
           never gets squeezed into a sliver, and the eyebrow stays readable. -->
      <div class="mb-[6rem] flex flex-col gap-4 border-b border-greyLines pb-6 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div>
          <p class="text-[12px] uppercase tracking-[0.12em] text-greyText mb-2">Featured collection</p>
          <p class="text-[18px] font-medium text-ink-950">Studio Canon: 2026 drop</p>
        </div>
        <NuxtLink to="/shop/canon" class="inline-flex items-center gap-2 self-start min-h-[44px] text-[14px] text-ink-950 hover:underline sm:self-auto">
          Shop the canon
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 8h12M9 3l5 5-5 5"/></svg>
        </NuxtLink>
      </div>

      <!-- Desktop filter bar (D2C mode, leaner than B2B PLP: no Quantity,
           Lead time, or Fast shipping. /shop is single-unit per the v2 IA, so
           those B2B-only facets don't apply here.) -->
      <nav class="hidden md:flex justify-between items-start gap-4 pb-[1rem] border-b border-greyLines">
        <div class="flex gap-[10px] flex-wrap">
          <FilterPill v-model="categoryFilter" label="Category" :options="liveOptions.category" data-test="filter-category" />
          <FilterPill v-model="priceFilter" label="Price range" :options="filterOptions.price" data-test="filter-price" />
          <FilterPill v-model="colorFilter" label="Color" :options="liveOptions.color" data-test="filter-color" />
          <FilterPill v-model="brandFilter" label="Brands" :options="liveOptions.brand" data-test="filter-brand" />
        </div>
        <FilterPill v-model="sortBy" label="Sort by" :options="filterOptions.sort" :multi="false" data-test="filter-sort" />
      </nav>

      <!-- Mobile filter bar: two-button row (Filters / Sort) opens bottom
           sheets. /shop is the leaner D2C facet set (no quantity/lead-time/
           fast-shipping); the sheet adapts accordingly. -->
      <div class="flex gap-3 pb-[1rem] border-b border-greyLines md:hidden">
        <button
          type="button"
          class="flex-1 inline-flex items-center justify-between min-h-11 border border-greyLines px-4 hover:bg-uiGrey"
          @click="filterSheetOpen = true"
        >
          <span class="text-[16px] font-medium text-ink-950">Filters{{ totalActiveFilters > 0 ? ` (${totalActiveFilters})` : '' }}</span>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M3 6h18M6 12h12M10 18h4" />
          </svg>
        </button>
        <button
          type="button"
          class="flex-1 inline-flex items-center justify-between min-h-11 border border-greyLines px-4 hover:bg-uiGrey"
          @click="sortSheetOpen = true"
        >
          <span class="text-[16px] font-medium text-ink-950 truncate">Sort: {{ sortLabel }}</span>
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </div>

      <!-- Mobile bottom sheets -->
      <MobileFilterSheet
        v-model:open="filterSheetOpen"
        title="Filter products"
        :result-count="sortedProducts.length"
        @clear="onClearFilters"
      >
        <div class="space-y-3">
          <FilterPill v-model="categoryFilter" label="Category" :options="liveOptions.category" data-test="filter-category-mobile" />
          <FilterPill v-model="priceFilter" label="Price range" :options="filterOptions.price" data-test="filter-price-mobile" />
          <FilterPill v-model="colorFilter" label="Color" :options="liveOptions.color" data-test="filter-color-mobile" />
          <FilterPill v-model="brandFilter" label="Brands" :options="liveOptions.brand" data-test="filter-brand-mobile" />
        </div>
      </MobileFilterSheet>

      <MobileFilterSheet
        v-model:open="sortSheetOpen"
        title="Sort products"
        :result-count="sortedProducts.length"
        @clear="sortBy = 'relevance'"
      >
        <FilterPill v-model="sortBy" label="Sort by" :options="filterOptions.sort" :multi="false" />
      </MobileFilterSheet>

      <!-- Result count + pagination, lifted from /products/index pattern -->
      <div class="flex items-center justify-between mt-[3rem] mb-[2rem] text-sm text-greyText">
        <p>Showing <span class="font-medium text-ink-950">{{ products.length }}</span> of <span class="font-medium text-ink-950">{{ totalCount }}</span> pieces</p>
      </div>

      <div v-if="pending" class="py-20 text-center text-ink-600">Loading the shelf&hellip;</div>
      <div v-else-if="error" class="py-20 text-center text-ink-600">Couldn't load the shelf.</div>
      <ul v-else-if="sortedProducts.length" class="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-5 lg:gap-y-10 xl:grid-cols-5">
        <ProductCard v-for="p in sortedProducts" :key="p.id" :product="p" mode="shop" />
      </ul>
      <!-- Empty state: friendly copy explicitly framed for the apparel-only
           filter on /shop. If `type_id` resolution fails AND the harvest
           fallback returns 0 apparel rows, this is the only thing the visitor
           sees, so it has to point them somewhere useful (the unified PLP, or
           a quote request). -->
      <div v-else class="py-12 text-center max-w-[600px] mx-auto">
        <p class="text-[15px] text-ink-700 mb-4">The Studio Canon is being stocked.</p>
        <p class="text-[14px] text-greyText mb-6">
          In the meantime, browse our custom &amp; POD catalogue at
          <NuxtLink to="/products" class="underline hover:text-ink-950">/products</NuxtLink>
          or
          <NuxtLink to="/contact" class="underline hover:text-ink-950">request a quote</NuxtLink>.
        </p>
      </div>

      <!-- Pagination: emit non-numeric entries (the ellipsis) as inert spans
           so we don't render a NuxtLink to "#" (which would break keyboard nav
           and trigger a route change). 44x44 minimum touch targets per WCAG. -->
      <nav v-if="totalPages > 1" class="flex items-center justify-center flex-wrap gap-2 mt-[4rem]" aria-label="Pagination">
        <NuxtLink
          v-if="currentPage > 1"
          :to="`/shop?page=${currentPage - 1}`"
          class="inline-flex items-center justify-center min-h-[44px] min-w-[44px] px-4 py-2 border border-greyLines rounded-none text-sm hover:bg-uiGrey"
          aria-label="Previous page"
        >Previous</NuxtLink>
        <template v-for="(p, idx) in visiblePages" :key="`p-${p}-${idx}`">
          <span
            v-if="typeof p !== 'number'"
            class="inline-flex items-center justify-center min-h-[44px] min-w-[24px] px-1 text-sm text-greyText"
            aria-hidden="true"
          >{{ p }}</span>
          <NuxtLink
            v-else
            :to="`/shop?page=${p}`"
            :aria-current="p === currentPage ? 'page' : undefined"
            :aria-label="`Go to page ${p}`"
            :class="['inline-flex items-center justify-center min-h-[44px] min-w-[44px] px-3 py-2 text-sm rounded-none', p === currentPage ? 'bg-ink-950 text-cream-50 font-medium' : 'border border-greyLines hover:bg-uiGrey']"
          >{{ p }}</NuxtLink>
        </template>
        <NuxtLink
          v-if="currentPage < totalPages"
          :to="`/shop?page=${currentPage + 1}`"
          class="inline-flex items-center justify-center min-h-[44px] min-w-[44px] px-4 py-2 border border-greyLines rounded-none text-sm hover:bg-uiGrey"
          aria-label="Next page"
        >Next</NuxtLink>
      </nav>
    </div>

    <!-- FAQ + Newsletter: siblings inside one wrapper per merchery section D. -->
    <div class="mx-auto w-full max-w-rail px-gutter mt-16 flex flex-col gap-12 mb-12">
      <AppFaq />
      <AppNewsletter />
    </div>
  </div>
</template>

<script setup lang="ts">
import FilterPill from '~/components/ui/FilterPill.vue'
import MobileFilterSheet from '~/components/ui/MobileFilterSheet.vue'
import { applySort, filterOptions, useFilterOptions, useProductTypeIds } from '~/utils/filters'
import { podFilteredUrl } from '~/utils/routes'

useHead({
  title: 'Shop · GhostMark Studio',
  meta: [{ name: 'description', content: 'Shop the GhostMark Canon: pieces designed in our Bordeaux studio. Per-unit prices, no minimums. Restocked irregularly.' }],
})

const route = useRoute()
const sdk = useMedusaClient()
const regionState = useRegion()

// `?type=` on /shop was READ BY NOTHING. Honour it instead of discarding it.
//
// /shop is the apparel surface and pins `type_id=[apparel]` on every request
// (see the useAsyncData call below). It never looked at `route.query.type`, so
// `/shop?type=pod` returned the full apparel grid and said nothing about it.
// Measured at 1440 on 2026-08-31, /shop?type=pod against bare /shop: same 20
// cards, same first five handles (workshop-tote, studio-tee-charcoal,
// studio-tee-cream, atelier-hoodie, ghostmark-cap), same "Showing 20 of 20
// pieces", HTTP 200, URL not rewritten. A visitor asking for POD got 20
// apparel products and no signal that the question had been thrown away.
//
// Of the honest options, redirect beats erroring: we can actually satisfy this
// request, and refusing a URL we know how to serve is user-hostile. What is
// NOT acceptable is the status quo, because a silent wrong answer is worse
// than either. `?type=apparel` is intentionally a no-op, apparel is already
// what this route shows, so it is a correct request, not a misrouted one.
//
// The destination carries the FILTER, not just the route. Redirecting to a
// bare catalogue would hand a visitor who asked for 5 products a list of 24,
// which is this same defect with a 302 in front of it: better, because the URL
// changes so they can see what happened, but still their request discarded.
// Built from a helper rather than an inline path so a future move of the
// catalogue cannot leave this line pointing somewhere stale.
if (String(route.query.type ?? '').toLowerCase() === 'pod') {
  await navigateTo(podFilteredUrl(), { redirectCode: 302, replace: true })
}

const PAGE_SIZE = 24
const currentPage = computed(() => Math.max(1, parseInt(String(route.query.page || '1'), 10) || 1))

const categoryFilter = ref<string[]>([])
const priceFilter = ref<string[]>([])
const colorFilter = ref<string[]>([])
const brandFilter = ref<string[]>([])
const sortBy = ref<string>('relevance')

// Mobile sheet state: desktop pill row above stays the active surface ≥md.
const filterSheetOpen = ref(false)
const sortSheetOpen = ref(false)
const totalActiveFilters = computed(() =>
  categoryFilter.value.length
  + priceFilter.value.length
  + colorFilter.value.length
  + brandFilter.value.length,
)
const sortLabel = computed(() => filterOptions.sort.find(o => o.value === sortBy.value)?.label || 'Relevance')
function onClearFilters() {
  categoryFilter.value = []
  priceFilter.value = []
  colorFilter.value = []
  brandFilter.value = []
}

await regionState.ensureRegion()

// Live filter options: Medusa-backed `category`/`color`/`brand` pills with
// static fallback. `price`/`sort` remain static (domain-specific per the
// filters.ts header docblock).
const { liveOptions, ensureResolved: ensureFilterOptionsResolved } = useFilterOptions()
await ensureFilterOptionsResolved()

// Resolve product-type IDs so we can pass `type_id` to the Store API and let
// the backend narrow to apparel-only, /shop is the Studio Canon D2C surface,
// not the unified catalogue. If the lookup fails (endpoint not exposed,
// network blip), `apparelTypeId` stays null and the computed below falls back
// to client-side filtering on `product.type.value`.
const { typeIds, ensureTypeIds } = useProductTypeIds()
await ensureTypeIds()
const apparelTypeId = computed(() => typeIds.value['apparel'] ?? null)

const { data, pending, error } = await useAsyncData(
  () => `shop-${apparelTypeId.value ?? 'all'}-${currentPage.value}-${regionState.regionId.value ?? 'no-region'}`,
  async () => {
    const args: Record<string, unknown> = {
      limit: PAGE_SIZE,
      offset: (currentPage.value - 1) * PAGE_SIZE,
      fields: 'id,handle,title,subtitle,description,thumbnail,*images,*variants.calculated_price,*variants.options.value,*options.title,*options.values,*type,metadata,*tags',
    }
    if (regionState.regionId.value) args.region_id = regionState.regionId.value
    if (apparelTypeId.value) args.type_id = [apparelTypeId.value]
    return sdk.store.product.list(args as any)
  },
  { watch: [() => currentPage.value, () => regionState.regionId.value, apparelTypeId] },
)

const products = computed(() => (data.value as any)?.products ?? [])
const totalCount = computed(() => (data.value as any)?.count ?? 0)
const totalPages = computed(() => Math.max(1, Math.ceil(totalCount.value / PAGE_SIZE)))
const visiblePages = computed(() => {
  const cur = currentPage.value
  const tot = totalPages.value
  if (tot <= 7) return Array.from({length: tot}, (_, i) => i + 1)
  if (cur <= 4) return [1, 2, 3, 4, 5, '…', tot]
  if (cur >= tot - 3) return [1, '…', tot-4, tot-3, tot-2, tot-1, tot]
  return [1, '…', cur-1, cur, cur+1, '…', tot]
})
// Defensive client-side filter, if we couldn't resolve a type_id (backend
// didn't expose `productType.list` AND the harvest fallback returned 0 types,
// or the seed hasn't run yet), narrow the grid by `product.type.value` so
// /shop never accidentally renders POD/custom products.
const sortedProducts = computed(() => {
  const sorted = applySort(products.value, sortBy.value)
  if (apparelTypeId.value) return sorted // server already filtered
  return sorted.filter((p: any) => String(p?.type?.value ?? '').toLowerCase() === 'apparel')
})
</script>
