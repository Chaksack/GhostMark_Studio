<script setup lang="ts">
/**
 * /cookies: Cookies policy (legal).
 *
 * Same structure as /privacy and /terms. Adds a "Manage preferences" CTA
 * at the top, placeholder click handler today, designed to plug into a
 * real consent platform later.
 */
defineOptions({ name: 'PageCookies' })

useHead({
  title: 'Cookies policy · GhostMark Studio',
  meta: [
    {
      name: 'description',
      content:
        'A clear breakdown of the cookies and similar technologies GhostMark Studio uses on this site: what they do, who sets them, and how to change your mind at any time.',
    },
  ],
})

interface Section {
  id: string
  title: string
  body: string[]
}

interface CookieType {
  id: string
  label: string
  body: string
}

const lastUpdated = '15 March 2026'

const types: CookieType[] = [
  {
    id: 'essential',
    label: 'Essential',
    body:
      'Make the cart, checkout, login session and region selection work. Cannot be turned off in the consent banner. Without them the site simply doesn\'t function.',
  },
  {
    id: 'functional',
    label: 'Functional',
    body:
      'Remember preferences like recently viewed products, sample-pack address, and accessibility settings. Set with consent and used only on the device you set them on.',
  },
  {
    id: 'analytics',
    label: 'Analytics',
    body:
      'Privacy-friendly Plausible script measures aggregate page views and conversion paths. No personally identifiable data, no cross-site tracking, no fingerprinting.',
  },
  {
    id: 'marketing',
    label: 'Marketing',
    body:
      'Optional. Help us measure the effectiveness of the (rare) social campaigns we run, and serve a small newsletter prompt to first-time visitors. Off by default.',
  },
]

const sections: Section[] = [
  {
    id: 'what-are-cookies',
    title: 'What are cookies?',
    body: [
      'Cookies are small text files stored on your device when you visit a website. They\'re used by almost every site on the modern web to keep you logged in, remember a cart, measure traffic, and personalise content. The cookies we set on ghostmark.studio are described in detail below.',
      'We treat cookies the same way we treat the rest of our data practices: as little as possible, transparent about why, and easy to change your mind about.',
    ],
  },
  {
    id: 'how-to-manage',
    title: 'How to manage cookies',
    body: [
      'You can change your consent at any time using the "Manage preferences" button at the top of this page. You can also block or delete cookies through your browser settings. Every modern browser exposes this in its privacy or content settings panel.',
      'Blocking essential cookies will break parts of the site (cart, checkout, account). Blocking analytics, functional or marketing cookies will not.',
    ],
  },
  {
    id: 'third-party-cookies',
    title: 'Third-party cookies',
    body: [
      'Some pages embed content from third parties: Stripe (payments), Vimeo (product video), and occasionally a Twitter or Instagram embed. These third parties may set their own cookies governed by their own policies. We list the active ones in our consent banner so you can opt out of each individually.',
    ],
  },
  {
    id: 'updates',
    title: 'Updates',
    body: [
      'When we add a new cookie or change how an existing one works, we update this page and refresh the consent banner so you can re-confirm. The "last updated" date at the top of the page tells you when the most recent change happened.',
    ],
  },
  {
    id: 'contact',
    title: 'Contact',
    body: [
      'For questions about our cookies policy or to request a copy of the cookies stored against your account, email privacy@ghostmark.studio. We respond within five working days.',
    ],
  },
]

const onManagePreferences = () => {
  // Placeholder: wire to the real cookie consent platform when it lands.
  // No-op today. The button is keyboard- and screen-reader-reachable so the
  // banner integration can be slotted in without page-template changes.
}
</script>

<template>
  <div class="bg-white text-ink-950">
    <!-- ============================================================
         1. Hero with manage-preferences CTA
         ============================================================ -->
    <section
      class="bg-merchery-tile"
      aria-labelledby="cookies-hero-heading"
    >
      <div class="mx-auto flex max-w-rail flex-col gap-6 px-gutter py-section">
        <p class="text-eyebrow font-body uppercase text-ink-500">
          Legal
        </p>
        <h1
          id="cookies-hero-heading"
          class="font-display text-display-lg font-normal text-ink-950"
        >
          Cookies policy.
        </h1>
        <p class="font-body text-caption uppercase tracking-[0.04em] text-ink-500">
          Last updated: {{ lastUpdated }}
        </p>
        <p class="max-w-[52ch] font-body text-body text-ink-700">
          What we set, why we set it, and how to change your mind at any
          time. As few cookies as possible, and never shared with anyone
          we haven't told you about.
        </p>
        <div class="pt-2">
          <UiButton
            variant="outline"
            size="md"
            type="button"
            @click="onManagePreferences"
          >
            Manage preferences
          </UiButton>
        </div>
      </div>
    </section>

    <!-- ============================================================
         2. Types of cookies: 4-up grid
         ============================================================ -->
    <section
      class="bg-white"
      aria-labelledby="cookies-types-heading"
    >
      <div class="mx-auto max-w-rail px-gutter py-section">
        <div class="flex flex-col gap-3 pb-12 lg:max-w-[440px]">
          <p class="text-eyebrow font-body uppercase text-ink-500">
            Types we use
          </p>
          <h2
            id="cookies-types-heading"
            class="font-display text-display-md font-normal text-ink-950"
          >
            Four categories, plainly explained.
          </h2>
        </div>

        <ul class="grid grid-cols-1 gap-x-[30px] gap-y-[30px] md:grid-cols-2 lg:grid-cols-4">
          <li
            v-for="type in types"
            :key="type.id"
            class="flex flex-col gap-3 bg-cream-warm p-8"
          >
            <h3 class="font-display text-display-sm font-normal text-ink-950">
              {{ type.label }}
            </h3>
            <p class="font-body text-body text-ink-700">
              {{ type.body }}
            </p>
          </li>
        </ul>
      </div>
    </section>

    <!-- ============================================================
         3. Long-form sections
         ============================================================ -->
    <section
      class="bg-cream-warm"
      aria-labelledby="cookies-body-heading"
    >
      <div class="mx-auto grid max-w-rail grid-cols-1 gap-x-[30px] gap-y-12 px-gutter py-section lg:grid-cols-[minmax(0,0.3fr)_minmax(0,0.7fr)]">
        <h2 id="cookies-body-heading" class="sr-only">
          Cookies policy details
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
