<script setup lang="ts">
import Icon from '~/components/ui/Icon.vue'
/**
 * About / Value chain: sub-page of /about that walks the reader through
 * the five steps a GhostMark order makes from brief to delivery, then
 * names the partners and certifications behind each step.
 *
 * Layout follows the merchery.co audit-about reference:
 *   1. Cream-tile hero with the headline + a short intro
 *   2. A five-step horizontal flow (collapsing to a vertical stack on
 *      mobile): Design → Sourcing → Production → Customisation → Logistics
 *   3. A 3-up grid of named partners with cream-tile placeholder photos
 *   4. A "where in Europe" map placeholder with dashed-underlined city names
 *   5. A trust-badge strip mirroring the footer pattern (B Corp, GOTS,
 *      OEKO-TEX, FSC)
 *
 * Every surface is tokenised through the editorial palette, no
 * `bg-[#hex]` literals.
 */
defineOptions({ name: 'PageAboutValueChain' })

useHead({
  title: 'Value chain · GhostMark Studio',
  meta: [
    {
      name: 'description',
      content:
        'From brief to doorstep: the five steps every GhostMark order moves through, the named partners we work with at each one, and the European cities where they\'re based.',
    },
  ],
})

interface FlowStep {
  index: string
  title: string
  body: string
  iconPath: string // single-line SVG path drawn in 0 0 24 24
}

interface Partner {
  name: string
  role: string
  city: string
  body: string
}

interface City {
  name: string
  country: string
}

interface Certification {
  id: 'bcorp' | 'gots' | 'oeko' | 'fsc'
  label: string
  short: string
}

const flow: FlowStep[] = [
  {
    index: '01',
    title: 'Design',
    body:
      'Every brief lands in our Brussels studio. We sketch, sample and prototype on real fabric before committing to production.',
    iconPath: 'M5 19V5h6l3 3h5v11Z',
  },
  {
    index: '02',
    title: 'Sourcing',
    body:
      'Raw materials are sourced from named mills in Portugal and Germany. Every fibre carries a GOTS or OEKO-TEX certificate.',
    iconPath: 'M4 8a4 4 0 1 1 8 0M4 8h16v9a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3Z',
  },
  {
    index: '03',
    title: 'Production',
    body:
      'Garments are cut and sewn in small batches near the source mill. Average run size: 142 units. No overstock, no airlift.',
    iconPath: 'M4 6h16v4H4Zm0 8h16v4H4Z',
  },
  {
    index: '04',
    title: 'Customisation',
    body:
      'Screen printing, embroidery and laser engraving happen in-house under one roof. Proofs go out within 48 hours of approval.',
    iconPath: 'M5 13l4 4L19 7M9 17l-4-4',
  },
  {
    index: '05',
    title: 'Logistics',
    body:
      'Bulk freight rides on rail or sea. Last-mile is DPD\'s carbon-neutral lane. Packaging is 100% post-consumer recycled.',
    iconPath: 'M3 7h11l3 4h4v6H3Zm4 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm10 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z',
  },
]

const partners: Partner[] = [
  {
    name: 'Mestre & Filhos',
    role: 'Cotton mill',
    city: 'Porto, PT',
    body:
      'Family-run since 1962. Spins our long-staple GOTS-certified cotton from organic Portuguese fibre.',
  },
  {
    name: 'Hofstetter Inks',
    role: 'Pigment supplier',
    city: 'Berlin, DE',
    body:
      'Reformulates our screen and pad inks with reclaimed water-based pigments. OEKO-TEX Eco Passport.',
  },
  {
    name: 'Pakka Press',
    role: 'Packaging partner',
    city: 'Krakow, PL',
    body:
      'Mailers, tape and labels: all FSC-certified, 100% post-consumer recycled, compostable in 90 days.',
  },
]

const cities: City[] = [
  { name: 'Brussels', country: 'BE' },
  { name: 'Berlin', country: 'DE' },
  { name: 'Lisbon', country: 'PT' },
  { name: 'Porto', country: 'PT' },
  { name: 'Stockholm', country: 'SE' },
  { name: 'Krakow', country: 'PL' },
]

const certifications: Certification[] = [
  { id: 'bcorp', label: 'Certified B Corporation', short: 'B Corp' },
  { id: 'gots', label: 'Global Organic Textile Standard', short: 'GOTS' },
  { id: 'oeko', label: 'OEKO-TEX Standard 100', short: 'OEKO-TEX' },
  { id: 'fsc', label: 'Forest Stewardship Council', short: 'FSC' },
]
</script>

