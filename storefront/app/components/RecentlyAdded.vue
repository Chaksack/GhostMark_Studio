<template>
  <section class="mx-auto w-full max-w-rail px-gutter">
    <!-- Same conversion as BestSellers: cold zinc-950 + body face -> warm
         ink-950 + display face, via the shared job-ticket heading. -->
    <SectionHeading
      spec="Apparel + made to order"
      title="Recently added"
      to="/products"
    />

    <!-- Same 2/3/4-up cadence as BestSellers: keep the rhythm consistent. -->
    <ul class="mt-5 sm:mt-6 grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-5 lg:gap-y-10 xl:grid-cols-5">
      <ProductCard
        v-for="p in products"
        :key="p.id"
        :product="p"
      />
      <!--
        Single editorial CTA end-tile (v18 audit fix). See BestSellers.vue
        for the full rationale: replaces the v-for orphan-filler with one
        deliberate tile that reads as design, not as a missing-data state.
        Hidden on mobile (`hidden md:block`) because 2-up grids handle a
        single dangling product gracefully on their own.
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
          to="/shop?sort=newest"
          class="group relative block w-full pb-[140%] overflow-hidden bg-cream-warm text-ink-950 ring-1 ring-inset ring-ink-200/60 transition-shadow duration-200 hover:ring-ink-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-cream-tile"
          aria-label="See more recent arrivals"
        >
          <div class="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
            <p class="font-accent text-[20px] leading-[24px] lg:text-[24px] lg:leading-[28px] text-ink-950 max-w-[16ch]">
              Browse every new arrival
            </p>
            <span class="mt-3 inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.12em] text-ink-700 transition-colors group-hover:text-ink-950">
              See what's new
              <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M2 8h12M9 3l5 5-5 5"/>
              </svg>
            </span>
          </div>
        </NuxtLink>
      </li>
    </ul>

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

const props = defineProps<{
  products?: any[]
}>()

// Mirror BestSellers: only render the CTA end-tile when the grid has at
// least one product. Empty state falls through to the skeleton block.
const showEndTile = computed(() => (props.products?.length ?? 0) > 0)
</script>
