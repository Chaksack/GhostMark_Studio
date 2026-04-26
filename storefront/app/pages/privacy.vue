<script setup lang="ts">
/**
 * /privacy — Privacy policy (legal).
 *
 * Editorial legal layout: cream-tile hero, prose body with serif h2s.
 * Copy is thoughtful placeholder language for a print-on-demand studio
 * — fit for a v0 launch, intended to be reviewed by counsel before
 * being treated as binding.
 */
defineOptions({ name: 'PagePrivacy' })

useHead({
  title: 'Privacy policy · GhostMark Studio',
  meta: [
    {
      name: 'description',
      content:
        'How GhostMark Studio collects, uses and protects your personal information — what we store, why we store it, and the rights you have over your data.',
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
    id: 'information-we-collect',
    title: 'Information we collect',
    body: [
      'When you place an order, request a sample, sign up to the newsletter or contact the studio, we collect the information you give us — name, email, billing and shipping address, phone number where provided, and order details. If you create an account, we additionally store the password as a salted hash.',
      'When you browse the site, we automatically collect technical data through first-party cookies and our analytics tools — IP address, device and browser type, the pages you visit, the products you view, and the route you took to get here. This data is aggregated and not used to identify you personally.',
    ],
  },
  {
    id: 'how-we-use-it',
    title: 'How we use it',
    body: [
      'We use your information to fulfil your order, communicate with you about it, prevent fraud, comply with our legal obligations, and improve the studio experience over time. With your explicit opt-in we also use your email to send the GhostMark Studio newsletter — twice a month, easy unsubscribe at the bottom of every issue.',
      'We never sell your personal information to a third party. We never share it with anyone outside the small circle of vendors strictly required to make the studio run (payment processor, shipping carrier, email platform, analytics provider).',
    ],
  },
  {
    id: 'cookies',
    title: 'Cookies',
    body: [
      'We use first-party cookies for cart persistence, authentication, region selection and basic analytics. We use third-party cookies only with your consent — payment, embedded video and social-share widgets fall into this group. A full breakdown of the cookies we set lives in the cookies policy, where you can also change your preferences at any time.',
    ],
  },
  {
    id: 'third-parties',
    title: 'Third parties',
    body: [
      'A short list of vendors helps us run the studio: Stripe processes payments; Sendgrid delivers transactional email; Plausible handles privacy-friendly analytics; DPD, Royal Mail and DHL handle delivery. Each vendor is GDPR-compliant and contractually bound to use your data only for the specific service they provide.',
      'We never use your data to train an AI model, internal or external.',
    ],
  },
  {
    id: 'your-rights',
    title: 'Your rights',
    body: [
      'Under GDPR and equivalent regimes, you have the right to access, correct, export and delete the personal data we hold about you. You also have the right to object to processing for marketing purposes and to lodge a complaint with your local data protection authority.',
      'To exercise any of these rights, email privacy@ghostmark.studio. We respond within five working days, and we don\'t make you fill in a form to do it.',
    ],
  },
  {
    id: 'contact',
    title: 'Contact',
    body: [
      'GhostMark Studio is registered in Belgium under company number BE 0712.345.678. For privacy questions or data requests, write to privacy@ghostmark.studio or to the studio address: 14 Rue du Page, 1050 Ixelles, Brussels, Belgium.',
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
      aria-labelledby="privacy-hero-heading"
    >
      <div class="mx-auto flex max-w-[1320px] flex-col gap-6 px-gutter py-section">
        <p class="text-eyebrow font-body uppercase text-ink-500">
          Legal
        </p>
        <h1
          id="privacy-hero-heading"
          class="font-display text-display-lg font-normal text-ink-950"
        >
          Privacy policy.
        </h1>
        <p class="font-body text-caption uppercase tracking-[0.04em] text-ink-500">
          Last updated: {{ lastUpdated }}
        </p>
        <p class="max-w-[52ch] font-body text-body text-ink-700">
          GhostMark Studio takes your privacy seriously. This page lays
          out exactly what we collect, why we collect it, and the rights
          you have over your data — written in English a human can read.
        </p>
      </div>
    </section>

    <!-- ============================================================
         2. Body — section list with anchor headings
         ============================================================ -->
    <section
      class="bg-white"
      aria-labelledby="privacy-body-heading"
    >
      <div class="mx-auto grid max-w-[1320px] grid-cols-1 gap-x-[30px] gap-y-12 px-gutter py-section lg:grid-cols-[minmax(0,0.3fr)_minmax(0,0.7fr)]">
        <h2 id="privacy-body-heading" class="sr-only">
          Privacy policy details
        </h2>

        <!-- Sticky in-page nav -->
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
