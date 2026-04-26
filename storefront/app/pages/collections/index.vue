<script setup lang="ts">
/**
 * /collections — curated product collections index.
 *
 * Pulls all StoreCollection rows via `sdk.store.collection.list()`.
 * No collections seeded today => the page renders an editorial empty
 * state. When collections exist, each tile becomes a NuxtLink to
 * `/collections/{handle}` (TODO: add `[handle].vue` once the team
 * starts curating; until then the cards 404 by design — data-driven).
 *
 * Layout mirrors `/categories` and `/products`:
 *   - cream-tile hero band with eyebrow + display heading
 *   - 3-up grid (1 col mobile, 2 col tablet, 3 col desktop) of cream
 *     tiles, font-display label centred. No chrome, no thumbnails.
 */
defineOptions({ name: 'PageCollections' })

useHead({
  title: 'Collections · GhostMark Studio',
  meta: [
    {
      name: 'description',
      content:
        'Browse seasonal and editorial product collections from GhostMark Studio — print-on-demand merch curated for thoughtful brands.',
    },
  ],
})

const sdk = useMedusaClient()

// SSR-friendly fetch. Errors collapse to an empty list so the page
// still renders the empty state instead of a hard failure.
const { data: collections, pending } = await useAsyncData('collections', async () => {
  try {
    const res = await sdk.store.collection.list({ limit: 50 } as any)
    return res.collections ?? []
  }
  catch {
    return []
  }
})
</script>

<template>
  <div class="bg-white text-ink-950">
    <!-- ============================================================
         1. Hero — eyebrow + serif label
         ============================================================ -->
    <section
      class="bg-cream-tile"
      aria-labelledby="collections-hero-heading"
    >
      <div class="mx-auto flex max-w-[1320px] flex-col gap-6 px-gutter py-section">
        <p class="text-eyebrow font-body uppercase text-ink-500">
          Catalog
        </p>
        <h1
          id="collections-hero-heading"
          class="font-display text-display-lg font-normal text-ink-950"
        >
          Shop by collection.
        </h1>
        <p class="max-w-[52ch] font-body text-body text-ink-700">
          Curated drops grouped by season, story, or finish. Pick a
          collection for hand-picked picks, or browse the full
          <NuxtLink
            to="/products"
            class="underline decoration-dashed decoration-ink-400 underline-offset-4 transition-colors duration-base ease-emphasis hover:decoration-ink-950"
          >catalog</NuxtLink>.
        </p>
      </div>
    </section>

    <!-- ============================================================
         2. Collection grid — 4:3 cream tiles
         ============================================================ -->
    <section
      class="bg-white"
      aria-labelledby="collections-grid-heading"
    >
      <div class="mx-auto max-w-[1320px] px-gutter py-section">
        <h2 id="collections-grid-heading" class="sr-only">
          All collections
        </h2>

        <ul
          v-if="collections && collections.length"
          class="grid grid-cols-1 gap-x-[30px] gap-y-[30px] sm:grid-cols-2 lg:grid-cols-3"
        >
          <li
            v-for="col in collections"
            :key="(col as any).handle ?? (col as any).id"
          >
            <NuxtLink
              :to="`/collections/${(col as any).handle}`"
              class="group flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 bg-cream-tile p-6 text-center transition-colors duration-base ease-emphasis hover:bg-cream-warm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900 focus-visible:ring-offset-2 focus-visible:ring-offset-cream-50"
            >
              <span class="font-display text-display-sm font-normal text-ink-950">
                {{ (col as any).title }}
              </span>
              <span class="font-body text-caption text-ink-500">
                Shop collection
              </span>
            </NuxtLink>
          </li>
        </ul>

        <div
          v-else-if="pending"
          class="flex items-center justify-center py-section"
        >
          <p class="font-body text-caption text-ink-500">
            Loading collections&hellip;
          </p>
        </div>

        <!-- Empty state — editorial, not apologetic -->
        <div
          v-else
          class="mx-auto flex max-w-[44ch] flex-col items-center gap-4 py-section text-center"
        >
          <p class="text-eyebrow font-body uppercase text-ink-500">
            Coming soon
          </p>
          <h3 class="font-display text-display-md font-normal text-ink-950">
            No collections yet.
          </h3>
          <p class="font-body text-body text-ink-700">
            We're curating the first drops. In the meantime, the full
            catalog is open — every blank we stock, no filter applied.
          </p>
          <NuxtLink
            to="/products"
            class="mt-2 inline-flex h-[48px] items-center justify-center bg-ink-900 px-7 font-body text-[14px] font-medium tracking-wide text-white transition-colors duration-base ease-emphasis hover:bg-ink-800"
          >
            Browse all products
          </NuxtLink>
        </div>
      </div>
    </section>
  </div>
</template>
