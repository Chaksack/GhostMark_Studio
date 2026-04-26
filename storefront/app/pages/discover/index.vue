<script setup lang="ts">
/**
 * /discover — curated landings hub.
 *
 * The merchery shop/c/discover convention: a quiet hero introduces the
 * shelf concept, then a 3-up grid of curated entry tiles links to the
 * landing pages under `/discover/[slug]`. Each tile is a cream slab with
 * a serif H3, a body excerpt, and a 4:3 photo placeholder block — the
 * same editorial rhythm used on `/categories`.
 *
 * The tile list is hard-coded here: these are editorial picks, not a
 * Medusa query. If/when the curation team wants the list to come from
 * Strapi, swap `TILES` for `useCms()` — the template iteration stays the
 * same.
 *
 * No Medusa calls happen on this page; it's pure layout. The downstream
 * `/discover/[slug]` page is where the product grids live.
 */
defineOptions({ name: 'PageDiscover' })

interface DiscoverTile {
  slug: string
  title: string
  excerpt: string
  surface: 'tile' | 'warm'
}

const TILES: DiscoverTile[] = [
  {
    slug: 'spring',
    title: 'Spring picks',
    excerpt:
      'Lighter weights, brighter dyes, the runs we keep stocked between equinox and solstice.',
    surface: 'warm',
  },
  {
    slug: 'best-sellers',
    title: 'Best sellers',
    excerpt:
      'The pieces our regulars reorder season after season — a working list of the studio canon.',
    surface: 'tile',
  },
  {
    slug: 'fast-shipping',
    title: 'Fast shipping',
    excerpt:
      'Stocked in Brussels, Berlin and London with same-week dispatch — for briefs that landed yesterday.',
    surface: 'tile',
  },
  {
    slug: 'new-hires',
    title: 'New hires kit',
    excerpt:
      'Welcome bundles tested by HR teams who hate looking at swag receipts. Tee, mug, notebook, tote.',
    surface: 'warm',
  },
  {
    slug: 'holiday',
    title: 'Holiday picks',
    excerpt:
      'Thoughtful end-of-year gifts that survive the post and don\'t end up on the unboxing landfill.',
    surface: 'tile',
  },
  {
    slug: 'back-to-school',
    title: 'Back to school',
    excerpt:
      'Notebooks, totes and labels for the September handover — campus runs we re-cut every August.',
    surface: 'warm',
  },
  {
    slug: 'travel',
    title: 'Travel essentials',
    excerpt:
      'Bottles, totes and caps that pack flat. Built for the off-site that needs branding without the bulk.',
    surface: 'tile',
  },
  {
    slug: 'recent',
    title: 'Recently added',
    excerpt:
      'New blanks, new finishes, new colourways — the freshest entries on the studio shelf.',
    surface: 'warm',
  },
]

useHead({
  title: 'Discover · GhostMark Studio',
  meta: [
    {
      name: 'description',
      content:
        'Curated landings from GhostMark Studio — spring, holiday, fast-shipping, new-hire kits and more. Eight shelves, one quiet voice.',
    },
  ],
})
</script>

<template>
  <main class="bg-white text-ink-950">
    <!-- ============================================================
         1. Hero — eyebrow + serif H1 + intro paragraph
         ============================================================ -->
    <section
      class="bg-cream-tile"
      aria-labelledby="discover-hero-heading"
    >
      <div class="mx-auto flex max-w-[1320px] flex-col gap-6 px-gutter py-section">
        <p class="text-eyebrow font-body uppercase text-ink-500">
          Discover
        </p>
        <h1
          id="discover-hero-heading"
          class="font-display text-display-lg font-normal text-ink-950"
        >
          Curated for the moment.
        </h1>
        <p class="max-w-[52ch] font-body text-body text-ink-700">
          Eight shelves we re-cut by hand each season. Pick a moment —
          spring break, a new hire, the holiday rush — and we'll show
          you the blanks, finishes and run sizes that fit it.
        </p>
      </div>
    </section>

    <!-- ============================================================
         2. Tile grid — 1-up mobile, 2-up tablet, 3-up desktop
         ============================================================ -->
    <section
      class="bg-white"
      aria-labelledby="discover-grid-heading"
    >
      <div class="mx-auto max-w-[1320px] px-gutter py-section">
        <h2 id="discover-grid-heading" class="sr-only">
          All curated landings
        </h2>

        <ul class="grid grid-cols-1 gap-x-[30px] gap-y-16 sm:grid-cols-2 lg:grid-cols-3">
          <li
            v-for="tile in TILES"
            :key="tile.slug"
          >
            <NuxtLink
              :to="`/discover/${tile.slug}`"
              class="group flex h-full flex-col gap-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900 focus-visible:ring-offset-2 focus-visible:ring-offset-cream-50"
            >
              <!-- 4:3 photo placeholder block -->
              <div
                class="aspect-[4/3] w-full overflow-hidden transition-colors duration-base ease-emphasis"
                :class="tile.surface === 'warm' ? 'bg-cream-warm group-hover:bg-cream-tile' : 'bg-cream-tile group-hover:bg-cream-warm'"
                aria-hidden="true"
              >
                <div class="flex h-full w-full items-end justify-end p-6">
                  <span class="font-body text-caption uppercase text-ink-500 tracking-wide">
                    {{ tile.slug }}
                  </span>
                </div>
              </div>

              <!-- Tile body -->
              <div class="flex flex-col gap-2">
                <p class="text-eyebrow font-body uppercase text-ink-500">
                  Curated landing
                </p>
                <h3
                  class="font-display text-display-sm font-normal text-ink-950 transition-colors duration-fast ease-emphasis group-hover:text-ink-700"
                >
                  {{ tile.title }}
                </h3>
                <p class="font-body text-body text-ink-700 max-w-prose">
                  {{ tile.excerpt }}
                </p>
                <span class="mt-2 text-eyebrow font-body uppercase text-ink-950 underline decoration-dashed decoration-ink-400 underline-offset-4 transition-colors duration-fast ease-emphasis group-hover:decoration-ink-950">
                  Open the shelf
                </span>
              </div>
            </NuxtLink>
          </li>
        </ul>
      </div>
    </section>
  </main>
</template>
