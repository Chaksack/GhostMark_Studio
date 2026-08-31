<script setup lang="ts">
/**
 * /terms: Terms of service (legal).
 */
defineOptions({ name: 'PageTerms' })

useHead({
  title: 'Terms of service · GhostMark Studio',
  meta: [
    {
      name: 'description',
      content:
        'The terms governing your use of the GhostMark Studio website and any orders you place with the studio: payments, shipping, returns, intellectual property and liability.',
    },
  ],
})

interface Section {
  id: string
  title: string
  body: string[]
}

const lastUpdated = '15 March 2026'

const sections: Section[] = [
  {
    id: 'acceptance',
    title: 'Acceptance',
    body: [
      'By accessing the GhostMark Studio website or placing an order with us, you agree to these terms in full. If any clause is unacceptable to you, please don\'t use the site or order from the studio. We may amend these terms from time to time; the version in force is always the one published on this page.',
    ],
  },
  {
    id: 'account',
    title: 'Account',
    body: [
      'You can browse the catalog without an account, but checkout, order history and saved designs require one. You\'re responsible for keeping your password confidential and for any activity on your account.',
      'Tell us straight away if you suspect unauthorised access. Email security@ghostmark.studio. We\'ll lock the account, force a password reset and audit recent activity together with you.',
    ],
  },
  {
    id: 'orders-payments',
    title: 'Orders & payments',
    body: [
      'Every order is an offer to purchase. The contract is formed when we send the order confirmation email. Until that point we may decline an order, partially fulfil it, or contact you for clarification (typically over a custom run).',
      'Prices are shown in the currency of your selected region and include VAT where applicable. Payment is taken in full at checkout. We accept all major debit and credit cards, Apple Pay, Google Pay and PayPal. We do not store full card numbers: payments are processed by our PCI-DSS certified provider.',
    ],
  },
  {
    id: 'shipping',
    title: 'Shipping',
    body: [
      'Lead times, regions and tracking are documented in full on the shipping policy page. Risk of loss passes to you when the courier scans the parcel as delivered. If a courier confirms delivery and you haven\'t received the parcel, please contact us within seven days so we can investigate jointly.',
    ],
  },
  {
    id: 'returns',
    title: 'Returns',
    body: [
      'Stocked styles can be returned within 30 days of delivery for a full refund. Custom and made-to-order pieces are non-returnable except in the case of a fault or a deviation from the approved sample. The full procedure is set out on the returns page.',
    ],
  },
  {
    id: 'intellectual-property',
    title: 'Intellectual property',
    body: [
      'GhostMark Studio retains all rights to the studio website, brand assets, photography and the catalog of stock designs. You may not copy, redistribute or commercially exploit them without written permission.',
      'Artwork you upload remains yours. By submitting it for production you grant the studio a non-exclusive license to reproduce it solely for the purpose of fulfilling your order. You confirm that you own or have permission to use the artwork; if a third-party rights complaint reaches us, we may pause production until it\'s resolved.',
    ],
  },
  {
    id: 'limitation-of-liability',
    title: 'Limitation of liability',
    body: [
      'To the fullest extent permitted by law, GhostMark Studio\'s aggregate liability arising out of or in connection with any order is limited to the amount paid by you for that order. Nothing in these terms excludes or limits liability for fraud, death or personal injury caused by negligence, or any other liability that cannot be excluded under applicable law.',
    ],
  },
  {
    id: 'governing-law',
    title: 'Governing law',
    body: [
      'These terms are governed by the laws of Belgium. Any dispute is subject to the exclusive jurisdiction of the courts of Brussels, save where mandatory consumer protection legislation in your country of residence requires otherwise.',
    ],
  },
  {
    id: 'contact',
    title: 'Contact',
    body: [
      'For any question about these terms, write to legal@ghostmark.studio. The studio\'s registered address is 14 Rue du Page, 1050 Ixelles, Brussels, Belgium. Belgian company number BE 0712.345.678.',
    ],
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
      aria-labelledby="terms-hero-heading"
    >
      <div class="mx-auto flex max-w-rail flex-col gap-6 px-gutter py-section">
        <p class="text-eyebrow font-body uppercase text-ink-500">
          Legal
        </p>
        <h1
          id="terms-hero-heading"
          class="font-display text-display-lg font-normal text-ink-950"
        >
          Terms of service.
        </h1>
        <p class="font-body text-caption uppercase tracking-[0.04em] text-ink-500">
          Last updated: {{ lastUpdated }}
        </p>
        <p class="max-w-[52ch] font-body text-body text-ink-700">
          The agreement between you and GhostMark Studio when you use the
          site or place an order. Written to be read, not buried.
        </p>
      </div>
    </section>

    <!-- ============================================================
         2. Body
         ============================================================ -->
    <section
      class="bg-white"
      aria-labelledby="terms-body-heading"
    >
      <div class="mx-auto grid max-w-rail grid-cols-1 gap-x-[30px] gap-y-12 px-gutter py-section lg:grid-cols-[minmax(0,0.3fr)_minmax(0,0.7fr)]">
        <h2 id="terms-body-heading" class="sr-only">
          Terms of service details
        </h2>

        <nav aria-label="On this page" class="lg:sticky lg:top-24 lg:self-start">
          <p class="text-eyebrow font-body uppercase text-ink-500">
            On this page
          </p>
          <ul class="mt-4 flex flex-col gap-2">
            <li
              v-for="section in sections"
              :key="section.id"
            >
              <a
                :href="`#${section.id}`"
                class="font-body text-body text-ink-700 underline decoration-dashed decoration-ink-300 underline-offset-4 transition-colors duration-base ease-emphasis hover:text-ink-950 hover:decoration-ink-950"
              >
                {{ section.title }}
              </a>
            </li>
          </ul>
        </nav>

        <div class="flex flex-col gap-12">
          <article
            v-for="section in sections"
            :key="section.id"
            class="flex flex-col gap-4"
          >
            <h2
              :id="section.id"
              class="font-display text-display-sm font-normal text-ink-950"
            >
              {{ section.title }}
            </h2>
            <p
              v-for="(para, idx) in section.body"
              :key="idx"
              class="font-body text-body text-ink-700"
            >
              {{ para }}
            </p>
          </article>
        </div>
      </div>
    </section>
  </div>
</template>
