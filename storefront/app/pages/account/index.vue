<script setup lang="ts">
import { computed, ref } from 'vue'
import type { StoreOrder } from '@medusajs/types'
import { formatMoney } from '~/utils/money'

/**
 * /account: the account overview.
 *
 * ---------------------------------------------------------------------------
 * What this replaces
 * ---------------------------------------------------------------------------
 * A labelled scaffold, on the page every signed-in customer lands on. It
 * rendered, literally:
 *
 *   - the subtitle "Profile + orders scaffold."
 *   - a customer-facing "Refresh" button, which is a developer's debug control
 *     wearing a product's clothes, no shopper has ever wanted to manually
 *     re-run a fetch, and offering it advertises that we expect the data to be
 *     wrong
 *   - the raw Medusa ULID as each order's title (`order_01J8XK…`), i.e. an
 *     internal primary key presented as the name of a customer's purchase
 *   - `catch { return [] }`, so an API failure rendered "No orders yet."
 *   - a `zinc-*` palette none of its four sibling account pages use, and no
 *     AccountShell, so the sidebar nav vanished exactly here, on the page
 *     whose entire job is to route you to the other four
 *
 * ---------------------------------------------------------------------------
 * What it is now
 * ---------------------------------------------------------------------------
 * An overview in the lululemon mould: greeting, then the most recent order
 * with its status and a link into detail, then the things you would come here
 * to check: where orders are being sent, and what you saved for later.
 * Walmart and Instacart both promote saved items to the top level of the
 * account rail rather than burying them; AccountShell already lists Wishlist,
 * and this page gives it a count so the rail entry means something before you
 * click it.
 *
 * Each panel states its own three states. The overview's recent-order panel is
 * the one place a swallowed error would be most misleading: "No orders yet."
 * on the landing page tells a returning customer their history is gone.
 */

definePageMeta({ middleware: ['auth'] })
useHead({ title: 'Account' })

const sdk = useMedusaClient()
const { customer, refresh: refreshCustomer } = useCustomer()
const { items: wishlistItems } = useWishlist()

await refreshCustomer()

// Only the most recent order: this is an overview, and /account/orders owns
// the full history. Distinct key from that page's `account-orders-list` so the
// two payloads never clobber each other.
const { data: recentOrders, pending, error, refresh } = await useAsyncData(
  'account-overview-recent-order',
  async () => {
    const res = await sdk.store.order.list({
      limit: 1,
      fields: 'id,display_id,status,fulfillment_status,total,currency_code,created_at,items.id',
    })
    return res.orders ?? []
  },
)

const recentOrder = computed<StoreOrder | null>(() => recentOrders.value?.[0] ?? null)

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

// ---------------------------------------------------------------------------
// Derived view data
// ---------------------------------------------------------------------------

const greetingName = computed(() => {
  const first = String(customer.value?.first_name || '').trim()
  return first || 'there'
})

/**
 * Medusa flags the address the customer chose as their shipping default. Fall
 * back to the first saved address so the panel still says something useful for
 * an account that never set one explicitly.
 */
const defaultAddress = computed(() => {
  const list = (customer.value?.addresses ?? []) as Array<Record<string, any>>
  return list.find(a => a?.is_default_shipping) ?? list[0] ?? null
})

const addressIsDefault = computed(() => Boolean(defaultAddress.value?.is_default_shipping))

const savedCount = computed(() => wishlistItems.value.length)

/**
 * Order identifier shown to the customer.
 *
 * NOT `order.id`. Medusa's ULID is an internal primary key and rendering it as
 * a purchase title is how the old page read. This matches the format used by
 * /account/orders one click away, so the two screens name the same order the
 * same way.
 *
 * Note for whoever unifies this: there are three order-identifier formats live
 * in the storefront right now: this `#display_id` pair, and `GMS-<ULID>` in
 * checkout.vue's `formatOrderNumber` (which must stay in sync with the backend
 * subscriber that builds the confirmation email). Unifying them is a
 * cross-cutting change that needs the checkout and email surfaces moved in the
 * same commit, so this page deliberately follows its neighbour rather than
 * introducing a fourth spelling.
 */
const orderLabel = (o: StoreOrder) => `#${o.display_id ?? o.id.slice(-6)}`

const formatDate = (value: string | Date | undefined) => {
  if (!value) return ''
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return ''
  // en-GB, matching /account/orders and /account/orders/[id].
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d)
}

const itemCount = (o: StoreOrder) => (Array.isArray(o.items) ? o.items.length : 0)

type BadgeVariant = 'neutral' | 'success' | 'warning' | 'danger' | 'info'

