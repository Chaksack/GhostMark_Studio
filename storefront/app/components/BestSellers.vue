<template>
  <section class="mx-auto w-full max-w-screen-3xl px-5 sm:px-6 lg:px-8">
    <div v-if="!hideHeading" class="flex items-end justify-between gap-4">
      <!--
        Editorial h2 ramp. 51.2px (3.2rem) at 360 reads as a hero-not-section,
        eats vertical real estate, and starves the grid. Drop the mobile floor
        to 28px and let the cascade lift to 3.2rem at sm and 4rem at lg.
      -->
      <h2 class="text-[1.75rem] leading-[2.1rem] sm:text-[2.4rem] sm:leading-[2.8rem] md:text-[3.2rem] md:leading-[3.8rem] lg:text-[4rem] lg:leading-[4.6rem] font-normal text-zinc-950">Our best sellers</h2>
      <NuxtLink to="/products" class="shrink-0 text-[13px] text-zinc-500 hover:text-zinc-950 hover:underline sm:text-[14px]">View all</NuxtLink>
    </div>

    <!--
      Grid cadence: 2-up on phones, 3-up on tablet (768) so cards don't squish
      to ~170px wide on a 4-up md grid, then 4-up at lg+ where 4 cards fit
      without crowding. Gap shrinks to 12px on mobile to give cards more room.
    -->
    <ul class="mt-5 grid grid-cols-2 gap-3 sm:mt-6 sm:gap-[1.6rem] md:grid-cols-3 lg:grid-cols-4 lg:gap-[3rem]">
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
      <li v-if="showEndTile" class="hidden md:block">
        <NuxtLink
          to="/shop"
          class="group relative block w-full pb-[140%] overflow-hidden rounded-[0.5rem] bg-warmGrey text-ink-950 ring-1 ring-inset ring-greyLines/50 transition-shadow duration-200 hover:ring-greyLines"
          aria-label="Browse all best sellers"
        >
          <div class="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
            <p class="font-accent text-[2rem] leading-[2.4rem] lg:text-[2.4rem] lg:leading-[2.8rem] text-ink-950 max-w-[16ch]">
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
      3-up, 3 rows at 4-up — matches the API's `limit: 10` plus orphan padding.
    -->
    <ul v-if="!products?.length" class="mt-5 grid grid-cols-2 gap-3 sm:mt-6 sm:gap-[1.6rem] md:grid-cols-3 lg:grid-cols-4 lg:gap-[3rem]">
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
// in the grid. With zero products we want the skeleton state — not a
// solitary "Browse all" tile floating in space.
const showEndTile = computed(() => (props.products?.length ?? 0) > 0)
</script>
