<script setup lang="ts">
/**
 * /discover/[slug]: curated landing page.
 *
 * Editorial hero (cream-tile band, eyebrow, serif H1, curator's note)
 * followed by a 4-up product grid. The product feed is just `product.list`
 * for now, when the curation team wires editorial collections into Strapi
 * or Medusa tags, swap the SDK call for a tag/collection filter without
 * touching the layout.
 *
 * Slug resolution:
 *   - `SLUG_META` is the source of truth for the eight curated shelves
 *     surfaced on `/discover`. Unknown slugs fall through to a not-found
 *     section so a stray inbound link still renders something legible.
 *   - The map is intentionally typed `Record<string, …>` rather than a
 *     union, keeping it open lets the curation team add a new shelf
 *     without re-typing the whole object.
 *
 * Region awareness mirrors `/categories/[parent]/[sub].vue`: ensureRegion
 * before listing products so calculated_price isn't null.
 */
defineOptions({ name: 'PageDiscoverSlug' })

interface SlugMeta {
  title: string
  intro: string
  curator: string
}

const SLUG_META: Record<string, SlugMeta> = {
  spring: {
    title: 'Spring picks',
    intro:
      'Lighter weights, brighter dyes: the runs we keep stocked between equinox and solstice. Pastels that survive a wash, tees that breathe through the first warm week, totes for the open-air market season.',
    curator:
      'Edited by the studio in March, refreshed each month until the longest day.',
  },
  'best-sellers': {
    title: 'Best sellers',
    intro:
      'The pieces our regulars reorder season after season. A working list of the studio canon: the heavyweight tee, the recycled tote, the 11oz mug we still print by hand.',
    curator:
      'Surfaced from twelve months of repeat orders. Ranked by re-buy rate, not by margin.',
  },
  'fast-shipping': {
    title: 'Fast shipping',
    intro:
      'Stocked in Brussels, Berlin and London with same-week dispatch. For the brief that landed yesterday: pick from the ready-to-print shelf and we\'ll have it on a courier inside three working days.',
    curator:
      'Held in physical stock at all three studios. No print queue, no MOQ negotiation.',
  },
  'new-hires': {
    title: 'New hires kit',
    intro:
      'Welcome bundles tested by HR teams who hate looking at swag receipts. A tee, a mug, a notebook and a tote, proportioned so the new joiner unboxes a complete starter set, not a pile of unrelated logo objects.',
    curator:
      'Bundle pricing kicks in at twelve units. Single-colour print on every piece keeps the brand cohesive.',
  },
  holiday: {
    title: 'Holiday picks',
    intro:
      'Thoughtful end-of-year gifts that survive the post and don\'t end up on the unboxing landfill. Edited for client thank-yous, team gifts and the awkward partner-list send.',
    curator:
      'Order by the second week of November to hit doormats before December 24.',
  },
  'back-to-school': {
    title: 'Back to school',
    intro:
      'Notebooks, totes and labels for the September handover. Campus runs we re-cut every August: branded student kits, freshers\' fair giveaways, society sweatshirts in run sizes that make sense for a single committee.',
    curator:
      'Draft your run by mid-July; cut-off for September delivery is August 12.',
  },
  travel: {
    title: 'Travel essentials',
    intro:
      'Bottles, totes and caps that pack flat. Built for the off-site that needs branding without the bulk: think four hundred grams of swag per attendee, not four kilograms.',
    curator:
      'Selected for cabin-bag friendliness. Every piece in the shelf weighs under 280g.',
  },
  recent: {
    title: 'Recently added',
    intro:
      'New blanks, new finishes, new colourways. The freshest entries on the studio shelf, a rolling six-week window of additions, edited so you see what changed without scrolling the full catalogue.',
    curator:
      'Refreshed every Monday morning. Items here graduate to their permanent category after six weeks.',
  },
}

const route = useRoute()
const sdk = useMedusaClient()
const { region, ensureRegion } = useRegion()

const slug = computed(() => String(route.params.slug ?? ''))
const meta = computed<SlugMeta | null>(() => SLUG_META[slug.value] ?? null)

await ensureRegion()

