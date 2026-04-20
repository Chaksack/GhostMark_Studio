<template>
  <div class="mx-auto w-full max-w-screen-2xl px-5 sm:px-6 lg:px-8">
    <h1 class="text-3xl font-bold tracking-tight sm:text-4xl">Pricing</h1>
    <p class="mt-2 max-w-[70ch] text-zinc-500">
      Hook this page to Strapi later. For now, it’s a clean, editable scaffold.
    </p>

    <div class="my-6 h-px w-full bg-zinc-200" />

    <div class="grid gap-4 lg:grid-cols-3">
      <div class="rounded-2xl border border-zinc-200 bg-white p-5">
        <div class="inline-flex rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-zinc-700">Starter</div>
        <h2 class="mt-3 text-lg font-bold">Self-serve</h2>
        <p class="mt-2 text-zinc-600">Best for simple drops.</p>
        <div class="mt-3.5">
          <NuxtLink class="inline-flex items-center justify-center gap-2 rounded-full border border-zinc-950 bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-900" to="/contact">Talk to us</NuxtLink>
        </div>
      </div>

      <div class="rounded-2xl border border-zinc-200 bg-white p-5">
        <div class="inline-flex rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-zinc-700">Studio</div>
        <h2 class="mt-3 text-lg font-bold">Design + ops</h2>
        <p class="mt-2 text-zinc-600">For brands that move fast.</p>
        <div class="mt-3.5">
          <NuxtLink class="inline-flex items-center justify-center gap-2 rounded-full border border-zinc-950 bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-900" to="/contact">Get a quote</NuxtLink>
        </div>
      </div>

      <div class="rounded-2xl border border-zinc-200 bg-white p-5">
        <div class="inline-flex rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-zinc-700">Enterprise</div>
        <h2 class="mt-3 text-lg font-bold">Custom</h2>
        <p class="mt-2 text-zinc-600">SLAs, integrations, multi-region.</p>
        <div class="mt-3.5">
          <NuxtLink class="inline-flex items-center justify-center gap-2 rounded-full border border-zinc-200 bg-transparent px-4 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-zinc-100" to="/integrations">See integrations</NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'Pricing' })
</script>
