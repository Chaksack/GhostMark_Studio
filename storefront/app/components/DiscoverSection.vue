<script setup lang="ts">
/**
 * DiscoverSection — three editorial tiles linking to /discover/[slug] landings.
 *
 * Design intent (post-grey-placeholder cleanup):
 *   - Real product photography only. The first product's `thumbnail` from the
 *     home page's best-seller fetch becomes the tile background — no fake
 *     lifestyle imagery, no grey placeholder boxes.
 *   - Editorial card pattern: cream-tile band on top, serif headline, eyebrow
 *     slug tag, curator's note pulled from the same source of truth as the
 *     /discover/[slug] page (kept inline here so the home tile doesn't need
 *     to import the slug page).
 *   - Falls back to a clean cream-tile when a product thumbnail is missing —
 *     never to a grey rectangle. The fallback still reads as intentional.
 *
 * Data source: re-uses the `products` prop passed in from pages/index.vue
 * (already fetched for BestSellers with region_id resolved). No second
 * network round-trip, no waterfall.
 */
defineOptions({ name: 'DiscoverSection' })

interface MedusaProduct {
  id: string
  handle: string
  title: string
  thumbnail?: string | null
  images?: { url: string }[]
}

const props = withDefaults(defineProps<{
  products?: MedusaProduct[]
}>(), {
  products: () => [],
})

interface Tile {
  slug: string
  title: string
  eyebrow: string
  note: string
}

// Three curated landings worth elevating to the home page. Slugs match
// SLUG_META in /discover/[slug].vue — keep these in sync if shelves change.
const TILES: Tile[] = [
  {
    slug: 'best-sellers',
    title: 'Best sellers',
    eyebrow: 'The studio canon',
    note: 'Ranked by re-buy rate, not by margin.',
  },
  {
    slug: 'new-hires',
    title: 'New hires kit',
    eyebrow: 'Welcome bundles',
    note: 'A tee, a mug, a notebook, a tote — proportioned as a set.',
  },
  {
    slug: 'holiday',
    title: 'Holiday picks',
    eyebrow: 'End of year',
    note: 'Order by mid-November to hit doormats before December 24.',
  },
]

// Pluck a real product image for each tile. We rotate through the available
// products so each tile gets a different photograph rather than three
// identical thumbnails. If we have fewer products than tiles, we wrap.
const tilesWithImage = computed(() => {
  const pool = props.products.filter(p => Boolean(p.thumbnail || p.images?.[0]?.url))
  return TILES.map((tile, i) => {
    const product = pool.length ? pool[i % pool.length] : undefined
    const image = product?.thumbnail || product?.images?.[0]?.url || ''
    return {
      ...tile,
      image,
      productHandle: product?.handle ?? '',
      productTitle: product?.title ?? '',
    }
  })
})

// Discover renders 3 tiles per row on md+ (md:grid-cols-3). TILES is a fixed
// length-3 constant today so the row is full, but we compute orphanCount
// defensively so a future fourth shelf doesn't silently reintroduce Bug 10.
const CELLS_PER_ROW = 3
const orphanCount = computed(() => {
  const count = tilesWithImage.value.length
  if (count === 0) return 0
  const remainder = count % CELLS_PER_ROW
  return remainder === 0 ? 0 : CELLS_PER_ROW - remainder
})
</script>

