<template>
  <div class="bg-cream-tile min-h-screen">
    <!-- Step indicator -->
    <div class="border-b border-ink-200 bg-white">
      <div class="mx-auto flex w-full max-w-rail flex-wrap items-center justify-center gap-x-6 gap-y-2 px-gutter py-4 text-[13px] sm:gap-x-10">
        <span class="flex items-center gap-2 font-semibold text-ink-950">
          <span class="flex h-6 w-6 items-center justify-center rounded-full bg-ink-950 gm-spec !text-[12px] font-bold text-white">1</span>
          Cart
        </span>
        <span class="h-px w-6 bg-ink-300" />
        <span class="flex items-center gap-2 text-ink-600">
          <span class="flex h-6 w-6 items-center justify-center rounded-full border border-ink-400 gm-spec !text-[12px] font-bold">2</span>
          Login
        </span>
        <span class="h-px w-6 bg-ink-300" />
        <span class="flex items-center gap-2 text-ink-600">
          <span class="flex h-6 w-6 items-center justify-center rounded-full border border-ink-400 gm-spec !text-[12px] font-bold">3</span>
          Shipping
        </span>
        <span class="h-px w-6 bg-ink-300" />
        <span class="flex items-center gap-2 text-ink-600">
          <span class="flex h-6 w-6 items-center justify-center rounded-full border border-ink-400 gm-spec !text-[12px] font-bold">4</span>
          Payment
        </span>
      </div>
    </div>

    <div class="mx-auto w-full max-w-rail px-gutter py-10">
      <div v-if="!isReady" class="py-20 text-center text-ink-600">Loading cart&hellip;</div>

      <!--
        Empty state: now the SHARED component, not a hand-rolled one.

        UiEmptyState was built and rolled into 6 files (error.vue, wishlist,
        search x2, account/index, account/orders x2, account/orders/[id] x2)
        and cart.vue was skipped, which left the highest-traffic empty state in
        the app as the only one that did not match the others.

        It fits without compromise: `headingTag="h1"` keeps this page's single
        level-1 heading exactly where it was, `variant="empty"` is correct (the
        cart loaded fine and is genuinely empty; this is not the error case),
        and the `#actions` slot takes the existing "Start shopping" link
        unchanged. What we GAIN is `role="status"`, so a customer who removes
        their last item is actually told the cart is now empty instead of the
        content silently swapping.

        The old hand-rolled cart glyph is dropped rather than passed through
        the default slot: UiEmptyState's layout is eyebrow / title /
        description / slot / actions, and a decorative 64px icon above the
        headline is not a thing any of the other six call sites do. Matching
        them is the entire point of adopting it.
      -->
      <UiEmptyState
        v-else-if="!items.length"
        variant="empty"
        heading-tag="h1"
        title="Your cart is empty"
        description="Browse our catalog and add items to get started."
        :retryable="false"
        :help-to="null"
      >
        <template #actions>
          <NuxtLink
            to="/products"
            class="inline-flex h-[48px] items-center justify-center bg-ink-950 px-8 text-[14px] font-medium tracking-wide text-white hover:bg-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-cream-tile"
          >
            Start shopping
          </NuxtLink>
        </template>
      </UiEmptyState>

      <!--
        THE SECOND LEVEL-1 HEADING ON THIS PAGE ("Your cart") IS SAFE.
        It and the empty state's "Your cart is empty" are the two arms of one
        v-if / v-else-if / v-else chain on `items.length`, so only ever one is
        in the DOM. Verified in-browser in both states.
      -->
      <!-- Cart with items -->
      <div v-else class="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
        <div>
          <h1 class="font-serif text-[28px] font-semibold text-ink-950">Your cart</h1>
          <p class="mt-1 text-[14px] text-ink-600">{{ itemsCount }} item{{ itemsCount === 1 ? '' : 's' }}</p>

          <!-- Mixed-mode delivery banner (renders only when both POD + apparel are present) -->
          <CartModeBanner :items="items" class="mt-6" />

          <!-- Studio Canon (apparel) section: D2C, ships fast -->
          <section v-if="apparelItems.length" class="mt-6" aria-label="Studio Canon items">
            <header class="flex items-baseline justify-between border-b border-ink-200 pb-2">
              <div>
                <h2 class="gm-spec text-ink-700">Studio Canon</h2>
                <p class="text-[12px] text-ink-600">Ships in 1-2 business days</p>
              </div>
              <span v-if="apparelSubtotalText" class="text-[13px] font-medium text-ink-950">{{ apparelSubtotalText }}</span>
            </header>
            <div class="divide-y divide-ink-200 border-b border-ink-200">
              <div
                v-for="item in apparelItems"
                :key="item.id"
                class="flex gap-4 py-5"
              >
                <!-- Thumbnail -->
                <div class="h-[100px] w-[100px] flex-shrink-0 overflow-hidden rounded-xl bg-ink-100">
                  <img
                    v-if="thumb(item) && !failedThumbs.has(item.id)"
                    class="h-full w-full object-cover"
                    :src="thumb(item)"
                    :alt="item.title || item.variant_title || 'Item'"
                    @error="failedThumbs.add(item.id)"
                  />
                  <div v-else class="flex h-full w-full items-center justify-center bg-gradient-to-br from-ink-200/60 to-ink-100">
                    <svg class="h-8 w-8 text-ink-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
                  </div>
                </div>

                <!-- Info -->
                <div class="flex flex-1 flex-col justify-between">
                  <div class="flex items-start justify-between gap-4">
                    <div>
                      <div class="text-[15px] font-semibold text-ink-950">{{ item.title || item.variant_title || 'Item' }}</div>
                      <div v-if="item.variant_title && item.title" class="mt-0.5 text-[13px] text-ink-600">{{ item.variant_title }}</div>
                    </div>
                    <div class="text-right text-[15px] font-semibold text-ink-950">{{ lineTotal(item) || '–' }}</div>
                  </div>

                  <div class="mt-3 flex items-center justify-between">
                    <div class="flex items-center gap-0">
                      <button
                        class="flex h-11 w-11 items-center justify-center border border-ink-400 bg-white text-ink-950 hover:bg-cream-50 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-cream-tile"
                        :disabled="item.quantity <= 1"
                        @click="setQty(item, item.quantity - 1)"
                        type="button"
                      >&minus;</button>
                      <div class="flex h-11 min-w-[44px] items-center justify-center border-y border-ink-200 bg-white px-2 text-[14px] font-medium text-ink-950">{{ item.quantity }}</div>
                      <button
                        class="flex h-11 w-11 items-center justify-center border border-ink-400 bg-white text-ink-950 hover:bg-cream-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-cream-tile"
                        @click="setQty(item, item.quantity + 1)"
                        type="button"
                      >+</button>
                    </div>
                    <button
                      class="inline-flex items-center min-h-11 rounded-none text-[13px] text-ink-600 underline hover:text-ink-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-cream-tile"
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

          <!-- Custom & POD section: requires e-proof, longer lead time -->
          <section v-if="podItems.length" :class="apparelItems.length ? 'mt-8' : 'mt-6'" aria-label="Custom and POD items">
            <header class="flex items-baseline justify-between border-b border-ink-200 pb-2">
              <div>
                <h2 class="gm-spec text-ink-700">Custom &amp; POD</h2>
                <p class="text-[12px] text-ink-600">E-proof in 48h, production 2-4 weeks</p>
              </div>
              <span v-if="podSubtotalText" class="text-[13px] font-medium text-ink-950">{{ podSubtotalText }}</span>
            </header>
            <div class="divide-y divide-ink-200 border-b border-ink-200">
              <div
                v-for="item in podItems"
                :key="item.id"
                class="flex gap-4 py-5"
              >
                <!-- Thumbnail (prefers preview_url for POD lines) -->
                <div class="h-[100px] w-[100px] flex-shrink-0 overflow-hidden rounded-xl bg-ink-100">
                  <img
                    v-if="podThumb(item) && !failedThumbs.has(item.id)"
                    class="h-full w-full object-cover"
                    :src="podThumb(item)"
                    :alt="item.title || item.variant_title || 'Item'"
                    @error="failedThumbs.add(item.id)"
                  />
                  <div v-else class="flex h-full w-full items-center justify-center bg-gradient-to-br from-ink-200/60 to-ink-100">
                    <svg class="h-8 w-8 text-ink-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
                  </div>
                </div>

                <!-- Info -->
                <div class="flex flex-1 flex-col justify-between">
                  <div class="flex items-start justify-between gap-4">
                    <div>
                      <div class="text-[15px] font-semibold text-ink-950">{{ item.title || item.variant_title || 'Item' }}</div>
                      <div v-if="item.variant_title && item.title" class="mt-0.5 text-[13px] text-ink-600">{{ item.variant_title }}</div>
                      <div class="mt-1.5 flex flex-wrap gap-1.5">
                        <span class="inline-block rounded bg-ink-200 gm-spec px-[6px] py-[2px] text-ink-950">POD</span>
                        <!--
                          E-PROOF: TEXT PLUS AN ICON, NO FILL, NO BORDER.

                          This was a tinted chip. GRID measured every semantic
                          surface against every ground this palette actually
                          paints on, and they are all invisible:
                            warning-surface 1.02 offWhite / 1.05 cream-tile
                            danger  1.04 · info 1.02 · success 1.01
                          My first instinct was to add semantic-*-border. GRID
                          measured that too and it also fails: best case across
                          all four borders is 1.57:1 against a 3:1 requirement,
                          so it moves the problem from the fill to the stroke.

                          The reason is structural, not a bad token: contrast
                          ratio is a LUMINANCE measure and is blind to hue, so
                          on a palette whose grounds are all high-luminance warm
                          neutrals, ANY light tint measures ~1:1 however
                          different it looks in a swatch. Nothing will ever flag
                          this, which is why it needed a decision rather than a
                          measurement.

                          What does work is the fg token as bare text: measured
                          7.48:1 on offWhite and 6.54:1 at worst on warmGrey.
                          ProductCardChips already ships exactly this and is the
                          live precedent.

                          The icon is not decoration: it is what stops this being
                          a colour-only signal (WCAG 1.4.1), which neither a fill
                          nor a border ever fixed. It is aria-hidden because the
                          adjacent text already says it.
                        -->
                        <span v-if="needsEProof(item)" class="gm-spec inline-flex items-center gap-1 text-semantic-warning-fg"><svg class="h-3.5 w-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg> E-proof needed</span>
                      </div>
                    </div>
                    <div class="text-right text-[15px] font-semibold text-ink-950">{{ lineTotal(item) || '–' }}</div>
                  </div>

                  <div class="mt-3 flex items-center justify-between">
                    <div class="flex items-center gap-0">
                      <button
                        class="flex h-11 w-11 items-center justify-center border border-ink-400 bg-white text-ink-950 hover:bg-cream-50 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-cream-tile"
                        :disabled="item.quantity <= 1"
                        @click="setQty(item, item.quantity - 1)"
                        type="button"
                      >&minus;</button>
                      <div class="flex h-11 min-w-[44px] items-center justify-center border-y border-ink-200 bg-white px-2 text-[14px] font-medium text-ink-950">{{ item.quantity }}</div>
                      <button
                        class="flex h-11 w-11 items-center justify-center border border-ink-400 bg-white text-ink-950 hover:bg-cream-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-cream-tile"
                        @click="setQty(item, item.quantity + 1)"
                        type="button"
                      >+</button>
                    </div>
                    <button
                      class="inline-flex items-center min-h-11 rounded-none text-[13px] text-ink-600 underline hover:text-ink-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-cream-tile"
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

          <NuxtLink to="/products" class="mt-4 inline-flex items-center gap-1.5 rounded-sm text-[14px] text-ink-700 hover:text-ink-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-cream-tile">
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            Continue shopping
          </NuxtLink>
        </div>

        <!-- Order summary sidebar -->
        <aside class="rounded-2xl border border-ink-200 bg-white p-6 lg:sticky lg:top-28">
          <h2 class="text-[18px] font-semibold text-ink-950">Order summary</h2>

          <!-- Discount code -->
          <div class="mt-5">
            <label class="text-[13px] text-ink-600" for="discount-code">Discount code</label>
            <div class="mt-1.5 flex gap-2">
              <input
                id="discount-code"
                v-model="discountCode"
                class="h-11 flex-1 border border-ink-400 bg-white px-3 text-[14px] text-ink-950 placeholder:text-ink-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                placeholder="Enter code"
                type="text"
              />
              <button
                class="h-11 border border-ink-400 bg-white px-4 text-[14px] font-medium text-ink-950 hover:bg-cream-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                type="button"
              >
                Apply
              </button>
            </div>
          </div>

          <div class="mt-5 space-y-2.5 border-t border-ink-200 pt-5">
            <div class="flex items-baseline justify-between text-[14px]">
              <span class="text-ink-600">Subtotal</span>
              <span class="font-medium text-ink-950">{{ cartSubtotal || '–' }}</span>
            </div>
            <div class="flex items-baseline justify-between text-[14px]">
              <span class="text-ink-600">Shipping</span>
              <span class="text-ink-600">Calculated at next step</span>
            </div>
            <div class="flex items-baseline justify-between text-[14px]">
              <span class="text-ink-600">Taxes</span>
              <span class="text-ink-600">Calculated at next step</span>
            </div>
          </div>

          <div class="mt-4 flex items-baseline justify-between border-t border-ink-200 pt-4">
            <span class="text-[16px] font-semibold text-ink-950">Total</span>
            <span class="text-[18px] font-bold text-ink-950">{{ cartSubtotal || '–' }}</span>
          </div>

          <NuxtLink
            to="/checkout"
            class="mt-5 flex h-[50px] w-full items-center justify-center bg-ink-950 text-[14px] font-medium tracking-wide text-white hover:bg-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-white"
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
import { inferLineMode, needsEProof } from '~/utils/cartMode'
import { formatMoneyOrNull } from '~/utils/money'

