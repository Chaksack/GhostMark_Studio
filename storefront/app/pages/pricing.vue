<template>
  <div class="mx-auto w-full max-w-rail px-gutter">
    <h1 class="gm-display gm-display-md text-ink-950">Pricing</h1>
    <p class="mt-2 max-w-[70ch] text-ink-600">
      Hook this page to Strapi later. For now, it’s a clean, editable scaffold.
    </p>

    <div class="my-6 h-px w-full bg-ink-200" />

    <div class="grid gap-4 lg:grid-cols-3">
      <div class="rounded-2xl border border-ink-200 bg-white p-5">
        <div class="inline-flex rounded-full border border-ink-200 bg-white px-3 py-1 text-xs font-semibold text-ink-700">Starter</div>
        <h2 class="mt-3 text-lg font-bold">Self-serve</h2>
        <p class="mt-2 text-ink-700">Best for simple drops.</p>
        <div class="mt-3.5">
          <NuxtLink class="inline-flex items-center justify-center gap-2 rounded-full border border-ink-950 bg-ink-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-ink-900" to="/contact">Talk to us</NuxtLink>
        </div>
      </div>

      <div class="rounded-2xl border border-ink-200 bg-white p-5">
        <div class="inline-flex rounded-full border border-ink-200 bg-white px-3 py-1 text-xs font-semibold text-ink-700">Studio</div>
        <h2 class="mt-3 text-lg font-bold">Design + ops</h2>
        <p class="mt-2 text-ink-700">For brands that move fast.</p>
        <div class="mt-3.5">
          <NuxtLink class="inline-flex items-center justify-center gap-2 rounded-full border border-ink-950 bg-ink-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-ink-900" to="/contact">Get a quote</NuxtLink>
        </div>
      </div>

      <div class="rounded-2xl border border-ink-200 bg-white p-5">
        <div class="inline-flex rounded-full border border-ink-200 bg-white px-3 py-1 text-xs font-semibold text-ink-700">Enterprise</div>
        <h2 class="mt-3 text-lg font-bold">Custom</h2>
        <p class="mt-2 text-ink-700">SLAs, integrations, multi-region.</p>
        <div class="mt-3.5">
          <NuxtLink class="inline-flex items-center justify-center gap-2 rounded-full border border-ink-200 bg-transparent px-4 py-2.5 text-sm font-semibold text-ink-950 hover:bg-ink-100" to="/integrations">See integrations</NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'Pricing' })
</script>
