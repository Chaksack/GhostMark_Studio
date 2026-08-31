<!--
  BrandShowcase: STATIC BY DESIGN.

  This component renders a wall of premium label partners (Patagonia, Kinto,
  Moleskine, ...). The data here is NOT Medusa data and intentionally is not
  wired to a backend collection or "brands" taxonomy:

  - Brand names + lockups are third-party IP. Surfacing them on the home page
    requires legal sign-off (partnership agreement, logo usage license) and
    a real product story behind each one. We do not have that today.
  - When the time comes, swap the inline `brands` array for editorial CMS
    content (Strapi/Sanity), and source the logos from `/public/img/logos/*`
    after legal review. Do NOT wire to `sdk.store.collection.list()`, these
    are partner narratives, not merchandised product collections.
  - This component is NOT currently mounted on `/` (pages/index.vue), it
    stays on disk for future content drops. See the section comment in
    pages/index.vue that explains the omission.

  TL;DR: brand logos are static editorial content sourced from
  `/public/img/logos/*` and require legal sign-off before launch.
-->
<template>
  <section class="mx-auto w-full max-w-rail px-gutter">
    <h2 class="font-display text-display-lg font-normal text-ink-950">Our best selling brands</h2>

    <div class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <NuxtLink
        v-for="(brand, i) in brands"
        :key="i"
        :to="brand.link"
        class="group overflow-hidden rounded-xl border border-ink-200 bg-white transition-shadow hover:shadow-md"
      >
        <div class="aspect-[16/10] bg-ink-100">
          <div class="flex h-full w-full items-center justify-center bg-gradient-to-br from-ink-200/60 to-ink-100">
            <span class="text-[28px] font-bold text-ink-300">{{ brand.name }}</span>
          </div>
        </div>
        <div class="p-5">
          <h3 class="text-[16px] font-semibold text-ink-950">Custom {{ brand.name }}</h3>
          <p class="mt-1.5 text-[14px] leading-relaxed text-ink-600">{{ brand.description }}</p>
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
