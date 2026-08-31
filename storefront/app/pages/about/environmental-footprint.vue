<script setup lang="ts">
/**
 * About / Environmental footprint: sub-page of /about that drills into the
 * concrete numbers and roadmap behind GhostMark Studio's sustainability
 * posture.
 *
 * Composition mirrors the merchery.co audit-about reference: cream-tile
 * hero, an editorial four-tile metrics dl, three "where we're at" supply
 * cards, a 2025/2026/2027 roadmap timeline, and a sage CTA band that
 * deep-links to the (forthcoming) full impact report PDF.
 *
 * Every surface is tokenised through the editorial palette
 * (`bg-cream-tile`, `bg-cream-warm`, `bg-merchery-sage`, `bg-accent-*`):
 * no `bg-[#hex]` literals, so a future re-skin can run through the
 * tailwind config alone.
 */
defineOptions({ name: 'PageAboutEnvironmentalFootprint' })

useHead({
  title: 'Environmental footprint · GhostMark Studio',
  meta: [
    {
      name: 'description',
      content:
        'Our measured environmental footprint: CO₂ offset, water saved, renewable energy share and recycled-material percentages. Plus the materials, factories and freight choices behind every order.',
    },
  ],
})

interface Metric {
  value: string
  unit: string
  label: string
  caption: string
}

interface Pillar {
  eyebrow: string
  title: string
  body: string
  caption: string
}

interface RoadmapEntry {
  year: string
  title: string
  body: string
  status: 'shipped' | 'in-flight' | 'planned'
}

const metrics: Metric[] = [
  {
    value: '12,400',
    unit: 'kg',
    label: 'CO₂ offset',
    caption: 'Verified by Climate Neutral, FY24 figures.',
  },
  {
    value: '3.2',
    unit: 'M L',
    label: 'Water saved',
    caption: 'Vs. conventional cotton baseline (Textile Exchange).',
  },
  {
    value: '100',
    unit: '%',
    label: 'Renewable energy',
    caption: 'Workshops on certified green tariffs since 2022.',
  },
  {
    value: '78',
    unit: '%',
    label: 'Recycled materials',
    caption: 'Across all packaging and selected garments.',
  },
]

const pillars: Pillar[] = [
  {
    eyebrow: 'Materials',
    title: 'Organic, recycled, traceable.',
    body:
      'GOTS-certified cotton, recycled polyester for technical layers, FSC paper for everything printed. We publish the mill, country and certifying body for every fibre we stock.',
    caption: 'Spec sheet refreshed quarterly.',
  },
  {
    eyebrow: 'Manufacturing',
    title: 'Small batches, near-shore.',
    body:
      'Production runs of 25–500 units, made within a two-day truck radius of our Brussels studio. No overstock burn, no air freight from the factory floor.',
    caption: 'Average run size, 2024: 142 units.',
  },
  {
    eyebrow: 'Logistics',
    title: 'Sea, rail, recycled mailers.',
    body:
      'Bulk freight moves by sea or rail; last-mile rides on DPD\'s carbon-neutral lane. Packaging is 100% post-consumer recycled with paper tape.',
    caption: 'Air freight share: 0% in FY24.',
  },
]

const roadmap: RoadmapEntry[] = [
  {
    year: '2025',
    title: 'Scope 3 disclosure published.',
    body:
      'Full upstream emissions audit (every blank, ink and freight leg) published as an open dataset alongside the impact report.',
    status: 'in-flight',
  },
  {
    year: '2026',
    title: 'Closed-loop garment take-back.',
    body:
      'Free return-and-recycle on every GhostMark-printed piece. Worn-out garments are shredded into insulation by our Porto partner.',
    status: 'planned',
  },
  {
    year: '2027',
    title: 'Net-zero operations.',
    body:
      'Workshops, freight and last-mile combined hit verified net-zero. Offsets only cover residual emissions after a measured 65% reduction.',
    status: 'planned',
  },
]
</script>

