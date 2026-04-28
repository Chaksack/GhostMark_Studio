<script setup lang="ts">
/**
 * /collections/[handle] — single curated collection.
 *
 * Mirrors the merchery PLP shell (oversized H1 + intro + filter bar + 4-up
 * grid) and adds collection-aware copy. Resolves the collection by handle via
 * `sdk.store.collection.list({ handle })`, then lists products scoped to that
 * collection id with region-aware pricing so calculated_price doesn't come
 * back null.
 *
 * Failure modes resolve to a soft "not found" panel inside the same route —
 * we never throw a 404 status (intentional: the /collections index already
 * deep-links to handles).
 */
import type { StoreCollection, StoreProduct } from '@medusajs/types'
import FilterPill from '~/components/ui/FilterPill.vue'
import MobileFilterSheet from '~/components/ui/MobileFilterSheet.vue'
import { applySort, filterOptions } from '~/utils/filters'

defineOptions({ name: 'PageCollectionHandle' })

const route = useRoute()
const sdk = useMedusaClient()
const regionState = useRegion()

const handle = computed(() => String(route.params.handle))

await regionState.ensureRegion()

const { data: collection } = await useAsyncData<StoreCollection | null>(
  () => `collection-${handle.value}`,
  async () => {
    try {
      const res = await sdk.store.collection.list({ handle: handle.value, limit: 1 })
      return (res.collections?.[0] ?? null) as StoreCollection | null
    }
    catch {
      return null
    }
  },
  { watch: [handle] },
)

const { data: products } = await useAsyncData<StoreProduct[]>(
  () => `collection-products-${handle.value}-${regionState.regionId.value ?? 'no-region'}`,
  async () => {
    if (!collection.value?.id) return []
    try {
      const res = await sdk.store.product.list({
        collection_id: [collection.value.id],
        fields: 'id,handle,title,subtitle,description,thumbnail,*images,*variants.calculated_price,*variants.options.value,*options.values,*type,metadata,*tags',
        limit: 24,
        ...(regionState.regionId.value ? { region_id: regionState.regionId.value } : {}),
      })
      return (res.products ?? []) as StoreProduct[]
    }
    catch {
      return []
    }
  },
  { watch: [handle, () => regionState.regionId.value, () => collection.value?.id] },
)

useHead(() => ({
  title: collection.value
    ? `${collection.value.title} · GhostMark Studio`
    : 'Collection · GhostMark Studio',
  meta: [
    {
      name: 'description',
      content: (collection.value?.metadata?.description as string | undefined)
        ?? `Shop the ${collection.value?.title ?? handle.value} collection from GhostMark Studio.`,
    },
  ],
}))

// Coerce `images: null` to `undefined` so the StoreProduct[] payload satisfies
// ProductCard's ProductLike shape (which mirrors Medusa minus nullable arrays).
const productCards = computed(() =>
  (products.value ?? []).map(p => ({
    ...p,
    images: p.images ?? undefined,
    variants: p.variants ?? undefined,
  })),
)

// --- Filter state — same merchery pill bar as sibling PLPs.
const categoryFilter = ref<string[]>([])
const priceFilter = ref<string[]>([])
const quantityFilter = ref<string[]>([])
const leadTimeFilter = ref<string[]>([])
const colorFilter = ref<string[]>([])
const brandFilter = ref<string[]>([])
const fastShipping = ref(false)
const sortBy = ref<string>('relevance')

// Sort runs over the already-coerced `productCards` array so `images:null`
// stripping isn't relitigated downstream — `applySort` reads `created_at` and
// the variant pricing we already coerced through.
const sortedProducts = computed(() => applySort(productCards.value as any[], sortBy.value))

// --- Mobile sheet state — same pattern as the rest of the PLP family.
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
  <div class="lg:pt-[118px]">
    <div class="relative px-[1.5rem] lg:px-[3rem]">
      <!-- Breadcrumb — flow at <md so the 4-segment trail wraps cleanly above
           the H1 instead of fighting it for space at 320. -->
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
            <NuxtLink to="/products" class="text-sm text-greyText hover:text-ink-950 hover:underline">
              All products
            </NuxtLink>
          </li>
          <li class="text-sm text-greyText" aria-hidden="true">
            /
          </li>
          <li>
            <NuxtLink to="/collections" class="text-sm text-greyText hover:text-ink-950 hover:underline">
              Collections
            </NuxtLink>
          </li>
          <li class="text-sm text-greyText" aria-hidden="true">
            /
          </li>
          <li>
            <span class="text-sm text-ink-950" aria-current="page">{{ collection?.title ?? handle }}</span>
          </li>
        </ol>
      </nav>

      <h1 class="relative mb-[3rem] max-w-[110rem] pt-[2rem] md:pt-[6rem] lg:pt-[10rem] mt-0 lg:mb-[6rem] text-[4rem] sm:text-[4.4rem] lg:text-[8rem] leading-[4.4rem] sm:leading-[4.8rem] lg:leading-[8.8rem] tracking-[-0.01em] break-words">
        {{ collection?.title ?? handle }}
      </h1>

      <p v-if="(collection?.metadata?.description as string | undefined)" class="mb-[6rem] max-w-[56rem]">
        {{ collection?.metadata?.description }}
      </p>
      <p v-else class="mb-[6rem] max-w-[56rem]">
        A curated edit from the GhostMark Studio canon. Considered objects for studios and
        teams &mdash; produced in Bordeaux from 25 pieces, e-proof in 48 hours.
      </p>

      <div v-if="!collection" class="py-12 text-center">
        <p class="font-body text-body text-ink-500">
          We couldn't find that collection. The handle
          <span class="font-medium text-ink-950">{{ handle }}</span> doesn't match any published collection.
        </p>
      </div>

      <template v-else>
        <!-- Desktop filter bar -->
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

        <!-- Mobile filter bar — wired two-button row. Drops the inert prior
             implementation and the offending `mx-[1.5rem]` (parent already has
             `px-[1.5rem]`, so nesting the margin caused horizontal overflow at
             320). 48px tall row hits WCAG touch target rules. -->
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

        <!-- Mobile bottom sheets — Teleported, full-height drawer pattern. -->
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

        <ul
          v-if="sortedProducts.length"
          class="grid grid-cols-2 gap-[1.6rem] md:grid-cols-3 lg:grid-cols-4 lg:gap-[3rem] mt-[3rem]"
        >
          <ProductCard
            v-for="p in sortedProducts"
            :key="p.id"
            :product="p"
          />
        </ul>

        <div v-else class="py-12 text-center">
          <p class="mx-auto max-w-[44rem] font-body text-body text-ink-500">
            No products in this collection yet.
            <NuxtLink to="/collections" class="ml-1 text-ink-950 underline decoration-dashed underline-offset-4 hover:decoration-solid">
              See all collections
            </NuxtLink>
            or
            <NuxtLink to="/products" class="ml-1 text-ink-950 underline decoration-dashed underline-offset-4 hover:decoration-solid">
              browse the full catalogue
            </NuxtLink>.
          </p>
        </div>
      </template>
    </div>

    <div class="mx-auto w-full max-w-screen-3xl px-5 sm:px-6 lg:px-8 mt-16 flex flex-col gap-12 mb-12">
      <AppFaq />
      <AppNewsletter />
    </div>
  </div>
</template>
