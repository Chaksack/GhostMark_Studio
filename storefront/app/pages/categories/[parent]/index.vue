<script setup lang="ts">
/**
 * /categories/[parent]: second-tier landing.
 *
 * Renders the parent category title + intro and a 4-up product grid filtered
 * by `category_id`. The merchery shell intentionally drops the
 * "sub-category tiles" intermediate block, visitors go straight from the
 * H1+description to the filter bar to the grid, matching merchery's PLP.
 *
 * Resolution chain:
 *   1. Look up the parent by handle (one round trip, with descendants).
 *   2. Fetch products with `category_id = [parent.id]`.
 *
 * Failure modes (all surface a useful page rather than a 404):
 *   - SDK throws / network down → empty state with "browse all products" CTA.
 *   - Handle resolves but Medusa returns 0 categories (not seeded yet) →
 *     friendly "we're stocking this shelf" message with `EDITORIAL_FALLBACK`
 *     copy keyed by handle so the page still feels tailored.
 *   - Handle resolves AND backend returns 0 products → "no products yet"
 *     with link back to the full catalogue.
 *
 * `discover` and `brands` are NOT real product taxonomy in Medusa, they're
 * editorial entries in the AppHeader nav. We render a curated landing block
 * for them rather than letting the resolver silently 404. (Long-term they
 * should move to /discover and /brands top-level pages, flagged in the
 * route audit; tracked separately.)
 */
import FilterPill from '~/components/ui/FilterPill.vue'
import MobileFilterSheet from '~/components/ui/MobileFilterSheet.vue'
import { applySort, filterOptions, useFilterOptions } from '~/utils/filters'

defineOptions({ name: 'PageCategoryParent' })

const route = useRoute()
const sdk = useMedusaClient()
const { region, ensureRegion } = useRegion()

/**
 * Sort collections by merchandiser priority when set, then by created_at desc.
 *
 * - metadata.discover_priority is a numeric field on the Medusa collection.
 * - Lower number = higher priority (1 first, 2 second, …), standard
 *   "rank from the top" convention.
 * - Collections without the field sink below ranked ones, then sort by
 *   created_at desc (newest first) so new drops still surface naturally.
 */
function sortByDiscoverPriority<T extends { metadata?: any, created_at?: string | Date }>(list: T[]): T[] {
  const arr = [...list]
  arr.sort((a, b) => {
    const pa = Number(a?.metadata?.discover_priority)
    const pb = Number(b?.metadata?.discover_priority)
    const aHas = Number.isFinite(pa)
    const bHas = Number.isFinite(pb)
    if (aHas && bHas) return pa - pb
    if (aHas) return -1
    if (bHas) return 1
    // Both unranked: fall back to created_at desc
    const da = a?.created_at ? new Date(a.created_at).getTime() : 0
    const db = b?.created_at ? new Date(b.created_at).getTime() : 0
    return db - da
  })
  return arr
}

const parent = computed(() => String(route.params.parent ?? ''))

// Handles that are editorial collections, not Medusa product categories.
// When the resolver fails on these, render the curated copy below instead
// of the generic "we couldn't find that" empty state.
const EDITORIAL_HANDLES = new Set(['discover', 'brands'])
const isEditorial = computed(() => EDITORIAL_HANDLES.has(parent.value))

type EditorialCopy = {
  title: string
  lede: string
  cta: { label: string, to: string }
  secondary?: { label: string, to: string }
}

const EDITORIAL_FALLBACK: Record<string, EditorialCopy> = {
  discover: {
    title: 'Discover',
    lede: 'Curated edits, ready-to-build assortments, and ideas the studio is talking about this season. Browse the full catalogue or jump into a theme below.',
    cta: { label: 'See all products', to: '/products' },
    secondary: { label: 'Best sellers', to: '/products?sort=bestsellers' },
  },
  brands: {
    title: 'Brands',
    lede: 'Shop premium label partners (Patagonia, Kinto, Moleskine, Yeti and more) when the product identity matters as much as the logo. We layer your branding on top of pieces people already trust.',
    cta: { label: 'Browse all brands', to: '/products' },
    secondary: { label: 'Talk to us', to: '/contact' },
  },
}

