<template>
  <div class="bg-[#f5f1ec] min-h-screen">
    <!-- Step indicator -->
    <div class="border-b border-zinc-200 bg-white">
      <div class="mx-auto flex w-full max-w-screen-xl items-center justify-center gap-6 px-5 py-4 text-[13px] sm:gap-10">
        <NuxtLink to="/cart" class="flex items-center gap-2 text-zinc-400 hover:text-zinc-600">
          <span class="flex h-6 w-6 items-center justify-center rounded-full border border-zinc-300 text-[11px] font-bold">1</span>
          Cart
        </NuxtLink>
        <span class="h-px w-6 bg-zinc-300" />
        <span
          class="flex items-center gap-2"
          :class="step >= 1 ? 'font-semibold text-zinc-950' : 'text-zinc-400'"
        >
          <span
            class="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold"
            :class="step >= 1 ? 'bg-zinc-950 text-white' : 'border border-zinc-300'"
          >2</span>
          Shipping
        </span>
        <span class="h-px w-6 bg-zinc-300" />
        <span
          class="flex items-center gap-2"
          :class="step >= 2 ? 'font-semibold text-zinc-950' : 'text-zinc-400'"
        >
          <span
            class="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold"
            :class="step >= 2 ? 'bg-zinc-950 text-white' : 'border border-zinc-300'"
          >3</span>
          Payment
        </span>
        <span class="h-px w-6 bg-zinc-300" />
        <span
          class="flex items-center gap-2"
          :class="step >= 3 ? 'font-semibold text-zinc-950' : 'text-zinc-400'"
        >
          <span
            class="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold"
            :class="step >= 3 ? 'bg-zinc-950 text-white' : 'border border-zinc-300'"
          >4</span>
          Confirmation
        </span>
      </div>
    </div>

    <div class="mx-auto w-full max-w-screen-xl px-5 py-10 sm:px-6 lg:px-8">
      <div v-if="!cart" class="py-20 text-center text-zinc-500">Loading&hellip;</div>

      <div v-else class="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
        <!-- Main form area -->
        <div>
          <!-- Step 1: Shipping -->
          <div v-if="step === 1">
            <h1 class="font-serif text-[28px] text-zinc-950">Shipping details</h1>
            <p class="mt-1 text-[14px] text-zinc-500">Where should we send your order?</p>

            <form class="mt-6 rounded-2xl border border-zinc-200 bg-white p-6" @submit.prevent="onSaveShipping">
              <div class="grid gap-4 sm:grid-cols-2">
                <div>
                  <label class="text-[13px] text-zinc-500" for="ship-email">Email</label>
                  <input id="ship-email" v-model="email" class="mt-1.5 h-[42px] w-full border border-zinc-200 bg-white px-3 text-[14px] text-zinc-950 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300" type="email" autocomplete="email" required />
                </div>
                <div>
                  <label class="text-[13px] text-zinc-500" for="ship-phone">Phone</label>
                  <input id="ship-phone" v-model="ship.phone" class="mt-1.5 h-[42px] w-full border border-zinc-200 bg-white px-3 text-[14px] text-zinc-950 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300" type="tel" autocomplete="tel" />
                </div>
              </div>

              <div class="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label class="text-[13px] text-zinc-500" for="ship-first">First name</label>
                  <input id="ship-first" v-model="ship.first_name" class="mt-1.5 h-[42px] w-full border border-zinc-200 bg-white px-3 text-[14px] text-zinc-950 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300" type="text" autocomplete="given-name" required />
                </div>
                <div>
                  <label class="text-[13px] text-zinc-500" for="ship-last">Last name</label>
                  <input id="ship-last" v-model="ship.last_name" class="mt-1.5 h-[42px] w-full border border-zinc-200 bg-white px-3 text-[14px] text-zinc-950 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300" type="text" autocomplete="family-name" required />
                </div>
              </div>

              <div class="mt-4">
                <label class="text-[13px] text-zinc-500" for="ship-address">Address</label>
                <input id="ship-address" v-model="ship.address_1" class="mt-1.5 h-[42px] w-full border border-zinc-200 bg-white px-3 text-[14px] text-zinc-950 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300" type="text" autocomplete="address-line1" required />
              </div>

              <div class="mt-4 grid gap-4 sm:grid-cols-3">
                <div>
                  <label class="text-[13px] text-zinc-500" for="ship-city">City</label>
                  <input id="ship-city" v-model="ship.city" class="mt-1.5 h-[42px] w-full border border-zinc-200 bg-white px-3 text-[14px] text-zinc-950 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300" type="text" autocomplete="address-level2" required />
                </div>
                <div>
                  <label class="text-[13px] text-zinc-500" for="ship-postal">Postal code</label>
                  <input id="ship-postal" v-model="ship.postal_code" class="mt-1.5 h-[42px] w-full border border-zinc-200 bg-white px-3 text-[14px] text-zinc-950 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300" type="text" autocomplete="postal-code" required />
                </div>
                <div>
                  <label class="text-[13px] text-zinc-500" for="ship-country">Country</label>
                  <input id="ship-country" v-model="ship.country_code" class="mt-1.5 h-[42px] w-full border border-zinc-200 bg-white px-3 text-[14px] text-zinc-950 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300" type="text" placeholder="us" autocomplete="country" required />
                </div>
              </div>

              <!-- Shipping options -->
              <div v-if="shippingOptions.length" class="mt-6 border-t border-zinc-200 pt-5">
                <h3 class="text-[14px] font-semibold text-zinc-950">Shipping method</h3>
                <div class="mt-3 grid gap-2">
                  <label
                    v-for="opt in shippingOptions"
                    :key="opt.id"
                    class="flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition"
                    :class="selectedShippingOptionId === opt.id ? 'border-zinc-950 bg-zinc-50' : 'border-zinc-200 hover:border-zinc-300'"
                  >
                    <input
                      type="radio"
                      name="shipping-option"
                      :value="opt.id"
                      v-model="selectedShippingOptionId"
                      class="accent-zinc-950"
                    />
                    <span class="text-[14px] text-zinc-950">{{ opt.name || opt.id }}</span>
                  </label>
                </div>
              </div>

              <p v-if="shipError" class="mt-3 text-[13px] text-red-700">{{ shipError }}</p>

              <div class="mt-5 flex flex-wrap gap-3">
                <button
                  class="inline-flex h-[48px] items-center justify-center bg-zinc-950 px-7 text-[14px] font-medium tracking-wide text-white hover:bg-zinc-800 disabled:opacity-50"
                  type="submit"
                  :disabled="savingShip"
                >
                  {{ savingShip ? 'Saving...' : 'Continue to payment' }}
                </button>
                <NuxtLink to="/cart" class="inline-flex h-[48px] items-center justify-center border border-zinc-200 bg-white px-6 text-[14px] text-zinc-600 hover:bg-zinc-50">
                  Back to cart
                </NuxtLink>
              </div>
            </form>
          </div>

          <!-- Step 2: Payment -->
          <div v-else-if="step === 2">
            <h1 class="font-serif text-[28px] text-zinc-950">Payment</h1>
            <p class="mt-1 text-[14px] text-zinc-500">Choose your payment method to complete your order.</p>

            <div class="mt-6 rounded-2xl border border-zinc-200 bg-white p-6">
              <div v-if="providersLoading" class="text-zinc-500">Loading payment providers&hellip;</div>
              <div v-else-if="!visibleProviders.length" class="text-zinc-500">No payment providers available. Please contact support.</div>
              <div v-else>
                <h3 class="text-[14px] font-semibold text-zinc-950">Payment method</h3>
                <div class="mt-3 grid gap-2">
                  <label
                    v-for="p in visibleProviders"
                    :key="p.id"
                    class="flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition"
                    :class="selectedProviderId === p.id ? 'border-zinc-950 bg-zinc-50' : 'border-zinc-200 hover:border-zinc-300'"
                  >
                    <input
                      type="radio"
                      name="payment-provider"
                      :value="p.id"
                      v-model="selectedProviderId"
                      class="accent-zinc-950"
                    />
                    <span class="text-[14px] text-zinc-950">{{ providerLabel(p.id) }}</span>
                  </label>
                </div>

                <!-- Stripe Card Element mount target -->
                <div v-show="isStripeSelected" class="mt-5">
                  <label class="text-[13px] font-medium text-ink-800">Card details</label>
                  <div
                    v-show="stripeReady"
                    ref="stripeMountEl"
                    class="mt-1.5 border border-zinc-200 bg-white px-4 py-3 rounded-md"
                  />
                  <div v-if="stripeInitError" class="mt-2 text-[13px] text-red-700">
                    {{ stripeInitError }}
                  </div>
                  <div v-else-if="!stripeConfigured" class="mt-2 text-[13px] text-amber-700">
                    Card payments are not configured. Set <code>NUXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code> in the environment.
                  </div>
                  <div v-else-if="!stripeReady" class="mt-2 flex items-center gap-2 text-[13px] text-zinc-500">
                    <UiSpinner :size="14" /> Initializing secure card form&hellip;
                  </div>
                  <p
                    v-if="cardError"
                    role="alert"
                    class="mt-2 text-[12px] text-red-600"
                  >
                    {{ cardError }}
                  </p>
                </div>
              </div>

              <p v-if="payError" class="mt-3 text-[13px] text-red-700">{{ payError }}</p>
              <p v-if="orderResult" class="mt-3 text-[13px] text-emerald-700">{{ orderResult }}</p>

              <div class="mt-5 flex flex-wrap gap-3">
                <button
                  class="inline-flex h-[48px] items-center justify-center gap-2 bg-zinc-950 px-7 text-[14px] font-medium tracking-wide text-white hover:bg-zinc-800 disabled:opacity-50"
                  type="button"
                  :disabled="placeDisabled"
                  @click="onPlaceOrder"
                >
                  <UiSpinner v-if="placing" :size="16" />
                  {{ placing ? 'Placing order...' : 'Place order' }}
                </button>
                <button
                  class="inline-flex h-[48px] items-center justify-center border border-zinc-200 bg-white px-6 text-[14px] text-zinc-600 hover:bg-zinc-50"
                  type="button"
                  @click="step = 1"
                >
                  Back to shipping
                </button>
              </div>
            </div>
          </div>

          <!-- Step 3: Confirmation -->
          <div v-else-if="step === 3" class="flex flex-col items-center py-10 text-center">
            <svg class="h-16 w-16 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <h1 class="mt-6 font-serif text-[32px] text-zinc-950">Thank you!</h1>
            <p class="mt-2 text-[15px] text-zinc-600">Your order has been placed successfully.</p>
            <p v-if="confirmationId" class="mt-1 text-[14px] text-zinc-500">Order ID: {{ confirmationId }}</p>
            <NuxtLink to="/products" class="mt-8 inline-flex h-[48px] items-center justify-center bg-zinc-950 px-8 text-[14px] font-medium tracking-wide text-white hover:bg-zinc-800">
              Continue shopping
            </NuxtLink>
          </div>
        </div>

        <!-- Order summary sidebar (steps 1 & 2) -->
        <aside v-if="step < 3" class="rounded-2xl border border-zinc-200 bg-white p-6 lg:sticky lg:top-28">
          <h2 class="text-[18px] font-semibold text-zinc-950">Order summary</h2>

          <!-- Mixed-mode delivery banner — renders only when the cart spans POD + apparel -->
          <CartModeBanner :items="cartItems" class="mt-4 mb-0" />

          <div class="mt-4 max-h-[300px] divide-y divide-zinc-100 overflow-y-auto">
            <div v-for="item in cartItems" :key="item.id" class="flex gap-3 py-3">
              <div class="h-[56px] w-[56px] flex-shrink-0 overflow-hidden rounded-lg bg-zinc-100">
                <img
                  v-if="item.thumbnail"
                  class="h-full w-full object-cover"
                  :src="item.thumbnail"
                  :alt="item.title"
                />
              </div>
              <div class="flex-1">
                <div class="text-[13px] font-medium text-zinc-950 line-clamp-1">{{ item.title }}</div>
                <div class="text-[12px] text-zinc-500">Qty: {{ item.quantity }}</div>
              </div>
              <div class="text-[13px] font-medium text-zinc-950">{{ formatMoney(item.total ?? item.subtotal) }}</div>
            </div>
          </div>

          <div class="mt-4 space-y-2 border-t border-zinc-200 pt-4">
            <div class="flex items-baseline justify-between text-[14px]">
              <span class="text-zinc-500">Subtotal</span>
              <span class="font-medium text-zinc-950">{{ cartSubtotal }}</span>
            </div>
            <div class="flex items-baseline justify-between text-[14px]">
              <span class="text-zinc-500">Shipping</span>
              <span class="text-zinc-500">{{ cartShipping || 'Calculated at checkout' }}</span>
            </div>
            <div class="flex items-baseline justify-between text-[14px]">
              <span class="text-zinc-500">Taxes</span>
              <span class="text-zinc-500">{{ cartTax || 'Included' }}</span>
            </div>
            <!-- Estimated delivery — copy branches on cart mode (all-apparel / all-pod / mixed) -->
            <div v-if="cartItems.length" class="flex items-baseline justify-between gap-3 text-[14px]">
              <span class="text-zinc-500">Estimated delivery</span>
              <span class="text-right text-zinc-700">{{ estimatedDeliveryText }}</span>
            </div>
          </div>

          <div class="mt-3 flex items-baseline justify-between border-t border-zinc-200 pt-3">
            <span class="text-[16px] font-semibold text-zinc-950">Total</span>
            <span class="text-[18px] font-bold text-zinc-950">{{ cartTotal }}</span>
          </div>
        </aside>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, watch } from 'vue'
