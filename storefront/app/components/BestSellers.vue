<template>
  <section class="mx-auto w-full max-w-rail px-gutter">
    <!--
      Was: a bare 64px <h2> in `text-zinc-950`, COLD black, on a page whose
      other headings were warm `ink-950`, and set in Inter Tight (the BODY
      face) rather than in the display face. Both defects are fixed by moving
      to SectionHeading, which owns the job-ticket rail + Fraunces title.
    -->
    <SectionHeading
      v-if="!hideHeading"
      spec="Apparel · sold as is"
      title="Our best sellers"
      to="/products"
    />

    <!--
      Grid cadence: 2-up on phones, 3-up on tablet (768) so cards don't squish
      to ~170px wide on a 4-up md grid, then 4-up at lg+ where 4 cards fit
      without crowding. Gap shrinks to 12px on mobile to give cards more room.
    -->
    <ul class="mt-5 sm:mt-6 grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-5 lg:gap-y-10 xl:grid-cols-5">
      <ProductCard
        v-for="p in products"
        :key="p.id"
        :product="p"
      />
      <!--
        Single editorial CTA tile at the END of the grid (v18 audit fix).
        Replaces the previous v-for orphan-filler that repeated 1-3 identical
        "Browse all" tiles in the trailing row and read as a missing data
        state rather than design. The tile is `hidden md:block` because the
        2-up mobile grid already handles a single dangling product gracefully
        and an end-tile there would create its own awkward orphan. Background
        is `bg-warmGrey` (vs the cream ProductCard well) so it reads as a
        deliberate call to action, not just another empty product cell.
      -->
      <!--
        END TILE, squared off and repainted to match the product cards.

        It carried `rounded-[0.5rem]` while every ProductCard tile beside it in
        the same grid row is square, and `bg-warmGrey` / `ring-greyLines` while
        the cards are on the canonical ink ramp. Two similar elements sitting
        side by side did not look similar, which is the plainest kind of design
        system defect: the radius read as an accident rather than a decision.

        The palette move is not cosmetic either. CHECKOUT measured greyLines
        against ink-200 at 1.02:1, i.e. the same colour declared twice under two
        names, and ART ruled ink-* canonical for new code. Leaving the legacy
        token here would keep a duplicate alive in the one component most likely
        to be copied when someone builds the next grid.

        `bg-cream-warm` keeps the original intent: a ground distinct from the
        cards so this reads as a call to action rather than an empty product
        cell.
      -->
      <li v-if="showEndTile" class="hidden md:block">
        <NuxtLink
          to="/shop"
          class="group relative block w-full pb-[140%] overflow-hidden bg-cream-warm text-ink-950 ring-1 ring-inset ring-ink-200/60 transition-shadow duration-200 hover:ring-ink-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-cream-tile"
          aria-label="Browse all best sellers"
        >
          <div class="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
            <p class="font-accent text-[20px] leading-[24px] lg:text-[24px] lg:leading-[28px] text-ink-950 max-w-[16ch]">
              See the rest of the canon
            </p>
            <span class="mt-3 inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.12em] text-ink-700 transition-colors group-hover:text-ink-950">
              Browse all
              <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M2 8h12M9 3l5 5-5 5"/>
              </svg>
            </span>
          </div>
        </NuxtLink>
      </li>
    </ul>

    <!--
      Skeleton mirrors the live grid cadence (2/3/4) and renders 12 placeholders
      so every breakpoint shows a complete row count: 6 rows at 2-up, 4 rows at
      3-up, 3 rows at 4-up, matches the API's `limit: 10` plus orphan padding.
    -->
    <ul v-if="!products?.length" class="mt-5 sm:mt-6 grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-5 lg:gap-y-10 xl:grid-cols-5">
      <li v-for="n in 12" :key="n" class="animate-pulse">
        <div class="aspect-[5/7] bg-cream-tile" />
        <div class="mt-4 h-4 w-3/4 rounded bg-ink-200" />
        <div class="mt-2 h-3 w-1/2 rounded bg-ink-200" />
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    products?: any[]
    hideHeading?: boolean
  }>(),
  {
    products: () => [],
    hideHeading: false,
  },
)

// Editorial CTA end-tile is shown only when at least one product rendered
// in the grid. With zero products we want the skeleton state, not a
// solitary "Browse all" tile floating in space.
const showEndTile = computed(() => (props.products?.length ?? 0) > 0)
</script>
