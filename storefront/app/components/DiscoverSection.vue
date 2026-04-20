<template>
  <section class="mx-auto w-full max-w-screen-3xl px-5 sm:px-6 lg:px-8">
    <h2 class="text-[22px] font-semibold tracking-tight text-zinc-950 sm:text-[26px]">Discover</h2>

    <div class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <!-- Feature cards -->
      <NuxtLink
        v-for="(card, i) in cards"
        :key="i"
        :to="card.link"
        class="group flex flex-col justify-between overflow-hidden rounded-xl border border-zinc-200 bg-white p-6 transition-shadow hover:shadow-md"
      >
        <div>
          <h3 class="text-[16px] font-semibold text-zinc-950">{{ card.title }}</h3>
          <p class="mt-2 text-[14px] leading-relaxed text-zinc-500">{{ card.description }}</p>
        </div>
        <span class="mt-6 text-[13px] font-medium text-zinc-950 group-hover:underline">Explore &rarr;</span>
      </NuxtLink>

      <!-- Featured blog post -->
      <div class="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <div class="aspect-[16/10] bg-zinc-100">
          <div class="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-200/60 to-zinc-100">
            <svg class="h-10 w-10 text-zinc-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="m21 15-5-5L5 21" />
            </svg>
          </div>
        </div>
        <div class="p-5">
          <h3 class="text-[15px] font-semibold leading-snug text-zinc-950">
            Discover our collaboration with Pentagram.
          </h3>
          <NuxtLink to="/blog" class="mt-3 inline-block text-[13px] font-medium text-zinc-950 hover:underline">
            Read more &rarr;
          </NuxtLink>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
const cards = [
  {
    title: 'Made in Europe',
    description: 'Our selection of products sourced exclusively in Europe.',
    link: '/products',
  },
  {
    title: 'Our bespoke offer',
    description: "Fully custom project? We're here to help.",
    link: '/contact',
  },
  {
    title: 'Spring selection',
    description: 'Quality that blooms with your brand.',
    link: '/products',
  },
]
</script>