import type {
  Stripe,
  StripeElements,
  StripeCardElement,
  StripeCardElementChangeEvent,
} from '@stripe/stripe-js'
import UiSpinner from '~/components/ui/UiSpinner.vue'
import CartModeBanner from '~/components/cart/CartModeBanner.vue'
import { inferCartMode } from '~/utils/cartMode'

useHead({ title: 'Checkout' })
const sdk = useMedusaClient()
const regionState = useRegion()
const { cart, cartId, ensureCart, updateCart, listShippingOptions, addShippingMethod, complete, refresh } = useCart()
const { stripePromise, isConfigured: stripeConfigured } = useStripe()
await ensureCart()

const STRIPE_PROVIDER_ID = 'pp_stripe_stripe'
const isProd = import.meta.env.PROD

const isStripeProvider = (id: string | undefined | null) => {
  if (!id) return false
  return id === STRIPE_PROVIDER_ID || id.startsWith('pp_stripe_')
}

const isManualProvider = (id: string | undefined | null) => {
  if (!id) return false
  return id === 'pp_system_default' || id === 'manual' || id.includes('system_default')
}

const providerLabel = (id: string) => {
  if (isStripeProvider(id)) return 'Card (Visa, Mastercard, Amex)'
  if (isManualProvider(id)) return 'Manual / Cash on delivery'
  return id
}

