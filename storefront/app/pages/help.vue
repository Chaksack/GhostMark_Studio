<script setup lang="ts">
import { ref } from 'vue'
import {
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
} from '@headlessui/vue'

/**
 * /help: Help Center landing page.
 *
 * Editorial cream + serif aesthetic, modeled on merchery's content pages.
 * Composition:
 *   - Hero with eyebrow + Fraunces headline + visual-only search input.
 *   - 6-up topic tile grid linking to category routes (`/help/<slug>`).
 *   - Searchable-style FAQ accordion built on Headless UI <Disclosure>,
 *     with a max-height + opacity panel transition guarded by
 *     `motion-reduce:transition-none`.
 *   - Sage-band CTA pointing at /contact.
 *
 * No backend wiring, every list is a typed, in-page stub. Topic links
 * resolve to deep-linked category pages once those exist; until then they
 * simply 404 gracefully via Nuxt's default handler.
 */

useHead({
  title: 'Help center · GhostMark Studio',
  meta: [
    {
      name: 'description',
      content:
        'Find answers about orders, shipping, returns, payments, and custom design files. Browse popular questions or get in touch with our team.',
    },
  ],
})

interface HelpTopic {
  slug: string
  title: string
  blurb: string
}

interface HelpQuestion {
  id: string
  title: string
  body: string
}

const search = ref<string>('')

const topics: HelpTopic[] = [
  {
    slug: 'orders',
    title: 'Orders & shipping',
    blurb: 'Track an order, change a delivery address, or see lead times by region.',
  },
  {
    slug: 'returns',
    title: 'Returns',
    blurb: 'How returns work for stocked styles versus made-to-order custom runs.',
  },
  {
    slug: 'payments',
    title: 'Payments',
    blurb: 'Accepted methods, invoicing for businesses, and payment timing on production.',
  },
  {
    slug: 'account',
    title: 'Account',
    blurb: 'Sign-in trouble, address book, saved designs, and team permissions.',
  },
  {
    slug: 'custom-design',
    title: 'Custom design files',
    blurb: 'Accepted file formats, color modes, bleed and the proofing workflow.',
  },
  {
    slug: 'contact',
    title: 'Contact us',
    blurb: 'Reach a human for anything our help articles do not cover.',
  },
]

const questions: HelpQuestion[] = [
  {
    id: 'q-shipping-time',
    title: 'How long does shipping take?',
    body: 'Standard EU and UK delivery lands in 3–5 working days from dispatch. North America runs 4–7 working days, and rest-of-world is 7–10. Custom production adds 5–10 working days before dispatch.',
  },
  {
    id: 'q-cancel',
    title: 'Can I cancel my order?',
    body: 'Stocked items can be cancelled any time before they leave the warehouse. Custom runs can only be cancelled before we send the digital proof. Once you approve a proof, we begin production.',
  },
  {
    id: 'q-files',
    title: 'What file formats do you accept for custom designs?',
    // Corrected against the live dropzone rather than against intent.
    //
    // The previous answer had the product exactly backwards: it said vector
    // files were BEST (".ai, .eps, .pdf, or .svg") and treated PNG as the
    // fallback. The editor refuses all four. `ACCEPTED_MIME` is
    // ['image/png','image/jpeg','image/webp'] (DesignEditor.vue:363), the input
    // carries accept="image/png,image/jpeg,image/webp" (:1137), and
    // MAX_UPLOAD_BYTES is 10 * 1024 * 1024 (:569). So this page's headline
    // recommendation was the one thing guaranteed to fail, and the customer got
    // a rejection naming MIME types while the help page named extensions.
    //
    // Raster is what you upload; vector is what you cannot upload; vectorisation
    // is a free service the studio performs FOR you. That is also what the
    // dropzone, the hero strip and the FAQ already say, this page was the last
    // surface still contradicting them.
    //
    // Wording is deliberately word-identical to the dropzone's own format line
    // ("PNG, JPEG or WebP · up to 10 MB", DesignEditor.vue:1518) so a customer
    // reading help and then seeing the uploader gets the same sentence twice.
    //
    // 300 DPI is kept because it is a real house standard, verified not assumed
    // (`DEFAULT_DPI = 300`, ghostmark/src/utils/units.ts:4; the editor's
    // print-quality readout uses MIN_PRINT_DPI = 300 sourced from this very
    // line). It is deliberately NOT attached to a physical print size: the
    // editor works in a 600x800 virtual pixel space and a physical dimension
    // only exists when a merchant supplies an optional `print_size`. Promising
    // "300 DPI at 30 x 40 cm" on a print service would be a fabricated spec and
    // a refund, so the guidance is the honest one: send the largest file you
    // have.
    body: 'The customiser takes PNG, JPEG or WebP · up to 10 MB. Upload the largest version you have. We target 300 DPI at print size, so more pixels is always better. Vector files (AI, EPS, PDF, SVG) go to the artwork team rather than the uploader: send them with your order and we will vectorise at no charge. Convert type to outlines first so we render the exact letterforms you signed off on.',
  },
  {
    id: 'q-where',
    title: 'Where do you ship to?',
    body: 'We ship worldwide from fulfillment hubs in Antwerp, Berlin and Brooklyn. A short list of countries is restricted by carrier policy. Checkout will tell you immediately if your address is supported.',
  },
  {
    id: 'q-returns',
    title: 'How do returns work?',
    body: 'Stocked styles can be returned within 30 days, unworn, in the original packaging. Custom runs are non-returnable except for production defects, which we replace at our cost on confirmation.',
  },
  {
    id: 'q-bulk',
    title: 'Do you offer bulk discounts?',
    body: 'Yes, pricing tiers kick in automatically at 25, 50, 100 and 250 units, and we can quote bespoke pricing on anything over 500. Drop the brief in our contact form for a same-day quote.',
  },
  {
    id: 'q-charge',
    title: 'When am I charged?',
    body: 'Stocked orders are charged at checkout. Custom runs are 50% on proof approval and 50% on dispatch. Invoicing on net-30 terms is available for established business accounts.',
  },
  {
    id: 'q-track',
    title: 'How do I track my order?',
    body: 'Every dispatch email includes a tracking link routed through your local carrier. Logged-in customers can also see live status under Account → Orders without leaving the site.',
  },
]
</script>

