<script setup lang="ts">
/**
 * /studio — Our story / studio editorial.
 *
 * Sister page to /about, but framed around the rooms, the people and the
 * way work moves through them rather than the company narrative. Same
 * tile-and-band rhythm: cream-tile hero, alternating white / cream-warm
 * bands, sage CTA at the foot.
 */
defineOptions({ name: 'PageStudio' })

useHead({
  title: 'Studio — GhostMark Studio',
  meta: [
    {
      name: 'description',
      content:
        'Inside the GhostMark Studio — three small workshops, the people who run the presses, and the way a brief becomes a finished, packed and shipped object.',
    },
  ],
})

interface Step {
  number: string
  title: string
  body: string
}

interface Member {
  name: string
  role: string
  city: 'Brussels' | 'Berlin' | 'London'
}

interface Address {
  city: 'Brussels' | 'Berlin' | 'London'
  street: string
  postal: string
  hours: string
}

const steps: Step[] = [
  {
    number: '01',
    title: 'Brief',
    body:
      'A fifteen-minute call, a shared mood board, a single PDF — whatever\'s easiest for you. We translate it into a printable spec the same week.',
  },
  {
    number: '02',
    title: 'Sample',
    body:
      'One physical sample, posted to your door, with the inks, threads and substrates we\'d run in production. Approve or iterate before any volume is committed.',
  },
  {
    number: '03',
    title: 'Production',
    body:
      'Small runs printed and finished by hand in the workshop closest to your destination market. Folded, polybagged and tracked end-to-end.',
  },
]

const team: Member[] = [
  { name: 'Mira Lefevre', role: 'Founder, creative direction', city: 'Brussels' },
  { name: 'Tomás Costa', role: 'Print lead, screen + DTG', city: 'Brussels' },
  { name: 'Hannah Wexler', role: 'Studio manager', city: 'Berlin' },
  { name: 'Yusuf Demir', role: 'Embroidery + finishing', city: 'Berlin' },
  { name: 'Priya Banerjee', role: 'Production lead', city: 'London' },
  { name: 'Rowan Faulkner', role: 'Customer + dispatch', city: 'London' },
  { name: 'Esma Karim', role: 'Sustainability + sourcing', city: 'Brussels' },
  { name: 'Leo Marchetti', role: 'Bindery + paper goods', city: 'Berlin' },
]

const addresses: Address[] = [
  {
    city: 'Brussels',
    street: '14 Rue du Page',
    postal: '1050 Ixelles',
    hours: 'Mon–Fri, 09:00–18:00',
  },
  {
    city: 'Berlin',
    street: 'Manteuffelstraße 77',
    postal: '10999 Kreuzberg',
    hours: 'Mon–Fri, 10:00–18:00',
  },
  {
    city: 'London',
    street: 'Unit 4, Hackney Downs Studios',
    postal: 'E8 2BT',
    hours: 'Tue–Sat, 10:00–18:00',
  },
]
</script>

