<script setup lang="ts">
/**
 * /returns: Returns & refunds policy.
 */
defineOptions({ name: 'PageReturns' })

useHead({
  title: 'Returns &amp; refunds · GhostMark Studio',
  meta: [
    {
      name: 'description',
      content:
        '30-day returns on all stocked styles, plus a clear policy on what we accept, what we don\'t, and how long refunds take. The GhostMark Studio returns policy in plain English.',
    },
  ],
})

interface Step {
  number: string
  title: string
  body: string
}

interface Timeline {
  number: string
  title: string
  body: string
}

interface AcceptanceList {
  title: string
  surface: string
  ink: string
  body_ink: string
  items: string[]
}

const steps: Step[] = [
  {
    number: '01',
    title: 'Request',
    body:
      'Sign in to your account, find the order, and click "Start a return". No login? Email returns@ghostmark.studio with your order number.',
  },
  {
    number: '02',
    title: 'Pack',
    body:
      'Fold the item back into its original mailer or any sturdy envelope. Pop the prepaid label inside the package. It\'s emailed within an hour.',
  },
  {
    number: '03',
    title: 'Ship',
    body:
      'Drop it at any post office or partner pickup point. Tracking is automatic; you\'ll get an email the moment it lands at the studio.',
  },
]

const acceptanceLists: AcceptanceList[] = [
  {
    title: 'What we accept',
    surface: 'bg-cream-tile',
    ink: 'text-ink-950',
    body_ink: 'text-ink-700',
    items: [
      'Stocked styles in original, unworn condition',
      'Items returned within 30 days of delivery',
      'Faulty or misprinted items, at any time',
      'Wrong size: we\'ll cover the swap shipping',
    ],
  },
  {
    title: 'What we can\'t accept',
    surface: 'bg-cream-warm',
    ink: 'text-ink-950',
    body_ink: 'text-ink-700',
    items: [
      'Custom or made-to-order pieces (unless faulty)',
      'Worn or laundered apparel',
      'Items returned beyond 30 days, except faults',
      'Final-sale or clearance pieces',
    ],
  },
]

