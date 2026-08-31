<script setup lang="ts">
/**
 * About / People and culture: sub-page of /about that introduces the
 * studio team, the working culture (remote-first, four-day week, open
 * salaries) and the current open roles.
 *
 * Composition mirrors the merchery.co audit-about reference:
 *   1. Cream-tile hero with the headline + a short intro
 *   2. A 4-up portrait grid (placeholder cream tiles, 4:5)
 *   3. A 3-up "Working at GhostMark" benefits row
 *   4. A list of open roles with location + employment type
 *   5. A sage CTA band linking back to the open-roles list
 *
 * Every surface is tokenised through the editorial palette, no
 * `bg-[#hex]` literals.
 */
defineOptions({ name: 'PageAboutPeopleAndCulture' })

useHead({
  title: 'People and culture · GhostMark Studio',
  meta: [
    {
      name: 'description',
      content:
        'The GhostMark Studio team, how we work (remote-first, four-day week, open salaries), and the roles we\'re currently hiring for.',
    },
  ],
})

interface TeamMember {
  name: string
  role: string
}

interface Benefit {
  eyebrow: string
  title: string
  body: string
  caption: string
}

interface Role {
  title: string
  location: string
  type: 'Full-time' | 'Part-time' | 'Contract'
}

const team: TeamMember[] = [
  { name: 'Marie Devos', role: 'Studio director' },
  { name: 'Anya Petersen', role: 'Head of design' },
  { name: 'Liam O\'Connor', role: 'Production lead' },
  { name: 'Sasha Kowalska', role: 'Sustainability lead' },
]

const benefits: Benefit[] = [
  {
    eyebrow: 'Where',
    title: 'Remote-first.',
    body:
      'Work from anywhere in CET ±2. The Brussels studio is open if you want a desk; nobody needs one to be in the room.',
    caption: 'Co-working stipend included.',
  },
  {
    eyebrow: 'When',
    title: 'Four-day week.',
    body:
      'Mon–Thu, full pay, no compressed hours. We\'ve run it since 2022 and our delivery times haven\'t slipped a day.',
    caption: 'Friday-off, no exceptions.',
  },
  {
    eyebrow: 'How much',
    title: 'Open salaries.',
    body:
      'Every role has a published band. Every band is reviewed annually against the Brussels and Berlin median. No negotiation theatre.',
    caption: 'Bands published on the roles page.',
  },
]

