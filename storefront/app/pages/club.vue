<script setup lang="ts">
/**
 * /club: GhostMark agency partner program landing page.
 *
 * For branding and event agencies. Same tile-and-band rhythm used across the
 * editorial pages: cream-tile hero, alternating white / cream-warm bands,
 * sage CTA at the foot. All CTAs use <UiButton> with the `merchery` (ink
 * slab) or `outline` variants.
 *
 * Token discipline: design-token utility classes only, no `bg-[#hex]`
 * literals, no `as any` casts.
 */
defineOptions({ name: 'PageClub' })

useHead({
  title: 'The Club - GhostMark Studio',
  meta: [
    {
      name: 'description',
      content:
        'A small, invitation-only club for branding, event and creative agencies. Bespoke production, dedicated production manager, and 5% commission on referred clients.',
    },
  ],
})

interface Benefit {
  number: string
  title: string
  body: string
}

interface JoinStep {
  number: string
  title: string
  body: string
}

interface Testimonial {
  quote: string
  author: string
  role: string
  agency: string
}

const benefits: Benefit[] = [
  {
    number: '01',
    title: 'Dedicated team',
    body:
      'Your own contact and a named production manager. One number, one inbox - no support queue, no ticket triage, no re-explaining the brief every Monday.',
  },
  {
    number: '02',
    title: 'Bespoke production',
    body:
      'Fully custom items, prototypes posted to your studio, low MOQs and the full material library at hand. Nothing is off-catalogue if it can be made well.',
  },
  {
    number: '03',
    title: 'Tailored service',
    body:
      'Sample cycles, mood-board reviews, on-call support during pitches and live events. We work to your project rhythm, not to a fixed SLA.',
  },
  {
    number: '04',
    title: 'Referral program',
    body:
      'Earn 5% commission on every client you refer, paid quarterly. We handle the relationship and keep you in the loop until the project ships.',
  },
]

const agencies: string[] = [
  'Pentagram',
  'TBWA',
  'Wolff Olins',
  'Highsnobiety',
  'Base',
  'Dept',
  'Kolo',
  'Droga',
  'AKQA',
  'Mother',
  'R/GA',
  'Anomaly',
  'Wieden+Kennedy',
  'Bruketa&Zinic',
  'Sid Lee',
  'Collins',
]

const joinSteps: JoinStep[] = [
  {
    number: '01',
    title: 'Apply with your agency profile',
    body: 'Send a deck, a website link, or just a paragraph - whatever shows the kind of work you make. We read every application personally.',
  },
  {
    number: '02',
    title: 'We review and onboard within 5 days',
    body: 'A short call, a NDA if you need one, a tour of the catalogue and material library. Then your team and access are live.',
  },
  {
    number: '03',
    title: 'Get your dedicated team and start projects',
    body: 'A direct line to your production manager. Quote-to-shipment in days, not weeks. Sample-first, on-the-record pricing, no surprises.',
  },
]

const testimonials: Testimonial[] = [
  {
    quote:
      'They picked up a re-brand launch with three weeks of runway and shipped 1,400 hand-numbered kits to seventeen markets without a single missed slot. We brief them now before we brief our own client.',
    author: 'Marta Gens',
    role: 'Creative Director',
    agency: 'Studio Volk, Berlin',
  },
  {
    quote:
      'Our production manager flagged a substrate issue on a sample we would have missed. That single email saved a six-figure run. The club pays for itself on the first project.',
    author: 'James Okafor',
    role: 'Head of Production',
    agency: 'Northwall Agency, London',
  },
  {
    quote:
      'The referral programme is the rare partner perk that actually pays. Quarterly statement, no chasing, and the work that comes back is at the same standard as our own.',
    author: 'Anais Lefevre',
    role: 'Managing Partner',
    agency: 'Maison Trois, Paris',
  },
]

