<script setup lang="ts">
import { computed } from 'vue'
import type { StoreOrder } from '@medusajs/types'
import { formatMoney as formatMoneyShared } from '~/utils/money'

/**
 * /account/orders/[id] — single order detail view, scoped to the signed-in
 * customer.
 *
 * Layout: AccountShell (shared sidebar nav + page header band) + a 2-column
 * editorial split:
 *   - left column: items list (large thumbnails, title, qty, line total)
 *   - right column: totals summary, shipping address, support CTA
 *
 * Data: a single `sdk.store.order.retrieve` call wide-loads items, addresses
 * and shipping methods so we don't N+1 in the template. The fetch is wrapped
 * in try/catch so an unknown / not-yours order id gracefully renders the
 * "we couldn't find that order" empty state rather than a 500.
 *
 * Auth: route-level `auth` middleware. Unauthenticated visitors get bounced
 * to `/account/login?redirect=/account/orders/<id>` so they land back here
 * after signing in.
 */

definePageMeta({ middleware: ['auth'] })

const route = useRoute()
const sdk = useMedusaClient()

const orderId = computed(() => String(route.params.id))

const { data: order, pending } = await useAsyncData(
  `gms-order-${orderId.value}`,
  async () => {
    try {
      const res = await sdk.store.order.retrieve(orderId.value, {
        fields:
          '*items,*shipping_address,*billing_address,*shipping_methods,*payment_collections.payment_sessions',
      })
      return res.order as StoreOrder
    }
    catch {
      return null
    }
  },
  { watch: [orderId] },
)

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
 * statuses is stable across recent Medusa v2 releases — anything we don't
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
    <!-- Loading -------------------------------------------------------- -->
    <div
      v-if="pending"
      class="flex items-center gap-3 border border-ink-200 bg-white px-6 py-10 font-body text-caption text-ink-500"
    >
      <UiSpinner :size="16" />
      <span>Loading order…</span>
    </div>

    <!-- Empty / not found --------------------------------------------- -->
    <div
      v-else-if="!order"
      class="border border-ink-200 bg-white px-6 py-16 text-center"
    >
      <p class="font-display text-[24px] leading-tight text-ink-950">
        We couldn't find that order.
      </p>
      <p class="mx-auto mt-2 max-w-md font-body text-caption text-ink-500">
        It may have been removed, or it might belong to a different account.
        Head back to your order history to pick another.
      </p>
      <UiButton
        as="NuxtLink"
        to="/account/orders"
        variant="outline"
        size="md"
        class="mt-6"
      >
        Back to all orders
      </UiButton>
    </div>

    <!-- Order detail --------------------------------------------------- -->
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
            class="mt-6 divide-y divide-ink-100 border-t border-ink-100"
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
            class="mt-6 border-t border-ink-100 pt-6 font-body text-caption text-ink-500"
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
