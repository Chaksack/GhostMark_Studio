<template>
  <NuxtLink
    :to="`/products/${encodeURIComponent(product.handle || product.id)}`"
    class="group block"
  >
    <div class="aspect-square overflow-hidden rounded-xl bg-zinc-100">
      <img
        v-if="product.thumbnail"
        class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        :src="product.thumbnail"
        :alt="product.title"
        loading="lazy"
      />
      <div
        v-else
        class="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-200/60 to-zinc-100"
      >
        <svg class="h-10 w-10 text-zinc-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="m21 15-5-5L5 21" />
        </svg>
      </div>
    </div>
    <div class="mt-3 flex items-start justify-between gap-2">
      <div>
        <h3 class="text-[14px] font-medium text-zinc-950 group-hover:underline">{{ product.title }}</h3>
        <p v-if="price" class="mt-0.5 text-[13px] text-zinc-500">
          From{{ price }}
        </p>
      </div>
      <button
        class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-400 hover:border-zinc-300 hover:text-zinc-950"
        type="button"
        aria-label="Add to favorites"
        @click.prevent
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 21s-7-4.6-9.5-8.7C.2 8.6 2.6 5.7 6 5.5c1.9-.1 3.2.8 4 1.8.8-1 2.1-1.9 4-1.8 3.4.2 5.8 3.1 3.5 6.8C19 16.4 12 21 12 21z" />
        </svg>
      </button>
    </div>
  </NuxtLink>
</template>

<script setup lang="ts">
const props = defineProps<{
  product: {
    id: string
    handle?: string
    title: string
    thumbnail?: string
    variants?: { prices?: { amount?: number; currency_code?: string }[] }[]
  }
}>()

const price = computed(() => {
  const variant = props.product.variants?.[0]
  const p = variant?.prices?.[0]
  if (!p?.amount) return null
  const amt = p.amount / 100
  const code = (p.currency_code || 'eur').toUpperCase()
  const symbols: Record<string, string> = { EUR: '€', GBP: '£', USD: '$' }
  const symbol = symbols[code] || code
  return `${amt}${symbol}`
})
</script>