const step = ref(1)
const email = ref('')
const ship = reactive({
  first_name: '',
  last_name: '',
  address_1: '',
  city: '',
  postal_code: '',
  country_code: 'us',
  phone: '',
})

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

const cartItems = computed(() => (cart.value?.items ?? []) as any[])
const cartSubtotal = computed(() => formatMoney((cart.value as any)?.subtotal) || '-')
const cartShipping = computed(() => formatMoney((cart.value as any)?.shipping_total) || null)
const cartTax = computed(() => formatMoney((cart.value as any)?.tax_total) || null)
const cartTotal = computed(() => formatMoney((cart.value as any)?.total) || cartSubtotal.value)

// Cart mode classification routes through ~/utils/cartMode (`inferCartMode`).
// Drives the estimated-delivery copy below: all-apparel cart shows the fast
// D2C ETA, all-POD cart shows the e-proof + production ETA, mixed defers to
// the banner above the line items so we don't double-narrate.
const cartMode = computed(() => inferCartMode(cartItems.value))

const estimatedDeliveryText = computed(() => {
  switch (cartMode.value) {
    case 'apparel':
      return '2-5 business days'
    case 'pod':
      return '3-5 weeks (48h e-proof + 2-4 weeks production)'
    case 'mixed':
      return 'Two delivery tracks - see banner above'
    default:
      return ''
  }
})