// Friendly per-handle fallback intro for slugs that exist in the AppHeader
// nav but might not be seeded in Medusa yet. Keeps the H1 / breadcrumb /
// CTA all looking deliberate rather than broken.
const HANDLE_FALLBACK_COPY: Record<string, { title: string, lede: string }> = {
  apparel: {
    title: 'Apparel',
    lede: 'Heavyweight hoodies, crisp tees, and premium outerwear: the everyday uniform of the brand. Order from 25 pieces, e-proof in 48 hours.',
  },
  bags: {
    title: 'Bags',
    lede: 'Structured totes, tech sleeves, and travel duffels designed to feel considered, not disposable. Built for events, onboarding, and retail drops.',
  },
  headwear: {
    title: 'Headwear',
    lede: 'Low-profile caps and beanies in elevated materials. Embroidery, woven patches, and tonal branding that keeps your logo understated and sharp.',
  },
  office: {
    title: 'Office',
    lede: 'Notebooks, pens, and desk objects people actually keep in rotation. Tasteful pieces for company stores and gifting programs.',
  },
  drinkware: {
    title: 'Drinkware',
    lede: 'Thermal bottles, tumblers, and ceramic mugs built to travel between commute, desk, and gym, with room for subtle branding.',
  },
  home: {
    title: 'Home',
    lede: 'Candles, throws, and tableware chosen for premium seasonal drops and client gifts. Branded objects that look like they belong in the home.',
  },
  wellness: {
    title: 'Wellness',
    lede: 'Yoga gear, recovery tools, and outdoor accessories for retreats, perks, and active communities. Anything but throwaway swag.',
  },
  others: {
    title: 'Others',
    lede: 'Games, travel goods, pet accessories, and limited runs. The unexpected extras that round out custom stores and curated campaigns.',
  },
}

await ensureRegion()

// Live filter options: Medusa-backed `category`/`color`/`brand` pills with
// static fallback. `price`/`quantity`/`leadTime`/`sort` remain on the static
// `filterOptions` import (domain-specific, see filters.ts header docblock).
const { liveOptions, ensureResolved: ensureFilterOptionsResolved } = useFilterOptions()
await ensureFilterOptionsResolved()

const { data: category } = await useAsyncData(
  `category-parent-${parent.value}`,
  async () => {
    try {
      const res = await sdk.store.category.list({
        handle: parent.value,
        limit: 1,
        include_descendants_tree: true,
        fields:
          'id,name,handle,description,category_children.id,category_children.name,category_children.handle',
      })
      return res.product_categories?.[0] ?? null
    }
    catch {
      return null
    }
  },
)

// Discover slug: pull live Medusa collections so the curated landing renders
// real merchandised data (e.g. "DTF", "Hot Deals") rather than a static CTA
// panel. Brands stays editorial: there's no live brand taxonomy in Medusa
// today, so its fallback panel below remains the source of truth.
//
// Failure mode: any SDK error (offline, 5xx, empty seed) collapses to an
// empty array, the template then falls back to the EDITORIAL_FALLBACK CTA
// panel for `discover`, so the page never breaks.
const { data: discoverCollections } = await useAsyncData(
  'category-discover-collections',
  async () => {
    if (parent.value !== 'discover') return []
    try {
      // Pull a larger pool (50) so the merchandiser-priority sort has
      // headroom to rank against; then slide the top 12 onto the page.
      // When no collection sets metadata.discover_priority the helper falls
      // back to created_at desc, preserving today's behaviour.
      const res = await sdk.store.collection.list({
        limit: 50,
        fields: 'id,title,handle,created_at,metadata',
      } as any)
      return sortByDiscoverPriority(((res as any).collections ?? []) as any[]).slice(0, 12)
    }
    catch {
      return []
    }
  },
)

const hasDiscoverCollections = computed(
  () => parent.value === 'discover' && (discoverCollections.value?.length ?? 0) > 0,
)

const { data: products } = await useAsyncData(
  `category-parent-products-${parent.value}-${region.value?.id ?? 'no-region'}`,
  async () => {
    if (!category.value) return []
    try {
      const res = await sdk.store.product.list({
        category_id: [(category.value as any).id],
        region_id: region.value?.id,
        fields: 'id,handle,title,subtitle,description,thumbnail,*images,*variants.calculated_price,*variants.options.value,*options.values,*type,metadata,*tags',
        limit: 24,
      } as any)
      return (res as any).products ?? []
    }
    catch {
      return []
    }
  },
  { watch: [() => (category.value as any)?.id, () => region.value?.id] },
)

