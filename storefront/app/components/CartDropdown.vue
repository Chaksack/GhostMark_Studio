<template>
  <div
    ref="rootRef"
    data-cart-dropdown
    class="relative hidden lg:block"
    @mouseenter="open = true"
    @mouseleave="open = false"
    @focusin="open = true"
    @focusout="onBlur"
    @keydown.esc="open = false"
  >
    <NuxtLink
      to="/cart"
      class="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-transparent bg-transparent text-ink-950 hover:border-ink-200 hover:bg-ink-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-warmGrey"
      aria-label="Cart"
      :aria-expanded="open ? 'true' : 'false'"
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M6 6h15l-1.5 9h-12z" />
        <path d="M6 6l-2-3H1" />
        <circle cx="9" cy="20" r="1" />
        <circle cx="18" cy="20" r="1" />
      </svg>
      <ClientOnly>
        <span
          v-if="cartCount"
          class="absolute right-1.5 top-1.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-ink-950 px-[5px] text-[12px] font-extrabold tabular-nums text-white"
        >
          {{ cartCount }}
        </span>
      </ClientOnly>
    </NuxtLink>
    <div
      v-if="open"
      class="absolute right-0 top-full z-[80] w-[340px] pt-2"
    >
      <div class="rounded-xl border border-ink-200 bg-white shadow-xl">
        <div class="border-b border-ink-100 px-4 py-3">
          <h3 class="text-sm font-bold text-ink-950">Shopping Cart ({{ cartCount }})</h3>
        </div>

        <div v-if="!cartItems.length" class="px-4 py-8 text-center">
          <svg class="mx-auto mb-3 text-ink-300" viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 6h15l-1.5 9h-12z" />
            <path d="M6 6l-2-3H1" />
            <circle cx="9" cy="20" r="1" />
            <circle cx="18" cy="20" r="1" />
          </svg>
          <p class="text-sm text-ink-600">Your cart is empty</p>
        </div>

        <div v-else class="max-h-[400px] overflow-y-auto">
          <!-- Studio Canon (D2C own-brand apparel, ships fast): impulse path first -->
          <section v-if="apparelItems.length" class="border-b border-ink-100">
            <header class="flex items-baseline justify-between px-4 pt-3 pb-1">
              <h4 class="gm-spec text-ink-700">Studio Canon</h4>
              <span class="gm-spec text-ink-600">Ships in 1-2 days</span>
            </header>
            <ul class="divide-y divide-ink-100">
              <li v-for="item in apparelItems" :key="item.id" class="flex items-start gap-3 px-4 py-3">
                <div class="h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg border border-ink-100 bg-cream-50">
                  <img
                    v-if="item.thumbnail && !failedThumbs.has(item.id)"
                    :src="item.thumbnail"
                    :alt="item.title"
                    class="h-full w-full object-cover"
                    loading="lazy"
                    @error="failedThumbs.add(item.id)"
                  />
                  <div v-else class="flex h-full w-full items-center justify-center text-ink-300">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="m9 14 2-2 4 4" /><circle cx="15" cy="9" r="1.5" /></svg>
                  </div>
                </div>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium text-ink-950">{{ item.title }}</p>
                  <p v-if="item.variant_title" class="truncate text-xs text-ink-600">{{ item.variant_title }}</p>
                  <div class="mt-1 flex items-center justify-between">
                    <span class="text-xs text-ink-600">Qty: {{ item.quantity }}</span>
                    <span class="text-sm font-semibold text-ink-950">{{ formatPrice(item.unit_price, item.currency_code) }}</span>
                  </div>
                </div>
                <button
                  class="mt-0.5 flex-shrink-0 rounded p-1 text-ink-600 hover:bg-ink-100 hover:text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                  type="button"
                  :aria-label="`Remove ${item.title}`"
                  @click.prevent="onRemove(item.id)"
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                </button>
              </li>
            </ul>
            <div v-if="apparelSubtotal" class="flex items-center justify-between px-4 pb-3 pt-1 text-[12px] text-ink-700">
              <span>Section subtotal</span>
              <span class="font-medium text-ink-950">{{ formatPrice(apparelSubtotal, currency) }}</span>
            </div>
          </section>

          <!-- Custom & POD (per-unit POD + B2B, requires e-proof): considered path second -->
          <section v-if="podItems.length" class="border-b border-ink-100">
            <header class="flex items-baseline justify-between px-4 pt-3 pb-1">
              <h4 class="gm-spec text-ink-700">Custom &amp; POD</h4>
              <span class="gm-spec text-ink-600">E-proof in 48h</span>
            </header>
            <ul class="divide-y divide-ink-100">
              <li v-for="item in podItems" :key="item.id" class="flex items-start gap-3 px-4 py-3">
                <div class="h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg border border-ink-100 bg-cream-50">
                  <img
                    v-if="(item.metadata?.preview_url || item.thumbnail) && !failedThumbs.has(item.id)"
                    :src="item.metadata?.preview_url || item.thumbnail"
                    :alt="item.title"
                    class="h-full w-full object-cover"
                    loading="lazy"
                    @error="failedThumbs.add(item.id)"
                  />
                  <div v-else class="flex h-full w-full items-center justify-center text-ink-300">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="m9 14 2-2 4 4" /><circle cx="15" cy="9" r="1.5" /></svg>
                  </div>
                </div>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium text-ink-950">{{ item.title }}</p>
                  <p v-if="item.variant_title" class="truncate text-xs text-ink-600">{{ item.variant_title }}</p>
                  <div class="mt-1 flex items-center justify-between">
                    <span class="text-xs text-ink-600">Qty: {{ item.quantity }}</span>
                    <span class="text-sm font-semibold text-ink-950">{{ formatPrice(item.unit_price, item.currency_code) }}</span>
                  </div>
                  <span
                    class="mt-1 inline-block rounded bg-ink-200 gm-spec px-[6px] py-[2px] text-ink-950"
                  >
                    POD
                  </span>
                  <!-- See cart.vue for why this is text + icon rather than a
                       tinted chip: every semantic surface measures ~1:1 against
                       this palette's warm grounds, and the borders top out at
                       1.57:1. The fg token as bare text measures 7.48:1. -->
                  <span
                    v-if="needsEProof(item)"
                    class="mt-1 ml-1 gm-spec inline-flex items-center gap-1 text-semantic-warning-fg"
                  >
                    <svg class="h-3.5 w-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
                    E-proof needed
                  </span>
                  <span
                    v-else-if="needsQuote(item)"
                    class="gm-spec mt-1 ml-1 inline-block rounded bg-ink-100 px-[6px] py-[2px] text-ink-700"
                  >
                    Quote pending
                  </span>
                </div>
                <button
                  class="mt-0.5 flex-shrink-0 rounded p-1 text-ink-600 hover:bg-ink-100 hover:text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                  type="button"
                  :aria-label="`Remove ${item.title}`"
                  @click.prevent="onRemove(item.id)"
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                </button>
              </li>
            </ul>
            <div v-if="podSubtotal" class="flex items-center justify-between px-4 pb-3 pt-1 text-[12px] text-ink-700">
              <span>Section subtotal</span>
              <span class="font-medium text-ink-950">{{ formatPrice(podSubtotal, currency) }}</span>
            </div>
          </section>
        </div>

        <div class="border-t border-ink-100 px-4 py-3">
          <div v-if="cartItems.length" class="mb-3 flex items-center justify-between">
            <span class="text-sm text-ink-600">Subtotal</span>
            <span class="text-sm font-bold text-ink-950">{{ subtotal }}</span>
          </div>
          <p
            v-if="podItems.length"
            class="mb-3 text-[12px] leading-relaxed text-ink-600"
          >
            Custom &amp; POD lines require e-proof confirmation before production. You'll receive a proof within 48h after placing your order.
          </p>
          <NuxtLink
            to="/cart"
            class="block w-full rounded-lg bg-ink-950 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            Continue to Checkout
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { inferLineMode, needsEProof } from '~/utils/cartMode'
import { formatMoney } from '~/utils/money'

