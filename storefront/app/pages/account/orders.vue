<script setup lang="ts">
import type { StoreOrder } from '@medusajs/types'
import { formatMoney } from '~/utils/money'

/**
 * /account/orders: paginated list of customer orders.
 *
 * For now we fetch up to 50 in one call (Medusa returns the most recent
 * first). When the customer history grows past that we can layer in a
 * `limit / offset` pager driven by `useAsyncData` keyed on `page`.
 *
 * Each row renders the canonical order summary (display id, date, status,
 * total) and links to the dedicated `/account/orders/[id]` detail page
 * (account-scoped, behind the same `auth` middleware as this list).
 *
 * ---------------------------------------------------------------------------
 * Tracking and reorder: copy made honest, features not faked
 * ---------------------------------------------------------------------------
 * The empty state promised that orders would appear here "with status,
 * tracking, and a quick reorder link". The row template has a status pill and
 * neither of the other two. Given the choice of building them or telling the
 * truth, this pass tells the truth, for three concrete reasons:
 *
 *   1. Neither is reachable from this query. Reorder needs variant ids and
 *      quantities; tracking needs `*fulfillments.labels`. This call asks for
 *      `items.id` only, one id per line, no variant, no fulfilment. Adding
 *      either means widening the payload for all 50 rows to serve a control
 *      most customers will not press, on the page where scan speed matters.
 *   2. Reorder is a cart mutation. Shipping an "add 6 items to your basket"
 *      button that has never once been executed against a real order is how
 *      you find out in production that the variant is discontinued, the price
 *      moved, or the POD line item needs its design re-uploaded. This branch
 *      forbids order/account writes, so it could not be verified here.
 *   3. It belongs on the row, not the empty state. Instacart puts "Add all
 *      items to cart" on each order in the history, beside "Rate order" and
 *      "Report a problem", an action on a loaded order, sized by that order's
 *      contents. The empty state's job is to describe what the list will
 *      actually look like, and now it does.
 *
 * Tracking is not lost in the meantime: /help states that every dispatch email
 * carries a carrier tracking link. The follow-up is to widen this query and put
 * a reorder control on the row, with an integration test behind it.
 */

definePageMeta({ middleware: ['auth'] })
useHead({ title: 'Orders' })

const sdk = useMedusaClient()

/**
 * The `catch { return [] as StoreOrder[] }` that used to wrap this call meant a
 * 500 from the orders endpoint rendered "No orders yet." to a customer who had
 * ordered fifty times. That is not a degraded experience; it is a false
 * statement about their purchase history, and it arrives at the exact moment
 * they are trying to find a delivery. The throw now propagates into `error`.
 */
const { data: ordersData, pending, error, refresh } = await useAsyncData(
  'account-orders-list',
  async () => {
    const res = await sdk.store.order.list({
      limit: 50,
      fields: 'id,display_id,status,total,currency_code,created_at,items.id',
    })
    return res.orders ?? []
  },
)

const orders = computed<StoreOrder[]>(() => ordersData.value ?? [])

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

// Adapter over the shared `~/utils/money` helper.
//
// The implementation this replaces was wrong in two independent ways: it
// hardcoded `en-US` (so a GBP order rendered with US grouping/spacing while
// the order-detail page next to it used en-GB), and (unlike every other
// money site in the storefront) it applied no scaling at all. Under the old
// divide-by-100 convention that made this list the ONLY screen showing the
// unscaled figure, i.e. £34,000.00 where checkout said £340.00. It was
// accidentally the one telling the truth about what Stripe would charge.
// Both concerns now live in one place.
const formatCurrency = (amount: number | undefined, currency: string | undefined) =>
  formatMoney({ amount, currency_code: currency })

// en-GB, matching orders/[id].vue. These two screens show the same order one
// click apart and were formatting its date two different ways, "Mar 4, 2026"
// here, "4 March 2026" there. For a GBP store shipping from Bordeaux, en-US was
// simply the wrong one of the pair. The locale is hardcoded rather than left to
// the host for the reason spelled out in ~/utils/money: `undefined` resolves to
// Node's locale on the SSR pass and the visitor's in the browser, which is a
// hydration mismatch by construction.
const formatDate = (value: string | Date | undefined) => {
  if (!value) return ''
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d)
}

const itemCount = (o: StoreOrder) => (Array.isArray(o.items) ? o.items.length : 0)
</script>

<template>
  <AccountShell
    page-title="Orders"
    intro="Every purchase you've placed with GhostMark, newest first."
  >
    <div>
      <!-- 1 of 3: pending ---------------------------------------------- -->
      <div
        v-if="pending"
        role="status"
        class="flex items-center gap-3 border border-ink-200 bg-white px-6 py-10 font-body text-caption text-ink-500"
      >
        <UiSpinner :size="16" />
        <span>Loading orders…</span>
      </div>

      <!--
        2 of 3: the request failed, so we say nothing about how many orders
        this customer has. "No orders yet." here would be a lie told to someone
        looking for a parcel.
      -->
      <UiEmptyState
        v-else-if="error"
        variant="error"
        title="We couldn't load your orders."
        description="This is on us, not you. Your order history is safe. We just couldn't reach it. Try again in a moment."
        :busy="retrying || pending"
        @retry="onRetry"
      />

      <!-- 3a of 3: resolved, genuinely no orders ----------------------- -->
      <!--
        Copy is now honest. It used to promise the list would show "status,
        tracking, and a quick reorder link", the row template below has a
        status pill and no trace of the other two, so the empty state was
        writing cheques the loaded state does not cash. See the note in the
        script block for why reorder is not being built in this pass.
      -->
      <UiEmptyState
        v-else-if="!orders.length"
        variant="empty"
        title="No orders yet."
        description="When you place your first order it'll show up here with its status and full breakdown, newest first."
      >
        <template #actions>
          <UiButton variant="merchery" size="md" as="NuxtLink" to="/products">
            Browse the catalog
          </UiButton>
        </template>
      </UiEmptyState>

      <!-- 3b of 3: resolved, with orders -------------------------------- -->
      <ul v-else class="divide-y divide-ink-200 border border-ink-200 bg-white">
        <li v-for="o in orders" :key="o.id">
          <NuxtLink
            :to="`/account/orders/${o.id}`"
            class="flex flex-col gap-3 px-6 py-5 transition-colors duration-fast hover:bg-cream-tile focus-visible:outline-none focus-visible:bg-cream-tile sm:flex-row sm:items-center sm:justify-between motion-reduce:transition-none"
          >
            <div class="min-w-0">
              <p class="font-body text-body text-ink-950">
                Order <span class="font-medium">#{{ o.display_id ?? o.id.slice(-6) }}</span>
              </p>
              <p class="mt-0.5 font-body text-caption text-ink-500">
                {{ formatDate(o.created_at) }} · {{ itemCount(o) }} item{{ itemCount(o) === 1 ? '' : 's' }}
              </p>
            </div>

            <div class="flex items-center gap-6 sm:gap-10">
              <span
                class="inline-flex items-center border border-ink-200 bg-cream-warm px-2.5 py-1 font-body text-caption uppercase text-ink-700"
              >
                {{ o.status || 'pending' }}
              </span>
              <span class="min-w-[7ch] text-right font-body text-body text-ink-950">
                {{ formatCurrency(Number(o.total), o.currency_code) }}
              </span>
              <span aria-hidden="true" class="text-ink-400">&rarr;</span>
            </div>
          </NuxtLink>
        </li>
      </ul>
    </div>
  </AccountShell>
</template>
