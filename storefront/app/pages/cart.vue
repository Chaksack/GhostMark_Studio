<template>
  <div class="bg-[#f5f1ec] min-h-screen">
    <!-- Step indicator -->
    <div class="border-b border-zinc-200 bg-white">
      <div class="mx-auto flex w-full max-w-screen-xl items-center justify-center gap-6 px-5 py-4 text-[13px] sm:gap-10">
        <span class="flex items-center gap-2 font-semibold text-zinc-950">
          <span class="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-950 text-[11px] font-bold text-white">1</span>
          Cart
        </span>
        <span class="h-px w-6 bg-zinc-300" />
        <span class="flex items-center gap-2 text-zinc-400">
          <span class="flex h-6 w-6 items-center justify-center rounded-full border border-zinc-300 text-[11px] font-bold">2</span>
          Login
        </span>
        <span class="h-px w-6 bg-zinc-300" />
        <span class="flex items-center gap-2 text-zinc-400">
          <span class="flex h-6 w-6 items-center justify-center rounded-full border border-zinc-300 text-[11px] font-bold">3</span>
          Shipping
        </span>
        <span class="h-px w-6 bg-zinc-300" />
        <span class="flex items-center gap-2 text-zinc-400">
          <span class="flex h-6 w-6 items-center justify-center rounded-full border border-zinc-300 text-[11px] font-bold">4</span>
          Payment
        </span>
      </div>
    </div>

    <div class="mx-auto w-full max-w-screen-xl px-5 py-10 sm:px-6 lg:px-8">
      <div v-if="!isReady" class="py-20 text-center text-zinc-500">Loading cart&hellip;</div>

      <!-- Empty state -->
      <div v-else-if="!items.length" class="flex flex-col items-center py-20 text-center">
        <svg class="h-16 w-16 text-zinc-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
        <h1 class="mt-6 font-serif text-[28px] text-zinc-950">Your cart is empty</h1>
        <p class="mt-2 text-[15px] text-zinc-500">Browse our catalog and add items to get started.</p>
        <NuxtLink
          to="/products"
          class="mt-6 inline-flex h-[48px] items-center justify-center bg-zinc-950 px-8 text-[14px] font-medium tracking-wide text-white hover:bg-zinc-800"
        >
          Start shopping
        </NuxtLink>
      </div>

      <!-- Cart with items -->
      <div v-else class="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
        <div>
          <h1 class="font-serif text-[28px] text-zinc-950">Your cart</h1>
          <p class="mt-1 text-[14px] text-zinc-500">{{ itemsCount }} item{{ itemsCount === 1 ? '' : 's' }}</p>

          <!-- Mixed-mode delivery banner (renders only when both POD + apparel are present) -->
          <CartModeBanner :items="items" class="mt-6" />

          <!-- Studio Canon (apparel) section — D2C, ships fast -->
          <section v-if="apparelItems.length" class="mt-6" aria-label="Studio Canon items">
            <header class="flex items-baseline justify-between border-b border-zinc-200 pb-2">
              <div>
                <h2 class="text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-700">Studio Canon</h2>
                <p class="text-[12px] text-zinc-500">Ships in 1-2 business days</p>
              </div>
              <span v-if="apparelSubtotalText" class="text-[13px] font-medium text-zinc-950">{{ apparelSubtotalText }}</span>
            </header>
            <div class="divide-y divide-zinc-200 border-b border-zinc-200">
              <div
                v-for="item in apparelItems"
                :key="item.id"
                class="flex gap-4 py-5"
              >
                <!-- Thumbnail -->
                <div class="h-[100px] w-[100px] flex-shrink-0 overflow-hidden rounded-xl bg-zinc-100">
                  <img
                    v-if="thumb(item)"
                    class="h-full w-full object-cover"
                    :src="thumb(item)"
                    :alt="item.title || item.variant_title || 'Item'"
                  />
                  <div v-else class="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-200/60 to-zinc-100">
                    <svg class="h-8 w-8 text-zinc-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
                  </div>
                </div>

                <!-- Info -->
                <div class="flex flex-1 flex-col justify-between">
                  <div class="flex items-start justify-between gap-4">
                    <div>
                      <div class="text-[15px] font-semibold text-zinc-950">{{ item.title || item.variant_title || 'Item' }}</div>
                      <div v-if="item.variant_title && item.title" class="mt-0.5 text-[13px] text-zinc-500">{{ item.variant_title }}</div>
                    </div>
                    <div class="text-right text-[15px] font-semibold text-zinc-950">{{ lineTotal(item) || '&mdash;' }}</div>
                  </div>

                  <div class="mt-3 flex items-center justify-between">
                    <div class="flex items-center gap-0">
                      <button
                        class="flex h-[34px] w-[34px] items-center justify-center border border-zinc-200 bg-white text-zinc-950 hover:bg-zinc-50 disabled:opacity-40"
                        :disabled="item.quantity <= 1"
                        @click="setQty(item, item.quantity - 1)"
                        type="button"
                      >&minus;</button>
                      <div class="flex h-[34px] min-w-[44px] items-center justify-center border-y border-zinc-200 bg-white px-2 text-[13px] font-medium text-zinc-950">{{ item.quantity }}</div>
                      <button
                        class="flex h-[34px] w-[34px] items-center justify-center border border-zinc-200 bg-white text-zinc-950 hover:bg-zinc-50"
                        @click="setQty(item, item.quantity + 1)"
                        type="button"
                      >+</button>
                    </div>
                    <button
                      class="text-[13px] text-zinc-500 underline hover:text-zinc-950"
                      @click="remove(item)"
                      type="button"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <!-- Custom & POD section — requires e-proof, longer lead time -->
          <section v-if="podItems.length" :class="apparelItems.length ? 'mt-8' : 'mt-6'" aria-label="Custom and POD items">
            <header class="flex items-baseline justify-between border-b border-zinc-200 pb-2">
              <div>
                <h2 class="text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-700">Custom &amp; POD</h2>
                <p class="text-[12px] text-zinc-500">E-proof in 48h, production 2-4 weeks</p>
              </div>
              <span v-if="podSubtotalText" class="text-[13px] font-medium text-zinc-950">{{ podSubtotalText }}</span>
            </header>
            <div class="divide-y divide-zinc-200 border-b border-zinc-200">
              <div
                v-for="item in podItems"
                :key="item.id"
                class="flex gap-4 py-5"
              >
                <!-- Thumbnail (prefers preview_url for POD lines) -->
                <div class="h-[100px] w-[100px] flex-shrink-0 overflow-hidden rounded-xl bg-zinc-100">
                  <img
                    v-if="podThumb(item)"
                    class="h-full w-full object-cover"
                    :src="podThumb(item)"
                    :alt="item.title || item.variant_title || 'Item'"
                  />
                  <div v-else class="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-200/60 to-zinc-100">
                    <svg class="h-8 w-8 text-zinc-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
                  </div>
                </div>

                <!-- Info -->
                <div class="flex flex-1 flex-col justify-between">
                  <div class="flex items-start justify-between gap-4">
                    <div>
                      <div class="text-[15px] font-semibold text-zinc-950">{{ item.title || item.variant_title || 'Item' }}</div>
                      <div v-if="item.variant_title && item.title" class="mt-0.5 text-[13px] text-zinc-500">{{ item.variant_title }}</div>
                      <div class="mt-1.5 flex flex-wrap gap-1.5">
                        <span class="inline-block rounded bg-zinc-200 px-[6px] py-[2px] text-[10px] font-medium uppercase tracking-[0.06em] text-zinc-950">POD</span>
                        <span v-if="needsProof(item)" class="inline-block rounded bg-amber-100 px-[6px] py-[2px] text-[10px] font-medium uppercase tracking-[0.06em] text-zinc-950">E-proof needed</span>
                      </div>
                    </div>
                    <div class="text-right text-[15px] font-semibold text-zinc-950">{{ lineTotal(item) || '&mdash;' }}</div>
                  </div>

                  <div class="mt-3 flex items-center justify-between">
                    <div class="flex items-center gap-0">
                      <button
                        class="flex h-[34px] w-[34px] items-center justify-center border border-zinc-200 bg-white text-zinc-950 hover:bg-zinc-50 disabled:opacity-40"
                        :disabled="item.quantity <= 1"
                        @click="setQty(item, item.quantity - 1)"
                        type="button"
                      >&minus;</button>
                      <div class="flex h-[34px] min-w-[44px] items-center justify-center border-y border-zinc-200 bg-white px-2 text-[13px] font-medium text-zinc-950">{{ item.quantity }}</div>
                      <button
                        class="flex h-[34px] w-[34px] items-center justify-center border border-zinc-200 bg-white text-zinc-950 hover:bg-zinc-50"
                        @click="setQty(item, item.quantity + 1)"
                        type="button"
                      >+</button>
                    </div>
                    <button
                      class="text-[13px] text-zinc-500 underline hover:text-zinc-950"
                      @click="remove(item)"
                      type="button"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <NuxtLink to="/products" class="mt-4 inline-flex items-center gap-1.5 text-[14px] text-zinc-600 hover:text-zinc-950">
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            Continue shopping
          </NuxtLink>
        </div>

        <!-- Order summary sidebar -->
        <aside class="rounded-2xl border border-zinc-200 bg-white p-6 lg:sticky lg:top-28">
          <h2 class="text-[18px] font-semibold text-zinc-950">Order summary</h2>

          <!-- Discount code -->
          <div class="mt-5">
            <label class="text-[13px] text-zinc-500" for="discount-code">Discount code</label>
            <div class="mt-1.5 flex gap-2">
              <input
                id="discount-code"
                v-model="discountCode"
                class="h-[42px] flex-1 border border-zinc-200 bg-white px-3 text-[14px] text-zinc-950 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300"
                placeholder="Enter code"
                type="text"
              />
              <button
                class="h-[42px] border border-zinc-200 bg-white px-4 text-[13px] font-medium text-zinc-950 hover:bg-zinc-50"
                type="button"
              >
                Apply
              </button>
            </div>
          </div>

          <div class="mt-5 space-y-2.5 border-t border-zinc-200 pt-5">
            <div class="flex items-baseline justify-between text-[14px]">
              <span class="text-zinc-500">Subtotal</span>
              <span class="font-medium text-zinc-950">{{ cartSubtotal || '&mdash;' }}</span>
            </div>
            <div class="flex items-baseline justify-between text-[14px]">
              <span class="text-zinc-500">Shipping</span>
              <span class="text-zinc-500">Calculated at next step</span>
            </div>
            <div class="flex items-baseline justify-between text-[14px]">
              <span class="text-zinc-500">Taxes</span>
              <span class="text-zinc-500">Calculated at next step</span>
            </div>
          </div>

          <div class="mt-4 flex items-baseline justify-between border-t border-zinc-200 pt-4">
            <span class="text-[16px] font-semibold text-zinc-950">Total</span>
            <span class="text-[18px] font-bold text-zinc-950">{{ cartSubtotal || '&mdash;' }}</span>
          </div>

          <NuxtLink
            to="/checkout"
            class="mt-5 flex h-[50px] w-full items-center justify-center bg-zinc-950 text-[14px] font-medium tracking-wide text-white hover:bg-zinc-800"
          >
            Go to checkout
          </NuxtLink>
        </aside>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import CartModeBanner from '~/components/cart/CartModeBanner.vue'