// Ids whose line-item image 404'd. Covers both lists below: the apparel rows
// read `thumbnail`, the POD rows read `metadata.preview_url` first. Either can
// be present-but-dead, which the old `v-if` treated as present and rendered as
// a collapsed <img> showing alt text. Set-keyed because both are v-for rows.
const failedThumbs = reactive(new Set<string>())

const { cart, ensureCart, removeItem } = useCart()

const open = ref(false)
const rootRef = ref<HTMLElement | null>(null)

// MOQ heuristic used by the "Quote pending" badge below. The matching
// fallback inside `inferLineMode` lives in ~/utils/cartMode, keep this
// constant in sync if the threshold ever moves.
const POD_MOQ_FALLBACK = 25

function onBlur() {
  // Defer so document.activeElement reflects the new focus target
  setTimeout(() => {
    if (!rootRef.value) return
    if (!rootRef.value.contains(document.activeElement)) {
      open.value = false
    }
  }, 0)
}

const cartItems = computed(() => cart.value?.items || [])
const cartCount = computed(
  () => cartItems.value.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0),
)
const currency = computed(() => cart.value?.currency_code || 'gbp')

function needsQuote(item: any): boolean {
  const meta = item?.metadata || {}
  return Boolean(meta.requires_quote) || (item?.quantity ?? 0) >= POD_MOQ_FALLBACK
}

function sumLines(items: any[]) {
  return items.reduce(
    (sum: number, item: any) => sum + (item.unit_price ?? 0) * (item.quantity ?? 0),
    0,
  )
}

const apparelItems = computed(() => cartItems.value.filter((item: any) => inferLineMode(item) === 'apparel'))
const podItems = computed(() => cartItems.value.filter((item: any) => inferLineMode(item) === 'pod'))

const apparelSubtotal = computed(() => sumLines(apparelItems.value))
const podSubtotal = computed(() => sumLines(podItems.value))

const subtotal = computed(() => {
  if (!cart.value) return ''
  return formatPrice(sumLines(cartItems.value), currency.value)
})

// Adapter over the shared `~/utils/money` helper, keeping the positional
// `(amount, currency)` signature the template already uses. The local
// implementation this replaces divided by 100 and defaulted to en-US/USD,
// so a GBP cart could render dollar signs in the drawer while the PDP
// behind it rendered pounds. Amounts are Medusa v2 major units.
function formatPrice(amount: number, currency: string) {
  return formatMoney({ amount, currency_code: currency })
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