// Same mapping as orders/[id].vue so a status never renders one colour here
// and another there.
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
    page-title="Overview"
    :intro="`Welcome back, ${greetingName}. Your latest order, where it's going, and what you've saved.`"
  >
    <div class="space-y-10">
      <!-- ==============================================================
           Most recent order
           ============================================================== -->
      <section aria-labelledby="overview-recent-heading">
        <div class="mb-4 flex items-baseline justify-between gap-4">
          <h2
            id="overview-recent-heading"
            class="font-display text-display-sm text-ink-950"
          >
            Most recent order
          </h2>
          <NuxtLink
            to="/account/orders"
            class="font-body text-caption text-ink-500 underline-offset-4 transition-colors duration-fast hover:text-ink-950 hover:underline focus-visible:outline-none focus-visible:text-ink-950 motion-reduce:transition-none"
          >
            All orders &rarr;
          </NuxtLink>
        </div>

        <!-- 1 of 3: pending ------------------------------------------ -->
        <div
          v-if="pending"
          role="status"
          class="flex items-center gap-3 border border-ink-200 bg-white px-6 py-10 font-body text-caption text-ink-500"
        >
          <UiSpinner :size="16" />
          <span>Loading your latest order…</span>
        </div>

        <!-- 2 of 3: the fetch failed --------------------------------- -->
        <UiEmptyState
          v-else-if="error"
          variant="error"
          heading-tag="h3"
          title="We couldn't load your orders."
          description="This is on us, not you. Nothing has happened to your order history. We just couldn't reach it. Try again in a moment."
          :busy="retrying || pending"
          @retry="onRetry"
        />

        <!-- 3a of 3: resolved, genuinely no orders -------------------- -->
        <UiEmptyState
          v-else-if="!recentOrder"
          variant="empty"
          heading-tag="h3"
          title="No orders yet."
          description="Your first order will show up here with its status, so you can pick up where you left off."
        >
          <template #actions>
            <UiButton variant="merchery" size="md" as="NuxtLink" to="/products">
              Browse the catalog
            </UiButton>
          </template>
        </UiEmptyState>

        <!-- 3b of 3: resolved, order loaded --------------------------- -->
        <div v-else class="border border-ink-200 bg-white">
          <div class="flex flex-col gap-5 p-6 sm:flex-row sm:items-start sm:justify-between">
            <div class="min-w-0">
              <p class="text-eyebrow font-body uppercase text-ink-500">
                Order {{ orderLabel(recentOrder) }}
              </p>
              <p class="mt-2 font-display text-[22px] leading-tight text-ink-950">
                {{ formatDate(recentOrder.created_at) }}
              </p>
              <p class="mt-1 font-body text-caption text-ink-500">
                {{ itemCount(recentOrder) }} item{{ itemCount(recentOrder) === 1 ? '' : 's' }}
                &middot; {{ formatMoney({ amount: Number(recentOrder.total), currency_code: recentOrder.currency_code }) }}
              </p>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <UiBadge :variant="statusVariant(recentOrder.status)">
                {{ recentOrder.status || 'pending' }}
              </UiBadge>
              <UiBadge
                v-if="recentOrder.fulfillment_status"
                :variant="statusVariant(recentOrder.fulfillment_status)"
              >
                {{ recentOrder.fulfillment_status }}
              </UiBadge>
            </div>
          </div>

          <div class="border-t border-ink-200 px-6 py-4">
            <UiButton
              as="NuxtLink"
              :to="`/account/orders/${recentOrder.id}`"
              variant="outline"
              size="sm"
            >
              View order
            </UiButton>
          </div>
        </div>
      </section>

      <!-- ==============================================================
           Shipping address + saved items
           ============================================================== -->
      <div class="grid gap-6 md:grid-cols-2">
        <!-- Default shipping address -------------------------------- -->
        <section
          aria-labelledby="overview-address-heading"
          class="flex flex-col border border-ink-200 bg-white p-6"
        >
          <h2
            id="overview-address-heading"
            class="font-display text-[20px] leading-tight text-ink-950"
          >
            {{ addressIsDefault ? 'Default shipping address' : 'Shipping address' }}
          </h2>

          <address
            v-if="defaultAddress"
            class="mt-4 flex-1 space-y-1 font-body text-body not-italic text-ink-700"
          >
            <p class="text-ink-950">
              {{ defaultAddress.first_name }} {{ defaultAddress.last_name }}
            </p>
            <p v-if="defaultAddress.company">
              {{ defaultAddress.company }}
            </p>
            <p v-if="defaultAddress.address_1">
              {{ defaultAddress.address_1 }}
            </p>
            <p v-if="defaultAddress.address_2">
              {{ defaultAddress.address_2 }}
            </p>
            <p>{{ defaultAddress.postal_code }} {{ defaultAddress.city }}</p>
            <p v-if="defaultAddress.country_code">
              {{ defaultAddress.country_code.toUpperCase() }}
            </p>
          </address>

          <p v-else class="mt-4 flex-1 font-body text-caption text-ink-500">
            No address saved yet. Adding one now means checkout is a step
            shorter next time.
          </p>

          <div class="mt-6">
            <UiButton as="NuxtLink" to="/account/addresses" variant="outline" size="sm">
              {{ defaultAddress ? 'Manage addresses' : 'Add an address' }}
            </UiButton>
          </div>
        </section>

        <!-- Saved items --------------------------------------------- -->
        <section
          aria-labelledby="overview-saved-heading"
          class="flex flex-col border border-ink-200 bg-cream-tile p-6"
        >
          <h2
            id="overview-saved-heading"
            class="font-display text-[20px] leading-tight text-ink-950"
          >
            Saved items
          </h2>

          <!--
            The wishlist lives in localStorage, so the server cannot know the
            count and rendering one during SSR would be a guaranteed hydration
            mismatch. ClientOnly with a neutral fallback keeps both passes
            honest rather than flashing a wrong number.
          -->
          <ClientOnly>
            <p class="mt-4 flex-1 font-body text-body text-ink-700">
              <template v-if="savedCount">
                You have
                <span class="font-medium text-ink-950">{{ savedCount }}</span>
                item{{ savedCount === 1 ? '' : 's' }} saved for later.
              </template>
              <template v-else>
                Nothing saved yet. Tap the heart on any product to keep it here
                while you decide.
              </template>
            </p>
            <template #fallback>
              <p class="mt-4 flex-1 font-body text-body text-ink-700">
                Products you save are kept here while you decide.
              </p>
            </template>
          </ClientOnly>

          <div class="mt-6">
            <UiButton as="NuxtLink" to="/wishlist" variant="outline" size="sm">
              View wishlist
            </UiButton>
          </div>
        </section>
      </div>
    </div>
  </AccountShell>
</template>
