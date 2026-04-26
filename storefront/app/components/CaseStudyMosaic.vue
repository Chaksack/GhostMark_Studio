<template>
  <!--
    Case-study mosaic — the editorial centrepiece of the home page.
    Positions GhostMark Studio as a creative agency that dresses other
    creative brands. Pinterest-style asymmetric grid: 2-up uniform on
    mobile, a 12-column asymmetric magazine layout from `lg` upward
    where deliberate y-offsets break the baseline grid.

    All six tiles below are PLACEHOLDERS. Brand names ("FieldDesk",
    "Opal Studio", "Thirdspace", …) are fictional, the case-study
    routes (/case-studies/*) do not exist yet, and the imagery is
    pulled from images.unsplash.com (already whitelisted in
    nuxt.config.ts under `image.domains`). Replace each `cases[]`
    entry once the real client work + case-study pages land.
  -->
  <section
    class="bg-warmGrey py-[6rem] lg:py-[10rem]"
    aria-labelledby="case-studies-heading"
  >
    <div class="mx-auto w-full max-w-screen-3xl px-5 sm:px-6 lg:px-8">
      <!-- Eyebrow + H2 + sub -->
      <div class="mb-[4rem] max-w-[80rem] lg:mb-[6rem]">
        <p class="mb-3 text-[12px] uppercase tracking-[0.18em] text-greyText">
          Our products in real life
        </p>
        <h2
          id="case-studies-heading"
          class="font-accent text-[3.2rem] leading-[3.6rem] text-ink-950 md:text-[4.8rem] md:leading-[5.2rem] lg:text-[6.4rem] lg:leading-[6.8rem]"
        >
          As real as it gets.
        </h2>
        <p class="mt-6 max-w-[56rem] text-[1.5rem] leading-[2rem] text-ink-700">
          Studios, agencies and teams send us their marks. We send them
          objects that outlast the campaign. A small selection from the canon.
        </p>
      </div>

      <!--
        Mosaic grid. `grid-flow-row-dense` lets later tiles backfill any
        leftover slots from the asymmetric col/row spans, so a `col-span-3`
        tile slotted next to a `col-span-5` tile doesn't leave a gap.
      -->
      <div
        class="grid grid-flow-row-dense grid-cols-2 gap-3 md:gap-4 lg:grid-cols-12 lg:gap-6"
      >
        <article
          v-for="(c, i) in cases"
          :key="c.slug"
          :class="[
            'group relative overflow-hidden rounded-[0.5rem] bg-offWhite',
            mosaicClass(i),
          ]"
        >
          <!--
            Stretched-link pattern: a transparent absolute anchor covers
            the whole tile so the entire card is the click target while
            the visual content (image + caption) sits underneath. The
            aria-label carries the destination context for screen readers
            since the visible text is brand + title.
          -->
          <NuxtLink
            :to="c.to"
            class="absolute inset-0 z-10"
            :aria-label="`View case study: ${c.title}`"
          />
          <img
            :src="c.image"
            :alt="c.alt"
            class="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            loading="lazy"
            decoding="async"
          />
          <!-- Bottom-anchored gradient scrim — keeps the caption legible
               regardless of the underlying photograph's exposure. -->
          <div
            class="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-950/70 via-ink-950/20 to-transparent"
          />
          <div class="absolute bottom-0 left-0 right-0 z-[1] p-5 md:p-7">
            <p class="mb-2 text-[11px] uppercase tracking-[0.18em] text-cream-50/85">
              {{ c.brand }}
            </p>
            <h3
              class="font-accent text-[1.6rem] leading-[1.9rem] text-cream-50 md:text-[2.2rem] md:leading-[2.5rem] lg:text-[2.8rem] lg:leading-[3.1rem]"
            >
              {{ c.title }}
            </h3>
          </div>
        </article>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
/**
 * Six placeholder case studies. All copy is fictional — replace as
 * real client work ships. Image URLs target images.unsplash.com,
 * which is whitelisted in nuxt.config.ts under `image.domains` so a
 * future swap to <NuxtImg> for IPX optimisation is a one-line change.
 *
 * Why <img> and not <NuxtImg>: these tiles are below the fold, well
 * past the LCP candidate, and we want lazy-load + decoding=async
 * without the IPX hop. NuxtPicture is reserved for hero / LCP-critical
 * imagery — see HeroSection.vue for the reference pattern.
 */
const cases = [
  {
    slug: 'fielddesk-onboarding',
    brand: 'FieldDesk',
    title: 'Onboarding kit for 200 new hires',
    image: 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=900&q=85',
    alt: 'Folded charcoal tee with embroidered logo, on a desk with notebook and pen',
    to: '/case-studies/fielddesk-onboarding',
  },
  {
    slug: 'opal-launch-tote',
    brand: 'Opal Studio',
    title: 'Launch totes for SS26',
    image: 'https://images.unsplash.com/photo-1572883454114-1cf0031ede2a?w=900&q=85',
    alt: 'Cream canvas tote bag with screen-printed crest',
    to: '/case-studies/opal-launch',
  },
  {
    slug: 'thirdspace-event-kit',
    brand: 'Thirdspace',
    title: 'Event kit · 3 cities, 3 weeks',
    image: 'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=900&q=85',
    alt: 'Hooded sweatshirt with embroidered chest hit',
    to: '/case-studies/thirdspace-events',
  },
  {
    slug: 'parallel-press-week',
    brand: 'Parallel',
    title: 'Press-week mini drops',
    image: 'https://images.unsplash.com/photo-1556306535-0f09a537f0a3?w=900&q=85',
    alt: 'Five-panel cap with woven label',
    to: '/case-studies/parallel-press',
  },
  {
    slug: 'mortara-recruit',
    brand: 'Mortara',
    title: 'Recruit-week welcome packs',
    image: 'https://images.unsplash.com/photo-1572177812156-58036aae439c?w=900&q=85',
    alt: 'Sticker pack with embossed seal',
    to: '/case-studies/mortara-recruit',
  },
  {
    slug: 'kew-quarterly',
    brand: 'Kew Quarterly',
    title: 'Quarterly merch for subscribers',
    image: 'https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=900&q=85',
    alt: 'Cream-coloured short-sleeve tee on hanger',
    to: '/case-studies/kew-quarterly',
  },
]

/**
 * Asymmetric layout map — index-keyed so we can read the magazine
 * intent at a glance:
 *
 *   0 ─ big left tile     col-span-5  row-span-2  (anchors top-left)
 *   1 ─ medium top-right  col-span-4  row-span-1
 *   2 ─ narrow w/ offset  col-span-3  row-span-1  + mt-[3rem]
 *   3 ─ narrow            col-span-3  row-span-1
 *   4 ─ medium            col-span-4  row-span-1
 *   5 ─ big right tile    col-span-5  row-span-2  + mt-[3rem]
 *
 * The two `mt-[3rem]` y-offsets break the baseline grid so the
 * composition reads as editorial-magazine, not template grid. Every
 * tile drops to a uniform 4:5 portrait on mobile (2-col grid) where
 * a 12-column asymmetric layout would be unreadable on a phone.
 */
function mosaicClass(i: number): string {
  const desktopLayouts = [
    'aspect-[4/5] lg:aspect-auto lg:col-span-5 lg:row-span-2 lg:min-h-[520px]',
    'aspect-[4/5] lg:aspect-auto lg:col-span-4 lg:row-span-1 lg:min-h-[260px]',
    'aspect-[4/5] lg:aspect-auto lg:col-span-3 lg:row-span-1 lg:min-h-[260px] lg:mt-[3rem]',
    'aspect-[4/5] lg:aspect-auto lg:col-span-3 lg:row-span-1 lg:min-h-[260px]',
    'aspect-[4/5] lg:aspect-auto lg:col-span-4 lg:row-span-1 lg:min-h-[260px]',
    'aspect-[4/5] lg:aspect-auto lg:col-span-5 lg:row-span-2 lg:min-h-[520px] lg:mt-[3rem]',
  ]
  return desktopLayouts[i] || ''
}
</script>
