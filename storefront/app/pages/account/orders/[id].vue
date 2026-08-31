<script setup lang="ts">
import { computed, ref } from 'vue'
import type { StoreOrder } from '@medusajs/types'
import { formatMoney as formatMoneyShared } from '~/utils/money'

/**
 * /account/orders/[id]: single order detail view, scoped to the signed-in
 * customer.
 *
 * Layout: AccountShell (shared sidebar nav + page header band) + a 2-column
 * editorial split:
 *   - left column: items list (large thumbnails, title, qty, line total)
 *   - right column: totals summary, shipping address, support CTA
 *
 * Data: a single `sdk.store.order.retrieve` call wide-loads items, addresses
 * and shipping methods so we don't N+1 in the template.
 *
 * ---------------------------------------------------------------------------
 * Why the try/catch went away
 * ---------------------------------------------------------------------------
 * The fetch used to be wrapped in `catch { return null }`, and the template
 * read a null order as "not found". So a timeout, a dropped connection or a
 * 500 all rendered:
 *
 *     We couldn't find that order. It may have been removed, or it might
 *     belong to a different account.
 *
 * That copy accuses the customer of looking at someone else's order because our
 * own backend was slow. It is the worst of the swallowed-error family: not
 * merely unhelpful but insinuating, on a page reached only from a link we
 * ourselves rendered in their own order history.
 *
 * Medusa's SDK throws a `FetchError` carrying the HTTP status
 * (js-sdk/dist/esm/client.js: `throw new FetchError(msg, resp.statusText,
 * resp.status)`), so the two cases are cleanly separable:
 *
 *   404 / 401 / 403 -> genuinely not available to this account. Say so.
 *   anything else   -> our fault. Apologise and offer a retry.
 *
 * ---------------------------------------------------------------------------
 * CORRECTION — what this comment used to claim, and why it was wrong
 * ---------------------------------------------------------------------------
 * It used to read: "401/403 are grouped with 404 deliberately: Medusa answers
 * 'someone else's order' with an auth error."
 *
 * THAT WAS FALSE for @medusajs/medusa 2.11.3, and a wrong comment about an auth
 * boundary is worse than no comment, because the next person reads it and stops
 * checking. Verified in the installed dist rather than the docs:
 *
 *   dist/api/store/orders/middlewares.js
 *     "/store/orders"      -> authenticate("customer", ["session","bearer"])
 *     "/store/orders/:id"  -> validateAndTransformQuery ONLY, no authenticate
 *   dist/api/store/orders/[id]/route.js:5
 *     // TODO: Do we want to apply some sort of authentication here?
 *
 * Stock Medusa answered "someone else's order" with **HTTP 200 and the whole
 * order** — email, full name, delivery address, line items, total — to anyone
 * presenting the publishable key, which ships in this bundle and is public by
 * design. It never returned an auth error, because there was no auth.
 *
 * WHAT IS TRUE NOW. ghostmark/src/api/middlewares.ts adds the guard upstream
 * left out. `GET /store/orders/:id` grants access on either (1) a signed-in
 * customer whose id matches the order's `customer_id` — which is this page's
 * path — or (2) a short-lived capability token minted at cart completion, which
 * is how the guest confirmation page at /order/confirmed/[number] works. Every
 * other request is refused with 401 and an identical body.
 *
 * So the grouping below is correct, but for a reason the old text had backwards:
 * the boundary is one WE now enforce, not one Medusa gave us. The backend
 * returns the SAME 401 for "no such order", "not yours" and "expired link", on
 * purpose — splitting them would build an existence oracle for order ids. This
 * page must keep folding them together; the distinction only ever helps someone
 * enumerating ids.
 *
 * This page sends no `?t=` token and does not need one: Grant (1) covers it,
 * and unlike the token it does not expire.
 * ---------------------------------------------------------------------------
 *
 * Auth: route-level `auth` middleware. Unauthenticated visitors get bounced
 * to `/account/login?redirect=/account/orders/<id>` so they land back here
 * after signing in.
 */

definePageMeta({ middleware: ['auth'] })

const route = useRoute()
const sdk = useMedusaClient()

const orderId = computed(() => String(route.params.id))

const { data: order, pending, error, refresh } = await useAsyncData(
  `gms-order-${orderId.value}`,
  async () => {
    const res = await sdk.store.order.retrieve(orderId.value, {
      fields:
        '*items,*shipping_address,*billing_address,*shipping_methods,*payment_collections.payment_sessions',
    })
    return res.order as StoreOrder
  },
  { watch: [orderId] },
)

// Medusa's FetchError puts the HTTP status on `.status`. `useAsyncData` may
// wrap it, so check the cause too before giving up and treating it as ours.
const errorStatus = computed<number | null>(() => {
  const e = error.value as (Error & { status?: number, statusCode?: number, cause?: unknown }) | null
  if (!e) return null
  const cause = e.cause as { status?: number, statusCode?: number } | undefined
  const code = e.status ?? e.statusCode ?? cause?.status ?? cause?.statusCode
  return typeof code === 'number' ? code : null
})

