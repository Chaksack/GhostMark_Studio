<script setup lang="ts">
/**
 * /categories/[parent]/[sub] — nested taxonomy leaf.
 *
 * Merchery PLP shell: breadcrumb, oversized H1, intro paragraph, filter bar,
 * 4-up product grid filtered by `category_id`. The sub-category handle is the
 * URL-leaf segment (Medusa's `handle` field carries the parent-prefixed slug
 * so the resolver doesn't need to walk the parent chain).
 *
 * SSR / failure model:
 *   - `useAsyncData` keys include both params + region id.
 *   - All SDK calls are wrapped — backend downtime renders an empty state.
 *
 * Region awareness: without `region_id`, Medusa returns
 * `calculated_price = null` and ProductCard strips every sticker.
 * `ensureRegion()` is awaited before product list to avoid silent breakage.
 */
import FilterPill from '~/components/ui/FilterPill.vue'
import MobileFilterSheet from '~/components/ui/MobileFilterSheet.vue'
import { applySort, filterOptions, useFilterOptions } from '~/utils/filters'

defineOptions({ name: 'PageCategorySub' })

const route = useRoute()
const sdk = useMedusaClient()
const { region, ensureRegion } = useRegion()

const parent = computed(() => String(route.params.parent ?? ''))
const sub = computed(() => String(route.params.sub ?? ''))

await ensureRegion()

// Live filter options — Medusa-backed `category`/`color`/`brand` pills with
// static fallback. `price`/`quantity`/`leadTime`/`sort` remain on the static
// `filterOptions` import (domain-specific, see filters.ts header docblock).
const { liveOptions, ensureResolved: ensureFilterOptionsResolved } = useFilterOptions()
await ensureFilterOptionsResolved()

const { data: category } = await useAsyncData(
  `category-${parent.value}-${sub.value}`,
  async () => {
    try {
      const res = await sdk.store.category.list({
        handle: sub.value,
        limit: 1,
        fields: 'id,name,handle,description,parent_category_id',
      })
      return res.product_categories?.[0] ?? null
    }
    catch {
      return null
    }
  },
)

const { data: products } = await useAsyncData(
  `category-products-${sub.value}-${region.value?.id ?? 'no-region'}`,
  async () => {
    if (!category.value) return []
    try {
      const res = await sdk.store.product.list({
        category_id: [category.value.id],
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
  { watch: [() => category.value?.id, () => region.value?.id] },
)

useHead(() => ({
  title: category.value
    ? `${category.value.name} · ${parent.value} · GhostMark Studio`
    : 'Category · GhostMark Studio',
  meta: [
    {
      name: 'description',
      content: category.value?.description
        ? String(category.value.description)
        : `Shop the ${sub.value} corner of GhostMark Studio's ${parent.value} catalogue.`,
    },
  ],
}))

// --- Filter state — same shape as sibling PLPs.
const categoryFilter = ref<string[]>([])
const priceFilter = ref<string[]>([])
const quantityFilter = ref<string[]>([])
const leadTimeFilter = ref<string[]>([])
const colorFilter = ref<string[]>([])
const brandFilter = ref<string[]>([])
const fastShipping = ref(false)
const sortBy = ref<string>('relevance')

const sortedProducts = computed(() => applySort(products.value as any[], sortBy.value))

// --- Mobile sheet state — wires the two-button row to a real bottom sheet.
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
      <!-- Breadcrumb — flow at <md so a 5-segment trail (Home / All products /
           parent / sub) can wrap onto two lines without colliding with H1.
           Floats absolute at md+ where there's vertical headroom. -->
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
            <NuxtLink :to="`/categories/${parent}`" class="text-sm text-greyText hover:text-ink-950 hover:underline capitalize">
              {{ parent }}
            </NuxtLink>
          </li>
          <li class="text-sm text-greyText" aria-hidden="true">
            /
          </li>
          <li>
            <span class="text-sm text-ink-950 capitalize" aria-current="page">{{ category?.name ?? sub }}</span>
          </li>
        </ol>
      </nav>

      <h1 class="relative mb-[3rem] max-w-[110rem] pt-[2rem] md:pt-[6rem] lg:pt-[10rem] mt-0 lg:mb-[6rem] text-[4rem] sm:text-[4.4rem] lg:text-[8rem] leading-[4.4rem] sm:leading-[4.8rem] lg:leading-[8.8rem] tracking-[-0.01em]">
        {{ category?.name ?? sub }}
      </h1>

      <p v-if="category?.description" class="mb-[6rem] max-w-[56rem]">
        {{ category.description }}
      </p>
      <p v-else class="mb-[6rem] max-w-[56rem]">
        The {{ category?.name ?? sub }} edit from GhostMark Studio &mdash; considered objects
        for the brands and teams that take taste seriously. Order from 25 pieces, e-proof in 48 hours.
      </p>

      <!-- Friendly empty state when the sub-handle is missing in Medusa.
           Always offer a path back to the parent category and to the full
           PLP so the visitor never feels stuck. -->
      <div v-if="!category" class="mb-12 flex flex-col gap-6 rounded border border-greyLines bg-cream-tile p-8 lg:flex-row lg:items-center lg:justify-between">
        <p class="max-w-[44rem] font-body text-body text-ink-700">
          We're stocking this shelf — check back soon, or jump up a level and
          browse the full <span class="capitalize">{{ parent }}</span> edit.
        </p>
        <div class="flex flex-wrap gap-3">
          <UiButton
            variant="merchery"
            size="lg"
            as="NuxtLink"
            :to="`/categories/${parent}`"
          >
            Back to <span class="capitalize">{{ parent }}</span>
          </UiButton>
          <UiButton
            variant="outline"
            size="lg"
            as="NuxtLink"
            to="/products"
          >
            See all products
          </UiButton>
        </div>
      </div>

      <template v-else>
        <!-- Desktop filter bar -->
        <nav class="hidden md:flex justify-between items-start gap-4 pb-[1rem] border-b border-greyLines">
          <div class="flex gap-[10px] flex-wrap">
            <FilterPill v-model="categoryFilter" label="Category" :options="liveOptions.category" data-test="filter-category" />
            <FilterPill v-model="priceFilter" label="Price range" :options="filterOptions.price" data-test="filter-price" />
            <FilterPill v-model="quantityFilter" label="Quantity" :options="filterOptions.quantity" data-test="filter-quantity" />
            <FilterPill v-model="leadTimeFilter" label="Lead time" :options="filterOptions.leadTime" data-test="filter-leadtime" />
            <FilterPill v-model="colorFilter" label="Color" :options="liveOptions.color" data-test="filter-color" />
            <FilterPill v-model="brandFilter" label="Brands" :options="liveOptions.brand" data-test="filter-brand" />
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

        <!-- Mobile filter bar — wired (drops the inert version that used the
             extra `mx-[1.5rem]` margin which caused horizontal overflow at
             320). 48px tall buttons satisfy WCAG 2.1 AA touch target rules. -->
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

        <!-- Mobile bottom sheets — Teleported to <body>, full-height drawer. -->
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
            No products in this category yet — check back soon, or browse the
            <NuxtLink :to="`/categories/${parent}`" class="ml-1 capitalize text-ink-950 underline decoration-dashed underline-offset-4 hover:decoration-solid">
              full {{ parent }} edit
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
