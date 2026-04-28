<template>
  <div class="lg:pt-[118px]">
    <div class="relative px-[1.5rem] lg:px-[3rem]">
      <!-- Breadcrumb — static-flow at <md so it can never overlap a wrapping
           H1 at 320px; lifts to absolute at md+ where there's headroom. -->
      <nav class="pt-[2rem] md:absolute md:top-[2rem] md:pt-0" aria-label="breadcrumbs">
        <ol class="flex flex-wrap items-center gap-x-1 gap-y-0">
          <li>
            <NuxtLink to="/" class="text-sm text-greyText hover:text-ink-950 hover:underline">
              Home
            </NuxtLink>
          </li>
          <li class="text-sm text-greyText" aria-hidden="true">
            /
          </li>
          <li>
            <span class="text-sm text-ink-950" aria-current="page">All products</span>
          </li>
        </ol>
      </nav>

      <h1 class="relative mb-[3rem] max-w-[110rem] pt-[2rem] md:pt-[6rem] lg:pt-[10rem] mt-0 lg:mb-[6rem] text-[4rem] sm:text-[4.4rem] lg:text-[8rem] leading-[4.4rem] sm:leading-[4.8rem] lg:leading-[8.8rem] tracking-[-0.01em]">
        Branded objects for studios &amp; teams
      </h1>

      <p class="mb-[6rem] max-w-[56rem]">
        A working catalogue of laser-engraved, DTF-printed and apparel-finished pieces &mdash;
        produced in Bordeaux for the studios, agencies and teams that take taste seriously.
        Order from 25 pieces. E-proof in 48 hours.
      </p>

      <!-- Desktop filter bar — wired FilterPill instances backed by local refs.
           State is presentational only (no backend facet wiring yet); only the
           `sortBy` ref drives a real client-side reorder of `sortedProducts`. -->
      <nav class="hidden md:flex justify-between items-start gap-4 pb-[1rem] border-b border-greyLines">
        <div class="flex gap-[10px] flex-wrap">
          <FilterPill v-model="categoryFilter" label="Category" :options="filterOptions.category" data-test="filter-category" />
          <FilterPill v-model="priceFilter" label="Price range" :options="filterOptions.price" data-test="filter-price" />
          <FilterPill v-model="quantityFilter" label="Quantity" :options="filterOptions.quantity" data-test="filter-quantity" />
          <FilterPill v-model="leadTimeFilter" label="Lead time" :options="filterOptions.leadTime" data-test="filter-leadtime" />
          <FilterPill v-model="colorFilter" label="Color" :options="filterOptions.color" data-test="filter-color" />
          <FilterPill v-model="brandFilter" label="Brands" :options="filterOptions.brand" data-test="filter-brand" />
          <label class="inline-flex items-center min-h-[44px] gap-2 px-3 py-2 border border-greyLines rounded cursor-pointer hover:bg-uiGrey" data-test="filter-fast-shipping">
            <input v-model="fastShipping" type="checkbox" class="w-5 h-5 rounded border-greyLines text-ink-950 focus:ring-ink-950">
            <span class="text-[14px] text-ink-950">Fast shipping only</span>
          </label>
        </div>
        <FilterPill
          v-model="sortBy"
          label="Sort by"
          :options="filterOptions.sort"
          :multi="false"
          data-test="filter-sort"
        />
      </nav>

      <!-- Mobile filter bar — two-button row (Filters / Sort) that opens
           a full-height bottom sheet. Desktop pills above remain the active
           surface ≥md; this is the <md surface only. -->
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

      <!-- Mobile bottom sheets — teleported to <body> so z-index is unbothered
           by sticky header / breadcrumb stacking contexts. -->
      <MobileFilterSheet
        v-model:open="filterSheetOpen"
        title="Filter products"
        :result-count="sortedProducts.length"
        @clear="onClearFilters"
      >
        <div class="space-y-3">
          <FilterPill v-model="categoryFilter" label="Category" :options="filterOptions.category" data-test="filter-category-mobile" />
          <FilterPill v-model="priceFilter" label="Price range" :options="filterOptions.price" data-test="filter-price-mobile" />
          <FilterPill v-model="quantityFilter" label="Quantity" :options="filterOptions.quantity" data-test="filter-quantity-mobile" />
          <FilterPill v-model="leadTimeFilter" label="Lead time" :options="filterOptions.leadTime" data-test="filter-leadtime-mobile" />
          <FilterPill v-model="colorFilter" label="Color" :options="filterOptions.color" data-test="filter-color-mobile" />
          <FilterPill v-model="brandFilter" label="Brands" :options="filterOptions.brand" data-test="filter-brand-mobile" />
          <label class="flex items-center min-h-[48px] gap-3 cursor-pointer" data-test="filter-fast-shipping-mobile">
            <input v-model="fastShipping" type="checkbox" class="w-5 h-5 rounded border-greyLines text-ink-950 focus:ring-ink-950">
            <span class="text-[16px] text-ink-950">Fast shipping only</span>
          </label>
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

      <!-- Result count — sits above the grid so the visitor sees scope before scroll. -->
      <div v-if="!pending && !error" class="flex items-center justify-between mt-[3rem] mb-[1.5rem] text-sm text-greyText">
        <p>
          Showing
          <span class="font-medium text-ink-950">{{ products.length }}</span>
          of
          <span class="font-medium text-ink-950">{{ totalCount }}</span>
          products
        </p>
      </div>

      <!-- Product grid -->
      <div v-if="pending" class="py-20 text-center text-zinc-500">
        Loading products&hellip;
      </div>
      <div v-else-if="error" class="py-20 text-center text-zinc-500">
        Couldn't load products.
      </div>

      <ul
        v-else-if="sortedProducts.length"
        class="grid grid-cols-2 gap-[1.6rem] md:grid-cols-3 lg:grid-cols-4 lg:gap-[3rem]"
      >
        <ProductCard
          v-for="p in sortedProducts"
          :key="p.id"
          :product="p"
        />
      </ul>
      <!-- Empty state — friendly copy + clear CTA back to the unscoped catalogue
           or category index. Mirrors the merchery PLP "shelf is restocking"
           pattern so a 0-result page never feels like a dead-end. -->
      <div v-else class="py-12 text-center">
        <p class="mx-auto max-w-[44rem] font-body text-body text-ink-500">
          No products match those filters yet.
          <button
            type="button"
            class="ml-1 text-ink-950 underline decoration-dashed underline-offset-4 hover:decoration-solid"
            @click="onClearFilters"
          >
            Clear all filters
          </button>
          or
          <NuxtLink to="/categories" class="ml-1 text-ink-950 underline decoration-dashed underline-offset-4 hover:decoration-solid">
            browse by category
          </NuxtLink>.
        </p>
      </div>

      <!-- Pagination — URL-driven (`?page=N`). Hidden when the catalogue
           fits on a single page so the empty nav doesn't add visual noise. -->
      <nav
        v-if="!pending && !error && totalPages > 1"
        class="flex items-center justify-center flex-wrap gap-2 mt-[4rem]"
        aria-label="Pagination"
      >
        <NuxtLink
          v-if="currentPage > 1"
          :to="`/products?page=${currentPage - 1}`"
          class="inline-flex items-center justify-center min-h-[44px] min-w-[44px] px-4 py-2 border border-greyLines rounded text-sm hover:bg-uiGrey"
          aria-label="Previous page"
        >
          Previous
        </NuxtLink>
        <template v-for="(p, idx) in visiblePages" :key="`${p}-${idx}`">
          <span
            v-if="typeof p === 'string'"
            class="inline-flex items-center justify-center min-h-[44px] min-w-[24px] px-1 text-sm text-greyText"
            aria-hidden="true"
          >{{ p }}</span>
          <NuxtLink
            v-else
            :to="`/products?page=${p}`"
            :aria-current="p === currentPage ? 'page' : undefined"
            :aria-label="`Go to page ${p}`"
            :class="[
              'inline-flex items-center justify-center min-h-[44px] min-w-[44px] px-3 py-2 text-sm rounded',
              p === currentPage
                ? 'bg-ink-950 text-cream-50 font-medium'
                : 'border border-greyLines hover:bg-uiGrey',
            ]"
          >
            {{ p }}
          </NuxtLink>
        </template>
        <NuxtLink
          v-if="currentPage < totalPages"
          :to="`/products?page=${currentPage + 1}`"
          class="inline-flex items-center justify-center min-h-[44px] min-w-[44px] px-4 py-2 border border-greyLines rounded text-sm hover:bg-uiGrey"
          aria-label="Next page"
        >
          Next
        </NuxtLink>
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
import { applySort, filterOptions } from '~/utils/filters'

