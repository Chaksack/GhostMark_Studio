<template>
  <div class="group relative">
    <NuxtLink
      to="/cart"
      class="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-transparent bg-transparent text-zinc-950 hover:border-zinc-200 hover:bg-zinc-100"
      aria-label="Cart"
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M6 6h15l-1.5 9h-12z" />
        <path d="M6 6l-2-3H1" />
        <circle cx="9" cy="20" r="1" />
        <circle cx="18" cy="20" r="1" />
      </svg>
      <span
        v-if="cartCount"
        class="absolute right-1.5 top-1.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-zinc-950 px-[5px] text-[11px] font-extrabold text-white"
      >
        {{ cartCount }}
      </span>
    </NuxtLink>
    <div
      class="pointer-events-none absolute right-0 top-full z-[80] w-[340px] pt-2 opacity-0 invisible translate-y-1 transition duration-150 ease-out group-hover:pointer-events-auto group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100"
    >
      <div class="rounded-xl border border-zinc-200 bg-white shadow-xl">
        <div class="border-b border-zinc-100 px-4 py-3">
          <h3 class="text-sm font-bold text-zinc-950">Shopping Cart ({{ cartCount }})</h3>
        </div>

        <div v-if="!cartItems.length" class="px-4 py-8 text-center">
          <svg class="mx-auto mb-3 text-zinc-300" viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 6h15l-1.5 9h-12z" />
            <path d="M6 6l-2-3H1" />
            <circle cx="9" cy="20" r="1" />
            <circle cx="18" cy="20" r="1" />
          </svg>
          <p class="text-sm text-zinc-500">Your cart is empty</p>
        </div>

        <ul v-else class="max-h-[280px] divide-y divide-zinc-100 overflow-y-auto">
          <li v-for="item in cartItems" :key="item.id" class="flex items-start gap-3 px-4 py-3">
            <div class="h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg border border-zinc-100 bg-zinc-50">
              <img
                v-if="item.thumbnail"
                :src="item.thumbnail"
                :alt="item.title"
                class="h-full w-full object-cover"
                loading="lazy"
              />
              <div v-else class="flex h-full w-full items-center justify-center text-zinc-300">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="m9 14 2-2 4 4" /><circle cx="15" cy="9" r="1.5" /></svg>
              </div>
            </div>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium text-zinc-950">{{ item.title }}</p>
              <p v-if="item.variant_title" class="truncate text-xs text-zinc-500">{{ item.variant_title }}</p>
              <div class="mt-1 flex items-center justify-between">
                <span class="text-xs text-zinc-500">Qty: {{ item.quantity }}</span>
                <span class="text-sm font-semibold text-zinc-950">{{ formatPrice(item.unit_price, item.currency_code) }}</span>
              </div>
            </div>
            <button
              class="mt-0.5 flex-shrink-0 rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
              type="button"
              :aria-label="`Remove ${item.title}`"
              @click.prevent="onRemove(item.id)"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </li>
        </ul>

        <div class="border-t border-zinc-100 px-4 py-3">
          <div v-if="cartItems.length" class="mb-3 flex items-center justify-between">
            <span class="text-sm text-zinc-500">Subtotal</span>
            <span class="text-sm font-bold text-zinc-950">{{ subtotal }}</span>
          </div>
          <NuxtLink
            to="/cart"
            class="block w-full rounded-lg bg-zinc-950 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-zinc-800"
          >
            Continue to Checkout
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { cart, ensureCart, removeItem } = useCart()

const cartItems = computed(() => cart.value?.items || [])
const cartCount = computed(
  () => cartItems.value.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0),
)

const subtotal = computed(() => {
  if (!cart.value) return ''
  const total = cartItems.value.reduce((sum: number, item: any) => sum + (item.unit_price || 0) * (item.quantity || 0), 0)
  const currency = cart.value.currency_code || 'usd'
  return formatPrice(total, currency)
})

function formatPrice(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency?.toUpperCase() || 'USD',
    minimumFractionDigits: 2,
  }).format(amount / 100)
}

async function onRemove(lineItemId: string) {
  try {
    await removeItem(lineItemId)
  } catch {
    // silent
  }
}

onMounted(() => {
  ensureCart().catch(() => undefined)
})
</script>