<template>
  <section
    class="mx-auto w-full max-w-screen-3xl px-5 sm:px-6 lg:px-8"
    aria-labelledby="discover-section-heading"
  >
    <div class="flex items-end justify-between gap-4">
      <div class="min-w-0">
        <!-- Same ramp as BestSellers/RecentlyAdded — sibling sections share rhythm. -->
        <h2
          id="discover-section-heading"
          class="text-[1.75rem] leading-[2.1rem] sm:text-[2.4rem] sm:leading-[2.8rem] md:text-[3.2rem] md:leading-[3.8rem] lg:text-[4rem] lg:leading-[4.6rem] font-normal text-ink-950"
        >
          Discover
        </h2>
        <!--
          Eyebrow-style sub-line, not a sub-heading: 1.6rem (25.6px) on mobile
          read as a competing headline and devoured the row. Drop to 13px / 14px
          floor (WCAG body floor satisfied) and tighten leading. Margin-top
          shrinks from 1.8rem → 8px on phone where the ramp is half the height.
        -->
        <p class="mt-2 text-[13px] leading-[1.5] text-ink-700 sm:mt-3 sm:text-[14px] md:mt-4 md:text-[15px] lg:mt-5 lg:text-[16px]">
          Curated shelves
        </p>
      </div>
      <NuxtLink
        to="/discover"
        class="shrink-0 text-[13px] text-ink-500 transition-colors duration-200 hover:text-ink-950 hover:underline sm:text-[14px]"
      >
        All shelves &rarr;
      </NuxtLink>
    </div>

    <!--
      Tile cadence: 1-up on phones (full-width tile reads as gallery hero),
      2-up at sm so the section doesn't sprawl on iPad-portrait, 3-up at md+.
      Gap shrinks on mobile to keep the tile's vertical footprint reasonable.
    -->
    <div class="mt-6 grid grid-cols-1 gap-x-5 gap-y-8 sm:mt-8 sm:grid-cols-2 sm:gap-x-6 sm:gap-y-10 md:mt-10 md:grid-cols-3 md:gap-x-[30px] md:gap-y-12">
      <NuxtLink
        v-for="tile in tilesWithImage"
        :key="tile.slug"
        :to="`/discover/${tile.slug}`"
        class="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-950 focus-visible:ring-offset-4 focus-visible:ring-offset-white"
      >
        <!--
          Image surface: real product photograph on cream-tile.
          Aspect ratio matches the editorial pull-quote crop used elsewhere
          in the storefront (4/5) — taller than wide reads as gallery, not
          as banner. No grey fallback: empty state is just the cream tile.
        -->
        <div class="relative aspect-[4/5] overflow-hidden bg-cream-tile">
          <img
            v-if="tile.image"
            :src="tile.image"
            :alt="`${tile.title} — featuring ${tile.productTitle}`"
            loading="lazy"
            decoding="async"
            class="h-full w-full object-cover object-center transition-transform duration-700 ease-out [@media(hover:hover)]:group-hover:scale-[1.03]"
          >
          <!-- Eyebrow chip, top-left, only when we have a real photo behind it -->
          <span
            v-if="tile.image"
            class="absolute left-4 top-4 inline-flex items-center bg-white/90 px-3 py-1.5 text-eyebrow font-body uppercase text-ink-950 backdrop-blur-sm"
          >
            {{ tile.eyebrow }}
          </span>
        </div>

        <!--
          Caption: serif headline + curator's note. Headline scales 22 → 26px
          across the breakpoint band; note + CTA stay at 13/14px (WCAG floor).
        -->
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

      <!--
        Orphan filler tiles. The grid is 3-up on md+; if a future shelf brings
        the tile count to 4 or 5 the last row would leave 1-2 dead cells
        (Bug 10). The filler points at /discover so the row stays full and the
        CTA still earns its rent. `hidden md:block` keeps mobile (1-up) clean.
      -->
      <NuxtLink
        v-for="i in orphanCount"
        :key="`discover-cta-${i}`"
        to="/discover"
        aria-label="Browse all curated shelves"
        class="hidden md:block group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-950 focus-visible:ring-offset-4 focus-visible:ring-offset-white"
      >
        <div class="relative flex aspect-[4/5] items-center justify-center overflow-hidden bg-cream-tile p-6 text-center ring-1 ring-inset ring-ink-200 transition-colors duration-200 group-hover:bg-uiHighlight">
          <div class="flex flex-col items-center gap-3">
            <span class="font-body text-eyebrow uppercase text-ink-500">All shelves</span>
            <p class="max-w-[220px] font-display text-[22px] leading-tight font-normal text-ink-950">
              See every curated shelf
            </p>
          </div>
        </div>
        <div class="mt-4 sm:mt-5">
          <h3 class="font-display text-[22px] leading-[1.1] font-normal text-ink-950 transition-colors duration-200 sm:text-[24px] lg:text-[26px] [@media(hover:hover)]:group-hover:text-ink-700">
            Browse all
          </h3>
          <p class="mt-2 font-body text-[13px] leading-relaxed text-ink-500 sm:text-[14px]">
            The full set of editorial landings, ranked and dated.
          </p>
          <span class="mt-3 inline-block font-body text-[13px] uppercase tracking-wider text-ink-950 transition-all duration-200 sm:mt-4 [@media(hover:hover)]:group-hover:tracking-[0.12em]">
            All shelves &rarr;
          </span>
        </div>
      </NuxtLink>
    </div>
  </section>
</template>