useHead({ title: 'Shop' })
const sdk = useMedusaClient()
const regionState = useRegion()
const route = useRoute()

// Page size keeps the grid to a tight 6-row 4-up rhythm on desktop. Bump
// here (and confirm `visiblePages` still scans cleanly) if merch wants more
// density per page.
const PAGE_SIZE = 24

// `?page=N` is the source of truth — bookmarkable, shareable, and survives
// region switches. We clamp to >=1 so a manually typed `?page=0` doesn't
// generate a negative offset on the SDK call.
const currentPage = computed(() => {
  const raw = parseInt(String(route.query.page ?? '1'), 10)
  return Number.isFinite(raw) && raw > 0 ? raw : 1
})

// --- Filter state -------------------------------------------------------
//
// Each multi-select pill owns its own ref. Sort by is single-select and
// drives `sortedProducts` below. `fastShipping` is a one-off boolean tied
// to the standalone checkbox in the bar. None of these refs are wired to
// the backend yet — the merchery facet taxonomy hasn't been modelled in
// Medusa, so this is the "looks live, fakes the filtering" pass.
const categoryFilter = ref<string[]>([])
const priceFilter = ref<string[]>([])
const quantityFilter = ref<string[]>([])
const leadTimeFilter = ref<string[]>([])
const colorFilter = ref<string[]>([])
const brandFilter = ref<string[]>([])
const fastShipping = ref(false)
const sortBy = ref<string>('relevance')

