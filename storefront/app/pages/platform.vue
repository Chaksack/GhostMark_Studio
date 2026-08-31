<script setup lang="ts">
/**
 * /platform: GhostMark fulfilment SaaS landing page.
 *
 * B2B product page for the inventory + internal-shop + shipments + orders
 * platform. Same tile-and-band rhythm used across /studio, /about and
 * /sustainability: cream-tile hero, alternating white / cream-warm bands,
 * sage CTA at the foot.
 *
 * All CTAs use <UiButton> with the `merchery` (ink slab) or `outline`
 * variants. Token discipline: design-token utility classes only, no
 * `bg-[#hex]` literals, no `as any` casts.
 */
defineOptions({ name: 'PagePlatform' })

useHead({
  title: 'Platform - GhostMark Studio',
  meta: [
    {
      name: 'description',
      content:
        'GhostMark Platform - one place to run your branded merch programme. Inventory, internal shop, multi-address shipments and order workflows in a single dashboard.',
    },
  ],
})

interface Feature {
  eyebrow: string
  title: string
  body: string
}

interface Step {
  number: string
  title: string
  body: string
}

interface Plan {
  name: string
  price: string
  cadence: string
  blurb: string
  features: string[]
  highlighted: boolean
  ctaLabel: string
}

interface Faq {
  question: string
  answer: string
}

const features: Feature[] = [
  {
    eyebrow: '01 / Stock',
    title: 'Inventory',
    body:
      'Track stock across every warehouse in real time. Set par levels per SKU, get low-stock alerts before a campaign sells through, and reorder without leaving the dashboard.',
  },
  {
    eyebrow: '02 / Storefront',
    title: 'Internal shop',
    body:
      'A branded ordering portal for employees, partners and end customers. Currency, language and entitlement rules are scoped per audience - no spreadsheets, no shared logins.',
  },
  {
    eyebrow: '03 / Logistics',
    title: 'Shipments',
    body:
      'Send to one address or three thousand. Bulk import a roster, generate customs paperwork on the fly, and follow every parcel with end-to-end tracking links.',
  },
  {
    eyebrow: '04 / Workflow',
    title: 'Orders',
    body:
      'A clean RFQ-to-fulfilment pipeline with budget approvals, automated invoices and audit trails - so finance, procurement and brand each see exactly what they need.',
  },
]

const steps: Step[] = [
  {
    number: '01',
    title: 'Upload or sync your branded items',
    body: 'Connect a catalogue or upload a list. We mirror your SKUs, decoration variants and stock positions in minutes.',
  },
  {
    number: '02',
    title: 'Recipients order or you ship in bulk',
    body: 'Open the portal to your team, run a one-off campaign, or push a bulk shipment to a hundred offices in one click.',
  },
  {
    number: '03',
    title: 'We pick, pack and dispatch',
    body: 'Our fulfilment partners handle the physical work in their nearest hub - usually the same business day.',
  },
  {
    number: '04',
    title: 'You see everything in your dashboard',
    body: 'Live stock, in-flight shipments, spend by team, every signed proof - one source of truth for the whole programme.',
  },
]

const plans: Plan[] = [
  {
    name: 'Starter',
    price: 'From £99',
    cadence: '/ month',
    blurb: 'For small teams running their first managed merch programme.',
    features: [
      'Inventory dashboard',
      'Internal shop (1 brand)',
      'Up to 25 SKUs',
      'Email support',
    ],
    highlighted: false,
    ctaLabel: 'Get started',
  },
  {
    name: 'Studio',
    price: 'From £299',
    cadence: '/ month',
    blurb: 'For brand teams scaling cross-market gifting and onboarding.',
    features: [
      'Everything in Starter',
      'Multi-address shipments',
      'Approvals and budgets',
      'Up to 250 SKUs',
      'Priority support',
    ],
    highlighted: true,
    ctaLabel: 'Get started',
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    cadence: '',
    blurb: 'For global programmes that need bespoke integrations and SLAs.',
    features: [
      'Full platform, unlimited SKUs',
      'SSO / SCIM provisioning',
      'Dedicated success manager',
      'Custom SLAs and reporting',
    ],
    highlighted: false,
    ctaLabel: 'Talk to sales',
  },
]

