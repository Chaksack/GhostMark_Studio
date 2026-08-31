<template>
  <!--
    AppFooter: single source of truth for the global footer band.

    Layout contract (intentionally rigid so home / PLP / PDP all match):
      - Surface: bg-offWhite (warm editorial off-white from the merchery
        palette). Top hairline uses border-greyLines.
      - Columns: 5 fixed sections rendered in every state (no v-if drift).
        Grid responds 2 → 3 → 5 across mobile / tablet / desktop, so the
        footer height stays bounded:
          mobile (<768)  : 2 cols × 3 rows ≈ ≤700px
          tablet (768)   : 3 cols × 2 rows ≈ ≤500px
          desktop (1024+): 5 cols × 1 row  ≈ ≤450px
      - Bottom bar: copyright + locale on the left, social + legal +
        payment chips on the right, hairline-divided by border-greyLines.

    Authentication / locale / cart state MUST NOT add or remove columns
    here: they belong in the bottom bar. Adding a sixth section breaks
    the 5-column desktop rhythm and re-introduces the cross-page drift
    reviewers reported.
  -->
  <footer class="border-t border-greyLines bg-offWhite">
    <!--
      Brand block: anchors the bottom of every page with the GhostMark
      wordmark + a one-line studio summary on the left, and a "Get in
      touch" contact group on the right. Hairline divider keeps it
      visually attached to the column grid below without doubling the
      border weight. Stacks vertically <md so the wordmark + contact
      both have the full content width on narrow handsets.
    -->
    <div
      class="mx-auto w-full max-w-rail px-gutter pt-12 md:pt-16 lg:pt-20"
    >
      <div class="flex flex-col md:flex-row md:items-end md:justify-between gap-6 pb-8 border-b border-greyLines">
        <div class="flex flex-col gap-3 max-w-[480px]">
          <NuxtLink
            to="/"
            class="inline-flex min-h-[44px] items-center font-display text-[34px] font-extrabold leading-none tracking-[0.2px] text-ink-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-950 focus-visible:ring-offset-2 focus-visible:ring-offset-offWhite rounded-sm"
            aria-label="GhostMark home"
          >
            GhostMark
          </NuxtLink>
          <p class="text-[14px] leading-[1.6] text-ink-700">
            Branded objects for the kind of work people keep. Laser
            engraving, DTF print, and apparel finishing, one studio in
            Bordeaux.
          </p>
        </div>
        <div class="flex flex-col gap-2">
          <p class="text-[12px] uppercase tracking-[0.12em] text-ink-700">
            Get in touch
          </p>
          <a
            href="mailto:hello@ghostmark.studio"
            class="inline-flex min-h-[44px] items-center text-[15px] font-medium text-ink-950 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-950 focus-visible:ring-offset-2 focus-visible:ring-offset-offWhite rounded-sm"
          >
            hello@ghostmark.studio
          </a>
          <p class="text-[13px] text-ink-700">
            Studio · Bordeaux, France
          </p>
        </div>
      </div>
    </div>

    <!--
      Social row + region marker (v18 audit). Sits between the brand
      block and the 5-column link grid as a single hairline-bounded
      strip: "FOLLOW US" + iconography on the left, "Based in Bordeaux"
      on the right. Stacks vertically <md so the icons keep their
      44×44 hit targets without being crowded by the region line.
    -->
    <div
      class="mx-auto w-full max-w-rail px-gutter pt-6"
    >
      <div
        class="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-greyLines"
      >
        <div class="flex items-center gap-3">
          <span class="text-[12px] uppercase tracking-[0.12em] text-ink-700">Follow us</span>
          <ul class="flex items-center gap-1" role="list">
            <li>
              <a
                href="https://instagram.com/ghostmarkstudio"
                aria-label="Instagram"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-sm text-ink-700 hover:text-ink-950 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-950 focus-visible:ring-offset-2 focus-visible:ring-offset-offWhite"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                  focusable="false"
                >
                  <rect x="3" y="3" width="18" height="18" rx="5" />
                  <path d="M16 11.4A4 4 0 1 1 12.6 8 4 4 0 0 1 16 11.4z" />
                  <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
                </svg>
              </a>
            </li>
            <li>
              <a
                href="https://www.linkedin.com/company/ghostmarkstudio"
                aria-label="LinkedIn"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-sm text-ink-700 hover:text-ink-950 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-950 focus-visible:ring-offset-2 focus-visible:ring-offset-offWhite"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path d="M4 4h4v4H4zM4 10h4v10H4zM10 10h4v2a3 3 0 0 1 6 0v8h-4v-7a1.5 1.5 0 0 0-3 0v7h-3z" />
                </svg>
              </a>
            </li>
            <li>
              <a
                href="https://pinterest.com/ghostmarkstudio"
                aria-label="Pinterest"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-sm text-ink-700 hover:text-ink-950 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-950 focus-visible:ring-offset-2 focus-visible:ring-offset-offWhite"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path d="M12 3a9 9 0 0 0-3.3 17.4c-.1-.7-.2-1.9 0-2.7l1.3-5.4s-.3-.7-.3-1.6c0-1.5.9-2.6 2-2.6.9 0 1.4.7 1.4 1.5 0 .9-.6 2.3-.9 3.6-.3 1.1.5 2 1.6 2 1.9 0 3.4-2 3.4-5 0-2.6-1.9-4.4-4.5-4.4-3.1 0-4.9 2.3-4.9 4.7 0 .9.4 1.9.8 2.5.1.1.1.2.1.3l-.3 1.2c0 .2-.2.2-.4.1-1.3-.6-2.1-2.5-2.1-4 0-3.3 2.4-6.3 6.9-6.3 3.6 0 6.4 2.6 6.4 6 0 3.6-2.3 6.5-5.5 6.5-1.1 0-2.1-.6-2.4-1.2l-.7 2.5c-.2 1-.9 2.2-1.4 3A9 9 0 1 0 12 3z" />
                </svg>
              </a>
            </li>
          </ul>
        </div>
        <p class="text-[13px] text-ink-700">
          Based in <span class="text-ink-950 font-medium">Bordeaux</span>. Designs shipped worldwide.
        </p>
      </div>
    </div>

    <div
      class="mx-auto w-full max-w-rail px-gutter py-10 md:py-14 lg:py-16"
    >
      <!--
        Mobile (<768): collapsible accordion. Each section ships closed so
        the visible footer height stays bounded (~520px instead of 1000+).
        Tap the heading to expand only what you need.
      -->
      <div class="md:hidden divide-y divide-greyLines border-y border-greyLines">
        <details
          v-for="section in sections"
          :key="`m-${section.heading}`"
          class="group"
        >
          <summary
            class="flex min-h-[44px] cursor-pointer items-center justify-between py-3 text-[12px] font-medium uppercase tracking-[0.12em] text-ink-950 marker:hidden [&::-webkit-details-marker]:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-950 focus-visible:ring-offset-2 focus-visible:ring-offset-offWhite rounded-sm"
          >
            <span>{{ section.heading }}</span>
            <svg
              class="h-3 w-3 text-ink-700 transition-transform group-open:rotate-180"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              aria-hidden="true"
            >
              <path d="M2 4l4 4 4-4" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </summary>
          <ul class="pb-2">
            <li
              v-for="link in section.links"
              :key="`m-${link.to}-${link.label}`"
            >
              <NuxtLink
                :to="link.to"
                class="flex min-h-[44px] items-center py-2 text-[14px] text-ink-700 hover:text-ink-950 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-950 focus-visible:ring-offset-2 focus-visible:ring-offset-offWhite rounded-sm"
              >
                {{ link.label }}
              </NuxtLink>
            </li>
          </ul>
        </details>
      </div>

      <!--
        Tablet+ (≥768): open grid. 3 columns at 768, 5 at 1024+. Five
        deterministic sections, no v-if drift across pages.
      -->
      <nav
        class="hidden md:grid md:grid-cols-3 lg:grid-cols-5 gap-6 md:gap-8 lg:gap-12"
        aria-label="Footer"
      >
        <div
          v-for="section in sections"
          :key="section.heading"
        >
          <h4
            class="text-[12px] font-medium uppercase tracking-[0.12em] text-ink-700 mb-3 whitespace-nowrap"
          >
            {{ section.heading }}
          </h4>
          <ul>
            <li
              v-for="link in section.links"
              :key="link.to + link.label"
            >
              <NuxtLink
                :to="link.to"
                class="flex min-h-[44px] items-center py-2 text-[14px] text-ink-700 hover:text-ink-950 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-950 focus-visible:ring-offset-2 focus-visible:ring-offset-offWhite rounded-sm"
              >
                {{ link.label }}
              </NuxtLink>
            </li>
          </ul>
        </div>
      </nav>

      <!--
        Trust + payments band (v18 audit). Replaces the previous
        Certified-B / 1% For The Planet pair, those certifications
        are not held yet, so we surface neutral provenance markers
        until the real audits land. Payment marks are TEXT, not
        brand SVGs, to avoid licensing risk before Stripe Connect
        is wired and a usage-rights review is on file.
      -->
      <div
        class="mt-10 pt-6 border-t border-greyLines flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
      >
      <!--
        These provenance chips carry NO aria-label, and that is deliberate.
        They used to. It was `aria-label="Made in Europe"` on a bare <span>
        whose visible text already read "Made in Europe" — so the attribute
        was both redundant AND non-conforming: a <span> is role=generic,
        which cannot take an accessible name, so browsers were free to drop
        it. Removing it is strictly better than making it conform with a
        role: the visible text is already the content, and the icon beside
        it is already aria-hidden. Do not add them back.
      -->
        <div class="flex items-center gap-3 flex-wrap">
          <span
            class="gm-spec inline-flex items-center gap-2 rounded border border-greyLines bg-offWhiteLight px-3 py-2 text-ink-700"
          >
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              stroke-width="1.75"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M12 22s-8-4.5-8-12V5l8-3 8 3v5c0 7.5-8 12-8 12z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
            Made in Europe
          </span>
          <span
            class="gm-spec inline-flex items-center gap-2 rounded border border-greyLines bg-offWhiteLight px-3 py-2 text-ink-700"
          >
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              stroke-width="1.75"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
              focusable="false"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
            Family-owned in Bordeaux
          </span>
          <span
            class="gm-spec inline-flex items-center gap-2 rounded border border-greyLines bg-offWhiteLight px-3 py-2 text-ink-700"
          >
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              stroke-width="1.75"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M3 12c2-3 6-6 9-6s7 3 9 6c-2 3-6 6-9 6s-7-3-9-6z" />
              <path d="M12 9v6" />
            </svg>
            Carbon-aware shipping
          </span>
        </div>

        <div class="flex items-center gap-3 flex-wrap">
          <span
            class="gm-spec text-ink-700"
          >Secure payments</span>
          <div class="flex items-center gap-2 flex-wrap" role="list" aria-label="Accepted payment methods">
            <span
              v-for="brand in payments"
              :key="brand"
              role="listitem"
              class="gm-spec rounded border border-greyLines bg-offWhiteLight px-3 py-1.5 text-ink-700"
            >{{ brand }}</span>
          </div>
        </div>
      </div>

      <!--
        Bottom bar: copyright + region/currency picker on the left,
        social icons + legal links on the right. RegionSelector is the
        canonical region/currency control (UiSheet-backed); the GeoModal
        is the first-visit suggestion overlay and is intentionally not
        the trigger here.
      -->
      <div
        class="mt-8 pt-6 border-t border-greyLines flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-[12px] text-ink-500"
      >
        <div class="flex flex-wrap items-center gap-4">
          <p>
            &copy; {{ year }} GhostMark Studio &middot; Bordeaux, France
          </p>
          <span class="hidden sm:inline-block h-3 w-px bg-greyLines" aria-hidden="true" />
          <!--
            Region trigger: the ONLY region/currency control in the storefront.

            History, because the previous comment here was wrong and cost us a
            shipped defect: this used to be `<NuxtLink to="/?region=open">`,
            justified by "RegionSelector's `useRegion()` contract (loadRegions /
            setRegion) does not yet match the live composable shape". That claim
            is stale: `useRegion.ts:177` returns
            `{ regionId, region, regions, loadRegions, ensureRegion, setRegion }`
            and `RegionSelector.vue:33` destructures four of those six. The
            contract matches exactly; the refactor it was waiting on landed.

            Worse, nothing ever claimed `?region=open`. Grepping `region=open`,
            `query.region` and `route.query.region` across `app/` returned
            exactly one hit: the link that emitted it. GeoModal reads no query
            at all: it is the first-visit suggestion overlay only. So the
            control rendered on every page, had a 44px hit area and a correct
            aria-label, and did nothing but navigate to the homepage.

            Net effect while that placeholder shipped: the footer says Bordeaux,
            the catalogue prices in GBP, and a customer who wanted EUR had no
            path to it on ANY viewport. RegionSelector (the one component that
            actually calls `setRegion()`) was mounted only in AppMobileNav.vue,
            which has zero live references (AppHeader.vue:345 renders
            MobileNav.vue instead), so it never rendered.

            Pattern: footer/utility trigger opening a right-side sheet that pairs
            country name with currency code. That is lululemon's web treatment
            (right drawer, "Select your location", currency right-aligned per
            row) and Selfridges' pairing ("United Kingdom / GBP £"), both via
            Mobbin. RegionSelector already implements exactly this,
            `side="right"`, `title="Choose your region"`, display_name left /
            currency_code right, so this is a mount, not a redesign.
          -->
          <RegionSelector variant="meta" />
        </div>
        <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
          <div class="flex items-center gap-1">
            <a
              v-for="social in socials"
              :key="social.label"
              :href="social.href"
              :aria-label="social.label"
              rel="noopener noreferrer"
              target="_blank"
              class="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-sm text-ink-500 hover:text-ink-950 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-950 focus-visible:ring-offset-2 focus-visible:ring-offset-offWhite"
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
                focusable="false"
              >
                <path :d="social.path" />
                <circle
                  v-if="social.dot"
                  :cx="social.dot.cx"
                  :cy="social.dot.cy"
                  :r="social.dot.r"
                  fill="currentColor"
                  stroke="none"
                />
              </svg>
            </a>
          </div>
          <span class="hidden sm:inline-block h-3 w-px bg-greyLines mx-1" aria-hidden="true" />
          <NuxtLink
            to="/privacy"
            class="inline-flex min-h-[44px] items-center px-2 py-2 hover:text-ink-950 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-950 focus-visible:ring-offset-2 focus-visible:ring-offset-offWhite rounded-sm"
          >
            Privacy
          </NuxtLink>
          <NuxtLink
            to="/terms"
            class="inline-flex min-h-[44px] items-center px-2 py-2 hover:text-ink-950 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-950 focus-visible:ring-offset-2 focus-visible:ring-offset-offWhite rounded-sm"
          >
            Terms
          </NuxtLink>
          <NuxtLink
            to="/cookies"
            class="inline-flex min-h-[44px] items-center px-2 py-2 hover:text-ink-950 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-950 focus-visible:ring-offset-2 focus-visible:ring-offset-offWhite rounded-sm"
          >
            Cookies
          </NuxtLink>
        </div>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