// --- Mobile sheet state -------------------------------------------------
//
// The two-button row (`Filters (n) | Sort: <label>`) opens these sheets on
// <md. Desktop (md+) keeps the inline pill row and never instantiates the
// sheet (the component is `lg:hidden` internally too as a belt-and-braces).
const filterSheetOpen = ref(false)
const sortSheetOpen = ref(false)

// Drives the `(n)` badge on the Filters button — sums every active facet so
// the visitor knows at-a-glance whether the catalog is narrowed.
const totalActiveFilters = computed(() =>
  categoryFilter.value.length
  + priceFilter.value.length
  + quantityFilter.value.length
  + leadTimeFilter.value.length
  + colorFilter.value.length
  + brandFilter.value.length
  + (fastShipping.value ? 1 : 0),
)

// Human-readable label for the Sort button. Falls back to "Relevance" if the
// current `sortBy` value drifts out of `filterOptions.sort` (shouldn't happen,
// but better than rendering an empty span).
const sortLabel = computed(() => filterOptions.sort.find(o => o.value === sortBy.value)?.label || 'Relevance')

// Sheet "Clear all" handler — wipes every filter ref but leaves sort alone
// (sort has its own clear via the sort sheet's footer button).
function onClearFilters() {
  categoryFilter.value = []
  priceFilter.value = []
  quantityFilter.value = []
  leadTimeFilter.value = []
  colorFilter.value = []
  brandFilter.value = []
  fastShipping.value = false
}

// Resolve the active region BEFORE listing products. Without `region_id` on
// the request, Medusa returns variants with `calculated_price = null`, which
// silently strips every price tag from the grid.
await regionState.ensureRegion()

// Keyed per (page, region) so navigating pages or switching region triggers
// a fresh fetch instead of replaying a stale cached payload. Medusa returns
// `count` as the unfiltered total — we lean on it for `totalPages`.
const { data, pending, error } = await useAsyncData(
  () => `products-${currentPage.value}-${regionState.regionId.value ?? 'no-region'}`,
  async () => sdk.store.product.list({
    limit: PAGE_SIZE,
    offset: (currentPage.value - 1) * PAGE_SIZE,
    fields: 'id,handle,title,subtitle,description,thumbnail,*images,*variants.calculated_price,*variants.options.value,*options.values,*type,metadata,*tags',
    ...(regionState.regionId.value ? { region_id: regionState.regionId.value } : {}),
  } as any),
  { watch: [() => currentPage.value, () => regionState.regionId.value] },
)

const products = computed(() => (data.value as any)?.products ?? [])
const totalCount = computed(() => (data.value as any)?.count ?? 0)
const totalPages = computed(() => Math.max(1, Math.ceil(totalCount.value / PAGE_SIZE)))

// Compact pager: render every page when the total fits in one row,
// otherwise collapse the middle with ellipses. Strings render as inert
// separators in the template; numbers render as `<NuxtLink>`.
const visiblePages = computed<(number | string)[]>(() => {
  const cur = currentPage.value
  const tot = totalPages.value
  if (tot <= 7) return Array.from({ length: tot }, (_, i) => i + 1)
  if (cur <= 4) return [1, 2, 3, 4, 5, '...', tot]
  if (cur >= tot - 3) return [1, '...', tot - 4, tot - 3, tot - 2, tot - 1, tot]
  return [1, '...', cur - 1, cur, cur + 1, '...', tot]
})

// Client-side sort. `applySort` always returns a new array so `:key="p.id"`
// reordering forces ProductCard to flip into the new slot rather than tear.
// NOTE: this only sorts the CURRENT page — true sort-across-all-pages needs
// a server-side `order` param wired through the SDK call above.
const sortedProducts = computed(() => applySort(products.value, sortBy.value))
</script>
