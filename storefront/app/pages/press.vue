<script setup lang="ts">
/**
 * /press: Press kit landing page.
 *
 * Editorial layout consistent with /about and /sustainability:
 *   - Cream-tile hero with eyebrow + serif headline.
 *   - "In the press": 3-up logo placeholder strip.
 *   - "Press releases": dated cards, serif title, dashed-underline link.
 *   - "Brand assets": outline buttons for downloadable kits (placeholder #).
 *   - "Press contact": single card with email + spokesperson.
 */
defineOptions({ name: 'PagePress' })

useHead({
  title: 'Press · GhostMark Studio',
  meta: [
    {
      name: 'description',
      content:
        'Press kit, brand assets and recent coverage of GhostMark Studio. Logos, photography and downloadable guidelines for journalists, editors and partners.',
    },
  ],
})

interface Outlet {
  name: string
  monogram: string
}

interface Release {
  date: string
  iso: string
  title: string
  excerpt: string
}

interface Asset {
  label: string
  format: string
  href: string
}

const outlets: Outlet[] = [
  { name: 'It\'s Nice That', monogram: 'INT' },
  { name: 'Eye on Design', monogram: 'EOD' },
  { name: 'Monocle', monogram: 'MNC' },
  { name: 'Sidetracked', monogram: 'SDT' },
  { name: 'Disegno', monogram: 'DSG' },
  { name: 'Wallpaper*', monogram: 'WLP' },
]

const releases: Release[] = [
  {
    date: '12 March 2026',
    iso: '2026-03-12',
    title: 'GhostMark opens a third workshop in East London',
    excerpt:
      'A 240 m² printroom in Hackney Downs Studios completes the studio\'s European triangle, cutting average UK delivery from five days to two.',
  },
  {
    date: '04 February 2026',
    iso: '2026-02-04',
    title: 'New algae-pigment ink reduces black-print emissions by 64%',
    excerpt:
      'A two-year R&D collaboration with Ghent\'s Pigment Lab produces a screen-printable carbon-black replacement now used across the GhostMark catalog.',
  },
  {
    date: '18 December 2025',
    iso: '2025-12-18',
    title: 'GhostMark joins 1% for the Planet as a permanent member',
    excerpt:
      'One percent of all studio revenue (not profit) will be directed to vetted environmental nonprofits chosen by the studio team each quarter.',
  },
]

const assets: Asset[] = [
  { label: 'Logo pack', format: 'ZIP · 4.2 MB', href: '#' },
  { label: 'Brand guidelines', format: 'PDF · 1.8 MB', href: '#' },
  { label: 'Photography library', format: 'ZIP · 38 MB', href: '#' },
]
</script>