// Shipping
const savingShip = ref(false)
const shipError = ref<string | null>(null)
const shippingOptions = ref<any[]>([])
const selectedShippingOptionId = ref('')

const onSaveShipping = async () => {
  savingShip.value = true
  shipError.value = null
  try {
    await updateCart({
      email: email.value,
      shipping_address: { ...ship },
      billing_address: { ...ship },
    })
    await refresh()
    // Load shipping options
    shippingOptions.value = await listShippingOptions()
    if (shippingOptions.value.length === 1) {
      selectedShippingOptionId.value = shippingOptions.value[0].id
    }
    if (selectedShippingOptionId.value) {
      await addShippingMethod(selectedShippingOptionId.value)
      await refresh()
    }
    // Load payment providers and advance
    await loadProviders()
    step.value = 2
  } catch (e: any) {
    shipError.value = e?.message || 'Failed to save shipping details.'
  } finally {
    savingShip.value = false
  }
}

// Payment
const providers = ref<any[]>([])
const providersLoading = ref(false)
const selectedProviderId = ref('')

const visibleProviders = computed(() => {
  return providers.value.filter((p: any) => {
    if (isProd && isManualProvider(p?.id)) return false
    return true
  })
})

const isStripeSelected = computed(() => isStripeProvider(selectedProviderId.value))

