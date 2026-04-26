<script setup lang="ts">
import type { StoreOrder } from '@medusajs/types'

/**
 * /account/orders — paginated list of customer orders.
 *
 * For now we fetch up to 50 in one call (Medusa returns the most recent
 * first). When the customer history grows past that we can layer in a
 * `limit / offset` pager driven by `useAsyncData` keyed on `page`.
 *
 * Each row renders the canonical order summary — display id, date, status,
 * total — and links to the dedicated `/account/orders/[id]` detail page
 * (account-scoped, behind the same `auth` middleware as this list).
 */

definePageMeta({ middleware: ['auth'] })
useHead({ title: 'Orders' })

const sdk = useMedusaClient()

const { data: ordersData, pending } = await useAsyncData(
  'account-orders-list',
  async () => {
    try {
      const res = await sdk.store.order.list({
        limit: 50,
        fields: 'id,display_id,status,total,currency_code,created_at,items.id',
      })
      return res.orders ?? []
    }
    catch {
      return [] as StoreOrder[]
    }
  },
)

const orders = computed<StoreOrder[]>(() => ordersData.value ?? [])

const formatCurrency = (amount: number | undefined, currency: string | undefined) => {
  if (typeof amount !== 'number' || !currency) return ''
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount)
  }
  catch {
    return `${amount} ${currency.toUpperCase()}`
  }
}

const formatDate = (value: string | Date | undefined) => {
  if (!value) return ''
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
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
    <div class="border border-ink-200 bg-white">
      <div
        v-if="pending"
        class="flex items-center gap-3 px-6 py-10 font-body text-caption text-ink-500"
      >
        <UiSpinner :size="16" />
        <span>Loading orders…</span>
      </div>

      <div
        v-else-if="!orders.length"
        class="px-6 py-16 text-center"
      >
        <p class="font-display text-[24px] leading-tight text-ink-950">
          No orders yet.
        </p>
        <p class="mx-auto mt-2 max-w-md font-body text-caption text-ink-500">
          When you place your first order it'll show up here with status,
          tracking, and a quick reorder link.
        </p>
        <UiButton
          variant="merchery"
          size="md"
          as="NuxtLink"
          to="/products"
          class="mt-6"
        >
          Browse the catalog
        </UiButton>
      </div>

      <ul v-else class="divide-y divide-ink-100">
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