<template>
  <div class="bg-white text-ink-950">
    <!-- ============================================================
         1. Hero: cream tile + serif headline
         ============================================================ -->
    <section
      class="bg-merchery-tile"
      aria-labelledby="press-hero-heading"
    >
      <div class="mx-auto grid max-w-rail grid-cols-1 gap-x-[30px] gap-y-10 px-gutter py-section lg:grid-cols-2 lg:items-center">
        <div class="flex flex-col gap-6">
          <p class="text-eyebrow font-body uppercase text-ink-500">
            Press
          </p>
          <h1
            id="press-hero-heading"
            class="font-display text-display-lg font-normal text-ink-950"
          >
            Press kit &amp; coverage.
          </h1>
          <p class="max-w-[48ch] font-body text-body text-ink-700">
            Recent releases, downloadable brand assets and a direct line to
            the studio for interviews, comment and feature requests. Anything
            missing? Email
            <a
              href="mailto:press@ghostmark.studio"
              class="underline decoration-dashed decoration-ink-400 underline-offset-4 transition-colors duration-base ease-emphasis hover:decoration-ink-950"
            >press@ghostmark.studio</a>
            and we'll get it over the same day.
          </p>
        </div>

        <div class="aspect-[4/3] w-full overflow-hidden bg-cream-tile">
          <div class="flex h-full w-full items-center justify-center">
            <span
              class="font-body text-caption text-ink-400"
              aria-label="Image placeholder"
            >Image: press cover frame</span>
          </div>
        </div>
      </div>
    </section>

    <!-- ============================================================
         2. In the press: 3-up logo grid placeholders
         ============================================================ -->
    <section
      class="bg-white"
      aria-labelledby="press-outlets-heading"
    >
      <div class="mx-auto max-w-rail px-gutter py-section">
        <div class="flex flex-col gap-3 pb-12 lg:max-w-[440px]">
          <p class="text-eyebrow font-body uppercase text-ink-500">
            In the press
          </p>
          <h2
            id="press-outlets-heading"
            class="font-display text-display-md font-normal text-ink-950"
          >
            Where the studio has shown up.
          </h2>
        </div>

        <ul class="grid grid-cols-2 gap-[30px] md:grid-cols-3 lg:grid-cols-6">
          <li
            v-for="outlet in outlets"
            :key="outlet.name"
            class="flex aspect-[3/2] items-center justify-center bg-cream-warm"
          >
            <span class="font-display text-display-sm font-normal text-ink-500">
              {{ outlet.monogram }}
            </span>
            <span class="sr-only">{{ outlet.name }}</span>
          </li>
        </ul>
      </div>
    </section>

    <!-- ============================================================
         3. Press releases: 3-up dated cards
         ============================================================ -->
    <section
      class="bg-cream-warm"
      aria-labelledby="press-releases-heading"
    >
      <div class="mx-auto max-w-rail px-gutter py-section">
        <div class="flex flex-col gap-3 pb-12 lg:max-w-[440px]">
          <p class="text-eyebrow font-body uppercase text-ink-500">
            Press releases
          </p>
          <h2
            id="press-releases-heading"
            class="font-display text-display-md font-normal text-ink-950"
          >
            Recent announcements.
          </h2>
        </div>

        <ul class="grid grid-cols-1 gap-x-[30px] gap-y-12 md:grid-cols-3">
          <li
            v-for="release in releases"
            :key="release.iso"
            class="flex flex-col gap-4 bg-white p-8"
          >
            <time
              :datetime="release.iso"
              class="text-eyebrow font-body uppercase text-ink-500"
            >
              {{ release.date }}
            </time>
            <h3 class="font-display text-display-sm font-normal leading-tight text-ink-950">
              {{ release.title }}
            </h3>
            <p class="font-body text-body text-ink-700">
              {{ release.excerpt }}
            </p>
            <a
              href="#"
              class="mt-auto self-start font-body text-body text-ink-950 underline decoration-dashed decoration-ink-400 underline-offset-4 transition-colors duration-base ease-emphasis hover:decoration-ink-950"
            >
              Read more
            </a>
          </li>
        </ul>
      </div>
    </section>

    <!-- ============================================================
         4. Brand assets: outline buttons for downloads
         ============================================================ -->
    <section
      class="bg-white"
      aria-labelledby="press-assets-heading"
    >
      <div class="mx-auto max-w-rail px-gutter py-section">
        <div class="grid grid-cols-1 gap-x-[30px] gap-y-10 lg:grid-cols-[minmax(0,0.4fr)_minmax(0,0.6fr)]">
          <div class="flex flex-col gap-3">
            <p class="text-eyebrow font-body uppercase text-ink-500">
              Brand assets
            </p>
            <h2
              id="press-assets-heading"
              class="font-display text-display-md font-normal text-ink-950"
            >
              Logos, photography, guidelines.
            </h2>
            <p class="max-w-[48ch] font-body text-body text-ink-700">
              Ready-to-use kits for editorial and partner work. Please
              don't recolour the wordmark, and please use the provided
              clear-space ratios: there are notes inside the PDF.
            </p>
          </div>
          <ul class="flex flex-col gap-4">
            <li
              v-for="asset in assets"
              :key="asset.label"
              class="flex flex-col gap-2 border border-ink-200 p-6 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
            >
              <div class="flex flex-col gap-1">
                <span class="font-display text-display-sm font-normal text-ink-950">
                  {{ asset.label }}
                </span>
                <span class="font-body text-caption text-ink-500">
                  {{ asset.format }}
                </span>
              </div>
              <UiButton
                variant="outline"
                size="md"
                as="a"
                :to="asset.href"
              >
                Download
              </UiButton>
            </li>
          </ul>
        </div>
      </div>
    </section>

    <!-- ============================================================
         5. Press contact: single card on sage band
         ============================================================ -->
    <section
      class="w-full bg-merchery-sage py-section"
      aria-labelledby="press-contact-heading"
    >
      <div class="mx-auto max-w-rail px-gutter">
        <div class="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_auto] lg:items-end lg:gap-16">
          <div class="max-w-[400px]">
            <!-- ink-600, not the ink-500 eyebrow default: sage ground. See tailwind.config.ts ink.500. -->
            <p class="text-eyebrow font-body uppercase text-ink-600">
              Press contact
            </p>
            <h2
              id="press-contact-heading"
              class="mt-3 font-display font-normal leading-[1.05] tracking-[-0.015em] text-ink-950"
              style="font-size: clamp(2rem, 1.4rem + 2vw, 3rem)"
            >
              Talk to a human.
            </h2>
            <p class="mt-4 font-body text-body text-ink-700">
              <span class="block text-ink-950">Esma Karim</span>
              Head of communications<br>
              <a
                href="mailto:press@ghostmark.studio"
                class="underline decoration-dashed decoration-ink-400 underline-offset-4 transition-colors duration-base ease-emphasis hover:decoration-ink-950"
              >press@ghostmark.studio</a>
              · +32 2 123 45 67
            </p>
          </div>

          <div class="flex flex-wrap gap-3">
            <UiButton
              variant="merchery"
              size="lg"
              as="a"
              to="mailto:press@ghostmark.studio"
            >
              Email the press desk
            </UiButton>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
