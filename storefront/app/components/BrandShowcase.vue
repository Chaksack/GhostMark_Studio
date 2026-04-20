<template>
  <section class="mx-auto w-full max-w-screen-3xl px-5 sm:px-6 lg:px-8">
    <h2 class="text-[22px] font-semibold tracking-tight text-zinc-950 sm:text-[26px]">Our best selling brands</h2>

    <div class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <NuxtLink
        v-for="(brand, i) in brands"
        :key="i"
        :to="brand.link"
        class="group overflow-hidden rounded-xl border border-zinc-200 bg-white transition-shadow hover:shadow-md"
      >
        <div class="aspect-[16/10] bg-zinc-100">
          <div class="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-200/60 to-zinc-100">
            <span class="text-[28px] font-bold text-zinc-300">{{ brand.name }}</span>
          </div>
        </div>
        <div class="p-5">
          <h3 class="text-[16px] font-semibold text-zinc-950">Custom {{ brand.name }}</h3>
          <p class="mt-1.5 text-[14px] leading-relaxed text-zinc-500">{{ brand.description }}</p>
        </div>
      </NuxtLink>
    </div>
  </section>
</template>

<script setup lang="ts">
const brands = [
  {
    name: 'Patagonia',
    description: 'Add your logo to our selection of Patagonia products.',
    link: '/products',
  },
  {
    name: 'Kinto',
    description: 'Custom drinkware, but make it incredibly pure and elegant.',
    link: '/products',
  },
  {
    name: 'Moleskine',
    description: 'Showcase your brand on the most premium notebooks.',
    link: '/products',
  },
]
</script>
