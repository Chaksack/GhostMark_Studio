<template>
  <div>
    <!-- Hero banner -->
    <section class="bg-[#f5f1ec] py-12 lg:py-16">
      <div class="mx-auto w-full max-w-screen-3xl px-5 sm:px-6 lg:px-8">
        <h1 class="font-serif text-[36px] leading-[1.1] text-zinc-950 sm:text-[48px] lg:text-[56px]">
          Branded gifts,<br />made the right way.
        </h1>
      </div>
    </section>

    <div class="mx-auto w-full max-w-screen-3xl px-5 sm:px-6 lg:px-8">
      <!-- Filter bar -->
      <div class="flex flex-wrap items-center gap-3 border-b border-zinc-200 py-4">
        <button
          v-for="tag in filterTags"
          :key="tag.value"
          class="inline-flex h-[34px] items-center justify-center rounded-full border px-4 text-[13px] font-medium transition"
          :class="activeFilter === tag.value
            ? 'border-zinc-950 bg-zinc-950 text-white'
            : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300'"
          @click="activeFilter = tag.value"
        >
          {{ tag.label }}
        </button>
      </div>

      <!-- Product grid -->
      <div v-if="pending" class="py-20 text-center text-zinc-500">Loading products&hellip;</div>
      <div v-else-if="error" class="py-20 text-center text-zinc-500">Couldn't load products.</div>

      <div v-else class="grid grid-cols-2 gap-x-4 gap-y-8 py-8 sm:grid-cols-3 lg:grid-cols-4">
        <ProductCard
          v-for="p in products"
          :key="p.id"
          :product="p"
        />
      </div>

      <!-- Inline content block -->
      <div v-if="products.length" class="my-8 rounded-2xl bg-[#f5f1ec] p-8 lg:p-12">
        <p class="max-w-[540px] text-[15px] leading-relaxed text-zinc-700">
          Design and durability are the core criteria we look at when selecting your favorite personalized corporate gifts.
        </p>
        <NuxtLink to="/about" class="mt-4 inline-block text-[13px] font-semibold uppercase tracking-wider text-zinc-950 hover:underline">
          More about transparency &rarr;
        </NuxtLink>
      </div>
    </div>

    <!-- FAQ + Newsletter -->
    <div class="mt-16 flex flex-col gap-16">
      <AppFaq />
      <AppNewletter />
    </div>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'Shop' })
const sdk = useMedusaClient()

const filterTags = [
  { label: 'All', value: 'all' },
  { label: 'Best sellers', value: 'best-sellers' },
  { label: 'Fast shipping', value: 'fast-shipping' },
  { label: 'Made in Europe', value: 'made-in-europe' },
  { label: 'B Corp', value: 'b-corp' },
]

const activeFilter = ref('all')

const { data, pending, error } = await useAsyncData('products', async () => {
  return await sdk.store.product.list({ limit: 48 } as any)
})

const products = computed(() => (data.value as any)?.products ?? [])
</script>