/**
 * "This order isn't available to you." Covers a bad id, a deleted order, and
 * someone else's order, all indistinguishable from the customer's side, and
 * deliberately kept that way.
 */
const isUnavailable = computed(() =>
  error.value ? [400, 401, 403, 404].includes(errorStatus.value ?? 0) : !order.value,
)

/** Everything else that failed: ours, and probably transient. */
const isOurFault = computed(() => Boolean(error.value) && !isUnavailable.value)

const retrying = ref(false)

const onRetry = async () => {
  if (retrying.value) return
  retrying.value = true
  try {
    await refresh()
  }
  finally {
    retrying.value = false
  }
}

useHead({
  title: () =>
    order.value?.display_id
      ? `Order #${order.value.display_id} · GhostMark Studio`
      : 'Order · GhostMark Studio',
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const formatDate = (iso?: string | Date | null) => {
  if (!iso) return ''
  const d = typeof iso === 'string' ? new Date(iso) : iso
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d)
}

// Routes through the shared `~/utils/money` helper so the minor->major
// conversion (Medusa V2 returns pence/cents) is owned in one place. Keeps
// the original `(amount, currency)` positional signature so the template
// doesn't need to be touched.
const formatMoney = (amount?: number | null, currency = 'gbp'): string =>
  formatMoneyShared({ amount, currency_code: currency })

type BadgeVariant = 'neutral' | 'success' | 'warning' | 'danger' | 'info'

/**
 * Map Medusa's order status enum to a UiBadge variant. The set of returned
 * statuses is stable across recent Medusa v2 releases, anything we don't
 * recognise falls back to `neutral` so a future status doesn't render as
 * raw text without colour treatment.
 */
const statusVariant = (status?: string | null): BadgeVariant => {
  switch ((status || '').toLowerCase()) {
    case 'completed':
    case 'captured':
    case 'shipped':
    case 'delivered':
    case 'fulfilled':
      return 'success'
    case 'pending':
    case 'requires_action':
    case 'not_fulfilled':
    case 'partially_fulfilled':
      return 'warning'
    case 'canceled':
    case 'cancelled':
    case 'failed':
    case 'rejected':
      return 'danger'
    case 'archived':
      return 'info'
    default:
      return 'neutral'
  }
}
</script>

<template>
  <AccountShell
    page-title="Order detail"
    intro="Everything we shipped (or are about to ship) for this order, with totals and address on hand."
  >
    <!-- 1 of 3: pending ----------------------------------------------- -->
    <div
      v-if="pending"
      role="status"
      class="flex items-center gap-3 border border-ink-200 bg-white px-6 py-10 font-body text-caption text-ink-500"
    >
      <UiSpinner :size="16" />
      <span>Loading order…</span>
    </div>

    <!--
      2 of 3: our fault. This branch exists so the "belongs to a different
      account" sentence below can never again be shown to someone whose only
      mistake was clicking a link while our API was down.
    -->
    <UiEmptyState
      v-else-if="isOurFault"
      variant="error"
      title="We couldn't load this order."
      description="This is on us, not you. The order is fine, we just couldn't fetch it. Try again in a moment."
      :busy="retrying || pending"
      @retry="onRetry"
    >
      <template #extra-actions>
        <UiButton as="NuxtLink" to="/account/orders" variant="outline" size="md">
          Back to all orders
        </UiButton>
      </template>
    </UiEmptyState>

    <!-- 3a of 3: resolved, and this order genuinely isn't available ---- -->
    <UiEmptyState
      v-else-if="isUnavailable"
      variant="empty"
      title="We couldn't find that order."
      description="It may have been removed, or it might belong to a different account. Head back to your order history to pick another."
    >
      <template #actions>
        <UiButton as="NuxtLink" to="/account/orders" variant="outline" size="md">
          Back to all orders
        </UiButton>
      </template>
    </UiEmptyState>

    <!-- 3b of 3: resolved, order loaded ------------------------------- -->
    <div v-else class="space-y-12">
      <!-- Header strip ------------------------------------------------ -->
      <div
        class="flex flex-col gap-4 border-b border-ink-200 pb-6 lg:flex-row lg:items-end lg:justify-between"
      >
        <div>
          <p class="text-eyebrow font-body uppercase text-ink-500">
            Order #{{ order.display_id ?? order.id.slice(-6) }}
          </p>
          <p class="mt-2 font-display text-display-sm text-ink-950">
            {{ formatDate(order.created_at) }}
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <UiBadge :variant="statusVariant(order.status)">
            {{ order.status || 'pending' }}
          </UiBadge>
          <UiBadge
            v-if="order.payment_status"
            :variant="statusVariant(order.payment_status)"
          >
            {{ order.payment_status }}
          </UiBadge>
          <UiBadge
            v-if="order.fulfillment_status"
            :variant="statusVariant(order.fulfillment_status)"
          >
            {{ order.fulfillment_status }}
          </UiBadge>
        </div>
      </div>

      <!-- 2-column body ---------------------------------------------- -->
      <div class="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_360px]">
        <!-- Items ---------------------------------------------------- -->
        <section aria-labelledby="order-items-heading">
          <h2
            id="order-items-heading"
            class="font-display text-display-md text-ink-950"
          >
            Items
          </h2>

          <ul
            v-if="order.items?.length"
            class="mt-6 divide-y divide-ink-200 border-t border-ink-200"
          >
            <li
              v-for="item in order.items"
              :key="item.id"
              class="flex gap-4 py-6"
            >
              <NuxtImg
                v-if="item.thumbnail"
                :src="item.thumbnail"
                :alt="item.product_title || item.title || ''"
                width="80"
                height="100"
                loading="lazy"
                class="aspect-[4/5] w-20 shrink-0 bg-cream-tile object-cover"
              />
              <div
                v-else
                class="aspect-[4/5] w-20 shrink-0 bg-cream-tile"
                aria-hidden="true"
              />

              <div class="min-w-0 flex-1">
                <p class="font-body text-body text-ink-950">
                  {{ item.product_title || item.title }}
                </p>
                <p
                  v-if="item.variant_title && item.variant_title !== item.title"
                  class="mt-0.5 font-body text-caption text-ink-500"
                >
                  {{ item.variant_title }}
                </p>
                <p class="mt-1 font-body text-caption text-ink-500">
                  Qty {{ item.quantity }}
                </p>
              </div>

              <p class="shrink-0 font-body text-body text-ink-950">
                {{ formatMoney(item.total, order.currency_code) }}
              </p>
            </li>
          </ul>

          <p
            v-else
            class="mt-6 border-t border-ink-200 pt-6 font-body text-caption text-ink-500"
          >
            This order has no items associated with it.
          </p>
        </section>

        <!-- Aside: summary + addresses + help ------------------------ -->
        <aside class="space-y-10">
          <!-- Totals --------------------------------------------------- -->
          <section
            aria-labelledby="order-summary-heading"
            class="bg-cream-tile p-6"
          >
            <h3
              id="order-summary-heading"
              class="text-eyebrow font-body uppercase text-ink-500"
            >
              Summary
            </h3>
            <dl class="mt-4 space-y-2 font-body text-body text-ink-700">
              <div class="flex justify-between">
                <dt>Subtotal</dt>
                <dd>{{ formatMoney(order.item_subtotal, order.currency_code) }}</dd>
              </div>
              <div class="flex justify-between">
                <dt>Shipping</dt>
                <dd>{{ formatMoney(order.shipping_total, order.currency_code) }}</dd>
              </div>
              <div
                v-if="order.discount_total"
                class="flex justify-between"
              >
                <dt>Discount</dt>
                <dd>−{{ formatMoney(order.discount_total, order.currency_code) }}</dd>
              </div>
              <div class="flex justify-between">
                <dt>Tax</dt>
                <dd>{{ formatMoney(order.tax_total, order.currency_code) }}</dd>
              </div>
              <div
                class="mt-2 flex justify-between border-t border-ink-200 pt-3 font-medium text-ink-950"
              >
                <dt>Total</dt>
                <dd>{{ formatMoney(order.total, order.currency_code) }}</dd>
              </div>
            </dl>
          </section>

          <!-- Shipping address --------------------------------------- -->
          <section
            v-if="order.shipping_address"
            aria-labelledby="order-shipping-heading"
          >
            <h3
              id="order-shipping-heading"
              class="text-eyebrow font-body uppercase text-ink-500"
            >
              Shipping to
            </h3>
            <address
              class="mt-3 space-y-1 font-body text-body not-italic text-ink-700"
            >
              <p class="text-ink-950">
                {{ order.shipping_address.first_name }}
                {{ order.shipping_address.last_name }}
              </p>
              <p v-if="order.shipping_address.company">
                {{ order.shipping_address.company }}
              </p>
              <p v-if="order.shipping_address.address_1">
                {{ order.shipping_address.address_1 }}
              </p>
              <p v-if="order.shipping_address.address_2">
                {{ order.shipping_address.address_2 }}
              </p>
              <p>
                {{ order.shipping_address.postal_code }}
                {{ order.shipping_address.city }}
              </p>
              <p v-if="order.shipping_address.province">
                {{ order.shipping_address.province }}
              </p>
              <p v-if="order.shipping_address.country_code">
                {{ order.shipping_address.country_code.toUpperCase() }}
              </p>
            </address>
          </section>

          <!-- Help CTA ----------------------------------------------- -->
          <section
            aria-labelledby="order-help-heading"
            class="bg-merchery-sage p-6"
          >
            <p
              id="order-help-heading"
              class="font-display text-[20px] leading-tight text-ink-950"
            >
              Need help with this order?
            </p>
            <p class="mb-4 mt-2 font-body text-body text-ink-700">
              Our team typically replies within a few hours.
            </p>
            <UiButton
              as="NuxtLink"
              to="/contact"
              variant="merchery"
              size="sm"
            >
              Contact support
            </UiButton>
          </section>
        </aside>
      </div>
    </div>
  </AccountShell>
</template>