<template>
  <div class="bg-white text-ink-950">
    <!-- ============================================================
         1. Hero: cream tile + serif headline + body intro
         ============================================================ -->
    <section
      class="bg-cream-tile"
      aria-labelledby="value-chain-hero-heading"
    >
      <div class="mx-auto grid max-w-rail grid-cols-1 gap-x-[30px] gap-y-12 px-gutter py-section lg:grid-cols-2 lg:items-center">
        <div class="flex flex-col gap-6">
          <p class="text-eyebrow font-body uppercase text-ink-500">
            About / Value chain
          </p>
          <h1
            id="value-chain-hero-heading"
            class="font-display text-display-lg font-normal text-ink-950"
          >
            Our value chain
          </h1>
          <p class="max-w-[44ch] font-body text-body text-ink-700">
            Five steps, six European cities, twenty-two named partners.
            Every order you place moves through the same chain in the same
            order. We name everyone we work with. If a partner won't be
            named, we don't work with them.
          </p>
        </div>

        <div class="aspect-[4/5] w-full overflow-hidden bg-cream-warm">
          <div class="flex h-full w-full items-center justify-center">
            <!--
              Placeholder for photography that has not been shot yet. It used to say
              "Image: replace with real photography" — an instruction to us, rendered
              to customers on a live marketing page. Fixing its contrast last commit
              only made the wrong thing easier to read.

              This is the placeholder the codebase already had (ProductCard uses it for
              a missing thumbnail), so it is a fourth pattern avoided rather than a new
              one invented. Decorative on purpose: Icon sets aria-hidden when no
              ariaLabel is passed, and the previous `aria-label="Image placeholder"`
              announced the absence of content, which is noise rather than information.
              ink-500 is 4.55:1 on cream-warm and 5.23:1 on cream-tile, over the 3:1
              floor a non-text graphic answers to.
            -->
            <Icon
              name="image-placeholder"
              :size="40"
              :stroke-width="1.5"
              class="text-ink-500"
            />
          </div>
        </div>
      </div>
    </section>

    <!-- ============================================================
         2. Flow: five horizontal steps (vertical on mobile)
         ============================================================ -->
    <section
      class="bg-white"
      aria-labelledby="value-chain-flow-heading"
    >
      <div class="mx-auto max-w-rail px-gutter py-section">
        <div class="flex flex-col gap-3 pb-12 lg:max-w-[440px]">
          <p class="text-eyebrow font-body uppercase text-ink-500">
            The flow
          </p>
          <h2
            id="value-chain-flow-heading"
            class="font-display text-display-md font-normal text-ink-950"
          >
            Brief to doorstep, in five steps.
          </h2>
        </div>

        <ol class="grid grid-cols-1 gap-x-[30px] gap-y-12 sm:grid-cols-2 lg:grid-cols-5">
          <li
            v-for="step in flow"
            :key="step.index"
            class="flex flex-col gap-4"
          >
            <div class="flex items-center gap-3">
              <span
                aria-hidden="true"
                class="grid h-12 w-12 place-items-center bg-cream-tile text-ink-950"
              >
                <svg
                  class="h-6 w-6"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.4"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path :d="step.iconPath" />
                </svg>
              </span>
              <span class="text-eyebrow font-body uppercase text-ink-500">
                {{ step.index }}
              </span>
            </div>
            <h3 class="font-display text-display-sm font-normal text-ink-950">
              {{ step.title }}
            </h3>
            <p class="font-body text-body text-ink-700">
              {{ step.body }}
            </p>
          </li>
        </ol>
      </div>
    </section>

    <!-- ============================================================
         3. Materials & partners: 3-up named cards on cream-warm
         ============================================================ -->
    <section
      class="bg-cream-warm"
      aria-labelledby="value-chain-partners-heading"
    >
      <div class="mx-auto max-w-rail px-gutter py-section">
        <div class="flex flex-col gap-3 pb-12 lg:max-w-[440px]">
          <p class="text-eyebrow font-body uppercase text-ink-500">
            Materials &amp; partners
          </p>
          <h2
            id="value-chain-partners-heading"
            class="font-display text-display-md font-normal text-ink-950"
          >
            The people behind your order.
          </h2>
        </div>

        <div class="grid grid-cols-1 gap-x-[30px] gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          <article
            v-for="partner in partners"
            :key="partner.name"
            class="flex flex-col gap-4"
          >
            <div class="aspect-[4/5] w-full overflow-hidden bg-cream-tile">
              <div class="flex h-full w-full items-center justify-center">
                <Icon
                  name="image-placeholder"
                  :size="40"
                  :stroke-width="1.5"
                  class="text-ink-500"
                />
              </div>
            </div>
            <p class="text-eyebrow font-body uppercase text-ink-500">
              {{ partner.role }} &middot; {{ partner.city }}
            </p>
            <h3 class="font-display text-display-sm font-normal text-ink-950">
              {{ partner.name }}
            </h3>
            <p class="font-body text-body text-ink-700">
              {{ partner.body }}
            </p>
          </article>
        </div>
      </div>
    </section>

    <!-- ============================================================
         4. Map: placeholder + dashed-underlined city list
         ============================================================ -->
    <section
      class="bg-white"
      aria-labelledby="value-chain-map-heading"
    >
      <div class="mx-auto max-w-rail px-gutter py-section">
        <div class="grid grid-cols-1 gap-x-[30px] gap-y-12 lg:grid-cols-[minmax(0,0.4fr)_minmax(0,0.6fr)] lg:items-start">
          <div class="flex flex-col gap-6">
            <p class="text-eyebrow font-body uppercase text-ink-500">
              On the map
            </p>
            <h2
              id="value-chain-map-heading"
              class="font-display text-display-md font-normal text-ink-950"
            >
              Our partners are here.
            </h2>
            <p class="max-w-[44ch] font-body text-body text-ink-700">
              Six cities, all within a two-day truck ride of the studio.
              Short freight, named contacts, drop-in visits whenever a
              client wants to see the floor.
            </p>
            <ul class="flex flex-wrap gap-x-6 gap-y-3 pt-2">
              <li
                v-for="city in cities"
                :key="city.name"
                class="font-body text-body text-ink-700"
              >
                <span class="underline decoration-dashed underline-offset-4 decoration-ink-400">{{ city.name }}</span>
                <span class="ml-1 text-ink-500">&middot; {{ city.country }}</span>
              </li>
            </ul>
          </div>

          <div class="aspect-[4/3] w-full overflow-hidden bg-cream-tile">
            <div class="flex h-full w-full items-center justify-center">
              <Icon
                name="image-placeholder"
                :size="40"
                :stroke-width="1.5"
                class="text-ink-500"
              />
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ============================================================
         5. Certifications: trust-badge strip (matches footer pattern)
         ============================================================ -->
    <section
      class="bg-cream-tile"
      aria-labelledby="value-chain-certs-heading"
    >
      <div class="mx-auto flex max-w-rail flex-col gap-12 px-gutter py-section">
        <div class="flex flex-col gap-3 lg:max-w-[440px]">
          <p
            id="value-chain-certs-heading"
            class="text-eyebrow font-body uppercase text-ink-500"
          >
            Certifications
          </p>
          <p class="font-display text-display-md font-normal leading-[1.1] text-ink-950">
            Audited by people who don't work for us.
          </p>
        </div>

        <ul class="flex flex-wrap items-center gap-x-12 gap-y-8">
          <li
            v-for="cert in certifications"
            :key="cert.id"
            class="flex items-center gap-3 text-ink-700"
          >
            <span
              aria-hidden="true"
              class="grid h-12 w-12 place-items-center rounded-full bg-white ring-1 ring-ink-200"
            >
              <!-- B Corp: circled B -->
              <svg
                v-if="cert.id === 'bcorp'"
                class="h-6 w-6 fill-current"
                viewBox="0 0 24 24"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="8.5"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.4"
                />
                <path
                  d="M10 8h2.6a1.7 1.7 0 0 1 0 3.4H10V8Zm0 3.4h3a1.8 1.8 0 0 1 0 3.6h-3v-3.6Z"
                  fill="currentColor"
                />
              </svg>
              <!-- GOTS: leaf cluster in a ring -->
              <svg
                v-else-if="cert.id === 'gots'"
                class="h-6 w-6 fill-current"
                viewBox="0 0 24 24"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="8.5"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.4"
                />
                <path
                  d="M8 14c0-3 2-5 5-5 0 3-2 5-5 5Zm0 0c1-1 2-2 3-3"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.4"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              <!-- OEKO-TEX: woven hex -->
              <svg
                v-else-if="cert.id === 'oeko'"
                class="h-6 w-6 fill-current"
                viewBox="0 0 24 24"
              >
                <path
                  d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3Zm0 4l-4 2.3v4.6L12 16l4-2.1V9.3Z"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.4"
                  stroke-linejoin="round"
                />
              </svg>
              <!-- FSC: tree-checkmark -->
              <svg
                v-else
                class="h-6 w-6 fill-current"
                viewBox="0 0 24 24"
              >
                <path
                  d="M12 4v14M8 8l4-4 4 4M7 18l4 3 6-9"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.4"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </span>
            <span class="sr-only">{{ cert.label }}</span>
            <span
              class="font-body text-body text-ink-700"
              aria-hidden="true"
            >{{ cert.short }}</span>
          </li>
        </ul>
      </div>
    </section>
  </div>
</template>