const loadProviders = async () => {
  providersLoading.value = true
  try {
    const regionId = cart.value?.region_id || (regionState.regionId.value as any)
    const res = await sdk.store.payment.listPaymentProviders({ region_id: regionId } as any)
    providers.value = (res as any).payment_providers ?? []
    const visible = visibleProviders.value
    // Prefer Stripe by default if available, otherwise the first visible provider.
    const stripeOption = visible.find((p: any) => isStripeProvider(p.id))
    if (stripeOption) {
      selectedProviderId.value = stripeOption.id
    } else if (visible.length === 1) {
      selectedProviderId.value = visible[0].id
    }
  } finally {
    providersLoading.value = false
  }
}

// ---------------------------------------------------------------------------
// Stripe Elements lifecycle
//
// Stripe instances embed cross-origin iframes with internal mutable state.
// They MUST NOT be wrapped in `reactive()` / `ref()` — Vue's Proxy machinery
// breaks Stripe's internal `===` identity checks (same trap as Konva nodes).
// We hold them in module-scoped `let` bindings and surface only primitives
// (booleans, strings) via refs to the template.
// ---------------------------------------------------------------------------
let stripeInstance: Stripe | null = null
let stripeElements: StripeElements | null = null
let cardElement: StripeCardElement | null = null
let stripeClientSecret: string | null = null
let stripeInitInFlight = false

const stripeMountEl = ref<HTMLDivElement | null>(null)
const stripeReady = ref(false)
const stripeInitError = ref<string | null>(null)
const cardError = ref<string | null>(null)
const cardComplete = ref(false)

const extractClientSecret = (): string | null => {
  const sessions = (cart.value as any)?.payment_collection?.payment_sessions ?? []
  const stripeSession = sessions.find((s: any) => isStripeProvider(s?.provider_id))
  return stripeSession?.data?.client_secret ?? null
}

const teardownStripe = () => {
  if (cardElement) {
    try { cardElement.unmount() } catch {}
    try { cardElement.destroy() } catch {}
    cardElement = null
  }
  stripeElements = null
  stripeClientSecret = null
  stripeReady.value = false
  cardError.value = null
  cardComplete.value = false
}

const initStripe = async () => {
  if (stripeInitInFlight) return
  if (cardElement) return // already mounted
  if (!stripeConfigured) {
    stripeInitError.value = 'Stripe publishable key is missing.'
    return
  }
  stripeInitInFlight = true
  stripeInitError.value = null
  try {
    // 1) Load Stripe.js once (singleton in useStripe()).
    if (!stripeInstance) {
      stripeInstance = await stripePromise
      if (!stripeInstance) {
        throw new Error('Failed to load Stripe.js.')
      }
    }

    // 2) Initiate payment session on the cart so Medusa creates the
    //    PaymentIntent and exposes its client_secret.
    await sdk.store.payment.initiatePaymentSession(
      cart.value as any,
      { provider_id: STRIPE_PROVIDER_ID, data: {} } as any,
    )
    await refresh()
    stripeClientSecret = extractClientSecret()
    if (!stripeClientSecret) {
      throw new Error('Stripe payment session was created but no client_secret was returned.')
    }

    // Dev-only debug hook for headless E2E verification. Stripped from prod.
    if (import.meta.dev && import.meta.client) {
      ;(window as any).__gmsStripeDebug = {
        provider: STRIPE_PROVIDER_ID,
        clientSecretPrefix: stripeClientSecret.slice(0, 18),
        hasClientSecret: true,
        elementsMounted: true,
      }
    }

    // 3) Create Elements + Card Element. Note: we do NOT pass `clientSecret`
    //    to elements() — that switches Elements into Payment-Element mode.
    //    For the standalone Card Element + confirmCardPayment flow we hand
    //    the secret directly to confirmCardPayment().
    stripeElements = stripeInstance.elements()
    cardElement = stripeElements.create('card', {
      hidePostalCode: false,
      style: {
        base: {
          fontFamily: 'Inter Tight, system-ui, sans-serif',
          fontSize: '15px',
          color: '#171717',
          '::placeholder': { color: '#73777E' },
        },
        invalid: { color: '#D43A2F' },
      },
    })

    cardElement.on('change', (event: StripeCardElementChangeEvent) => {
      cardError.value = event.error?.message ?? null
      cardComplete.value = event.complete
    })

    // 4) Reveal the mount target (v-show flips), then wait for the DOM to
    //    flush before calling .mount() so Stripe sees a real, sized node.
    stripeReady.value = true
    await nextTick()
    if (stripeMountEl.value) {
      cardElement.mount(stripeMountEl.value)
    } else {
      throw new Error('Stripe mount target not found.')
    }
  } catch (e: any) {
    stripeInitError.value = e?.message || 'Failed to initialize Stripe.'
    teardownStripe()
  } finally {
    stripeInitInFlight = false
  }
}

