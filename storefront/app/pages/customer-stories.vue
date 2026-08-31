<script setup lang="ts">
/**
 * /customer-stories: editorial case-studies index.
 *
 * Mirrors merchery's content-page rhythm: cream backgrounds, full-bleed
 * imagery placeholders (4:5 portrait), Fraunces display headlines, dashed
 * underline link affordances, sage CTA band at the foot.
 *
 * Stories are inline stubs, when CMS wiring lands, swap `stories` for the
 * fetched dataset; the template loop can stay as-is.
 */

useHead({
  title: 'Customer stories · GhostMark Studio',
  meta: [
    {
      name: 'description',
      content:
        'Editorial case studies from brands we partner with: coffee roasters, running clubs, conference organizers and design studios using GhostMark for sustainable, on-demand merchandise.',
    },
  ],
})

interface Story {
  slug: string
  brand: string
  sector: string
  title: string
  excerpt: string
  /**
   * Tone seed for the placeholder swatch, purely decorative, used to vary
   * the gradient cards so the grid does not read as a single visual block.
   */
  tone: 'sage' | 'terracotta' | 'cream' | 'ink'
}

const featured: Story = {
  slug: 'berlin-coffee-roaster',
  brand: 'Drift Roasters',
  sector: 'F&B',
  title: 'How a Berlin coffee roaster scaled merch without inventory',
  excerpt:
    'Drift was sitting on three pallets of unsold tote bags when we started. Eighteen months later, every piece of merch ships within 72 hours of a customer click, and they have not held a single unit of stock.',
  tone: 'terracotta',
}

const stories: Story[] = [
  {
    slug: 'london-running-club',
    brand: 'East London Runners',
    sector: 'Sport',
    title: '100% recycled hoodies for a London running club',
    excerpt:
      'A community of 600 runners. One drop a season. Zero virgin polyester anywhere in the supply chain.',
    tone: 'sage',
  },
  {
    slug: 'tech-conference',
    brand: 'Signal Summit',
    sector: 'Tech',
    title: "Conference swag that doesn't end up in landfill",
    excerpt:
      'On-demand printing replaced the bin-bound goodie bag: attendees pick what they actually want, before they fly home.',
    tone: 'ink',
  },
  {
    slug: 'lisbon-design-studio',
    brand: 'Estúdio Margem',
    sector: 'Agency',
    title: 'From idea to door in 7 days for a Lisbon design studio',
    excerpt:
      'A new identity launched on a Tuesday. Branded merch landed at the press preview the following Monday.',
    tone: 'cream',
  },
  {
    slug: 'climate-ngo-campaign',
    brand: 'Atlas Foundation',
    sector: 'NGO',
    title: 'On-demand print solved our 100k-piece campaign waste',
    excerpt:
      'A national awareness drive moved from forecast-and-overprint to print-only-on-RSVP. Waste fell by 78% versus the prior year.',
    tone: 'sage',
  },
  {
    slug: 'partner-studio',
    brand: 'Hollow & Co.',
    sector: 'Studio',
    title: 'Why our designers love working with GhostMark',
    excerpt:
      'A long-form conversation with the agency partners we ship for, on file specs, color fidelity and the value of an editorial brief.',
    tone: 'terracotta',
  },
  {
    slug: 'remote-onboarding',
    brand: 'Halftone Labs',
    sector: 'SaaS',
    title: 'Onboarding kits for a fully remote engineering team',
    excerpt:
      'Forty-three engineers across nineteen countries. One curated welcome kit, dispatched the day a contract is signed.',
    tone: 'cream',
  },
]

const tonePlaceholderClass: Record<Story['tone'], string> = {
  sage: 'bg-gradient-to-br from-sage-100 via-cream-tile to-sage-50',
  terracotta: 'bg-gradient-to-br from-cream-200 via-cream-tile to-cream-100',
  cream: 'bg-gradient-to-br from-cream-100 via-cream-tile to-cream-200',
  ink: 'bg-gradient-to-br from-ink-100 via-cream-tile to-ink-50',
}

