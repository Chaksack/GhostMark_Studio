<template>
  <div class="lg:pt-[118px]">
    <div class="relative px-[1.5rem] lg:px-[3rem]">
      <!-- Breadcrumb — static at <md so it can't collide with a wrapping H1
           at 320; floats absolute at md+ where there's room. -->
      <nav class="pt-[2rem] md:absolute md:top-[2rem] md:pt-0" aria-label="breadcrumbs">
        <ol class="flex flex-wrap items-center gap-x-1 gap-y-0">
          <li><NuxtLink to="/" class="text-sm text-greyText hover:text-ink-950 hover:underline">Home</NuxtLink></li>
          <li class="text-sm text-greyText" aria-hidden="true">/</li>
          <li><span class="text-sm text-ink-950" aria-current="page">Shop</span></li>
        </ol>
      </nav>

      <h1 class="relative mb-[3rem] max-w-[110rem] pt-[2rem] md:pt-[6rem] lg:pt-[10rem] mt-0 lg:mb-[6rem] text-[4rem] sm:text-[4.4rem] lg:text-[8rem] leading-[4.4rem] sm:leading-[4.8rem] lg:leading-[8.8rem] tracking-[-0.01em]">
        Shop the Studio
      </h1>

      <p class="mb-[6rem] max-w-[56rem]">
        The GhostMark Canon — pieces designed in our Bordeaux studio and ready to order. Per-unit prices, no minimums. Restocked irregularly, gone when they're gone.
      </p>

      <!-- Featured: Studio Canon collection callout — stacks at <sm so the CTA
           never gets squeezed into a sliver, and the eyebrow stays readable. -->
      <div class="mb-[6rem] flex flex-col gap-4 border-b border-greyLines pb-6 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div>
          <p class="text-[12px] uppercase tracking-[0.12em] text-greyText mb-2">Featured collection</p>
          <p class="text-[1.8rem] font-medium text-ink-950">Studio Canon — 2026 drop</p>
        </div>
        <NuxtLink to="/shop/canon" class="inline-flex items-center gap-2 self-start min-h-[44px] text-[14px] text-ink-950 hover:underline sm:self-auto">
          Shop the canon
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 8h12M9 3l5 5-5 5"/></svg>
        </NuxtLink>
      </div>

      <!-- Desktop filter bar (D2C mode — leaner than B2B PLP: no Quantity,
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

      <!-- Mobile filter bar — two-button row (Filters / Sort) opens bottom
           sheets. /shop is the leaner D2C facet set (no quantity/lead-time/
           fast-shipping); the sheet adapts accordingly. -->
      <div class="flex gap-3 pb-[1rem] border-b border-greyLines md:hidden">
        <button
          type="button"
          class="flex-1 inline-flex items-center justify-between min-h-[48px] border border-greyLines px-[1.6rem] hover:bg-uiGrey"
          @click="filterSheetOpen = true"
        >
          <span class="text-[16px] font-medium text-ink-950">Filters{{ totalActiveFilters > 0 ? ` (${totalActiveFilters})` : '' }}</span>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M3 6h18M6 12h12M10 18h4" />
          </svg>
        </button>
        <button
          type="button"
          class="flex-1 inline-flex items-center justify-between min-h-[48px] border border-greyLines px-[1.6rem] hover:bg-uiGrey"
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

      <div v-if="pending" class="py-20 text-center text-zinc-500">Loading the shelf&hellip;</div>
      <div v-else-if="error" class="py-20 text-center text-zinc-500">Couldn't load the shelf.</div>
      <ul v-else-if="sortedProducts.length" class="grid grid-cols-2 gap-[1.6rem] md:grid-cols-3 lg:grid-cols-4 lg:gap-[3rem]">
        <ProductCard v-for="p in sortedProducts" :key="p.id" :product="p" mode="shop" />
      </ul>
      <!-- Empty state — friendly copy explicitly framed for the apparel-only
           filter on /shop. If `type_id` resolution fails AND the harvest
           fallback returns 0 apparel rows, this is the only thing the visitor
           sees, so it has to point them somewhere useful (the unified PLP, or
           a quote request). -->
      <div v-else class="py-12 text-center max-w-[60rem] mx-auto">
        <p class="text-[1.5rem] text-ink-700 mb-4">The Studio Canon is being stocked.</p>
        <p class="text-[1.4rem] text-greyText mb-6">
          In the meantime, browse our custom &amp; POD catalogue at
          <NuxtLink to="/products" class="underline hover:text-ink-950">/products</NuxtLink>
          or
          <NuxtLink to="/contact" class="underline hover:text-ink-950">request a quote</NuxtLink>.
        </p>
      </div>

      <!-- Pagination — emit non-numeric entries (the ellipsis) as inert spans
           so we don't render a NuxtLink to "#" (which would break keyboard nav
           and trigger a route change). 44x44 minimum touch targets per WCAG. -->
      <nav v-if="totalPages > 1" class="flex items-center justify-center flex-wrap gap-2 mt-[4rem]" aria-label="Pagination">
        <NuxtLink
          v-if="currentPage > 1"
          :to="`/shop?page=${currentPage - 1}`"
          class="inline-flex items-center justify-center min-h-[44px] min-w-[44px] px-4 py-2 border border-greyLines rounded text-sm hover:bg-uiGrey"
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
            :class="['inline-flex items-center justify-center min-h-[44px] min-w-[44px] px-3 py-2 text-sm rounded', p === currentPage ? 'bg-ink-950 text-cream-50 font-medium' : 'border border-greyLines hover:bg-uiGrey']"
          >{{ p }}</NuxtLink>
        </template>
        <NuxtLink
          v-if="currentPage < totalPages"
          :to="`/shop?page=${currentPage + 1}`"
          class="inline-flex items-center justify-center min-h-[44px] min-w-[44px] px-4 py-2 border border-greyLines rounded text-sm hover:bg-uiGrey"
          aria-label="Next page"
        >Next</NuxtLink>
      </nav>
    </div>

    <!-- FAQ + Newsletter — siblings inside one wrapper per merchery section D. -->
    <div class="mx-auto w-full max-w-screen-3xl px-5 sm:px-6 lg:px-8 mt-16 flex flex-col gap-12 mb-12">
      <AppFaq />
      <AppNewsletter />
    </div>
  </div>