// React to provider radio changes. Selecting Stripe initializes (idempotent);
// selecting anything else tears down so the iframe doesn't linger.
watch(selectedProviderId, (next, prev) => {
  if (isStripeProvider(next)) {
    void initStripe()
  } else if (isStripeProvider(prev)) {
    teardownStripe()
  }
})

// Tear down on step change away from payment + on unmount.
watch(step, (next) => {
  if (next !== 2) teardownStripe()
})

onBeforeUnmount(() => {
  teardownStripe()
})

const placing = ref(false)
const payError = ref<string | null>(null)
const orderResult = ref<string | null>(null)
const confirmationId = ref<string | null>(null)

const placeDisabled = computed(() => {
  if (placing.value) return true
  if (!selectedProviderId.value) return true
  if (isStripeSelected.value) {
    if (!stripeReady.value || !cardElement || !stripeClientSecret) return true
    if (!cardComplete.value) return true
  }
  return false
})

const buildBillingDetails = () => {
  const c = cart.value as any
  const billing = c?.billing_address ?? c?.shipping_address ?? {}
  return {
    name: [billing.first_name, billing.last_name].filter(Boolean).join(' ') || undefined,
    email: c?.email || undefined,
    phone: billing.phone || undefined,
    address: {
      city: billing.city || undefined,
      country: billing.country_code || undefined,
      line1: billing.address_1 || undefined,
      line2: billing.address_2 || undefined,
      postal_code: billing.postal_code || undefined,
      state: billing.province || undefined,
    },
  }
}

const finalizeOrder = async () => {
  const result: any = await complete()
  // Medusa V2 returns either { type: 'order', order } on success or
  // { type: 'cart', cart, error } when payment finalisation fails.
  if (result?.type === 'cart' && result?.error) {
    throw new Error(result.error?.message || 'Cart could not be completed.')
  }
  const order = result?.order ?? (result?.type === 'order' ? result?.order : null) ?? result
  confirmationId.value = order?.id || result?.id || null
  // Clear the cart cookie so a fresh cart is created on the next visit.
  cartId.value = null
  step.value = 3
}

const onPlaceOrder = async () => {
  if (!selectedProviderId.value) return
  placing.value = true
  payError.value = null
  try {
    if (isStripeSelected.value) {
      // Stripe branch: confirmCardPayment, then Medusa cart.complete().
      if (!stripeInstance || !cardElement || !stripeClientSecret) {
        throw new Error('Stripe is not ready. Please wait a moment and try again.')
      }
      const { error, paymentIntent } = await stripeInstance.confirmCardPayment(
        stripeClientSecret,
        {
          payment_method: {
            card: cardElement,
            billing_details: buildBillingDetails(),
          },
        },
      )
      if (error) {
        cardError.value = error.message ?? 'Card was declined.'
        return
      }
      if (paymentIntent?.status !== 'succeeded' && paymentIntent?.status !== 'requires_capture') {
        cardError.value = `Payment status: ${paymentIntent?.status ?? 'unknown'}.`
        return
      }
      await finalizeOrder()
    } else {
      // Manual / system_default branch: legacy flow.
      await sdk.store.payment.initiatePaymentSession(
        cart.value as any,
        { provider_id: selectedProviderId.value, data: {} } as any,
      )
      await refresh()
      await finalizeOrder()
    }
  } catch (e: any) {
    payError.value = e?.message || 'Failed to place order.'
  } finally {
    placing.value = false
  }
}
</script>