const roles: Role[] = [
  {
    title: 'Senior production designer',
    location: 'Brussels or remote (CET ±2)',
    type: 'Full-time',
  },
  {
    title: 'Sustainability analyst',
    location: 'Remote (EU)',
    type: 'Full-time',
  },
  {
    title: 'Studio internship, Spring 2026',
    location: 'Brussels',
    type: 'Part-time',
  },
  {
    title: 'Customer success specialist',
    location: 'Remote (EU)',
    type: 'Full-time',
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
      aria-labelledby="people-hero-heading"
    >
      <div class="mx-auto grid max-w-rail grid-cols-1 gap-x-[30px] gap-y-12 px-gutter py-section lg:grid-cols-2 lg:items-center">
        <div class="flex flex-col gap-6">
          <p class="text-eyebrow font-body uppercase text-ink-500">
            About / People and culture
          </p>
          <h1
            id="people-hero-heading"
            class="font-display text-display-lg font-normal text-ink-950"
          >
            People and culture
          </h1>
          <p class="max-w-[44ch] font-body text-body text-ink-700">
            We're a small studio that picks small problems carefully. The
            twenty of us spread across nine cities work the same four days,
            on the same published salaries, on the same handful of clients
            we'd happily name in print.
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
            >Image: replace with team photography</span>
          </div>
        </div>
      </div>
    </section>

    <!-- ============================================================
         2. Our team: 4-up portrait grid (placeholder cream tiles)
         ============================================================ -->
    <section
      class="bg-white"
      aria-labelledby="people-team-heading"
    >
      <div class="mx-auto max-w-rail px-gutter py-section">
        <div class="flex flex-col gap-3 pb-12 lg:max-w-[440px]">
          <p class="text-eyebrow font-body uppercase text-ink-500">
            Our team
          </p>
          <h2
            id="people-team-heading"
            class="font-display text-display-md font-normal text-ink-950"
          >
            Twenty people, eleven nationalities.
          </h2>
        </div>

        <ul class="grid grid-cols-1 gap-x-[30px] gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
          <li
            v-for="member in team"
            :key="member.name"
            class="flex flex-col gap-4"
          >
            <div class="aspect-[4/5] w-full overflow-hidden bg-cream-tile">
              <div class="flex h-full w-full items-center justify-center">
                <span
                  class="font-body text-caption text-ink-600"
                  role="img"
                  aria-label="Portrait placeholder"
                >Portrait: placeholder</span>
              </div>
            </div>
            <div class="flex flex-col gap-1">
              <h3 class="font-display text-display-sm font-normal text-ink-950">
                {{ member.name }}
              </h3>
              <p class="font-body text-caption uppercase tracking-wide text-ink-500">
                {{ member.role }}
              </p>
            </div>
          </li>
        </ul>
      </div>
    </section>

    <!-- ============================================================
         3. Working at GhostMark: 3-up benefits cards on cream-warm
         ============================================================ -->
    <section
      class="bg-cream-warm"
      aria-labelledby="people-benefits-heading"
    >
      <div class="mx-auto max-w-rail px-gutter py-section">
        <div class="flex flex-col gap-3 pb-12 lg:max-w-[440px]">
          <p class="text-eyebrow font-body uppercase text-ink-500">
            Working at GhostMark
          </p>
          <h2
            id="people-benefits-heading"
            class="font-display text-display-md font-normal text-ink-950"
          >
            Three things we got right early.
          </h2>
        </div>

        <div class="grid grid-cols-1 gap-x-[30px] gap-y-[30px] md:grid-cols-3">
          <article
            v-for="benefit in benefits"
            :key="benefit.title"
            class="flex flex-col gap-5 bg-white p-10"
          >
            <p class="text-eyebrow font-body uppercase text-ink-500">
              {{ benefit.eyebrow }}
            </p>
            <h3 class="font-display text-display-sm font-normal text-ink-950">
              {{ benefit.title }}
            </h3>
            <p class="font-body text-body text-ink-700">
              {{ benefit.body }}
            </p>
            <p class="mt-auto font-body text-caption text-ink-500">
              {{ benefit.caption }}
            </p>
          </article>
        </div>
      </div>
    </section>

    <!-- ============================================================
         4. Open roles: list with location + type
         ============================================================ -->
    <section
      class="bg-white"
      aria-labelledby="people-roles-heading"
    >
      <div class="mx-auto max-w-rail px-gutter py-section">
        <div class="flex flex-col gap-3 pb-12 lg:max-w-[440px]">
          <p class="text-eyebrow font-body uppercase text-ink-500">
            Open roles
          </p>
          <h2
            id="people-roles-heading"
            class="font-display text-display-md font-normal text-ink-950"
          >
            We're hiring four roles right now.
          </h2>
        </div>

        <ul class="divide-y divide-ink-200 border-y border-ink-200">
          <li
            v-for="role in roles"
            :key="role.title"
          >
            <a
              href="#apply"
              class="group grid grid-cols-1 items-baseline gap-x-[30px] gap-y-2 py-8 transition-[background,color] duration-fast ease-emphasis hover:bg-cream-50 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.4fr)_auto] sm:py-10"
            >
              <span class="font-display text-display-sm font-normal text-ink-950 group-hover:underline group-hover:decoration-dashed group-hover:underline-offset-4 group-hover:decoration-ink-400">
                {{ role.title }}
              </span>
              <span class="font-body text-body text-ink-700">
                {{ role.location }}
              </span>
              <span class="text-eyebrow font-body uppercase text-ink-500">
                {{ role.type }}
              </span>
              <span
                aria-hidden="true"
                class="hidden text-ink-500 transition-transform duration-fast ease-emphasis group-hover:translate-x-1 sm:inline-flex"
              >
                <svg
                  class="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.4"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </span>
            </a>
          </li>
        </ul>
      </div>
    </section>

    <!-- ============================================================
         5. CTA band: sage slab linking to the roles list
         ============================================================ -->
    <section
      class="w-full bg-merchery-sage py-section"
      aria-labelledby="people-cta-heading"
    >
      <div class="mx-auto max-w-rail px-gutter">
        <div class="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_auto] lg:items-end lg:gap-16">
          <div class="max-w-[400px]">
            <!-- ink-600, not the ink-500 eyebrow default: sage ground. See tailwind.config.ts ink.500. -->
            <p class="text-eyebrow font-body uppercase text-ink-600">
              Join us
            </p>
            <h2
              id="people-cta-heading"
              class="mt-3 font-display text-display-md font-normal leading-[1.05] text-ink-950"
            >
              Want to join us?
            </h2>
            <p class="mt-4 font-body text-body text-ink-700">
              We're always interested in meeting people who care about the
              craft, the planet and the four-day week, even when no role
              is open.
            </p>
          </div>

          <div class="flex flex-wrap gap-3">
            <UiButton
              variant="outline"
              size="lg"
              as="a"
              to="#apply"
            >
              See open roles
            </UiButton>
            <UiButton
              variant="merchery"
              size="lg"
              as="NuxtLink"
              to="/contact"
            >
              Say hello
            </UiButton>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
