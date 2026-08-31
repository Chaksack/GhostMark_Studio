<script setup lang="ts">
import Icon from '~/components/ui/Icon.vue'
/**
 * Sustainability: the editorial /transparency page.
 *
 * Restructured from a four-band commitments page into the six-section
 * merchery.co audit-transparency layout: a Made-in-transparency hero
 * followed by a B Corp panel, sourcing, 1% for the Planet, raw materials,
 * transport and factories, closing on a sage CTA band.
 *
 * Each numbered section is its own `<section>` with `id="section-N"` so
 * footer / in-page anchors can deep-link straight to the band. Surfaces
 * alternate cream-tile and cream-warm to give the eye a rhythm; every
 * surface is tokenised through the editorial palette (no `bg-[#hex]`
 * literals).
 *
 * Cross-links land on the two new About sub-pages:
 *   - /about/value-chain          (Sourcing + Our factories)
 *   - /about/environmental-footprint  (Raw materials)
 */
defineOptions({ name: 'PageSustainability' })

useHead({
  title: 'Made in transparency · GhostMark Studio',
  meta: [
    {
      name: 'description',
      content:
        'Made in transparency: our B Corp score, where we source materials, our 1% for the Planet pledge, the percentages behind every blank, our freight choices and the factories we work with.',
    },
  ],
})

interface RawMaterial {
  label: string
  percent: number
}

interface FactoryStep {
  city: string
  country: string
  role: string
  body: string
}

const rawMaterials: RawMaterial[] = [
  { label: 'GOTS organic cotton', percent: 62 },
  { label: 'Recycled polyester', percent: 18 },
  { label: 'Recycled cotton', percent: 12 },
  { label: 'Hemp & linen blends', percent: 8 },
]

const factories: FactoryStep[] = [
  {
    city: 'Porto',
    country: 'Portugal',
    role: 'Cotton spinning &amp; knitting',
    body:
      'Mestre &amp; Filhos run a family-owned mill spinning long-staple GOTS cotton on machinery they\'ve maintained since 1962.',
  },
  {
    city: 'Brussels',
    country: 'Belgium',
    role: 'Customisation &amp; finishing',
    body:
      'Screen, pad and laser work happens at the studio. We see every piece before it ships. Proofs go out within 48 hours.',
  },
  {
    city: 'Krakow',
    country: 'Poland',
    role: 'Packaging &amp; pick-pack',
    body:
      'Pakka Press pack each order in 100% post-consumer recycled mailers. Tape is paper, labels compost in 90 days.',
  },
]
</script>