useHead({ title: 'Cart' })
const { cart, isReady, ensureCart, updateItem, removeItem } = useCart()
await ensureCart()

const items = computed(() => (cart.value?.items ?? []) as any[])
const itemsCount = computed(() => items.value.reduce((sum: number, i: any) => sum + (i?.quantity || 0), 0))
const discountCode = ref('')

function sumLines(rows: any[]) {
  return rows.reduce(
    (sum: number, item: any) => sum + ((item?.unit_price ?? 0) * (item?.quantity ?? 0)),
    0,
  )
}

// Mode classification routes through ~/utils/cartMode: see that module for
// the 5-tier resolution order. Keeping the bucketing as page-level computeds
// (rather than a util) preserves reactivity off the `items` computed above.
const apparelItems = computed(() => items.value.filter((i: any) => inferLineMode(i) === 'apparel'))
const podItems = computed(() => items.value.filter((i: any) => inferLineMode(i) === 'pod'))

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
  return (c?.currency_code || c?.region?.currency_code || 'gbp') as string
})

// Adapter over the shared `~/utils/money` helper. Returns `null` (not the
// en-dash) for unrenderable amounts because the template does its own
// `|| '–'` fallback. Amounts are Medusa v2 major units, no scaling here.
const formatMoney = (amount: number | null | undefined) =>
  formatMoneyOrNull({ amount, currency_code: currencyCode.value })

const cartSubtotal = computed(() => {
  const c: any = cart.value
  return formatMoney(c?.subtotal ?? c?.items_subtotal ?? null)
})

/**
 * Line-item ids whose image failed to load.
 *
 * `thumb()` / `podThumb()` resolve the first NON-NULL url in a fallback chain,
 * which answers "is a url configured?" and not "does that url load?". The
 * template treated the first as the second, so a dead url rendered an <img>
 * that collapsed to the alt string, in the cart, where a customer is deciding
 * whether to spend money, and where a missing product picture reads as a
 * broken order rather than a broken asset.
 *
 * Set-keyed by line id: these are v-for rows and one shared boolean would blank
 * every line as soon as any single one failed.
 */
const failedThumbs = reactive(new Set<string>())

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