const timeline: Timeline[] = [
  {
    number: '01',
    title: 'Received',
    body:
      'A confirmation email lands the moment your parcel checks in at the studio, usually 2–3 working days after dispatch.',
  },
  {
    number: '02',
    title: 'Inspected',
    body:
      'We open and inspect every return inside one working day. Faults, sizing notes and substitutions are logged at this point.',
  },
  {
    number: '03',
    title: 'Refunded',
    body:
      'Refunds are issued back to the original payment method. Card refunds typically settle within 3–5 working days; PayPal sooner.',
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
      aria-labelledby="returns-hero-heading"
    >
      <div class="mx-auto flex max-w-rail flex-col gap-6 px-gutter py-section">
        <p class="text-eyebrow font-body uppercase text-ink-500">
          Returns &amp; refunds
        </p>
        <h1
          id="returns-hero-heading"
          class="font-display text-display-lg font-normal text-ink-950"
        >
          Returns,<br>
          made simple.
        </h1>
        <p class="max-w-[52ch] font-body text-body text-ink-700">
          Free returns on every stocked style for 30 days. No restocking fees,
          no hoops to jump through. Custom orders are a different story,
          there's a note about that further down.
        </p>
      </div>
    </section>

    <!-- ============================================================
         2. 30-day returns headline tile (sage)
         ============================================================ -->
    <section
      class="bg-white"
      aria-labelledby="returns-headline-heading"
    >
      <div class="mx-auto max-w-rail px-gutter py-section">
        <div class="bg-merchery-sage p-10 lg:p-16">
          <p class="text-eyebrow font-body uppercase text-ink-500">
            Our promise
          </p>
          <h2
            id="returns-headline-heading"
            class="mt-3 font-display text-display-md font-normal leading-tight text-ink-950"
          >
            30 days, no questions, free return label.
          </h2>
          <p class="mt-4 max-w-[52ch] font-body text-body text-ink-700">
            If a stocked piece doesn't fit, doesn't suit, or just isn't
            what you expected. Send it back. We pay the return postage
            and refund the original total in full.
          </p>
        </div>
      </div>
    </section>

    <!-- ============================================================
         3. How to start a return: 3-step numbered list
         ============================================================ -->
    <section
      class="bg-cream-warm"
      aria-labelledby="returns-steps-heading"
    >
      <div class="mx-auto max-w-rail px-gutter py-section">
        <div class="flex flex-col gap-3 pb-12 lg:max-w-[440px]">
          <p class="text-eyebrow font-body uppercase text-ink-500">
            How it works
          </p>
          <h2
            id="returns-steps-heading"
            class="font-display text-display-md font-normal text-ink-950"
          >
            Three steps, ten minutes.
          </h2>
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
         4. What we accept / don't: 2-up cards
         ============================================================ -->
    <section
      class="bg-white"
      aria-labelledby="returns-acceptance-heading"
    >
      <div class="mx-auto max-w-rail px-gutter py-section">
        <div class="flex flex-col gap-3 pb-12 lg:max-w-[440px]">
          <p class="text-eyebrow font-body uppercase text-ink-500">
            Acceptance
          </p>
          <h2
            id="returns-acceptance-heading"
            class="font-display text-display-md font-normal text-ink-950"
          >
            What we can and can't take back.
          </h2>
        </div>

        <div class="grid grid-cols-1 gap-x-[30px] gap-y-[30px] md:grid-cols-2">
          <article
            v-for="list in acceptanceLists"
            :key="list.title"
            :class="[list.surface, 'flex flex-col gap-5 p-10 lg:p-12']"
          >
            <h3 :class="['font-display text-display-sm font-normal', list.ink]">
              {{ list.title }}
            </h3>
            <ul :class="['flex flex-col gap-3 font-body text-body', list.body_ink]">
              <li
                v-for="item in list.items"
                :key="item"
                class="flex gap-3"
              >
                <span aria-hidden="true" class="mt-2 inline-block h-1 w-3 shrink-0 bg-ink-700" />
                <span>{{ item }}</span>
              </li>
            </ul>
          </article>
        </div>
      </div>
    </section>

    <!-- ============================================================
         5. Refund timeline: 3-up timeline cards
         ============================================================ -->
    <section
      class="bg-cream-warm"
      aria-labelledby="returns-timeline-heading"
    >
      <div class="mx-auto max-w-rail px-gutter py-section">
        <div class="flex flex-col gap-3 pb-12 lg:max-w-[440px]">
          <p class="text-eyebrow font-body uppercase text-ink-500">
            Refund timeline
          </p>
          <h2
            id="returns-timeline-heading"
            class="font-display text-display-md font-normal text-ink-950"
          >
            Received → Inspected → Refunded.
          </h2>
        </div>

        <ol class="grid grid-cols-1 gap-x-[30px] gap-y-12 md:grid-cols-3">
          <li
            v-for="stage in timeline"
            :key="stage.number"
            class="flex flex-col gap-4 bg-white p-8"
          >
            <span class="font-body text-caption uppercase tracking-[0.04em] text-ink-500">
              Stage {{ stage.number }}
            </span>
            <h3 class="font-display text-display-sm font-normal text-ink-950">
              {{ stage.title }}
            </h3>
            <p class="font-body text-body text-ink-700">
              {{ stage.body }}
            </p>
          </li>
        </ol>
      </div>
    </section>

    <!-- ============================================================
         6. Custom orders caveat: sage warning tile
         ============================================================ -->
    <section
      class="bg-white"
      aria-labelledby="returns-custom-heading"
    >
      <div class="mx-auto max-w-rail px-gutter py-section">
        <div class="bg-merchery-sage p-10 lg:p-14">
          <p class="text-eyebrow font-body uppercase text-ink-500">
            One important caveat
          </p>
          <h2
            id="returns-custom-heading"
            class="mt-3 font-display text-display-md font-normal leading-tight text-ink-950"
          >
            Custom orders are non-returnable.
          </h2>
          <p class="mt-4 max-w-[52ch] font-body text-body text-ink-700">
            Anything printed, embroidered or finished to your spec is made
            for you and you alone: we can't restock it. We mitigate this
            by sending a physical sample for sign-off before any custom
            run goes to press. If something arrives faulty or doesn't
            match the approved sample,
            <NuxtLink
              to="/contact"
              class="underline decoration-dashed decoration-ink-400 underline-offset-4 transition-colors duration-base ease-emphasis hover:decoration-ink-950"
            >tell us</NuxtLink>
            and we'll reprint at our cost.
          </p>
        </div>
      </div>
    </section>

    <!-- ============================================================
         7. CTA band
         ============================================================ -->
    <section
      class="w-full bg-merchery-sage py-section"
      aria-labelledby="returns-cta-heading"
    >
      <div class="mx-auto max-w-rail px-gutter">
        <div class="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_auto] lg:items-end lg:gap-16">
          <div class="max-w-[400px]">
            <h2
              id="returns-cta-heading"
              class="font-display font-normal leading-[1.05] tracking-[-0.015em] text-ink-950"
              style="font-size: clamp(2rem, 1.4rem + 2vw, 3rem)"
            >
              Need help with a return?
            </h2>
            <p class="mt-4 font-body text-body text-ink-700">
              The customer team replies inside one working day. Send the
              order number and a photo if anything's not right.
            </p>
          </div>

          <div class="flex flex-wrap gap-3">
            <UiButton
              variant="merchery"
              size="lg"
              as="NuxtLink"
              to="/contact"
            >
              Start a return
            </UiButton>
            <UiButton
              variant="outline"
              size="lg"
              as="NuxtLink"
              to="/shipping"
            >
              Shipping policy
            </UiButton>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
