<script setup lang="ts">
/**
 * DiscoverSection: live curated shelves rail.
 *
 * Pulls up to 2 live Medusa collections (e.g. DTF, Hot Deals) and renders
 * each as a "shelf": collection title + a 3-up row of real product cards
 * pulled with region-aware pricing. Empty shelves are filtered out so we
 * never render an "X" heading over an empty grid.
 *
 * Why self-fetched (vs prop-driven):
 *   - The collection rail is a distinct merchandising surface from
 *     BestSellers/RecentlyAdded. The earlier prop-driven version reused
 *     the home page's best-seller fetch as background imagery for three
 *     hardcoded "shelves" (best-sellers / new-hires / holiday), which were
 *     editorial fiction tied to /discover/[slug] copy, not real Medusa
 *     data. Wiring this band to live collections makes it a true CMS
 *     surface that merchandisers can update without a deploy.
 *   - The home page still passes `products` (legacy prop), but the
 *     component now ignores it unless the SDK fetch returns 0 collections,
 *     in which case we degrade to a single "Best sellers" editorial tile
 *     row using those products as photography. Page never goes empty.
 *
 * Failure modes:
 *   - SDK throws on collection.list / product.list → empty shelves array
 *     → editorial fallback renders.
 *   - Collection has 0 products → skipped (don't render an empty shelf).
 *   - 0 live collections AND 0 prop products → render the curated "All
 *     shelves" CTA tile so the section never collapses to a blank band.
 *
 * Region awareness: passes `region_id` when available so `calculated_price`
 * hydrates on the product cards. ensureRegion is called by the host page
 * (index.vue) before this section mounts, so the cookie is warm.
 */
defineOptions({ name: 'DiscoverSection' })

interface MedusaProduct {
  id: string
  handle: string
  title: string
  thumbnail?: string | null
  images?: { url: string }[]
}

interface MedusaCollection {
  id: string
  handle: string
  title: string
  created_at?: string
  metadata?: Record<string, unknown> | null
}

interface Shelf {
  id: string
  handle: string
  title: string
  eyebrow: string
  note: string
  products: MedusaProduct[]
}

// Legacy prop kept for backwards compat with pages/index.vue, only consumed
// by the editorial fallback when the live-collection fetch returns nothing.
const props = withDefaults(defineProps<{
  products?: MedusaProduct[]
}>(), {
  products: () => [],
})

const sdk = useMedusaClient()
const regionState = useRegion()

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

// Curator notes per collection handle. Anything not in this map gets a
// generic "Hand-picked by the studio." fallback so a new collection added
// in Medusa Admin still reads as deliberate on the home page. Keys match
// Medusa collection handles (lowercase, dash-separated).
const COLLECTION_COPY: Record<string, { eyebrow: string, note: string }> = {
  'hot-deals': {
    eyebrow: 'On sale now',
    note: 'Limited-window pricing on studio favourites. Refreshed weekly.',
  },
  'dtf': {
    eyebrow: 'Print finish',
    note: 'Direct-to-film transfers: sharp colour, soft hand, low MOQ.',
  },
}