// Pretty page title even when Medusa hasn't seeded the handle yet, falls
// back to the editorial / handle-copy lookup so the browser tab + share
// previews never read "Category · GhostMark Studio".
const pageTitle = computed(() => {
  const name
    = (category.value as any)?.name
    ?? EDITORIAL_FALLBACK[parent.value]?.title
    ?? HANDLE_FALLBACK_COPY[parent.value]?.title
    ?? null
  return name ? `${name} · GhostMark Studio` : 'Category · GhostMark Studio'
})

const pageDescription = computed(() => {
  const desc = (category.value as any)?.description
  if (desc) return String(desc)
  if (EDITORIAL_FALLBACK[parent.value]) return EDITORIAL_FALLBACK[parent.value].lede
  if (HANDLE_FALLBACK_COPY[parent.value]) return HANDLE_FALLBACK_COPY[parent.value].lede
  return `Browse the ${parent.value} corner of GhostMark Studio.`
})

useHead(() => ({
  title: pageTitle.value,
  meta: [{ name: 'description', content: pageDescription.value }],
}))

// --- Filter state: one ref per multi-select pill, plus the single-select
// `sortBy` and the standalone `fastShipping` checkbox. Backend facet wiring
// is out of scope; only sort drives the visible grid order today.
const categoryFilter = ref<string[]>([])
const priceFilter = ref<string[]>([])
const quantityFilter = ref<string[]>([])
const leadTimeFilter = ref<string[]>([])
const colorFilter = ref<string[]>([])
const brandFilter = ref<string[]>([])
const fastShipping = ref(false)
const sortBy = ref<string>('relevance')

const sortedProducts = computed(() => applySort(products.value as any[], sortBy.value))

// --- Mobile sheet state: same pattern as /products + /shop so the
// two-button row (Filter / Sort) can open a real bottom sheet rather than
// the previous inert placeholder buttons.
const filterSheetOpen = ref(false)
const sortSheetOpen = ref(false)
const totalActiveFilters = computed(() =>
  categoryFilter.value.length
  + priceFilter.value.length
  + quantityFilter.value.length
  + leadTimeFilter.value.length
  + colorFilter.value.length
  + brandFilter.value.length
  + (fastShipping.value ? 1 : 0),
)
const sortLabel = computed(() => filterOptions.sort.find(o => o.value === sortBy.value)?.label || 'Relevance')
function onClearFilters() {
  categoryFilter.value = []
  priceFilter.value = []
  quantityFilter.value = []
  leadTimeFilter.value = []
  colorFilter.value = []
  brandFilter.value = []
  fastShipping.value = false
}
</script>