const { data: products } = await useAsyncData(
  `discover-${slug.value}-${region.value?.id ?? 'no-region'}`,
  async () => {
    if (!meta.value) return []
    try {
      const res = await sdk.store.product.list({
        region_id: region.value?.id,
        fields: 'id,handle,title,subtitle,description,thumbnail,*images,*variants.calculated_price,*variants.options.value,*options.values,metadata,*tags',
        limit: 24,
      } as any)
      return (res as any).products ?? []
    }
    catch {
      return []
    }
  },
  { watch: [() => slug.value, () => region.value?.id] },
)

useHead(() => ({
  title: meta.value
    ? `${meta.value.title} · Discover · GhostMark Studio`
    : 'Discover · GhostMark Studio',
  meta: [
    {
      name: 'description',
      content: meta.value?.intro ?? 'Curated landings from GhostMark Studio.',
    },
  ],
}))
</script>

<template>
  <main class="bg-white text-ink-950">
    <!-- ============================================================
         1. Breadcrumb
         ============================================================ -->
    <section class="mx-auto max-w-rail px-gutter pt-section">
      <nav
        class="text-eyebrow font-body uppercase text-ink-500"
        aria-label="Breadcrumb"
      >
        <NuxtLink to="/" class="transition-colors duration-fast ease-emphasis hover:text-ink-950">
          Home
        </NuxtLink>
        <span class="mx-2" aria-hidden="true">·</span>
        <NuxtLink to="/discover" class="transition-colors duration-fast ease-emphasis hover:text-ink-950">
          Discover
        </NuxtLink>
        <span class="mx-2" aria-hidden="true">·</span>
        <span class="text-ink-700">{{ meta?.title ?? slug }}</span>
      </nav>
    </section>

    <!-- ============================================================
         2. Editorial hero: cream-tile band, eyebrow + serif H1 + intro
         ============================================================ -->
    <section
      v-if="meta"
      class="mx-auto max-w-rail px-gutter py-section bg-cream-tile"
      aria-labelledby="discover-slug-heading"
    >
      <p class="text-eyebrow font-body uppercase text-ink-500 mb-3">
        Discover · {{ slug }}
      </p>
      <h1
        id="discover-slug-heading"
        class="font-display text-display-lg font-normal text-ink-950"
      >
        {{ meta.title }}
      </h1>
      <p class="font-body text-body text-ink-700 mt-4 max-w-prose">
        {{ meta.intro }}
      </p>
      <p class="font-body text-caption text-ink-500 mt-6 italic max-w-prose">
        Curator's note: {{ meta.curator }}
      </p>
    </section>

    <!-- ============================================================
         3. Not found: unknown slug
         ============================================================ -->
    <section
      v-else
      class="mx-auto max-w-rail px-gutter py-section"
      aria-labelledby="discover-slug-empty-heading"
    >
      <p class="text-eyebrow font-body uppercase text-ink-500 mb-3">
        Discover
      </p>
      <h1
        id="discover-slug-empty-heading"
        class="font-display text-display-md font-normal text-ink-950"
      >
        That shelf isn't on the rack.
      </h1>
      <p class="font-body text-body text-ink-700 mt-4 max-w-prose">
        We couldn't find a curated landing for
        <span class="font-mono text-ink-950">{{ slug }}</span>. Browse the
        eight current shelves on the Discover hub.
      </p>
      <UiButton
        as="NuxtLink"
        to="/discover"
        variant="outline"
        size="md"
        class="mt-6"
      >
        Back to Discover
      </UiButton>
    </section>

    <!-- ============================================================
         4. Product grid
         ============================================================ -->
    <section
      v-if="meta"
      class="mx-auto max-w-rail px-gutter py-section"
      aria-labelledby="discover-slug-grid-heading"
    >
      <div class="flex items-end justify-between border-b border-ink-200 pb-4 mb-12">
        <h2
          id="discover-slug-grid-heading"
          class="font-display text-display-md font-normal text-ink-950"
        >
          On the {{ meta.title.toLowerCase() }} shelf
        </h2>
        <p class="text-eyebrow font-body uppercase text-ink-500">
          {{ products?.length ?? 0 }} {{ (products?.length ?? 0) === 1 ? 'item' : 'items' }}
        </p>
      </div>

      <ul
        v-if="products?.length"
        class="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-5 lg:gap-y-10 xl:grid-cols-5"
      >
        <ProductCard
          v-for="p in products"
          :key="p.id"
          :product="p"
        />
      </ul>

      <div v-else class="py-12 text-center">
        <p class="font-body text-body text-ink-500">
          This shelf is being re-cut. Check back this week.
        </p>
      </div>
    </section>
  </main>
</template>
