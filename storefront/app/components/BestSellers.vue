<template>
  <section class="mx-auto w-full max-w-screen-3xl px-5 sm:px-6 lg:px-8">
    <div class="flex items-end justify-between gap-4">
      <h2 class="text-[22px] font-semibold tracking-tight text-zinc-950 sm:text-[26px]">Our best sellers</h2>
      <NuxtLink to="/products" class="text-[14px] text-zinc-500 hover:text-zinc-950 hover:underline">View all</NuxtLink>
    </div>

    <div class="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      <ProductCard
        v-for="p in products"
        :key="p.id"
        :product="p"
      />
    </div>

    <div v-if="!products.length" class="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      <div v-for="n in 10" :key="n" class="animate-pulse">
        <div class="aspect-square rounded-xl bg-zinc-200" />
        <div class="mt-3 h-4 w-3/4 rounded bg-zinc-200" />
        <div class="mt-1.5 h-3 w-1/2 rounded bg-zinc-200" />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  products: any[]
}>()
</script>