useHead({ title: 'Cart' })
const { cart, isReady, ensureCart, updateItem, removeItem } = useCart()
await ensureCart()

const items = computed(() => (cart.value?.items ?? []) as any[])
const itemsCount = computed(() => items.value.reduce((sum: number, i: any) => sum + (i?.quantity || 0), 0))
const discountCode = ref('')

// ---------------------------------------------------------------------------
// Mode classification — duplicated from CartDropdown.inferMode rather than
// extracted to a shared util to keep CartDropdown.vue self-contained per the
// current ownership boundary. If you touch this chain, mirror the change in
// CartDropdown.vue (5-tier resolution: product.type -> line meta -> variant
// meta -> product meta -> design signals -> MOQ heuristic).
// ---------------------------------------------------------------------------
const POD_MOQ_FALLBACK = 25
type CartLineMode = 'pod' | 'apparel'

function inferMode(item: any): CartLineMode {
  const productType = (item?.variant?.product?.type?.value as string | undefined)?.toLowerCase()
  if (productType === 'pod') return 'pod'
  if (productType === 'apparel') return 'apparel'

  const lineMode = (item?.metadata?.commerce_mode as string | undefined)?.toLowerCase()
  if (lineMode === 'pod') return 'pod'
  if (lineMode === 'shop' || lineMode === 'apparel') return 'apparel'

  const variantMode = (item?.variant?.metadata?.commerce_mode as string | undefined)?.toLowerCase()
  if (variantMode === 'pod') return 'pod'
  if (variantMode === 'shop' || variantMode === 'apparel') return 'apparel'

  const productMeta = (item?.variant?.product?.metadata?.commerce_mode as string | undefined)?.toLowerCase()
  if (productMeta === 'pod') return 'pod'
  if (productMeta === 'shop' || productMeta === 'apparel') return 'apparel'

  if (item?.metadata?.design_data) return 'pod'
  if (item?.metadata?.preview_url) return 'pod'
  if ((item?.quantity ?? 0) >= POD_MOQ_FALLBACK) return 'pod'

  return 'apparel'
}