const logos: string[] = [
  'Oatly',
  'Highsnobiety',
  'Spotify',
  'Caudalie',
  'WeTransfer',
  'Deliveroo',
  'Deloitte',
  'Accenture',
]

const faqs: Faq[] = [
  {
    question: 'Is there a setup fee?',
    answer:
      'No. Onboarding, catalogue migration and your first portal launch are included in every plan. You only pay the monthly platform fee plus the cost of goods you ship.',
  },
  {
    question: 'What integrations do you support?',
    answer:
      'Native connectors for Slack, Workday, BambooHR, Salesforce and HubSpot, plus a documented REST API and outbound webhooks. Custom integrations are scoped on Enterprise.',
  },
  {
    question: 'How does pricing actually work?',
    answer:
      'Plans are billed monthly per workspace. Goods, decoration and shipping are passed through at cost - we publish margins openly so finance always sees what they are paying for.',
  },
  {
    question: 'Can we white-label the experience?',
    answer:
      'Yes. From Studio upwards, the recipient-facing portal is fully white-labelled - your colour palette, your typography, your domain. The platform itself stays internal to your team.',
  },
  {
    question: 'How long does implementation take?',
    answer:
      'A working pilot in five business days, a full programme in three to four weeks. We assign a launch lead from day one and run weekly check-ins until you are live.',
  },
  {
    question: 'Where is data hosted?',
    answer:
      'EU-resident infrastructure on AWS Frankfurt by default, with optional US or UK regions on Enterprise. SOC 2 Type II report available under NDA.',
  },
]

const openFaq = ref<number | null>(0)
const toggleFaq = (index: number) => {
  openFaq.value = openFaq.value === index ? null : index
}
</script>

