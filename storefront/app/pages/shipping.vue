<script setup lang="ts">
/**
 * /shipping: Shipping policy.
 *
 * Editorial reference page. Hero + structured content sections:
 *   - Where we ship (region table)
 *   - Lead times (3-up cards)
 *   - Tracking, customs, lost-or-damaged paragraphs
 */
defineOptions({ name: 'PageShipping' })

useHead({
  title: 'Shipping · GhostMark Studio',
  meta: [
    {
      name: 'description',
      content:
        'Where we ship, how long it takes, what tracking looks like, and what happens if something goes wrong. The full GhostMark Studio shipping policy in plain English.',
    },
  ],
})

interface Region {
  region: string
  standard: string
  express: string
}

interface LeadTime {
  category: string
  range: string
  body: string
}

const regions: Region[] = [
  { region: 'United Kingdom', standard: '2–3 working days', express: '1 working day' },
  { region: 'European Union', standard: '3–5 working days', express: '1–2 working days' },
  { region: 'United States & Canada', standard: '5–7 working days', express: '2–3 working days' },
  { region: 'Rest of world', standard: '7–14 working days', express: '3–5 working days' },
]

const leadTimes: LeadTime[] = [
  {
    category: 'Apparel',
    range: '3–5 working days',
    body:
      'Tees, hoodies, crewnecks and caps. Run from the workshop closest to the destination market. Embroidery adds two days.',
  },
  {
    category: 'Print goods',
    range: '2–4 working days',
    body:
      'Posters, zines and notebooks printed sheet by sheet. Same-day dispatch on orders confirmed before 11:00 CET.',
  },
  {
    category: 'Custom orders',
    range: '10–15 working days',
    body:
      'Anything not in the standing catalog: bespoke blanks, multi-piece runs, custom finishes. Lead time confirmed in writing at sample sign-off.',
  },
]
</script>