<template>
  <div class="bg-white text-ink-950">
    <!-- ============================================================
         1. Hero: eyebrow "Made in transparency" + serif headline
         ============================================================ -->
    <section
      id="section-1"
      class="bg-cream-tile"
      aria-labelledby="transparency-hero-heading"
    >
      <div class="mx-auto grid max-w-rail grid-cols-1 gap-x-[30px] gap-y-12 px-gutter py-section lg:grid-cols-2 lg:items-center">
        <div class="flex flex-col gap-6">
          <p class="text-eyebrow font-body uppercase text-ink-500">
            Made in transparency
          </p>
          <h1
            id="transparency-hero-heading"
            class="font-display text-display-lg font-normal text-ink-950"
          >
            Every claim, sourced and dated.
          </h1>
          <p class="max-w-[44ch] font-body text-body text-ink-700">
            Print-on-demand was sold to the industry as a sustainability
            story and quietly turned into the opposite. We're trying to
            walk it back, and to show our working as we go. Six sections
            below. Pick one, or read them in order.
          </p>
          <div class="flex flex-wrap gap-3 pt-2">
            <UiButton
              variant="merchery"
              size="lg"
              as="NuxtLink"
              to="/contact"
            >
              Print sustainably
            </UiButton>
            <UiButton
              variant="outline"
              size="lg"
              as="a"
              to="#section-2"
            >
              Read the report
            </UiButton>
          </div>
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
         2. B Corp: score + body + circled-B logo
         ============================================================ -->
    <section
      id="section-2"
      class="bg-white"
      aria-labelledby="transparency-bcorp-heading"
    >
      <div class="mx-auto grid max-w-rail grid-cols-1 gap-x-[30px] gap-y-12 px-gutter py-section lg:grid-cols-[minmax(0,0.55fr)_minmax(0,0.45fr)] lg:items-center">
        <div class="flex flex-col gap-6">
          <p class="text-eyebrow font-body uppercase text-ink-500">
            01 &middot; B Corp
          </p>
          <h2
            id="transparency-bcorp-heading"
            class="font-display text-display-md font-normal text-ink-950"
          >
            Certified B Corp since 2021.
          </h2>
          <p class="max-w-[52ch] font-body text-body text-ink-700">
            Our last assessment scored 112.4, comfortably past the 80-point
            certification floor and above the apparel-industry median of
            91.7. The full disclosure is published on B Lab\'s directory
            and re-assessed every three years.
          </p>
          <dl class="grid grid-cols-3 gap-x-[30px] gap-y-6 pt-2">
            <div class="flex flex-col gap-1 border-l border-ink-200 pl-4">
              <dt class="text-eyebrow font-body uppercase text-ink-500">
                Score
              </dt>
              <dd class="font-display text-display-sm font-normal text-ink-950">
                112.4
              </dd>
            </div>
            <div class="flex flex-col gap-1 border-l border-ink-200 pl-4">
              <dt class="text-eyebrow font-body uppercase text-ink-500">
                Median
              </dt>
              <dd class="font-display text-display-sm font-normal text-ink-950">
                91.7
              </dd>
            </div>
            <div class="flex flex-col gap-1 border-l border-ink-200 pl-4">
              <dt class="text-eyebrow font-body uppercase text-ink-500">
                Recertify
              </dt>
              <dd class="font-display text-display-sm font-normal text-ink-950">
                2027
              </dd>
            </div>
          </dl>
        </div>

        <div class="flex justify-center lg:justify-end">
          <div class="grid h-40 w-40 place-items-center rounded-full bg-cream-tile ring-1 ring-ink-200">
            <svg
              class="h-20 w-20 fill-current text-ink-950"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                cx="12"
                cy="12"
                r="9"
                fill="none"
                stroke="currentColor"
                stroke-width="1.4"
              />
              <path
                d="M9 7h3.6a2 2 0 0 1 0 4H9V7Zm0 4h4a2 2 0 0 1 0 4H9v-4Z"
                fill="currentColor"
              />
            </svg>
            <span class="sr-only">Certified B Corporation</span>
          </div>
        </div>
      </div>
    </section>

    <!-- ============================================================
         3. Sourcing: link out to /about/value-chain
         ============================================================ -->
    <section
      id="section-3"
      class="bg-cream-warm"
      aria-labelledby="transparency-sourcing-heading"
    >
      <div class="mx-auto grid max-w-rail grid-cols-1 gap-x-[30px] gap-y-12 px-gutter py-section lg:grid-cols-2 lg:items-center">
        <div class="aspect-[4/5] w-full overflow-hidden bg-cream-tile lg:order-2">
          <div class="flex h-full w-full items-center justify-center">
            <Icon
              name="image-placeholder"
              :size="40"
              :stroke-width="1.5"
              class="text-ink-500"
            />
          </div>
        </div>

        <div class="flex flex-col gap-6 lg:order-1">
          <p class="text-eyebrow font-body uppercase text-ink-500">
            02 &middot; Sourcing
          </p>
          <h2
            id="transparency-sourcing-heading"
            class="font-display text-display-md font-normal text-ink-950"
          >
            Named mills, named partners, two-day truck radius.
          </h2>
          <p class="max-w-[52ch] font-body text-body text-ink-700">
            Every fibre we stock comes from a mill we can name in print,
            most within a two-day truck ride of the studio. The full
            partner list lives on the <NuxtLink
              to="/about/value-chain"
              class="underline decoration-dashed underline-offset-4 decoration-ink-400 hover:text-ink-950"
            >value chain page</NuxtLink>, with cities, certifications and
            the role each partner plays in your order.
          </p>
          <div class="flex flex-wrap gap-3 pt-2">
            <UiButton
              variant="outline"
              size="lg"
              as="NuxtLink"
              to="/about/value-chain"
            >
              See the value chain
            </UiButton>
          </div>
        </div>
      </div>
    </section>

    <!-- ============================================================
         4. 1% for the Planet: partnership detail
         ============================================================ -->
    <section
      id="section-4"
      class="bg-white"
      aria-labelledby="transparency-planet-heading"
    >
      <div class="mx-auto grid max-w-rail grid-cols-1 gap-x-[30px] gap-y-12 px-gutter py-section lg:grid-cols-[minmax(0,0.55fr)_minmax(0,0.45fr)] lg:items-center">
        <div class="flex flex-col gap-6">
          <p class="text-eyebrow font-body uppercase text-ink-500">
            03 &middot; 1% for the Planet
          </p>
          <h2
            id="transparency-planet-heading"
            class="font-display text-display-md font-normal text-ink-950"
          >
            One percent of revenue, not profit.
          </h2>
          <p class="max-w-[52ch] font-body text-body text-ink-700">
            One percent of every order (revenue, before margin) goes to
            vetted environmental nonprofits chosen by the studio team each
            quarter. We've been an approved 1% for the Planet member since
            2021 and publish the beneficiary list every January.
          </p>
          <dl class="grid grid-cols-2 gap-x-[30px] gap-y-6 pt-2">
            <div class="flex flex-col gap-1 border-l border-ink-200 pl-4">
              <dt class="text-eyebrow font-body uppercase text-ink-500">
                Member since
              </dt>
              <dd class="font-display text-display-sm font-normal text-ink-950">
                2021
              </dd>
            </div>
            <div class="flex flex-col gap-1 border-l border-ink-200 pl-4">
              <dt class="text-eyebrow font-body uppercase text-ink-500">
                FY24 donation
              </dt>
              <dd class="font-display text-display-sm font-normal text-ink-950">
                €38,420
              </dd>
            </div>
          </dl>
        </div>

        <div class="flex justify-center lg:justify-end">
          <div class="grid h-40 w-40 place-items-center rounded-full bg-merchery-sage ring-1 ring-ink-200">
            <span class="text-center font-display text-display-sm font-normal leading-tight text-ink-950">
              1%<br><span class="text-eyebrow font-body uppercase tracking-wide text-ink-600">For the Planet</span>
            </span>
          </div>
        </div>
      </div>
    </section>

    <!-- ============================================================
         5. Raw materials: what we use + percentages
         ============================================================ -->
    <section
      id="section-5"
      class="bg-cream-warm"
      aria-labelledby="transparency-materials-heading"
    >
      <div class="mx-auto max-w-rail px-gutter py-section">
        <div class="grid grid-cols-1 gap-x-[30px] gap-y-10 pb-12 lg:grid-cols-[minmax(0,0.4fr)_minmax(0,0.6fr)]">
          <div class="flex flex-col gap-3">
            <p class="text-eyebrow font-body uppercase text-ink-500">
              04 &middot; Raw materials
            </p>
            <h2
              id="transparency-materials-heading"
              class="font-display text-display-md font-normal text-ink-950"
            >
              The percentages behind every blank.
            </h2>
          </div>
          <p class="max-w-[52ch] font-body text-body text-ink-700">
            FY24 fibre mix across our garment catalog. Methodology and the
            full per-product breakdown live on the
            <NuxtLink
              to="/about/environmental-footprint"
              class="underline decoration-dashed underline-offset-4 decoration-ink-400 hover:text-ink-950"
            >environmental footprint page</NuxtLink>.
          </p>
        </div>

        <ul class="grid grid-cols-1 gap-x-[30px] gap-y-6">
          <li
            v-for="material in rawMaterials"
            :key="material.label"
            class="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-6 border-b border-ink-200 pb-4"
          >
            <div class="flex flex-col gap-2">
              <span class="font-display text-display-sm font-normal text-ink-950">
                {{ material.label }}
              </span>
              <div
                aria-hidden="true"
                class="h-1.5 w-full overflow-hidden bg-cream-tile"
              >
                <div
                  class="h-full bg-merchery-sage"
                  :style="{ width: `${material.percent}%` }"
                />
              </div>
            </div>
            <span class="font-display text-display-sm font-normal text-ink-950">
              {{ material.percent }}%
            </span>
          </li>
        </ul>
      </div>
    </section>

    <!-- ============================================================
         6. Transport: shipping + offsets
         ============================================================ -->
    <section
      id="section-6"
      class="bg-white"
      aria-labelledby="transparency-transport-heading"
    >
      <div class="mx-auto max-w-rail px-gutter py-section">
        <div class="flex flex-col gap-3 pb-12 lg:max-w-[440px]">
          <p class="text-eyebrow font-body uppercase text-ink-500">
            05 &middot; Transport
          </p>
          <h2
            id="transparency-transport-heading"
            class="font-display text-display-md font-normal text-ink-950"
          >
            Sea, rail, recycled mailers. Never airlift.
          </h2>
        </div>

        <div class="grid grid-cols-1 gap-x-[30px] gap-y-[30px] md:grid-cols-3">
          <article class="flex flex-col gap-5 bg-cream-tile p-10">
            <p class="text-eyebrow font-body uppercase text-ink-500">
              Bulk freight
            </p>
            <h3 class="font-display text-display-sm font-normal text-ink-950">
              Sea &amp; rail only.
            </h3>
            <p class="font-body text-body text-ink-700">
              0% of FY24 bulk movements went by air. The studio refuses
              airlift even for late deliveries, we'd rather miss a date
              than burn the offset budget.
            </p>
          </article>
          <article class="flex flex-col gap-5 bg-merchery-sage p-10">
            <!-- ink-600, not the ink-500 eyebrow default: sage ground. See tailwind.config.ts ink.500. -->
            <p class="text-eyebrow font-body uppercase text-ink-600">
              Last mile
            </p>
            <h3 class="font-display text-display-sm font-normal text-ink-950">
              DPD carbon-neutral lane.
            </h3>
            <p class="font-body text-body text-ink-700">
              All EU last-mile rides on DPD's verified carbon-neutral
              network. Outside the EU, we partner with carriers that
              publish per-shipment emissions data.
            </p>
          </article>
          <article class="flex flex-col gap-5 bg-accent-terracotta p-10">
            <p class="text-eyebrow font-body uppercase text-cream-50/70">
              Offsets
            </p>
            <h3 class="font-display text-display-sm font-normal text-cream-50">
              12,400 kg CO₂ in FY24.
            </h3>
            <p class="font-body text-body text-cream-50/90">
              Residual freight emissions are offset through verified
              Climate Neutral projects. We pay the difference, you pay
              nothing extra at checkout.
            </p>
          </article>
        </div>
      </div>
    </section>

    <!-- ============================================================
         7. Our factories: link to /about/value-chain
         ============================================================ -->
    <section
      id="section-7"
      class="bg-cream-warm"
      aria-labelledby="transparency-factories-heading"
    >
      <div class="mx-auto max-w-rail px-gutter py-section">
        <div class="grid grid-cols-1 gap-x-[30px] gap-y-10 pb-12 lg:grid-cols-[minmax(0,0.4fr)_minmax(0,0.6fr)]">
          <div class="flex flex-col gap-3">
            <p class="text-eyebrow font-body uppercase text-ink-500">
              06 &middot; Our factories
            </p>
            <h2
              id="transparency-factories-heading"
              class="font-display text-display-md font-normal text-ink-950"
            >
              Three rooms, three named partners.
            </h2>
          </div>
          <p class="max-w-[52ch] font-body text-body text-ink-700">
            Spinning, finishing and pick-pack live in three rooms across
            three cities. Visit any of them. We'll book the trip.
          </p>
        </div>

        <ol class="grid grid-cols-1 gap-x-[30px] gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          <li
            v-for="factory in factories"
            :key="factory.city"
            class="flex flex-col gap-4 border-t border-ink-200 pt-8"
          >
            <div class="flex items-baseline justify-between gap-4">
              <span class="font-display text-display-sm font-normal text-ink-950">
                <span class="underline decoration-dashed underline-offset-4 decoration-ink-400">{{ factory.city }}</span>
              </span>
              <span class="text-eyebrow font-body uppercase text-ink-500">
                {{ factory.country }}
              </span>
            </div>
            <p class="text-eyebrow font-body uppercase text-ink-500">
              <!-- eslint-disable-next-line vue/no-v-html -->
              <span v-html="factory.role" />
            </p>
            <!-- eslint-disable-next-line vue/no-v-html -->
            <p
              class="font-body text-body text-ink-700"
              v-html="factory.body"
            />
          </li>
        </ol>

        <div class="mt-12 flex flex-wrap gap-3">
          <UiButton
            variant="outline"
            size="lg"
            as="NuxtLink"
            to="/about/value-chain"
          >
            Full value chain
          </UiButton>
        </div>
      </div>
    </section>

    <!-- ============================================================
         8. CTA band: sage slab linking to the (forthcoming) report
         ============================================================ -->
    <section
      class="w-full bg-merchery-sage py-section"
      aria-labelledby="transparency-cta-heading"
    >
      <div class="mx-auto max-w-rail px-gutter">
        <div class="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_auto] lg:items-end lg:gap-16">
          <div class="max-w-[400px]">
            <!-- ink-600, not the ink-500 eyebrow default: sage ground. See tailwind.config.ts ink.500. -->
            <p class="text-eyebrow font-body uppercase text-ink-600">
              The full picture
            </p>
            <h2
              id="transparency-cta-heading"
              class="mt-3 font-display text-display-md font-normal leading-[1.05] text-ink-950"
            >
              Read our impact report.
            </h2>
            <p class="mt-4 font-body text-body text-ink-700">
              48 pages of methodology, supplier breakdowns and the things
              we still haven't fixed. Updated every January.
            </p>
          </div>

          <div class="flex flex-wrap gap-3">
            <UiButton
              variant="outline"
              size="lg"
              as="a"
              to="#report"
            >
              Download the report
            </UiButton>
            <UiButton
              variant="merchery"
              size="lg"
              as="NuxtLink"
              to="/contact"
            >
              Print sustainably
            </UiButton>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