<template>
  <div>
    <div class="relative mx-auto w-full max-w-rail px-gutter">
      <!-- Breadcrumb: flow at <md so it can never collide with a wrapping
           H1 (this route's titles are dynamic, "drinkware", "wellness", ...,
           so we can't predict line count). Floats absolute at md+. -->
      <nav class="pt-[2rem] md:absolute md:top-[2rem] md:z-10 md:pt-0" aria-label="breadcrumbs">
        <ol class="flex flex-wrap items-center gap-x-1 gap-y-0">
          <li>
            <NuxtLink to="/" class="gm-tap-44 text-sm text-greyText hover:text-ink-950 hover:underline">
              Home
            </NuxtLink>
          </li>
          <li class="text-sm text-greyText" aria-hidden="true">
            /
          </li>
          <li>
            <NuxtLink to="/products" class="gm-tap-44 text-sm text-greyText hover:text-ink-950 hover:underline">
              All products
            </NuxtLink>
          </li>
          <li class="text-sm text-greyText" aria-hidden="true">
            /
          </li>
          <li>
            <span class="text-sm text-ink-950 capitalize" aria-current="page">{{ category?.name ?? parent }}</span>
          </li>
        </ol>
      </nav>

      <h1 class="relative mb-[3rem] max-w-[1100px] pt-[2rem] md:pt-[6rem] lg:pt-[10rem] mt-0 lg:mb-[6rem] text-[40px] sm:text-[44px] lg:text-[80px] leading-[44px] sm:leading-[48px] lg:leading-[88px] capitalize tracking-[-0.01em]">
        {{ (category as any)?.name ?? EDITORIAL_FALLBACK[parent]?.title ?? HANDLE_FALLBACK_COPY[parent]?.title ?? parent }}
      </h1>

      <p v-if="(category as any)?.description" class="mb-[6rem] max-w-[560px]">
        {{ (category as any).description }}
      </p>
      <p v-else-if="isEditorial" class="mb-[6rem] max-w-[560px]">
        {{ EDITORIAL_FALLBACK[parent].lede }}
      </p>
      <p v-else-if="HANDLE_FALLBACK_COPY[parent]" class="mb-[6rem] max-w-[560px]">
        {{ HANDLE_FALLBACK_COPY[parent].lede }}
      </p>
      <p v-else class="mb-[6rem] max-w-[560px]">
        Browse the {{ parent }} corner of the GhostMark catalogue,
        produced in Bordeaux for studios and teams. Order from 25 pieces, e-proof in 48 hours.
      </p>

      <!-- Discover w/ live collections: render the actual merchandised
           collections (DTF, Hot Deals, ...) as a 3-up grid of cream tiles
           that link straight to /collections/{handle}. Mirrors the
           /collections index layout so the surfaces stay coherent. -->
      <section
        v-if="hasDiscoverCollections"
        class="mb-12"
        aria-labelledby="discover-collections-heading"
      >
        <h2 id="discover-collections-heading" class="sr-only">
          Curated collections
        </h2>
        <ul class="grid grid-cols-1 gap-x-[30px] gap-y-[30px] sm:grid-cols-2 lg:grid-cols-3">
          <li
            v-for="col in (discoverCollections as any[])"
            :key="col.handle ?? col.id"
          >
            <NuxtLink
              :to="`/collections/${col.handle}`"
              class="group flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 bg-cream-tile p-6 text-center transition-colors duration-base ease-emphasis hover:bg-cream-warm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900 focus-visible:ring-offset-2 focus-visible:ring-offset-cream-50"
            >
              <span class="font-display text-display-sm font-normal text-ink-950">
                {{ col.title }}
              </span>
              <span class="font-body text-caption text-ink-500">
                Shop collection &rarr;
              </span>
            </NuxtLink>
          </li>
        </ul>
      </section>

      <!-- Editorial routes (Discover w/ 0 live collections / Brands): no
           Medusa data to render, but we still want a useful landing page
           rather than the "we couldn't find it" gut-punch. Show a curated
           CTA panel and skip the filter bar. -->
      <div
        v-else-if="isEditorial"
        class="mb-12 flex flex-col gap-6 rounded border border-greyLines bg-cream-tile p-8 lg:flex-row lg:items-center lg:justify-between"
      >
        <p class="max-w-[440px] font-body text-body text-ink-700">
          This shelf is curated rather than a single product category. Use the
          buttons to dive into the catalogue, or tell us what you're sourcing.
        </p>
        <div class="flex flex-wrap gap-3">
          <UiButton
            variant="merchery"
            size="lg"
            as="NuxtLink"
            :to="EDITORIAL_FALLBACK[parent].cta.to"
          >
            {{ EDITORIAL_FALLBACK[parent].cta.label }}
          </UiButton>
          <UiButton
            v-if="EDITORIAL_FALLBACK[parent].secondary"
            variant="outline"
            size="lg"
            as="NuxtLink"
            :to="EDITORIAL_FALLBACK[parent].secondary!.to"
          >
            {{ EDITORIAL_FALLBACK[parent].secondary!.label }}
          </UiButton>
        </div>
      </div>

      <!-- Friendly empty state when a normal product handle is missing from
           Medusa (backend not seeded, downtime, etc.), never show the raw
           "we couldn't find" copy to a real shopper. -->
      <div v-else-if="!category" class="mb-12 flex flex-col gap-6 rounded border border-greyLines bg-cream-tile p-8 lg:flex-row lg:items-center lg:justify-between">
        <p class="max-w-[440px] font-body text-body text-ink-700">
          We're stocking this shelf. Check back soon, or browse everything in the catalogue while we restock.
        </p>
        <div class="flex flex-wrap gap-3">
          <UiButton
            variant="merchery"
            size="lg"
            as="NuxtLink"
            to="/products"
          >
            See all products
          </UiButton>
          <UiButton
            variant="outline"
            size="lg"
            as="NuxtLink"
            to="/categories"
          >
            All categories
          </UiButton>
        </div>
      </div>

      <template v-if="category && !isEditorial">
        <!-- Desktop filter bar -->
        <nav class="hidden md:flex justify-between items-start gap-4 pb-[1rem] border-b border-greyLines">
          <div class="flex gap-[10px] flex-wrap">
            <FilterPill v-model="categoryFilter" label="Category" :options="liveOptions.category" data-test="filter-category" />
            <FilterPill v-model="priceFilter" label="Price range" :options="filterOptions.price" data-test="filter-price" />
            <FilterPill v-model="quantityFilter" label="Quantity" :options="filterOptions.quantity" data-test="filter-quantity" />
            <FilterPill v-model="leadTimeFilter" label="Lead time" :options="filterOptions.leadTime" data-test="filter-leadtime" />
            <FilterPill v-model="colorFilter" label="Color" :options="liveOptions.color" data-test="filter-color" />
            <FilterPill v-model="brandFilter" label="Brands" :options="liveOptions.brand" data-test="filter-brand" />
            <label class="inline-flex items-center min-h-[44px] gap-2 px-3 py-2 border border-greyLines rounded-none cursor-pointer hover:bg-uiGrey" data-test="filter-fast-shipping">
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

        <!-- Mobile filter bar: wired two-button row (Filter / Sort). Drops the
             previous `mx-[1.5rem]` (the parent already has `px-[1.5rem]`, so
             nesting margins blew the row out at 320). 48px tall hits WCAG. -->
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

        <!-- Mobile bottom sheets: Teleported, full-height drawer pattern. -->
        <MobileFilterSheet
          v-model:open="filterSheetOpen"
          title="Filter products"
          :result-count="sortedProducts?.length ?? 0"
          @clear="onClearFilters"
        >
          <div class="space-y-3">
            <FilterPill v-model="categoryFilter" label="Category" :options="liveOptions.category" data-test="filter-category-mobile" />
            <FilterPill v-model="priceFilter" label="Price range" :options="filterOptions.price" data-test="filter-price-mobile" />
            <FilterPill v-model="quantityFilter" label="Quantity" :options="filterOptions.quantity" data-test="filter-quantity-mobile" />
            <FilterPill v-model="leadTimeFilter" label="Lead time" :options="filterOptions.leadTime" data-test="filter-leadtime-mobile" />
            <FilterPill v-model="colorFilter" label="Color" :options="liveOptions.color" data-test="filter-color-mobile" />
            <FilterPill v-model="brandFilter" label="Brands" :options="liveOptions.brand" data-test="filter-brand-mobile" />
            <label class="flex items-center min-h-[48px] gap-3 cursor-pointer" data-test="filter-fast-shipping-mobile">
              <input v-model="fastShipping" type="checkbox" class="w-5 h-5 rounded border-greyLines text-ink-950 focus:ring-ink-950">
              <span class="text-[16px] text-ink-950">Fast shipping only</span>
            </label>
          </div>
        </MobileFilterSheet>

        <MobileFilterSheet
          v-model:open="sortSheetOpen"
          title="Sort products"
          :result-count="sortedProducts?.length ?? 0"
          @clear="sortBy = 'relevance'"
        >
          <FilterPill v-model="sortBy" label="Sort by" :options="filterOptions.sort" :multi="false" />
        </MobileFilterSheet>

        <ul
          v-if="sortedProducts?.length"
          class="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-5 lg:gap-y-10 xl:grid-cols-5 mt-[3rem]"
        >
          <ProductCard
            v-for="p in sortedProducts"
            :key="p.id"
            :product="p"
          />
        </ul>

        <div v-else class="py-12 text-center">
          <p class="mx-auto max-w-[440px] font-body text-body text-ink-500">
            No products on this shelf yet. We're sourcing.
            <NuxtLink to="/products" class="ml-1 text-ink-950 underline decoration-dashed underline-offset-4 hover:decoration-solid">
              Browse all products
            </NuxtLink>
            or
            <NuxtLink to="/contact" class="ml-1 text-ink-950 underline decoration-dashed underline-offset-4 hover:decoration-solid">
              tell us what you're after
            </NuxtLink>.
          </p>
        </div>
      </template>
    </div>

    <div class="mx-auto w-full max-w-rail px-gutter mt-16 flex flex-col gap-12 mb-12">
      <AppFaq />
      <AppNewsletter />
    </div>
  </div>
</template>