const { data } = await useAsyncData<Shelf[]>(
  () => `discover-section:${regionState.regionId.value ?? 'no-region'}`,
  async () => {
    try {
      // 1. List a pool of collections, then rank by merchandiser priority
      //    (metadata.discover_priority) and slice the top 2. When the field
      //    is unset everywhere we fall back to Medusa-default created_at
      //    desc inside sortByDiscoverPriority, so today's behaviour is
      //    preserved until merchandisers start setting the field.
      const colRes: any = await sdk.store.collection.list({
        limit: 50,
        fields: 'id,title,handle,created_at,metadata',
      } as any)
      const collections: MedusaCollection[] = sortByDiscoverPriority(
        (colRes?.collections ?? []) as MedusaCollection[],
      ).slice(0, 2)
      if (!collections.length) return []

      // 2. Fan out one product.list per collection. Promise.all keeps the
      //    requests parallel; failures on individual collections collapse
      //    to an empty product array so a single bad shelf can't take the
      //    whole rail down.
      const fields = 'id,handle,title,thumbnail,*images,*variants.calculated_price,*type'
      const enriched = await Promise.all(
        collections.map(async (col): Promise<Shelf> => {
          try {
            const args: Record<string, unknown> = {
              collection_id: [col.id],
              limit: 3,
              fields,
            }
            if (regionState.regionId.value) args.region_id = regionState.regionId.value
            const prodRes: any = await sdk.store.product.list(args as any)
            const copy = COLLECTION_COPY[col.handle] ?? {
              eyebrow: 'Studio shelf',
              note: 'Hand-picked by the studio.',
            }
            return {
              id: col.id,
              handle: col.handle,
              title: col.title,
              eyebrow: copy.eyebrow,
              note: copy.note,
              products: (prodRes?.products ?? []) as MedusaProduct[],
            }
          }
          catch {
            return {
              id: col.id,
              handle: col.handle,
              title: col.title,
              eyebrow: 'Studio shelf',
              note: 'Hand-picked by the studio.',
              products: [],
            }
          }
        }),
      )

      // 3. Drop empty shelves: never render a heading over nothing.
      return enriched.filter(s => s.products.length > 0)
    }
    catch {
      return []
    }
  },
  { watch: [() => regionState.regionId.value] },
)

const shelves = computed<Shelf[]>(() => data.value ?? [])

// Editorial fallback for when 0 live collections come back (offline,
// unseeded backend, empty shelves). Re-uses the home page's best-seller
// products as photography so the band never collapses to dead space.
interface FallbackTile {
  slug: string
  title: string
  eyebrow: string
  note: string
  image: string
  productHandle: string
  productTitle: string
}

const FALLBACK_TILES = [
  { slug: 'best-sellers', title: 'Best sellers', eyebrow: 'The studio canon', note: 'Ranked by re-buy rate, not by margin.' },
  { slug: 'new-hires', title: 'New hires kit', eyebrow: 'Welcome bundles', note: 'A tee, a mug, a notebook, a tote, proportioned as a set.' },
  { slug: 'holiday', title: 'Holiday picks', eyebrow: 'End of year', note: 'Order by mid-November to hit doormats before December 24.' },
] as const

const fallbackTiles = computed<FallbackTile[]>(() => {
  const pool = props.products.filter(p => Boolean(p.thumbnail || p.images?.[0]?.url))
  return FALLBACK_TILES.map((tile, i) => {
    const product = pool.length ? pool[i % pool.length] : undefined
    return {
      ...tile,
      image: product?.thumbnail || product?.images?.[0]?.url || '',
      productHandle: product?.handle ?? '',
      productTitle: product?.title ?? '',
    }
  })
})

const showFallback = computed(() => shelves.value.length === 0)
</script>