<template>
  <div class="bg-white text-ink-950">
    <!-- ============================================================
         1. Hero — 50/50 cream tile + serif left, photo right
         ============================================================ -->
    <section
      class="bg-merchery-tile"
      aria-labelledby="studio-hero-heading"
    >
      <div class="mx-auto grid max-w-[1320px] grid-cols-1 gap-x-[30px] gap-y-12 px-gutter py-section lg:grid-cols-2 lg:items-center">
        <div class="flex flex-col gap-6">
          <p class="text-eyebrow font-body uppercase text-ink-500">
            Our story
          </p>
          <h1
            id="studio-hero-heading"
            class="font-display text-display-lg font-normal text-ink-950"
          >
            One bench,<br>
            three crafts.
          </h1>
          <p class="max-w-[44ch] font-body text-body text-ink-700">
            Laser engraving, DTF print and apparel finishing &mdash; side
            by side, eight pairs of hands, one shared board. Small on
            purpose: the person who answers your email is usually the
            person who'll cut, press or thread your order.
          </p>
          <div class="flex flex-wrap gap-3 pt-2">
            <UiButton
              variant="merchery"
              size="lg"
              as="NuxtLink"
              to="/contact"
            >
              Visit the studio
            </UiButton>
            <UiButton
              variant="outline"
              size="lg"
              as="NuxtLink"
              to="/about"
            >
              About the company
            </UiButton>
          </div>
        </div>

        <div class="aspect-[4/5] w-full overflow-hidden bg-cream-tile">
          <div class="flex h-full w-full items-center justify-center">
            <span
              class="font-body text-caption text-ink-400"
              aria-label="Image placeholder"
            >Image &mdash; the print room at golden hour</span>
          </div>
        </div>
      </div>
    </section>

    <!-- ============================================================
         2. How we work — 3-up cream tile band: Brief / Sample / Production
         ============================================================ -->
    <section
      class="bg-cream-warm"
      aria-labelledby="studio-process-heading"
    >
      <div class="mx-auto max-w-[1320px] px-gutter py-section">
        <div class="flex flex-col gap-3 pb-12 lg:max-w-[44rem]">
          <p class="text-eyebrow font-body uppercase text-ink-500">
            How we work
          </p>
          <h2
            id="studio-process-heading"
            class="font-display text-display-md font-normal text-ink-950"
          >
            Brief, sample, production.
          </h2>
          <p class="max-w-[52ch] font-body text-body text-ink-700">
            Three steps, no surprises. We name the inks, the threads and
            the substrates up front, send a physical sample before any
            volume is committed, and finish every piece in the workshop
            closest to where it's heading.
          </p>
        </div>

        <ol class="grid grid-cols-1 gap-x-[30px] gap-y-12 md:grid-cols-3">
          <li
            v-for="step in steps"
            :key="step.number"
            class="flex flex-col gap-4 bg-cream-tile p-10"
          >
            <span class="font-body text-caption uppercase tracking-[0.04em] text-ink-500">
              {{ step.number }}
            </span>
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
         3. The team — placeholder portraits, 4-up grid
         ============================================================ -->
    <section
      class="bg-white"
      aria-labelledby="studio-team-heading"
    >
      <div class="mx-auto max-w-[1320px] px-gutter py-section">
        <div class="flex flex-col gap-3 pb-12 lg:max-w-[44rem]">
          <p class="text-eyebrow font-body uppercase text-ink-500">
            The team
          </p>
          <h2
            id="studio-team-heading"
            class="font-display text-display-md font-normal text-ink-950"
          >
            Eight people, three rooms.
          </h2>
        </div>

        <ul class="grid grid-cols-2 gap-x-[30px] gap-y-12 md:grid-cols-3 lg:grid-cols-4">
          <li
            v-for="member in team"
            :key="member.name"
            class="flex flex-col gap-3"
          >
            <div class="aspect-[4/5] w-full overflow-hidden bg-cream-tile">
              <div class="flex h-full w-full items-center justify-center">
                <span
                  class="font-body text-caption text-ink-400"
                  aria-label="Portrait placeholder"
                >Portrait</span>
              </div>
            </div>
            <div class="flex flex-col gap-1">
              <span class="font-display text-display-sm font-normal leading-tight text-ink-950">
                {{ member.name }}
              </span>
              <span class="font-body text-caption text-ink-500">
                {{ member.role }} · {{ member.city }}
              </span>
            </div>
          </li>
        </ul>
      </div>
    </section>

    <!-- ============================================================
         4. Visit us — dashed-underline addresses for 3 cities
         ============================================================ -->
    <section
      class="bg-cream-tile"
      aria-labelledby="studio-visit-heading"
    >
      <div class="mx-auto max-w-[1320px] px-gutter py-section">
        <div class="flex flex-col gap-3 pb-12 lg:max-w-[44rem]">
          <p class="text-eyebrow font-body uppercase text-ink-500">
            Visit us
          </p>
          <h2
            id="studio-visit-heading"
            class="font-display text-display-md font-normal text-ink-950"
          >
            Drop in, we'll put the kettle on.
          </h2>
          <p class="font-body text-body text-ink-700">
            All three workshops are open to clients by appointment. Email
            <a
              href="mailto:hello@ghostmark.studio"
              class="underline decoration-dashed decoration-ink-400 underline-offset-4 transition-colors duration-base ease-emphasis hover:decoration-ink-950"
            >hello@ghostmark.studio</a> a couple of days ahead and we'll
            block the room.
          </p>
        </div>

        <ul class="grid grid-cols-1 gap-x-[30px] gap-y-10 md:grid-cols-3">
          <li
            v-for="addr in addresses"
            :key="addr.city"
            class="flex flex-col gap-3"
          >
            <h3 class="font-display text-display-sm font-normal text-ink-950">
              {{ addr.city }}
            </h3>
            <address class="not-italic font-body text-body text-ink-700">
              <a
                :href="`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${addr.street}, ${addr.postal}, ${addr.city}`)}`"
                target="_blank"
                rel="noopener"
                class="underline decoration-dashed decoration-ink-400 underline-offset-4 transition-colors duration-base ease-emphasis hover:decoration-ink-950"
              >
                {{ addr.street }}<br>
                {{ addr.postal }}
              </a>
            </address>
            <p class="font-body text-caption text-ink-500">
              {{ addr.hours }}
            </p>
          </li>
        </ul>
      </div>
    </section>

    <!-- ============================================================
         5. CTA band — sage slab linking to /contact
         ============================================================ -->
    <section
      class="w-full bg-merchery-sage py-section"
      aria-labelledby="studio-cta-heading"
    >
      <div class="mx-auto max-w-[1320px] px-gutter">
        <div class="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_auto] lg:items-end lg:gap-16">
          <div class="max-w-[40rem]">
            <h2
              id="studio-cta-heading"
              class="font-display font-normal leading-[1.05] tracking-[-0.015em] text-ink-950"
              style="font-size: clamp(2rem, 1.4rem + 2vw, 3rem)"
            >
              Want to come and see how we make things?
            </h2>
            <p class="mt-4 font-body text-body text-ink-700">
              Studio tours run on Thursdays at our Brussels and Berlin
              workshops. Bring a friend, bring a brief, bring nothing — we'll
              still put the espresso machine on.
            </p>
          </div>

          <div class="flex flex-wrap gap-3">
            <UiButton
              variant="merchery"
              size="lg"
              as="NuxtLink"
              to="/contact"
            >
              Book a visit
            </UiButton>
            <UiButton
              variant="outline"
              size="lg"
              as="NuxtLink"
              to="/sustainability"
            >
              How we make it
            </UiButton>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
