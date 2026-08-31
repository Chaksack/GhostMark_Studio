<template>
  <div class="mx-auto w-full max-w-rail px-gutter">
    <h1 class="gm-display gm-display-md text-ink-950">Integrations</h1>
    <p class="mt-2 max-w-[80ch] text-ink-600">
      A simple integrations index (Strapi-ready).
    </p>

    <div class="my-6 h-px w-full bg-ink-200" />

    <div class="grid gap-4 lg:grid-cols-3">
      <div class="rounded-2xl border border-ink-200 bg-white p-5">
        <div class="inline-flex rounded-full border border-ink-200 bg-white px-3 py-1 text-xs font-semibold text-ink-700">Commerce</div>
        <h2 class="mt-3 text-lg font-bold">Medusa</h2>
        <p class="mt-2 text-ink-700">Products, cart, checkout, customers, orders.</p>
      </div>
      <div class="rounded-2xl border border-ink-200 bg-white p-5">
        <div class="inline-flex rounded-full border border-ink-200 bg-white px-3 py-1 text-xs font-semibold text-ink-700">Content</div>
        <h2 class="mt-3 text-lg font-bold">Strapi</h2>
        <p class="mt-2 text-ink-700">Blog, pages, marketing content.</p>
      </div>
      <div class="rounded-2xl border border-ink-200 bg-white p-5">
        <div class="inline-flex rounded-full border border-ink-200 bg-white px-3 py-1 text-xs font-semibold text-ink-700">Delivery</div>
        <h2 class="mt-3 text-lg font-bold">Fulfillment</h2>
        <p class="mt-2 text-ink-700">Shipping options via Medusa providers.</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'Integrations' })
</script>