<template>
  <section
    class="mx-auto w-full max-w-rail px-gutter"
    aria-labelledby="discover-section-heading"
  >
    <div class="flex items-end justify-between gap-4">
      <div class="min-w-0">
        <!-- Same ramp as BestSellers/RecentlyAdded: sibling sections share rhythm. -->
        <h2
          id="discover-section-heading"
          class="gm-display gm-display-lg text-ink-950"
        >
          Discover
        </h2>
        <!-- Eyebrow sub-line. 13-16px ramp, never competes with the H2. -->
        <p class="mt-2 text-[13px] leading-[1.5] text-ink-700 sm:mt-3 sm:text-[14px] md:mt-4 md:text-[15px] lg:mt-5 lg:text-[16px]">
          {{ showFallback ? 'Curated shelves' : 'Curated collections: refreshed when something good lands.' }}
        </p>
      </div>
      <NuxtLink
        :to="showFallback ? '/discover' : '/collections'"
        class="shrink-0 text-[13px] text-ink-500 transition-colors duration-200 hover:text-ink-950 hover:underline sm:text-[14px]"
      >
        {{ showFallback ? 'All shelves &rarr;' : 'All collections &rarr;' }}
      </NuxtLink>
    </div>

    <!--
      Live shelves: one block per Medusa collection, each with a title row
      (links to /collections/{handle}) and a 3-up product card grid.
      Mobile collapses to a 2-up grid so the cards still read.
    -->
    <div v-if="!showFallback" class="mt-6 flex flex-col gap-10 sm:mt-8 sm:gap-12 md:mt-10 md:gap-14">
      <div v-for="shelf in shelves" :key="shelf.id">
        <div class="flex items-end justify-between gap-4 border-b border-ink-200 pb-3">
          <div class="min-w-0">
            <p class="text-eyebrow font-body uppercase text-ink-500">
              {{ shelf.eyebrow }}
            </p>
            <h3 class="mt-1 font-display text-[22px] leading-[1.1] font-normal text-ink-950 sm:text-[26px] lg:text-[30px]">
              {{ shelf.title }}
            </h3>
            <p class="mt-2 font-body text-[13px] leading-relaxed text-ink-500 sm:text-[14px]">
              {{ shelf.note }}
            </p>
          </div>
          <NuxtLink
            :to="`/collections/${shelf.handle}`"
            class="shrink-0 self-start text-[13px] text-ink-500 transition-colors duration-200 hover:text-ink-950 hover:underline sm:text-[14px]"
          >
            Shop {{ shelf.title }} &rarr;
          </NuxtLink>
        </div>
        <!-- Stays 3-up: the shelf is fetched with `limit: 3` (see the loader
             below), so a 4- or 5-column grid would leave a hole in the row.
             It does not need a column change to shrink -- ProductCard's crop
             moved from 5:7 to 1:1, which took this card from 736px (82% of a
             900px fold, the tallest card in the app) to ~563px on its own. -->
        <ul class="mt-6 grid grid-cols-2 gap-x-5 gap-y-8 sm:gap-x-6 md:grid-cols-3 md:gap-x-[30px]">
          <ProductCard
            v-for="p in shelf.products"
            :key="p.id"
            :product="(p as any)"
          />
        </ul>
      </div>
    </div>

    <!--
      Editorial fallback: rendered when the SDK returns 0 usable collections
      (offline, unseeded, empty shelves). Uses the home page's best-seller
      photography so the band never reads as broken. Same 3-up tile pattern
      the section used before the live-collection refactor.
    -->
    <div v-else class="mt-6 grid grid-cols-1 gap-x-5 gap-y-8 sm:mt-8 sm:grid-cols-2 sm:gap-x-6 sm:gap-y-10 md:mt-10 md:grid-cols-3 md:gap-x-[30px] md:gap-y-12">
      <NuxtLink
        v-for="tile in fallbackTiles"
        :key="tile.slug"
        :to="`/discover/${tile.slug}`"
        class="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-950 focus-visible:ring-offset-4 focus-visible:ring-offset-white"
      >
        <div class="relative aspect-[4/5] overflow-hidden bg-cream-tile">
          <img
            v-if="tile.image"
            :src="tile.image"
            :alt="`${tile.title}, featuring ${tile.productTitle}`"
            loading="lazy"
            decoding="async"
            class="h-full w-full object-cover object-center transition-transform duration-700 ease-out [@media(hover:hover)]:group-hover:scale-[1.03]"
          >
          <span
            v-if="tile.image"
            class="absolute left-4 top-4 inline-flex items-center bg-white/90 px-3 py-1.5 text-eyebrow font-body uppercase text-ink-950 backdrop-blur-sm"
          >
            {{ tile.eyebrow }}
          </span>
        </div>
        <div class="mt-4 sm:mt-5">
          <h3 class="font-display text-[22px] leading-[1.1] font-normal text-ink-950 transition-colors duration-200 sm:text-[24px] lg:text-[26px] [@media(hover:hover)]:group-hover:text-ink-700">
            {{ tile.title }}
          </h3>
          <p class="mt-2 font-body text-[13px] leading-relaxed text-ink-500 sm:text-[14px]">
            {{ tile.note }}
          </p>
          <span class="mt-3 inline-block font-body text-[13px] uppercase tracking-wider text-ink-950 transition-all duration-200 sm:mt-4 [@media(hover:hover)]:group-hover:tracking-[0.12em]">
            Explore the shelf &rarr;
          </span>
        </div>
      </NuxtLink>
    </div>
  </section>
</template>