const trustedBy: string[] = [
  'Drift Roasters',
  'Signal Summit',
  'East London Runners',
  'Atlas Foundation',
  'Estúdio Margem',
  'Halftone Labs',
  'Hollow & Co.',
  'Northbound Press',
]
</script>

<template>
  <div>
    <!-- Hero: eyebrow, serif, body intro. -->
    <section
      class="bg-cream-warm text-ink-950"
      aria-labelledby="cs-hero"
    >
      <div class="mx-auto max-w-rail px-gutter py-section">
        <div class="grid items-end gap-12 lg:grid-cols-[0.55fr_0.45fr]">
          <div>
            <p class="text-eyebrow font-body uppercase text-ink-500">
              Inspiration
            </p>
            <h1
              id="cs-hero"
              class="mt-4 font-display text-display-lg font-normal leading-[1] tracking-[-0.02em] text-ink-950"
            >
              Stories from our studio
            </h1>
          </div>
          <p
            class="max-w-[55ch] font-body text-body text-ink-700 lg:pb-3"
          >
            Long-form conversations with the brands we ship for, coffee
            roasters, running clubs, conference organizers, agencies and
            climate NGOs. The product changes; the editorial standard
            doesn't.
          </p>
        </div>
      </div>
    </section>

    <!-- Featured story: image left, content right. -->
    <section
      class="bg-cream-50 text-ink-950"
      aria-labelledby="cs-featured"
    >
      <div class="mx-auto max-w-rail px-gutter py-section">
        <p class="text-eyebrow font-body uppercase text-ink-500">
          Featured
        </p>
        <div
          class="mt-6 grid gap-x-[30px] gap-y-12 lg:grid-cols-2 lg:items-center"
        >
          <NuxtLink
            :to="`/customer-stories/${featured.slug}`"
            class="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900 focus-visible:ring-offset-2 focus-visible:ring-offset-cream-50"
          >
            <div
              :class="[
                'aspect-[4/5] w-full overflow-hidden',
                tonePlaceholderClass[featured.tone],
              ]"
              role="img"
              :aria-label="`Cover image for ${featured.title}`"
            >
              <div
                class="flex h-full w-full items-center justify-center"
              >
                <span
                  class="font-display text-[64px] font-normal leading-none tracking-[-0.04em] text-ink-300/80"
                  aria-hidden="true"
                >
                  {{ featured.brand.charAt(0) }}
                </span>
              </div>
            </div>
          </NuxtLink>

          <div class="flex flex-col gap-5">
            <p
              class="text-eyebrow font-body uppercase text-ink-500"
            >
              {{ featured.brand }} &middot; {{ featured.sector }}
            </p>
            <h2
              id="cs-featured"
              class="font-display text-display-md font-normal leading-[1.05] tracking-[-0.015em] text-ink-950"
            >
              &ldquo;{{ featured.title }}&rdquo;
            </h2>
            <p class="max-w-[60ch] font-body text-body text-ink-700">
              {{ featured.excerpt }}
            </p>
            <div>
              <NuxtLink
                :to="`/customer-stories/${featured.slug}`"
                class="inline-flex items-center gap-2 font-body text-caption text-ink-950 underline decoration-dashed decoration-ink-400 underline-offset-4 transition-colors duration-base hover:decoration-ink-950 motion-reduce:transition-none"
              >
                Read the story
                <span aria-hidden="true">&rarr;</span>
              </NuxtLink>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Story grid: 3-up cards. -->
    <section
      class="bg-cream-warm text-ink-950"
      aria-labelledby="cs-grid"
    >
      <div class="mx-auto max-w-rail px-gutter py-section">
        <div class="flex flex-col gap-3">
          <p class="text-eyebrow font-body uppercase text-ink-500">
            All stories
          </p>
          <h2
            id="cs-grid"
            class="font-display text-display-sm font-normal text-ink-950"
          >
            More from the studio
          </h2>
        </div>

        <ul
          class="mt-12 grid grid-cols-1 gap-x-[30px] gap-y-16 md:grid-cols-2 lg:grid-cols-3"
        >
          <li v-for="story in stories" :key="story.slug">
            <NuxtLink
              :to="`/customer-stories/${story.slug}`"
              class="group flex h-full flex-col gap-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900 focus-visible:ring-offset-2 focus-visible:ring-offset-cream-warm"
            >
              <div
                :class="[
                  'aspect-[4/5] w-full overflow-hidden',
                  tonePlaceholderClass[story.tone],
                ]"
                role="img"
                :aria-label="`Cover image for ${story.title}`"
              >
                <div
                  class="flex h-full w-full items-center justify-center transition-transform duration-slow ease-emphasis group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                >
                  <span
                    class="font-display text-[56px] font-normal leading-none tracking-[-0.04em] text-ink-300/80"
                    aria-hidden="true"
                  >
                    {{ story.brand.charAt(0) }}
                  </span>
                </div>
              </div>

              <div class="flex flex-col gap-3">
                <p
                  class="text-eyebrow font-body uppercase text-ink-500"
                >
                  {{ story.brand }} &middot; {{ story.sector }}
                </p>
                <h3
                  class="font-display text-[24px] font-normal leading-[1.15] tracking-[-0.01em] text-ink-950"
                >
                  {{ story.title }}
                </h3>
                <p class="font-body text-caption text-ink-700">
                  {{ story.excerpt }}
                </p>
                <span
                  aria-hidden="true"
                  class="mt-2 inline-flex items-center gap-2 font-body text-caption text-ink-950 underline decoration-dashed decoration-ink-400 underline-offset-4 transition-colors duration-base group-hover:decoration-ink-950 motion-reduce:transition-none"
                >
                  Read the story
                  <span>&rarr;</span>
                </span>
              </div>
            </NuxtLink>
          </li>
        </ul>
      </div>
    </section>

    <!-- Brand strip: grayscale text wordmarks. -->
    <section
      class="bg-cream-50 text-ink-950"
      aria-labelledby="cs-trust"
    >
      <div class="mx-auto max-w-rail px-gutter py-section">
        <div class="flex flex-col items-center gap-10">
          <p
            id="cs-trust"
            class="text-eyebrow font-body uppercase text-ink-500"
          >
            Trusted by
          </p>
          <ul
            class="flex flex-wrap items-center justify-center gap-x-12 gap-y-6"
          >
            <li
              v-for="brand in trustedBy"
              :key="brand"
              class="font-display text-[20px] font-normal leading-none tracking-[-0.005em] text-ink-500 transition-colors duration-base hover:text-ink-950 motion-reduce:transition-none"
            >
              {{ brand }}
            </li>
          </ul>
        </div>
      </div>
    </section>

    <!-- Sage CTA band: tell your story. -->
    <section
      class="bg-merchery-sage text-ink-950"
      aria-labelledby="cs-cta"
    >
      <div class="mx-auto max-w-rail px-gutter py-section">
        <div
          class="flex flex-col items-start gap-8 lg:flex-row lg:items-center lg:justify-between"
        >
          <div class="max-w-[680px]">
            <p class="text-eyebrow font-body uppercase text-ink-700">
              Your turn
            </p>
            <h2
              id="cs-cta"
              class="mt-3 font-display text-display-md font-normal leading-[1.05] tracking-[-0.015em] text-ink-950"
            >
              Tell your story with us.
            </h2>
            <p class="mt-4 font-body text-body text-ink-700">
              We work with a small number of brands at a time. If you make
              something you are proud of, we would love to hear about it.
            </p>
          </div>
          <UiButton
            as="NuxtLink"
            to="/contact"
            variant="merchery"
            size="lg"
            shape="square"
          >
            Start a conversation
          </UiButton>
        </div>
      </div>
    </section>
  </div>
</template>