function needsProof(item: any): boolean {
  const meta = item?.metadata || {}
  return Boolean(meta.requires_proof || meta.design_data || meta.preview_url)
}

function sumLines(rows: any[]) {
  return rows.reduce(
    (sum: number, item: any) => sum + ((item?.unit_price ?? 0) * (item?.quantity ?? 0)),
    0,
  )
}

const apparelItems = computed(() => items.value.filter((i: any) => inferMode(i) === 'apparel'))
const podItems = computed(() => items.value.filter((i: any) => inferMode(i) === 'pod'))

const apparelSubtotalText = computed(() => {
  if (!apparelItems.value.length) return null
  return formatMoney(sumLines(apparelItems.value))
})
const podSubtotalText = computed(() => {
  if (!podItems.value.length) return null
  return formatMoney(sumLines(podItems.value))
})

const podThumb = (item: any) =>
  item?.metadata?.preview_url
  || item?.thumbnail
  || item?.variant?.product?.thumbnail
  || item?.product?.thumbnail
  || null

const currencyCode = computed(() => {
  const c = cart.value as any
  return (c?.currency_code || c?.region?.currency_code || 'usd') as string
})

const formatMoney = (amountMinor: number | null | undefined) => {
  if (typeof amountMinor !== 'number' || Number.isNaN(amountMinor)) return null
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currencyCode.value.toUpperCase(),
    }).format(amountMinor / 100)
  } catch {
    return `${(amountMinor / 100).toFixed(2)} ${currencyCode.value.toUpperCase()}`
  }
}

const cartSubtotal = computed(() => {
  const c: any = cart.value
  return formatMoney(c?.subtotal ?? c?.items_subtotal ?? null)
})

const thumb = (item: any) =>
  item?.thumbnail || item?.variant?.product?.thumbnail || item?.product?.thumbnail || null

const lineTotal = (item: any) =>
  formatMoney(item?.total ?? item?.subtotal ?? null)

const setQty = async (item: any, qty: number) => {
  if (qty < 1) return
  await updateItem(item.id, qty)
}

const remove = async (item: any) => {
  await removeItem(item.id)
}
</script>