<template>
  <div class="bg-white text-ink-950">
    <!-- ============================================================
         1. Hero
         ============================================================ -->
    <section
      class="bg-merchery-tile"
      aria-labelledby="shipping-hero-heading"
    >
      <div class="mx-auto flex max-w-rail flex-col gap-6 px-gutter py-section">
        <p class="text-eyebrow font-body uppercase text-ink-500">
          Shipping policy
        </p>
        <h1
          id="shipping-hero-heading"
          class="font-display text-display-lg font-normal text-ink-950"
        >
          Where we ship<br>
          and how long it takes.
        </h1>
        <p class="max-w-[52ch] font-body text-body text-ink-700">
          Every order is printed on demand from the workshop closest to
          your destination. Lead times below are from the moment your
          order is confirmed to the moment the courier picks it up.
        </p>
      </div>
    </section>

    <!-- ============================================================
         2. Where we ship: region table
         ============================================================ -->
    <section
      class="bg-white"
      aria-labelledby="shipping-regions-heading"
    >
      <div class="mx-auto max-w-rail px-gutter py-section">
        <div class="flex flex-col gap-3 pb-12 lg:max-w-[440px]">
          <p class="text-eyebrow font-body uppercase text-ink-500">
            Coverage
          </p>
          <h2
            id="shipping-regions-heading"
            class="font-display text-display-md font-normal text-ink-950"
          >
            Where we ship.
          </h2>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full min-w-[640px] border-collapse text-left font-body text-body text-ink-700">
            <thead>
              <tr class="border-b border-ink-200">
                <th
                  scope="col"
                  class="py-4 pr-6 text-eyebrow font-body uppercase text-ink-500"
                >
                  Region
                </th>
                <th
                  scope="col"
                  class="py-4 pr-6 text-eyebrow font-body uppercase text-ink-500"
                >
                  Standard
                </th>
                <th
                  scope="col"
                  class="py-4 text-eyebrow font-body uppercase text-ink-500"
                >
                  Express
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in regions"
                :key="row.region"
                class="border-b border-ink-100 last:border-b-0"
              >
                <th
                  scope="row"
                  class="py-5 pr-6 font-display text-display-sm font-normal text-ink-950"
                >
                  {{ row.region }}
                </th>
                <td class="py-5 pr-6">
                  {{ row.standard }}
                </td>
                <td class="py-5">
                  {{ row.express }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- ============================================================
         3. Lead times: 3-up cards
         ============================================================ -->
    <section
      class="bg-cream-warm"
      aria-labelledby="shipping-lead-times-heading"
    >
      <div class="mx-auto max-w-rail px-gutter py-section">
        <div class="flex flex-col gap-3 pb-12 lg:max-w-[440px]">
          <p class="text-eyebrow font-body uppercase text-ink-500">
            Lead times
          </p>
          <h2
            id="shipping-lead-times-heading"
            class="font-display text-display-md font-normal text-ink-950"
          >
            From order to dispatch.
          </h2>
        </div>

        <ul class="grid grid-cols-1 gap-x-[30px] gap-y-12 md:grid-cols-3">
          <li
            v-for="lead in leadTimes"
            :key="lead.category"
            class="flex flex-col gap-4 bg-cream-tile p-10"
          >
            <h3 class="font-display text-display-sm font-normal text-ink-950">
              {{ lead.category }}
            </h3>
            <p class="font-display text-display-sm font-normal text-ink-700">
              {{ lead.range }}
            </p>
            <p class="font-body text-body text-ink-700">
              {{ lead.body }}
            </p>
          </li>
        </ul>
      </div>
    </section>

    <!-- ============================================================
         4. Tracking + Customs + Lost / damaged paragraphs
         ============================================================ -->
    <section
      class="bg-white"
      aria-labelledby="shipping-fineprint-heading"
    >
      <div class="mx-auto grid max-w-rail grid-cols-1 gap-x-[30px] gap-y-12 px-gutter py-section lg:grid-cols-3">
        <h2 id="shipping-fineprint-heading" class="sr-only">
          Tracking, customs and lost or damaged
        </h2>

        <article class="flex flex-col gap-4">
          <h3 class="font-display text-display-sm font-normal text-ink-950">
            Tracking
          </h3>
          <p class="font-body text-body text-ink-700">
            A tracking link is emailed the moment your order is handed
            to the courier, usually before 17:00 CET on dispatch day.
            Account holders can also track from
            <NuxtLink
              to="/account"
              class="underline decoration-dashed decoration-ink-400 underline-offset-4 transition-colors duration-base ease-emphasis hover:decoration-ink-950"
            >their order history</NuxtLink>.
          </p>
        </article>

        <article class="flex flex-col gap-4">
          <h3 class="font-display text-display-sm font-normal text-ink-950">
            Customs &amp; duties
          </h3>
          <p class="font-body text-body text-ink-700">
            Orders inside the UK and EU are shipped duty-paid. For all
            other destinations, the recipient is responsible for any
            import duties or taxes the local customs authority levies.
            Our courier collects these on delivery.
          </p>
        </article>

        <article class="flex flex-col gap-4">
          <h3 class="font-display text-display-sm font-normal text-ink-950">
            Lost or damaged
          </h3>
          <p class="font-body text-body text-ink-700">
            If your parcel is late, lost in transit or arrives damaged,
            we'll reprint and reship at our cost. No questions, no forms,
            no friction.
            <NuxtLink
              to="/contact"
              class="underline decoration-dashed decoration-ink-400 underline-offset-4 transition-colors duration-base ease-emphasis hover:decoration-ink-950"
            >Tell us what happened</NuxtLink>
            and we'll fix it the same day.
          </p>
        </article>
      </div>
    </section>

    <!-- ============================================================
         5. CTA band
         ============================================================ -->
    <section
      class="w-full bg-merchery-sage py-section"
      aria-labelledby="shipping-cta-heading"
    >
      <div class="mx-auto max-w-rail px-gutter">
        <div class="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_auto] lg:items-end lg:gap-16">
          <div class="max-w-[400px]">
            <h2
              id="shipping-cta-heading"
              class="font-display font-normal leading-[1.05] tracking-[-0.015em] text-ink-950"
              style="font-size: clamp(2rem, 1.4rem + 2vw, 3rem)"
            >
              Question we haven't answered?
            </h2>
            <p class="mt-4 font-body text-body text-ink-700">
              The customer team replies inside one working day, including
              weekends during peak season.
            </p>
          </div>

          <div class="flex flex-wrap gap-3">
            <UiButton
              variant="merchery"
              size="lg"
              as="NuxtLink"
              to="/contact"
            >
              Get in touch
            </UiButton>
            <UiButton
              variant="outline"
              size="lg"
              as="NuxtLink"
              to="/returns"
            >
              Returns policy
            </UiButton>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
