<template>
  <div>
    <AppHeader />

    <main class="pb-[60px]">
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
// AppHeader and MobileNav now consume `useCategories()` directly — single
// source of truth, live data, zero drift between SSR and CSR.
</script>
