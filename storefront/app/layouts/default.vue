<template>
  <div>
    <!--
      WCAG 2.4.1 Bypass Blocks (Level A): skip link.

      The desktop chrome puts 16 tab stops in front of page content on EVERY
      route (search field + submit, wishlist, cart, account, two mode links,
      and one trigger per category dropdown). Without a bypass, a keyboard or
      switch user pays that toll on every navigation.

      It must be the first focusable node in the document, so it sits above
      <AppHeader>. `sr-only` keeps it out of the visual and screen-reader-
      *visual* flow until it takes keyboard focus; `focus-visible:` (not
      `focus:`) means a mouse click on the very top-left of the page can't
      flash it. `not-sr-only` resets the clip/size that `sr-only` applies,
      Tailwind emits the `accessibility` plugin before `position`, so the
      `focus-visible:fixed` below still wins the position declaration.
    -->
    <a
      href="#main"
      class="skip-link sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-4 focus-visible:top-4 focus-visible:z-toast focus-visible:inline-flex focus-visible:min-h-[44px] focus-visible:items-center focus-visible:rounded focus-visible:bg-ink-950 focus-visible:px-5 focus-visible:py-3 focus-visible:text-lead focus-visible:font-medium focus-visible:text-cream-50 focus-visible:no-underline focus-visible:shadow-elev-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-cream-50"
    >
      Skip to main content
    </a>

    <AppHeader />

    <!--
      `<main>` owns BOTH page offsets.

      It already owned the bottom (pb-[60px]). The top used to be delegated to
      every page individually via `lg:pt-[118px]`, an opt-in that only 9 of the
      ~20 routes remembered, so /about, /faq, /contact, /wishlist, /pricing,
      /integrations and /blog rendered their H1 underneath the two fixed
      desktop bands (three of them at top: 0, i.e. fully invisible).

      Owning it here makes clearance structural: a new page cannot forget it.
      The offset is `lg:` only because below `lg` the header is `sticky` and
      therefore still in normal flow, it needs no compensation, and adding
      one would open a 118px hole at the top of every mobile screen.

      `id`/`tabindex="-1"` are the skip-link target. `tabindex="-1"` is required
      for Safari and older WebKit, which otherwise move the scroll position but
      not the focus ring, silently dumping the user back at the top of the tab
      order.
    -->
    <main
      id="main"
      tabindex="-1"
      class="pb-[60px] lg:pt-[var(--header-offset)] focus:outline-none"
    >
      <slot />
    </main>
    <AppFooter />

    <!--
      Utility widgets: both depend on localStorage and on the live region
      catalogue, so we keep them out of the SSR pass to avoid hydration
      mismatches and to keep first-paint payload lean.
    -->
    <ClientOnly>
      <GeoModal />
      <CookieBanner />
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
// Categories used to be a 300-line hardcoded array passed down as a prop.
// That data did NOT match the live Medusa catalogue and every link 404'd.
// AppHeader and MobileNav now consume `useCategories()` directly: single
// source of truth, live data, zero drift between SSR and CSR.
</script>

<!--
  Fixed-header geometry (`--header-offset`, and the two band heights it is the
  sum of) is declared in `app/assets/css/tokens.css`, which nuxt.config loads
  globally. It deliberately lives there and not here: AppHeader reads the two
  bands, this layout reads the sum, and the PDP subtracts it, three files, so
  it belongs to none of them.
-->