</template>

<script setup lang="ts">
import FilterPill from '~/components/ui/FilterPill.vue'
import MobileFilterSheet from '~/components/ui/MobileFilterSheet.vue'
import { applySort, filterOptions, useFilterOptions, useProductTypeIds } from '~/utils/filters'

useHead({
  title: 'Shop · GhostMark Studio',
  meta: [{ name: 'description', content: 'Shop the GhostMark Canon — pieces designed in our Bordeaux studio. Per-unit prices, no minimums. Restocked irregularly.' }],
})

const route = useRoute()
const sdk = useMedusaClient()
const regionState = useRegion()

const PAGE_SIZE = 24
const currentPage = computed(() => Math.max(1, parseInt(String(route.query.page || '1'), 10) || 1))

const categoryFilter = ref<string[]>([])
const priceFilter = ref<string[]>([])
const colorFilter = ref<string[]>([])
const brandFilter = ref<string[]>([])
const sortBy = ref<string>('relevance')

// Mobile sheet state — desktop pill row above stays the active surface ≥md.
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

// Live filter options — Medusa-backed `category`/`color`/`brand` pills with
// static fallback. `price`/`sort` remain static (domain-specific per the
// filters.ts header docblock).
const { liveOptions, ensureResolved: ensureFilterOptionsResolved } = useFilterOptions()
await ensureFilterOptionsResolved()

// Resolve product-type IDs so we can pass `type_id` to the Store API and let
// the backend narrow to apparel-only — /shop is the Studio Canon D2C surface,
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
      fields: 'id,handle,title,subtitle,description,thumbnail,*images,*variants.calculated_price,*variants.options.value,*options.values,*type,metadata,*tags',
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
// Defensive client-side filter — if we couldn't resolve a type_id (backend
// didn't expose `productType.list` AND the harvest fallback returned 0 types,
// or the seed hasn't run yet), narrow the grid by `product.type.value` so
// /shop never accidentally renders POD/custom products.
const sortedProducts = computed(() => {
  const sorted = applySort(products.value, sortBy.value)
  if (apparelTypeId.value) return sorted // server already filtered
  return sorted.filter((p: any) => String(p?.type?.value ?? '').toLowerCase() === 'apparel')
})
</script>
