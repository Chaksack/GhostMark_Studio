<template>
  <section class="mx-auto w-full max-w-screen-3xl px-5 sm:px-6 lg:px-8">
    <div class="flex items-end justify-between gap-4">
      <!-- Mirrored ramp from BestSellers (28 → 38.4 → 51.2 → 64) -->
      <h2 class="text-[1.75rem] leading-[2.1rem] sm:text-[2.4rem] sm:leading-[2.8rem] md:text-[3.2rem] md:leading-[3.8rem] lg:text-[4rem] lg:leading-[4.6rem] font-normal text-zinc-950">Recently added</h2>
      <NuxtLink to="/products" class="shrink-0 text-[13px] text-zinc-500 hover:text-zinc-950 hover:underline sm:text-[14px]">View all</NuxtLink>
    </div>

    <!-- Same 2/3/4-up cadence as BestSellers — keep the rhythm consistent. -->
    <ul class="mt-5 grid grid-cols-2 gap-3 sm:mt-6 sm:gap-[1.6rem] md:grid-cols-3 lg:grid-cols-4 lg:gap-[3rem]">
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
      <li v-if="showEndTile" class="hidden md:block">
        <NuxtLink
          to="/shop?sort=newest"
          class="group relative block w-full pb-[140%] overflow-hidden rounded-[0.5rem] bg-warmGrey text-ink-950 ring-1 ring-inset ring-greyLines/50 transition-shadow duration-200 hover:ring-greyLines"
          aria-label="See more recent arrivals"
        >
          <div class="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
            <p class="font-accent text-[2rem] leading-[2.4rem] lg:text-[2.4rem] lg:leading-[2.8rem] text-ink-950 max-w-[16ch]">
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

const props = defineProps<{
  products?: any[]
}>()

// Mirror BestSellers — only render the CTA end-tile when the grid has at
// least one product. Empty state falls through to the skeleton block.
const showEndTile = computed(() => (props.products?.length ?? 0) > 0)
</script>