const activeTestimonial = ref(0)
const setTestimonial = (i: number) => {
  activeTestimonial.value = i
}
const currentTestimonial = computed(
  () => testimonials[activeTestimonial.value] ?? testimonials[0]!,
)
</script>

<template>
  <div class="bg-white text-ink-950">
    <!-- 1. Hero -->
    <section class="bg-cream-tile">
      <div
        class="mx-auto grid max-w-rail grid-cols-1 gap-x-[30px] gap-y-12 px-gutter py-section lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-center"
      >
        <div class="flex flex-col gap-8">
          <p class="text-eyebrow font-body uppercase tracking-[0.18em] text-ink-500">
            The Club / Agencies
          </p>
          <h1
            class="font-display text-display-lg font-normal leading-[1.02] tracking-[-0.015em] text-ink-950"
          >
            Are you a branding<br class="hidden sm:block" />
            or event agency?
          </h1>
          <p class="max-w-[48ch] font-body text-body leading-relaxed text-ink-700">
            A small, invitation-only club for the studios we love working with.
            Bespoke production, a dedicated team and a referral programme that pays
            for itself - all built around the way agencies actually deliver.
          </p>
          <div class="flex flex-wrap items-center gap-4">
            <UiButton
              variant="merchery"
              size="lg"
              as="NuxtLink"
              to="/contact?topic=club-application"
            >
              Apply to join the club
            </UiButton>
            <UiButton variant="outline" size="lg" as="NuxtLink" to="#how-to-join">
              How it works
            </UiButton>
          </div>
        </div>

        <div class="relative">
          <div class="aspect-[4/5] w-full overflow-hidden bg-cream-warm">
            <div class="flex h-full w-full flex-col justify-between p-8">
              <span
                class="font-body text-caption uppercase tracking-[0.12em] text-ink-500"
              >
                Member card / 2026
              </span>
              <div class="flex flex-col gap-2">
                <span class="font-display text-[44px] leading-none text-ink-950">
                  No. 047
                </span>
                <span class="font-body text-caption text-ink-500">
                  GhostMark Studio Club - Agency portrait
                </span>
              </div>
            </div>
          </div>
          <div
            class="absolute -bottom-6 -right-6 hidden w-[200px] bg-merchery-sage p-5 lg:block"
            aria-hidden="true"
          >
            <p
              class="font-body text-caption uppercase tracking-[0.12em] text-ink-700"
            >
              Active members
            </p>
            <p class="mt-2 font-display text-[28px] leading-none text-ink-950">
              68 studios
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- 2. Member benefits -->
    <section>
      <div class="mx-auto max-w-rail px-gutter py-section">
        <div class="mb-14 flex flex-col gap-4">
          <p class="text-eyebrow font-body uppercase tracking-[0.18em] text-ink-500">
            Member benefits
          </p>
          <h2
            class="max-w-[24ch] font-display text-display-md font-normal leading-[1.05] tracking-[-0.015em] text-ink-950"
          >
            Built around how agencies actually work.
          </h2>
        </div>

        <div class="grid grid-cols-1 gap-x-[30px] gap-y-8 sm:grid-cols-2">
          <article
            v-for="benefit in benefits"
            :key="benefit.title"
            class="flex flex-col gap-5 bg-cream-tile p-10 transition-colors duration-300 ease-emphasis hover:bg-cream-warm"
          >
            <!--
              /55, up from /40 (2.56:1). At 44px the floor is 3:1, not 4.5.
              `aria-hidden` keeps this out of the accessibility tree, but it
              does not make it invisible: a sighted low-vision reader still
              has to resolve it, so it is held to the large-text floor rather
              than treated as exempt decoration.

              Measured on BOTH grounds, because the card is
              `hover:bg-cream-warm` — the ground moves under the pointer.
              /55 is 3.99 at rest and 3.83 on hover; /50 would have been
              3.42 / 3.31, which is too little for a value that has to
              survive a ground change.
            -->
            <span
              class="font-display text-[44px] leading-none text-ink-950/55"
              aria-hidden="true"
            >
              {{ benefit.number }}
            </span>
            <h3 class="font-display text-display-sm font-normal text-ink-950">
              {{ benefit.title }}
            </h3>
            <p class="max-w-[42ch] font-body text-body text-ink-700">
              {{ benefit.body }}
            </p>
          </article>
        </div>
      </div>
    </section>

    <!-- 3. Brand wall -->
    <section class="bg-cream-tile">
      <div class="mx-auto max-w-rail px-gutter py-section">
        <div
          class="mb-12 flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end"
        >
          <div>
            <p class="text-eyebrow font-body uppercase tracking-[0.18em] text-ink-500">
              Trusted by
            </p>
            <h2
              class="mt-3 max-w-[28ch] font-display text-display-md font-normal leading-[1.05] tracking-[-0.015em] text-ink-950"
            >
              Studios, agencies and independents from twelve countries.
            </h2>
          </div>
          <p class="max-w-[36ch] font-body text-caption text-ink-500">
            A representative selection. Membership list available on request.
          </p>
        </div>

        <ul
          class="grid grid-cols-2 items-center gap-x-10 gap-y-10 border-y border-ink-200 py-12 sm:grid-cols-3 lg:grid-cols-4"
        >
          <!--
            ink-500, not ink-700/70. These are real content — client and agency
            names — not decoration, so they answer to the 4.5:1 floor, and at
            22px/18px they are NOT large text (that starts at 24px). The alpha
            composited to 4.31:1 on cream-tile and missed.

            Replaced the alpha with a solid ramp step rather than nudging the
            opacity to /75. An alpha value has to be re-derived every time the
            ground changes; a token can be measured once and read off a table.
            ink-500 is 5.23:1 here, and the ink-950 hover is unchanged.
          -->
          <li
            v-for="(agency, i) in agencies"
            :key="agency"
            :class="[
              'text-center font-display text-[22px] leading-none text-ink-500 transition-colors duration-300 hover:text-ink-950',
              i % 4 === 1 ? 'tracking-[0.04em]' : '',
              i % 4 === 2 ? 'italic' : '',
            ]"
          >
            {{ agency }}
          </li>
        </ul>
      </div>
    </section>

    <!-- 4. Founder pull-quote -->
    <section class="bg-cream-warm">
      <div class="mx-auto max-w-rail px-gutter py-section">
        <div
          class="grid grid-cols-1 gap-x-[30px] gap-y-12 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-center"
        >
          <div class="order-2 lg:order-1">
            <div class="aspect-[4/5] w-full overflow-hidden bg-cream-tile">
              <div class="flex h-full w-full items-end p-6">
                <span class="font-body text-caption text-ink-500">
                  Founder portrait - Brussels workshop, 2025
                </span>
              </div>
            </div>
          </div>

          <figure class="order-1 flex flex-col gap-8 lg:order-2">
            <p
              class="text-eyebrow font-body uppercase tracking-[0.18em] text-ink-500"
            >
              From the founders
            </p>
            <blockquote
              class="font-display text-[34px] font-normal leading-[1.15] tracking-[-0.01em] text-ink-950 sm:text-[44px]"
            >
              <span aria-hidden="true" class="text-ink-500">"</span>We built the club
              because the best work happens when production sits at the table from
              day one.<span aria-hidden="true" class="text-ink-500">"</span>
            </blockquote>
            <figcaption class="flex flex-col gap-1">
              <span class="font-display text-[18px] text-ink-950">
                Founders, GhostMark Studio
              </span>
              <span class="font-body text-caption uppercase tracking-[0.12em] text-ink-500">
                Brussels - Berlin - London
              </span>
            </figcaption>
          </figure>
        </div>
      </div>
    </section>

    <!-- 5. How to join -->
    <section id="how-to-join">
      <div class="mx-auto max-w-rail px-gutter py-section">
        <div class="mb-14 flex flex-col gap-4">
          <p class="text-eyebrow font-body uppercase tracking-[0.18em] text-ink-500">
            How to join
          </p>
          <h2
            class="max-w-[28ch] font-display text-display-md font-normal leading-[1.05] tracking-[-0.015em] text-ink-950"
          >
            Three steps. Five working days. Then you are in.
          </h2>
        </div>

        <ol class="grid grid-cols-1 gap-x-[30px] gap-y-10 lg:grid-cols-3">
          <li
            v-for="step in joinSteps"
            :key="step.number"
            class="flex flex-col gap-5 border-t border-ink-200 pt-8"
          >
            <span class="font-display text-[44px] leading-none text-ink-950">
              {{ step.number }}
            </span>
            <h3 class="font-display text-[24px] leading-snug text-ink-950">
              {{ step.title }}
            </h3>
            <p class="font-body text-body text-ink-700">
              {{ step.body }}
            </p>
          </li>
        </ol>
      </div>
    </section>

    <!-- 6. Member testimonial carousel -->
    <section class="bg-cream-tile">
      <div class="mx-auto max-w-rail px-gutter py-section">
        <div class="flex flex-col gap-4">
          <p class="text-eyebrow font-body uppercase tracking-[0.18em] text-ink-500">
            Members on the record
          </p>
        </div>

        <figure
          v-if="currentTestimonial"
          :key="activeTestimonial"
          class="mt-10 flex flex-col gap-10"
        >
          <blockquote
            class="max-w-[36ch] font-display text-[32px] font-normal leading-[1.18] tracking-[-0.01em] text-ink-950 sm:max-w-[60ch] sm:text-[40px]"
          >
            <span aria-hidden="true" class="text-ink-500">"</span>{{ currentTestimonial.quote }}<span aria-hidden="true" class="text-ink-500">"</span>
          </blockquote>
          <figcaption class="flex flex-col gap-1">
            <span class="font-display text-[18px] text-ink-950">
              {{ currentTestimonial.author }}
            </span>
            <span class="font-body text-caption uppercase tracking-[0.12em] text-ink-500">
              {{ currentTestimonial.role }} - {{ currentTestimonial.agency }}
            </span>
          </figcaption>
        </figure>

        <div class="mt-10 flex items-center gap-3">
          <button
            v-for="(t, i) in testimonials"
            :key="t.author"
            type="button"
            :aria-label="`Show testimonial ${i + 1}`"
            :aria-current="activeTestimonial === i ? 'true' : undefined"
            :class="[
              'h-[3px] w-12 transition-colors duration-200',
              activeTestimonial === i ? 'bg-ink-950' : 'bg-ink-200 hover:bg-ink-700',
            ]"
            @click="setTestimonial(i)"
          />
        </div>
      </div>
    </section>

    <!-- 7. CTA band -->
    <section class="w-full bg-merchery-sage">
      <div class="mx-auto max-w-rail px-gutter py-section">
        <div
          class="grid grid-cols-1 gap-x-[30px] gap-y-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-center"
        >
          <div>
            <p
              class="text-eyebrow font-body uppercase tracking-[0.18em] text-ink-700/80"
            >
              Open call
            </p>
            <h2
              class="mt-3 max-w-[18ch] font-display text-display-md font-normal leading-[1.05] tracking-[-0.015em] text-ink-950"
            >
              Apply to the club.
            </h2>
            <p class="mt-5 max-w-[52ch] font-body text-body text-ink-700">
              We open a small number of memberships each quarter. Tell us about your
              studio and the work you make - we read every application personally.
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-4 lg:justify-end">
            <UiButton
              variant="merchery"
              size="lg"
              as="NuxtLink"
              to="/contact?topic=club-application"
            >
              Apply to join the club
            </UiButton>
            <UiButton variant="outline" size="lg" as="NuxtLink" to="/contact">
              Email us
            </UiButton>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