/**
 * Footer copy lives in `sections` so the column count is deterministic:
 * exactly five entries, top-to-bottom in the order they should ship.
 * Add / remove links inside a section freely; do NOT add a sixth section
 * without also bumping the desktop grid (currently lg:grid-cols-5).
 */
type FooterLink = { to: string, label: string }
type FooterSection = { heading: string, links: FooterLink[] }

const sections: FooterSection[] = [
  {
    heading: 'Company',
    links: [
      { to: '/about', label: 'About us' },
      { to: '/sustainability', label: 'Sustainability' },
      { to: '/about/value-chain', label: 'Value chain' },
      { to: '/about/people-and-culture', label: 'People & culture' },
      { to: '/press', label: 'Press' },
    ],
  },
  {
    heading: 'Shop',
    links: [
      { to: '/products', label: 'Shop all' },
      { to: '/platform', label: 'Platform' },
      { to: '/club', label: 'Club & agencies' },
      { to: '/blog', label: 'Journal' },
    ],
  },
  {
    heading: 'Help',
    links: [
      { to: '/help', label: 'Help center' },
      { to: '/faq', label: 'FAQ' },
      { to: '/shipping', label: 'Shipping' },
      { to: '/returns', label: 'Returns' },
      { to: '/contact', label: 'Contact us' },
    ],
  },
  {
    heading: 'Account',
    links: [
      { to: '/account', label: 'Preferences' },
      { to: '/account/orders', label: 'Orders' },
      { to: '/account/orders', label: 'Invoices' },
      { to: '/wishlist', label: 'Saved projects' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { to: '/terms', label: 'Terms & conditions' },
      { to: '/privacy', label: 'Privacy policy' },
      { to: '/cookies', label: 'Cookies' },
      { to: '/accessibility', label: 'Accessibility' },
    ],
  },
]

/**
 * Text-only payment marks (v18 audit). We render the brand names as
 * plain text inside neutral chips rather than vendor SVGs because we
 * do not yet hold explicit usage rights for the Visa / Mastercard /
 * Amex / PayPal / Apple Pay logos. Once Stripe Connect is wired and
 * the brand-asset license review is on file, swap to real glyphs.
 */
const payments = ['VISA', 'MC', 'AMEX', 'PAYPAL', 'APPLE PAY'] as const

/**
 * Social icons rendered inline as compact SVGs, no external icon
 * library, no font load. Each entry carries an explicit `aria-label`
 * (the visible glyph is decorative). The path/dot tuple keeps the SVG
 * markup uniform; `dot` is only used by the Instagram glyph.
 */
type SocialIcon = {
  label: string
  href: string
  path: string
  dot?: { cx: number, cy: number, r: number }
}

const socials: SocialIcon[] = [
  {
    label: 'Instagram',
    href: 'https://instagram.com/ghostmarkstudio',
    path: 'M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4zm5 5.5A3.5 3.5 0 1 0 12 15.5 3.5 3.5 0 0 0 12 8.5z',
    dot: { cx: 17.5, cy: 6.5, r: 0.9 },
  },
  {
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/company/ghostmarkstudio',
    path: 'M4 4h4v4H4zM4 10h4v10H4zM10 10h4v2a3 3 0 0 1 6 0v8h-4v-7a1.5 1.5 0 0 0-3 0v7h-3z',
  },
  {
    label: 'Pinterest',
    href: 'https://pinterest.com/ghostmarkstudio',
    path: 'M12 3a9 9 0 0 0-3.3 17.4c-.1-.7-.2-1.9 0-2.7l1.3-5.4s-.3-.7-.3-1.6c0-1.5.9-2.6 2-2.6.9 0 1.4.7 1.4 1.5 0 .9-.6 2.3-.9 3.6-.3 1.1.5 2 1.6 2 1.9 0 3.4-2 3.4-5 0-2.6-1.9-4.4-4.5-4.4-3.1 0-4.9 2.3-4.9 4.7 0 .9.4 1.9.8 2.5.1.1.1.2.1.3l-.3 1.2c0 .2-.2.2-.4.1-1.3-.6-2.1-2.5-2.1-4 0-3.3 2.4-6.3 6.9-6.3 3.6 0 6.4 2.6 6.4 6 0 3.6-2.3 6.5-5.5 6.5-1.1 0-2.1-.6-2.4-1.2l-.7 2.5c-.2 1-.9 2.2-1.4 3A9 9 0 1 0 12 3z',
  },
  {
    label: 'X (formerly Twitter)',
    href: 'https://x.com/ghostmarkstudio',
    path: 'M3 3l7.5 9.6L3.4 21h2.3l5.9-7 5.4 7H21l-7.9-10.2L20.4 3h-2.3l-5.4 6.3L7.6 3z',
  },
]

const year = new Date().getFullYear()

/*
 * The `regionLabel` computed that used to live here is gone, along with the
 * `useRegion()` call that fed it. It rendered a read-only "EN · GBP" beside a
 * dead link; RegionSelector now owns both the label and the switch, and
 * derives the same `EN · <CURRENCY>` shape from the same composable
 * (RegionSelector.vue `pillLabel`, variant="meta"). Keeping a second copy here
 * would be two sources of truth for one string.
 */
</script>