<template>
  <div>
    <!-- Hero: eyebrow, serif headline, visual-only search field. -->
    <section
      class="bg-cream-warm text-ink-950"
      aria-labelledby="help-hero"
    >
      <div class="mx-auto max-w-rail px-gutter py-section">
        <div class="mx-auto max-w-[760px] text-center">
          <p
            class="text-eyebrow font-body uppercase text-ink-500"
          >
            Help center
          </p>
          <h1
            id="help-hero"
            class="mt-4 font-display text-display-lg font-normal leading-[1.02] tracking-[-0.02em] text-ink-950"
          >
            How can we help?
          </h1>
          <p
            class="mx-auto mt-5 max-w-[55ch] font-body text-body text-ink-700"
          >
            Browse the most common questions, dive into a topic, or talk to a
            human. We answer every email within one working day.
          </p>

          <form
            class="mx-auto mt-10 max-w-[560px]"
            role="search"
            aria-label="Search the help center"
            @submit.prevent
          >
            <UiField label="Search the help center">
              <UiInput
                v-model="search"
                type="search"
                size="lg"
                placeholder="Search the help center..."
                autocomplete="off"
              />
            </UiField>
          </form>
        </div>
      </div>
    </section>

    <!-- Topic tiles: 6-up grid of cream-tile cards. -->
    <section
      class="bg-cream-50 text-ink-950"
      aria-labelledby="help-topics"
    >
      <div class="mx-auto max-w-rail px-gutter py-section">
        <div class="flex flex-col gap-3">
          <p class="text-eyebrow font-body uppercase text-ink-500">
            Topics
          </p>
          <h2
            id="help-topics"
            class="font-display text-display-sm font-normal text-ink-950"
          >
            Find what you need
          </h2>
        </div>

        <ul
          class="mt-12 grid grid-cols-1 gap-x-[30px] gap-y-16 md:grid-cols-3"
        >
          <li v-for="topic in topics" :key="topic.slug">
            <NuxtLink
              :to="`/help/${topic.slug}`"
              class="group block h-full bg-cream-tile p-8 transition-colors duration-base ease-emphasis hover:bg-cream-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900 focus-visible:ring-offset-2 focus-visible:ring-offset-cream-50 motion-reduce:transition-none"
            >
              <h3
                class="font-display text-[28px] font-normal leading-[1.1] tracking-[-0.01em] text-ink-950"
              >
                {{ topic.title }}
              </h3>
              <p
                class="mt-3 font-body text-caption text-ink-700"
              >
                {{ topic.blurb }}
              </p>
              <span
                aria-hidden="true"
                class="mt-6 inline-flex items-center gap-2 font-body text-caption text-ink-950 underline decoration-dashed decoration-ink-400 underline-offset-4 transition-colors duration-base group-hover:decoration-ink-950 motion-reduce:transition-none"
              >
                Read articles
                <span class="translate-y-[-1px]">&rarr;</span>
              </span>
            </NuxtLink>
          </li>
        </ul>
      </div>
    </section>

    <!-- Popular questions: Headless UI Disclosure accordion. -->
    <section
      class="bg-cream-warm text-ink-950"
      aria-labelledby="help-popular"
    >
      <div class="mx-auto max-w-rail px-gutter py-section">
        <div class="grid gap-12 lg:grid-cols-[0.4fr_0.6fr]">
          <div class="flex flex-col gap-3">
            <p class="text-eyebrow font-body uppercase text-ink-500">
              Popular questions
            </p>
            <h2
              id="help-popular"
              class="font-display text-display-sm font-normal text-ink-950"
            >
              Quick answers
            </h2>
            <p class="mt-2 font-body text-body text-ink-700">
              The eight things customers ask us most. If yours is not here,
              the
              <NuxtLink
                to="/contact"
                class="underline decoration-dashed decoration-ink-400 underline-offset-4 transition-colors duration-base hover:decoration-ink-950 hover:text-ink-950 motion-reduce:transition-none"
              >
                contact form
              </NuxtLink>
              is the fastest path to a human.
            </p>
          </div>

          <div class="border-t border-ink-200">
            <Disclosure
              v-for="q in questions"
              :key="q.id"
              v-slot="{ open: isOpen }"
              as="div"
              class="border-b border-ink-200"
            >
              <DisclosureButton
                class="flex w-full items-center justify-between gap-6 py-6 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900 focus-visible:ring-offset-2 focus-visible:ring-offset-cream-warm"
              >
                <span
                  class="font-display text-[20px] font-normal leading-[1.2] tracking-[-0.005em] text-ink-950"
                >
                  {{ q.title }}
                </span>
                <svg
                  :class="[
                    'h-4 w-4 shrink-0 text-ink-700 transition-transform duration-base ease-emphasis motion-reduce:transition-none',
                    isOpen && 'rotate-180',
                  ]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </DisclosureButton>
              <transition
                enter-active-class="transition-[max-height,opacity] duration-base ease-emphasis overflow-hidden motion-reduce:transition-none"
                enter-from-class="max-h-0 opacity-0"
                enter-to-class="max-h-[400px] opacity-100"
                leave-active-class="transition-[max-height,opacity] duration-fast ease-emphasis overflow-hidden motion-reduce:transition-none"
                leave-from-class="max-h-[400px] opacity-100"
                leave-to-class="max-h-0 opacity-0"
              >
                <DisclosurePanel
                  class="pb-6 pr-10 font-body text-body text-ink-700"
                >
                  {{ q.body }}
                </DisclosurePanel>
              </transition>
            </Disclosure>
          </div>
        </div>
      </div>
    </section>

    <!-- Sage CTA band: still need help. -->
    <section
      class="bg-merchery-sage text-ink-950"
      aria-labelledby="help-cta"
    >
      <div class="mx-auto max-w-rail px-gutter py-section">
        <div
          class="flex flex-col items-start gap-8 lg:flex-row lg:items-center lg:justify-between"
        >
          <div class="max-w-[680px]">
            <p class="text-eyebrow font-body uppercase text-ink-700">
              Still need help?
            </p>
            <h2
              id="help-cta"
              class="mt-3 font-display text-display-md font-normal leading-[1.05] tracking-[-0.015em] text-ink-950"
            >
              Talk to a real person.
            </h2>
            <p class="mt-4 font-body text-body text-ink-700">
              Our studio team replies in plain language, usually within a few
              hours. No bots, no scripted answers, just people who know the
              product.
            </p>
          </div>
          <UiButton
            as="NuxtLink"
            to="/contact"
            variant="merchery"
            size="lg"
            shape="square"
          >
            Contact the team
          </UiButton>
        </div>
      </div>
    </section>
  </div>
</template>