<template>
  <div class="bg-white text-ink-950">
    <!-- 1. Hero -->
    <section class="bg-cream-tile">
      <div
        class="mx-auto grid max-w-rail grid-cols-1 gap-x-[30px] gap-y-16 px-gutter py-section lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-center"
      >
        <div class="flex flex-col gap-8">
          <p class="text-eyebrow font-body uppercase tracking-[0.18em] text-ink-500">
            GhostMark Platform
          </p>
          <h1
            class="font-display text-display-lg font-normal leading-[1.02] tracking-[-0.015em] text-ink-950"
          >
            Sending gifts,<br class="hidden sm:block" />
            made easy.
          </h1>
          <p class="max-w-[46ch] font-body text-body leading-relaxed text-ink-700">
            One dashboard for stock, internal shops, multi-address dispatch and approvals.
            Built so brand, finance and ops can finally read the same page.
          </p>
          <div class="flex flex-wrap items-center gap-4">
            <UiButton
              variant="merchery"
              size="lg"
              as="NuxtLink"
              to="/contact?topic=platform-demo"
            >
              Book a demo
            </UiButton>
            <UiButton variant="outline" size="lg" as="NuxtLink" to="/contact">
              Talk to our team
            </UiButton>
          </div>
          <dl class="mt-2 flex flex-wrap gap-x-10 gap-y-4 border-t border-ink-200 pt-6">
            <div>
              <dt class="font-body text-caption uppercase tracking-[0.12em] text-ink-500">
                Live workspaces
              </dt>
              <dd class="mt-1 font-display text-[28px] leading-none text-ink-950">
                240+
              </dd>
            </div>
            <div>
              <dt class="font-body text-caption uppercase tracking-[0.12em] text-ink-500">
                Parcels routed / yr
              </dt>
              <dd class="mt-1 font-display text-[28px] leading-none text-ink-950">
                1.2M
              </dd>
            </div>
            <div>
              <dt class="font-body text-caption uppercase tracking-[0.12em] text-ink-500">
                Avg setup
              </dt>
              <dd class="mt-1 font-display text-[28px] leading-none text-ink-950">
                5 days
              </dd>
            </div>
          </dl>
        </div>

        <div class="relative">
          <div class="aspect-[5/4] w-full overflow-hidden bg-cream-warm">
            <div class="flex h-full w-full flex-col p-6">
              <div class="flex items-center justify-between border-b border-ink-200 pb-4">
                <span class="font-display text-[18px] text-ink-950">Inventory</span>
                <span
                  class="inline-flex items-center bg-ink-900 px-3 py-1 font-body text-caption uppercase tracking-[0.08em] text-cream-50"
                >
                  Send 2 products
                </span>
              </div>
              <div class="mt-6 grid flex-1 grid-cols-3 gap-3">
                <div
                  v-for="n in 6"
                  :key="n"
                  class="aspect-square bg-cream-tile"
                  aria-hidden="true"
                />
              </div>
              <p class="mt-6 font-body text-caption text-ink-500">
                Platform UI screenshot
              </p>
            </div>
          </div>
          <div
            class="absolute -bottom-6 -left-6 hidden w-[180px] bg-merchery-sage p-5 lg:block"
            aria-hidden="true"
          >
            <p class="font-body text-caption uppercase tracking-[0.12em] text-ink-700">
              In stock
            </p>
            <p class="mt-2 font-display text-[28px] leading-none text-ink-950">
              4,820 units
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- 2. Feature grid -->
    <section>
      <div class="mx-auto max-w-rail px-gutter py-section">
        <div class="mb-14 grid grid-cols-1 gap-x-[30px] gap-y-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <div>
            <p class="text-eyebrow font-body uppercase tracking-[0.18em] text-ink-500">
              The platform
            </p>
            <h2
              class="mt-3 font-display text-display-md font-normal leading-[1.05] tracking-[-0.015em] text-ink-950"
            >
              Four products, one source of truth.
            </h2>
          </div>
          <p class="max-w-[52ch] self-end font-body text-body text-ink-700">
            Each module stands alone, but they were designed in the same room - so a
            recipient ordering through the portal triggers a shipment, a stock movement
            and an approval entry without anyone having to wire it up.
          </p>
        </div>

        <div class="grid grid-cols-1 gap-x-[30px] gap-y-8 sm:grid-cols-2">
          <article
            v-for="feature in features"
            :key="feature.title"
            class="group flex flex-col gap-5 bg-cream-tile p-10 transition-colors duration-300 ease-emphasis hover:bg-cream-warm"
          >
            <span
              class="font-body text-caption uppercase tracking-[0.12em] text-ink-500"
            >
              {{ feature.eyebrow }}
            </span>
            <h3 class="font-display text-display-sm font-normal text-ink-950">
              {{ feature.title }}
            </h3>
            <p class="max-w-[42ch] font-body text-body text-ink-700">
              {{ feature.body }}
            </p>
            <NuxtLink
              :to="`/contact?topic=platform-${feature.title.toLowerCase().replace(/\s+/g, '-')}`"
              class="mt-auto inline-flex w-fit items-center gap-2 border-b border-dashed border-ink-700 pb-1 font-body text-body text-ink-950 transition-colors duration-150 hover:border-ink-950"
            >
              Learn more
              <span aria-hidden="true">-&gt;</span>
            </NuxtLink>
          </article>
        </div>
      </div>
    </section>

    <!-- 3. How it works -->
    <section class="bg-cream-warm">
      <div class="mx-auto max-w-rail px-gutter py-section">
        <div class="mb-14 max-w-[60ch]">
          <p class="text-eyebrow font-body uppercase tracking-[0.18em] text-ink-500">
            How it works
          </p>
          <h2
            class="mt-3 font-display text-display-md font-normal leading-[1.05] tracking-[-0.015em] text-ink-950"
          >
            From a folder of PDFs to a programme that runs itself.
          </h2>
        </div>

        <ol class="grid grid-cols-1 gap-x-[30px] gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          <li
            v-for="(step, i) in steps"
            :key="step.number"
            class="flex flex-col gap-4 border-t border-ink-200 pt-6"
          >
            <!--
              The ordinal is announced by a visually-hidden sibling, not by
              an aria-label. Three reasons it cannot be done the shorter ways:

              1. `aria-label` on a bare <span> (role=generic) cannot take an
                 accessible name, so the old attribute was free to be ignored
                 — leaving a screen reader to announce the raw glyph "01".
              2. `role="img"` would make it conform, but calls a numeral an
                 image to get there.
              3. Leaving it to the <ol> does not work either: this list is
                 `list-style: none` AND `display: grid` (both measured), and
                 each of those is enough on its own to strip list semantics,
                 so there is no reliable "item 1 of 4" to lean on.

              A real text node in the accessibility tree needs none of that
              to be true.
            -->
            <span class="font-display text-[44px] leading-none text-ink-950">
              <span class="sr-only">Step {{ i + 1 }}</span>
              <span aria-hidden="true">{{ step.number }}</span>
            </span>
            <h3 class="font-display text-[22px] leading-snug text-ink-950">
              {{ step.title }}
            </h3>
            <p class="font-body text-body text-ink-700">
              {{ step.body }}
            </p>
          </li>
        </ol>
      </div>
    </section>

    <!-- 4. Pricing -->
    <section>
      <div class="mx-auto max-w-rail px-gutter py-section">
        <div class="mb-14 flex flex-col items-center text-center">
          <p class="text-eyebrow font-body uppercase tracking-[0.18em] text-ink-500">
            Pricing
          </p>
          <h2
            class="mt-3 max-w-[24ch] font-display text-display-md font-normal leading-[1.05] tracking-[-0.015em] text-ink-950"
          >
            Honest prices. Flat fee, goods at cost.
          </h2>
          <p class="mt-5 max-w-[58ch] font-body text-body text-ink-700">
            Every plan includes onboarding, training and your first portal launch. No
            implementation fees, no per-seat tax.
          </p>
        </div>

        <div class="grid grid-cols-1 gap-x-[30px] gap-y-8 lg:grid-cols-3">
          <article
            v-for="plan in plans"
            :key="plan.name"
            :class="[
              'flex flex-col gap-6 p-10 transition-colors duration-300 ease-emphasis',
              plan.highlighted
                ? 'bg-accent-terracotta text-cream-50'
                : 'bg-cream-tile text-ink-950',
            ]"
          >
            <header class="flex flex-col gap-3">
              <p
                :class="[
                  'font-body text-caption uppercase tracking-[0.12em]',
                  plan.highlighted ? 'text-cream-50/80' : 'text-ink-500',
                ]"
              >
                {{ plan.name }}
              </p>
              <p class="font-display text-[44px] leading-none">
                {{ plan.price }}
                <span
                  v-if="plan.cadence"
                  :class="[
                    'ml-1 font-body text-caption',
                    plan.highlighted ? 'text-cream-50/80' : 'text-ink-500',
                  ]"
                >
                  {{ plan.cadence }}
                </span>
              </p>
              <p
                :class="[
                  'max-w-[36ch] font-body text-body',
                  plan.highlighted ? 'text-cream-50/90' : 'text-ink-700',
                ]"
              >
                {{ plan.blurb }}
              </p>
            </header>

            <ul
              :class="[
                'flex flex-col gap-3 border-t pt-6',
                plan.highlighted ? 'border-cream-50/30' : 'border-ink-200',
              ]"
            >
              <li
                v-for="item in plan.features"
                :key="item"
                class="flex items-start gap-3 font-body text-body"
              >
                <span
                  :class="[
                    'mt-[7px] inline-block h-[6px] w-[6px] flex-shrink-0',
                    plan.highlighted ? 'bg-cream-50' : 'bg-ink-950',
                  ]"
                  aria-hidden="true"
                />
                {{ item }}
              </li>
            </ul>

            <UiButton
              :variant="plan.highlighted ? 'merchery' : 'outline'"
              size="lg"
              block
              as="NuxtLink"
              to="/contact?topic=platform-pricing"
              class="mt-auto"
            >
              {{ plan.ctaLabel }}
            </UiButton>
          </article>
        </div>
      </div>
    </section>

    <!-- 5. Customer logos / proof -->
    <section class="bg-cream-tile">
      <div class="mx-auto max-w-rail px-gutter py-20">
        <p
          class="mb-10 text-center font-body text-caption uppercase tracking-[0.18em] text-ink-500"
        >
          Trusted by brand teams at
        </p>
        <ul
          class="grid grid-cols-2 items-center gap-x-10 gap-y-8 sm:grid-cols-4 lg:grid-cols-8"
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
            v-for="logo in logos"
            :key="logo"
            class="text-center font-display text-[18px] leading-none text-ink-500 transition-colors duration-300 hover:text-ink-950"
          >
            {{ logo }}
          </li>
        </ul>
      </div>
    </section>

    <!-- 6. FAQ accordion -->
    <section>
      <div class="mx-auto max-w-rail px-gutter py-section">
        <div
          class="grid grid-cols-1 gap-x-[30px] gap-y-12 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]"
        >
          <div>
            <p class="text-eyebrow font-body uppercase tracking-[0.18em] text-ink-500">
              FAQ
            </p>
            <h2
              class="mt-3 max-w-[16ch] font-display text-display-md font-normal leading-[1.05] tracking-[-0.015em] text-ink-950"
            >
              Questions, answered.
            </h2>
            <p class="mt-5 max-w-[42ch] font-body text-body text-ink-700">
              Still wondering? Drop us a note and we will reply the same business day.
            </p>
          </div>

          <ul class="flex flex-col">
            <li
              v-for="(item, i) in faqs"
              :key="item.question"
              class="border-t border-ink-200 last:border-b"
            >
              <button
                type="button"
                class="flex w-full items-center justify-between gap-6 py-6 text-left font-body text-body text-ink-950 transition-colors hover:text-ink-700"
                :aria-expanded="openFaq === i"
                :aria-controls="`platform-faq-${i}`"
                @click="toggleFaq(i)"
              >
                <span class="font-display text-[20px] leading-snug">
                  {{ item.question }}
                </span>
                <span
                  :class="[
                    'flex h-7 w-7 shrink-0 items-center justify-center font-display text-[26px] leading-none transition-transform duration-300 ease-emphasis',
                    openFaq === i ? 'rotate-45' : '',
                  ]"
                  aria-hidden="true"
                >
                  +
                </span>
              </button>
              <div
                v-show="openFaq === i"
                :id="`platform-faq-${i}`"
                class="pb-6 pr-12 font-body text-body text-ink-700"
              >
                {{ item.answer }}
              </div>
            </li>
          </ul>
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
              Ready when you are
            </p>
            <h2
              class="mt-3 max-w-[20ch] font-display text-display-md font-normal leading-[1.05] tracking-[-0.015em] text-ink-950"
            >
              Ready to scale your gifting program?
            </h2>
            <p class="mt-5 max-w-[52ch] font-body text-body text-ink-700">
              A 30-minute walkthrough. We open a sandbox workspace with your brand
              loaded so you can click around the same dashboard your team would use.
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-4 lg:justify-end">
            <UiButton
              variant="merchery"
              size="lg"
              as="NuxtLink"
              to="/contact?topic=platform-demo"
            >
              Book a demo
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