<template>
  <div class="bg-white text-ink-950">
    <!-- ============================================================
         1. Hero: cream tile + serif headline + body intro
         ============================================================ -->
    <section
      class="bg-cream-tile"
      aria-labelledby="footprint-hero-heading"
    >
      <div class="mx-auto grid max-w-rail grid-cols-1 gap-x-[30px] gap-y-12 px-gutter py-section lg:grid-cols-2 lg:items-center">
        <div class="flex flex-col gap-6">
          <p class="text-eyebrow font-body uppercase text-ink-500">
            About / Environmental footprint
          </p>
          <h1
            id="footprint-hero-heading"
            class="font-display text-display-lg font-normal text-ink-950"
          >
            Our environmental footprint
          </h1>
          <p class="max-w-[44ch] font-body text-body text-ink-700">
            We measure what we make. Every kilo of cotton, every truck mile,
            every kilowatt of studio electricity is accounted for, audited,
            and published. The numbers below are the FY24 figures; the
            roadmap is what we're working on next.
          </p>
        </div>

        <div class="aspect-[4/5] w-full overflow-hidden bg-cream-warm">
          <div class="flex h-full w-full items-center justify-center">
            <!--
              ink-600, not ink-400. These placeholder captions are real rendered text
              and answer to the 4.5:1 floor like any other: ink-400 measured 2.89:1 on
              cream-warm and 3.33:1 on cream-tile. ink-600 is 6.06 / 6.98. ink-500
              also passes but by 0.05 on cream-warm, which is no margin at all.

              `role="img"` is not decoration either: `aria-label` on a bare <span>
              (role=generic) is non-conforming and unreliably exposed, so the label
              was a coin flip. role="img" gives it an element that can carry a name.
            -->
            <span
              class="font-body text-caption text-ink-600"
              role="img"
              aria-label="Image placeholder"
            >Image: replace with real photography</span>
          </div>
        </div>
      </div>
    </section>

    <!-- ============================================================
         2. Numbers: 4 metric tiles (CO₂, water, renewable, recycled)
         ============================================================ -->
    <section
      class="bg-white"
      aria-labelledby="footprint-numbers-heading"
    >
      <div class="mx-auto max-w-rail px-gutter py-section">
        <div class="flex flex-col gap-3 pb-12 lg:max-w-[440px]">
          <p class="text-eyebrow font-body uppercase text-ink-500">
            By the numbers
          </p>
          <h2
            id="footprint-numbers-heading"
            class="font-display text-display-md font-normal text-ink-950"
          >
            Measured, audited, published.
          </h2>
        </div>

        <dl class="grid grid-cols-1 gap-x-[30px] gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
          <div
            v-for="metric in metrics"
            :key="metric.label"
            class="flex flex-col gap-3 bg-cream-warm p-8"
          >
            <dt class="text-eyebrow font-body uppercase text-ink-500">
              {{ metric.label }}
            </dt>
            <dd class="flex items-baseline gap-1 font-display text-display-md font-normal leading-none text-ink-950">
              <span>{{ metric.value }}</span>
              <span class="font-body text-body font-normal text-ink-500">{{ metric.unit }}</span>
            </dd>
            <p class="font-body text-caption text-ink-500">
              {{ metric.caption }}
            </p>
          </div>
        </dl>
      </div>
    </section>

    <!-- ============================================================
         3. Where we're at: 3-up pillar cards on cream-warm band
         ============================================================ -->
    <section
      class="bg-cream-warm"
      aria-labelledby="footprint-pillars-heading"
    >
      <div class="mx-auto max-w-rail px-gutter py-section">
        <div class="grid grid-cols-1 gap-x-[30px] gap-y-10 pb-16 lg:grid-cols-[minmax(0,0.4fr)_minmax(0,0.6fr)]">
          <div class="flex flex-col gap-3">
            <p class="text-eyebrow font-body uppercase text-ink-500">
              Where we're at
            </p>
            <h2
              id="footprint-pillars-heading"
              class="font-display text-display-md font-normal text-ink-950"
            >
              The three places we move the needle.
            </h2>
          </div>
          <p class="max-w-[52ch] font-body text-body text-ink-700">
            Materials, manufacturing, logistics. Most footprint reductions
            in our category come from one of those three places. Here's
            where we are on each, and what the next twelve months look like.
          </p>
        </div>

        <div class="grid grid-cols-1 gap-x-[30px] gap-y-[30px] md:grid-cols-3">
          <article
            v-for="pillar in pillars"
            :key="pillar.title"
            class="flex flex-col gap-5 bg-white p-10"
          >
            <p class="text-eyebrow font-body uppercase text-ink-500">
              {{ pillar.eyebrow }}
            </p>
            <h3 class="font-display text-display-sm font-normal text-ink-950">
              {{ pillar.title }}
            </h3>
            <p class="font-body text-body text-ink-700">
              {{ pillar.body }}
            </p>
            <p class="mt-auto font-body text-caption text-ink-500">
              {{ pillar.caption }}
            </p>
          </article>
        </div>
      </div>
    </section>

    <!-- ============================================================
         4. Where we're going: roadmap timeline (2025/2026/2027)
         ============================================================ -->
    <section
      class="bg-white"
      aria-labelledby="footprint-roadmap-heading"
    >
      <div class="mx-auto max-w-rail px-gutter py-section">
        <div class="flex flex-col gap-3 pb-12 lg:max-w-[440px]">
          <p class="text-eyebrow font-body uppercase text-ink-500">
            Where we're going
          </p>
          <h2
            id="footprint-roadmap-heading"
            class="font-display text-display-md font-normal text-ink-950"
          >
            Three commitments, dated.
          </h2>
        </div>

        <ol class="grid grid-cols-1 gap-x-[30px] gap-y-12 md:grid-cols-3">
          <li
            v-for="entry in roadmap"
            :key="entry.year"
            class="flex flex-col gap-5 border-t border-ink-200 pt-8"
          >
            <div class="flex items-baseline justify-between gap-4">
              <span class="font-display text-display-md font-normal text-ink-950">
                {{ entry.year }}
              </span>
              <span
                class="text-eyebrow font-body uppercase text-ink-500"
                :class="{ 'text-accent-terracotta': entry.status === 'in-flight' }"
              >
                {{ entry.status === 'in-flight' ? 'In flight' : entry.status === 'shipped' ? 'Shipped' : 'Planned' }}
              </span>
            </div>
            <h3 class="font-display text-display-sm font-normal text-ink-950">
              {{ entry.title }}
            </h3>
            <p class="font-body text-body text-ink-700">
              {{ entry.body }}
            </p>
          </li>
        </ol>
      </div>
    </section>

    <!-- ============================================================
         5. CTA band: sage slab linking to the (forthcoming) report
         ============================================================ -->
    <section
      class="w-full bg-merchery-sage py-section"
      aria-labelledby="footprint-cta-heading"
    >
      <div class="mx-auto max-w-rail px-gutter">
        <div class="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_auto] lg:items-end lg:gap-16">
          <div class="max-w-[400px]">
            <!-- ink-600, not the ink-500 eyebrow default: sage ground. See tailwind.config.ts ink.500. -->
            <p class="text-eyebrow font-body uppercase text-ink-600">
              The full picture
            </p>
            <h2
              id="footprint-cta-heading"
              class="mt-3 font-display text-display-md font-normal leading-[1.05] text-ink-950"
            >
              Read our full sustainability report.
            </h2>
            <p class="mt-4 font-body text-body text-ink-700">
              48 pages of methodology, supplier breakdowns, scope-3
              calculations and the things we still haven't fixed. Updated
              every January.
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
              to="/sustainability"
            >
              Back to sustainability
            </UiButton>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
