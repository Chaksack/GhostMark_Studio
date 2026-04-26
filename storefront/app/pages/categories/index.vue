<script setup lang="ts">
/**
 * /categories — top-level taxonomy index.
 *
 * NOTE on routing: this file lives at `pages/categories/index.vue` (not the
 * sibling `pages/categories.vue`) on purpose. When both exist, Nuxt treats
 * the `.vue` file as a parent layout for the `categories/` directory and
 * requires `<NuxtPage />` inside it — without that, every dynamic child
 * (e.g. `/categories/apparel`) silently rendered THIS page instead of
 * `[parent]/index.vue`. Keeping the index inside the dir removes the
 * ambiguity: `/categories` hits this file, `/categories/<handle>` hits
 * the dynamic resolver.
 *
 * Surfaces top-tier categories from `useCategories()` so the page picks up
 * live Medusa data when the backend is awake and falls back to the bundled
 * stub list when it isn't. The composable does that swap internally — the
 * page just iterates `categories.value`.
 *
 * Layout follows the merchery editorial rhythm: cream-tile hero, white band
 * with a 2-up (mobile) / 4-up (desktop) tile grid linking each category to
 * `/categories/{handle}` (the dynamic PLP). Each tile is a 4:3 cream-warm
 * slab with the label centred in `font-display`.
 */
defineOptions({ name: 'PageCategoriesIndex' })

useHead({
  title: 'Categories · GhostMark Studio',
  meta: [
    {
      name: 'description',
      content:
        'Shop GhostMark Studio by category — apparel, drinkware, accessories and lifestyle. Print-on-demand merch for thoughtful brands, made in low runs in Brussels, Berlin and London.',
    },
  ],
})

const { categories, pending } = useCategories()
</script>

<template>
  <div class="bg-white text-ink-950">
    <!-- ============================================================
         1. Hero — eyebrow + serif label
         ============================================================ -->
    <section
      class="bg-merchery-tile"
      aria-labelledby="categories-hero-heading"
    >
      <div class="mx-auto flex max-w-[1320px] flex-col gap-6 px-gutter py-section">
        <p class="text-eyebrow font-body uppercase text-ink-500">
          Catalog
        </p>
        <h1
          id="categories-hero-heading"
          class="font-display text-display-lg font-normal text-ink-950"
        >
          Shop by category.
        </h1>
        <p class="max-w-[52ch] font-body text-body text-ink-700">
          Pick a corner of the studio. Each category lists the blanks we
          keep stocked, the run sizes they suit, and the finishes we offer.
          Need something we don't list? <NuxtLink
            to="/contact"
            class="underline decoration-dashed decoration-ink-400 underline-offset-4 transition-colors duration-base ease-emphasis hover:decoration-ink-950"
          >Tell us about it</NuxtLink>.
        </p>
      </div>
    </section>

    <!-- ============================================================
         2. Category grid — 4:3 cream tiles, serif label centred
         ============================================================ -->
    <section
      class="bg-white"
      aria-labelledby="categories-grid-heading"
    >
      <div class="mx-auto max-w-[1320px] px-gutter py-section">
        <h2 id="categories-grid-heading" class="sr-only">
          All categories
        </h2>

        <ul
          v-if="categories && categories.length"
          class="grid grid-cols-2 gap-x-[1.6rem] gap-y-[1.6rem] md:grid-cols-3 md:gap-x-[2rem] md:gap-y-[2rem] lg:grid-cols-4 lg:gap-x-[3rem] lg:gap-y-[3rem]"
        >
          <li
            v-for="cat in categories"
            :key="cat.handle"
          >
            <NuxtLink
              :to="`/categories/${cat.handle}`"
              class="group flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 bg-cream-tile p-6 text-center transition-colors duration-base ease-emphasis hover:bg-cream-warm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900 focus-visible:ring-offset-2 focus-visible:ring-offset-cream-50"
            >
              <span class="font-display text-display-sm font-normal text-ink-950">
                {{ cat.label }}
              </span>
              <span
                v-if="cat.items.length"
                class="font-body text-caption text-ink-500"
              >
                {{ cat.items.length }} {{ cat.items.length === 1 ? 'style' : 'styles' }}
              </span>
            </NuxtLink>
          </li>
        </ul>

        <div
          v-else-if="pending"
          class="flex items-center justify-center py-section"
        >
          <UiSpinner />
        </div>
      </div>
    </section>

    <!-- ============================================================
         3. CTA band — sage slab pointing at /contact
         ============================================================ -->
    <section
      class="w-full bg-merchery-sage py-section"
      aria-labelledby="categories-cta-heading"
    >
      <div class="mx-auto max-w-[1320px] px-gutter">
        <div class="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_auto] lg:items-end lg:gap-16">
          <div class="max-w-[40rem]">
            <h2
              id="categories-cta-heading"
              class="font-display font-normal leading-[1.05] tracking-[-0.015em] text-ink-950"
              style="font-size: clamp(2rem, 1.4rem + 2vw, 3rem)"
            >
              Can't find the right blank?
            </h2>
            <p class="mt-4 font-body text-body text-ink-700">
              We source for custom briefs every week — heavyweight tees, vintage
              caps, ceramic that survives a dishwasher. Tell us what you need
              and we'll quote a small batch.
            </p>
          </div>

          <div class="flex flex-wrap gap-3">
            <UiButton
              variant="merchery"
              size="lg"
              as="NuxtLink"
              to="/contact"
            >
              Request a sample
            </UiButton>
            <UiButton
              variant="outline"
              size="lg"
              as="NuxtLink"
              to="/swatches"
            >
              Order swatches
            </UiButton>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
