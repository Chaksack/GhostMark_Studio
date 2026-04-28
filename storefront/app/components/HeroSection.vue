<template>
  <!--
    Full-bleed image-led hero, merchery.co cadence.
    Photo is the LCP; copy overlays as caption + sans H1 + CTAs.
    Dark gradient guarantees WCAG contrast for white text.
    Figcaption visible at every breakpoint — only branded mark on the photo.
  -->
  <!--
    Hero stacking: the section is the figcaption's containing block.
    `isolate` opens a fresh stacking context so the absolutely-positioned
    figcaption (z-10) cannot bleed past the section bounds and over the
    sticky/fixed AppHeader bands (mobile z-50, desktop z-20).
  -->
  <section class="relative isolate z-0 w-full overflow-hidden bg-ink-950">
    <div
      class="relative h-[640px] min-h-[640px] w-full md:h-[700px] lg:h-[calc(100vh-118px)] lg:min-h-[640px]"
    >
      <NuxtPicture
        src="https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=1600&q=85&fit=crop&crop=entropy&auto=format"
        alt="Model wearing the Atelier Hoodie in cream — GhostMark Studio editorial hero"
        preset="hero"
        sizes="100vw lg:50vw xl:50vw 2xl:960px"
        loading="eager"
        :preload="{ fetchPriority: 'high' }"
        width="1600"
        height="2133"
        :img-attrs="{
          fetchpriority: 'high',
          decoding: 'async',
          class: 'absolute inset-0 h-full w-full object-cover object-center',
        }"
      />

      <!-- Gradient overlay so white type clears the photograph at AAA -->
      <div
        class="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-black/25 to-black/15"
        aria-hidden="true"
      />

      <!-- Eyebrow, top-left -->
      <!--
        13px floor across the board: 12px previously violated WCAG 2.1 AA body
        floor on mobile devices. The existing sm: bump becomes redundant — keep
        a single value to flatten the cascade.
      -->
      <span
        class="absolute left-gutter top-6 z-10 text-[13px] font-medium uppercase tracking-[0.18em] text-white/85 sm:top-8 lg:top-10"
      >
        Studio &mdash; est. Bordeaux
      </span>

      <!--
        Headline + dual-path CTAs, bottom-left.
        Mobile clamp: 2.6rem floor at 320 keeps "Objects we make for you." to
        three lines max in the 280px text rail (320 viewport - 2x20px gutter).
        Steps up to 3.4rem at 360+, then 4.4rem at md, 7rem at lg as before.
      -->
      <div class="absolute bottom-8 left-gutter right-gutter z-10 max-w-[1040px] sm:bottom-10 lg:bottom-14">
        <h1
          class="text-[2.6rem] font-normal leading-[2.9rem] tracking-[-0.015em] text-white sm:text-[3.4rem] sm:leading-[3.7rem] md:text-[4.4rem] md:leading-[4.8rem] lg:text-[7rem] lg:leading-[7.4rem]"
        >
          Objects we design. Objects we make for you.
        </h1>
        <p class="mt-5 max-w-[560px] text-[13px] leading-[1.55] text-white/85 sm:mt-6 sm:text-[15px] sm:leading-[1.6]">
          Shop the Studio Canon &mdash; or bring your artwork. From &pound;18 / piece, MOQ 25 on
          custom &middot; POD on the rest.
        </p>
        <div class="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row">
          <!--
            Primary CTA — D2C apparel catalogue. White-filled per design-system
            CTA hierarchy: high-emphasis for the buy-as-is path that converts
            today, no upload step required.
          -->
          <NuxtLink
            to="/shop"
            class="group inline-flex h-12 min-w-[200px] items-center justify-center gap-2 rounded-[0.25rem] bg-white px-6 text-[14px] font-medium uppercase tracking-[0.04em] text-ink-950 transition-colors duration-fast ease-emphasis hover:bg-cream-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950"
            aria-label="Shop the Studio Canon — apparel sold as-is"
          >
            Shop the Studio Canon
            <svg
              class="h-3.5 w-3.5 transition-transform duration-fast ease-emphasis group-hover:translate-x-1"
              viewBox="0 0 16 16"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <path d="M2 8h12M9 3l5 5-5 5" />
            </svg>
          </NuxtLink>
          <!--
            Secondary CTA — POD-type catalogue. Object syntax preferred over a
            string href so Nuxt's router builds the URL deterministically and
            we don't have to think about encoding edge cases. Lands on
            /products?type=pod — the PLP filters by product.type.value === 'pod'.
          -->
          <NuxtLink
            :to="{ path: '/products', query: { type: 'pod' } }"
            class="inline-flex h-12 min-w-[200px] items-center justify-center gap-2 rounded-[0.25rem] border border-white/80 bg-white/0 px-6 text-[14px] font-medium uppercase tracking-[0.04em] text-white transition-colors duration-fast ease-emphasis hover:bg-white hover:text-ink-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950"
            aria-label="Customise and print on demand — upload your artwork"
          >
            Customise &amp; POD
          </NuxtLink>
        </div>

        <!--
          Mini value-prop strip — names BOTH product-type flows so the dual-mode
          storefront is legible at a glance.
          Mobile (≤sm): collapsed to 2 props to avoid one-per-line wrap at 360px.
            Both modes still get a mention via the "Apparel from £18" /
            "Custom from MOQ 25" pair.
          sm+: full 3-prop strip surfaces with the e-proof reassurance.
          Sizes meet WCAG 2.1 AA body floor (≥13px) on small screens.
        -->
        <div
          class="mt-8 flex flex-wrap gap-x-4 gap-y-2 text-[13px] uppercase tracking-[0.1em] text-white/85 sm:gap-x-6 sm:text-[14px]"
        >
          <span>Designed in Bordeaux</span>
          <span aria-hidden="true">&middot;</span>
          <span>Apparel from &pound;18</span>
          <span aria-hidden="true">&middot;</span>
          <span class="sm:hidden">Custom MOQ 25</span>
          <span class="hidden sm:inline">Custom from MOQ 25</span>
          <span class="hidden sm:inline" aria-hidden="true">&middot;</span>
          <span class="hidden sm:inline">E-proof in 48h</span>
        </div>
      </div>

      <!--
        Branded figcaption, bottom-right, visible at all breakpoints.
        z-[2] keeps it above the gradient (z-0/auto) but the section's
        `isolate` ensures it can never overlay the global AppHeader bands.
      -->
      <figcaption
        class="pointer-events-none absolute bottom-4 right-4 z-[2] inline-flex items-center gap-2 bg-cream-50/85 px-[10px] py-[5px] text-[11px] font-medium uppercase tracking-[0.16em] text-ink-700 backdrop-blur-sm sm:bottom-5 sm:right-5 sm:text-[12px]"
      >
        <span class="h-1 w-1 rounded-full bg-accent-terracotta" aria-hidden="true" />
        Studio Canon &middot; 2026
      </figcaption>
    </div>
  </section>
</template>

<script setup lang="ts">
/**
 * HeroSection — homepage editorial hero.
 *
 * Single full-bleed photograph anchors the LCP, served via NuxtPicture
 * + IPX (AVIF/WebP) with explicit width/height to lock 1600×2133 and
 * eliminate CLS. `preload` + `fetchpriority=high` + `loading=eager`
 * keep it on the critical path; copy is overlaid, not laid out beside.
 */
</script>
