<template>
  <section class="mx-auto w-full max-w-screen-3xl px-5 sm:px-6 lg:px-8">
    <div class="flex items-end justify-between gap-4">
      <div>
        <h2 class="text-[22px] font-semibold tracking-tight text-zinc-950 sm:text-[26px]">Our products in real life</h2>
        <p class="mt-1 text-[15px] text-zinc-500">As real as it gets</p>
      </div>
    </div>

    <div class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div
        v-for="(item, i) in showcase"
        :key="i"
        class="group relative overflow-hidden rounded-xl bg-zinc-100"
        :class="i === 0 ? 'sm:col-span-2 sm:row-span-2' : ''"
      >
        <div :class="i === 0 ? 'aspect-[4/3]' : 'aspect-[4/3]'">
          <div class="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-200/60 to-zinc-100">
            <svg class="h-12 w-12 text-zinc-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="m21 15-5-5L5 21" />
            </svg>
          </div>
        </div>
        <!-- Overlay on hover -->
        <div class="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/50 via-transparent to-transparent p-5 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <span class="text-[12px] font-semibold uppercase tracking-wider text-white/80">{{ item.brand }}</span>
          <span class="mt-0.5 text-[15px] font-medium text-white">{{ item.description }}</span>
          <NuxtLink
            v-if="item.link"
            :to="item.link"
            class="mt-2 text-[13px] text-white/80 underline"
          >
            {{ item.product }}
          </NuxtLink>
        </div>
        <!-- Always-visible caption (mobile) -->
        <div class="p-3 lg:hidden">
          <span class="text-[12px] font-semibold uppercase tracking-wider text-zinc-500">{{ item.brand }}</span>
          <span class="mt-0.5 block text-[14px] font-medium text-zinc-950">{{ item.description }}</span>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
const showcase = [
  {
    brand: 'Tarta Gelatina',
    description: 'Oversized tees made in Portugal for the Barcelona-based homeware brand.',
    product: 'Oversized t-shirt',
    link: '/products',
  },
  {
    brand: 'Financial Times',
    description: 'Totes and caps for the Financial Times.',
    product: 'Vintage cap',
    link: '/products',
  },
  {
    brand: 'Charlotte Taylor',
    description: 'Opinel knives, bottle openers, mugs, socks, for Charlotte\'s collection Home from Home.',
    product: 'Opinel',
    link: '/products',
  },
  {
    brand: 'Combeau',
    description: 'Custom oversized t-shirts for the parisian brand Combeau.',
    product: 'Oversized t-shirt',
    link: '/products',
  },
  {
    brand: 'Paradiso Mediterraneo',
    description: 'Fully customised beach towels.',
    product: 'Bespoke',
    link: '/products',
  },
]
</script>
