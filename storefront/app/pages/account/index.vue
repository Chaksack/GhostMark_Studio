<template>
  <div class="mx-auto w-full max-w-screen-2xl px-5 sm:px-6 lg:px-8">
    <h1 class="text-3xl font-bold tracking-tight sm:text-4xl">Account</h1>
    <p class="mt-2 text-zinc-500">Profile + orders scaffold.</p>

    <div class="my-6 h-px w-full bg-zinc-200" />

    <div v-if="isLoading" class="text-zinc-500">Loading…</div>

    <div v-else class="grid gap-4 lg:grid-cols-2">
      <div class="rounded-2xl border border-zinc-200 bg-white p-5">
        <h2 class="text-lg font-bold">Profile</h2>
        <div class="my-3 h-px w-full bg-zinc-200" />
        <div class="text-sm text-zinc-500">Email</div>
        <div class="mt-1.5 font-semibold text-zinc-950">{{ customer?.email }}</div>
        <div class="mt-3.5 flex flex-wrap gap-2.5">
          <button class="inline-flex items-center justify-center gap-2 rounded-full border border-zinc-200 bg-transparent px-4 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-zinc-100" @click="refresh">Refresh</button>
          <button class="inline-flex items-center justify-center gap-2 rounded-full border border-red-200 bg-transparent px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50" @click="onLogout">Logout</button>
        </div>
      </div>

      <div class="rounded-2xl border border-zinc-200 bg-white p-5">
        <h2 class="text-lg font-bold">Orders</h2>
        <div class="my-3 h-px w-full bg-zinc-200" />
        <div v-if="ordersPending" class="text-zinc-500">Loading orders…</div>
        <div v-else-if="!orders.length" class="text-zinc-500">No orders yet.</div>
        <div v-else class="grid gap-2.5">
          <div v-for="o in orders" :key="o.id" class="rounded-xl border border-zinc-200 bg-white p-3">
            <div class="text-sm font-bold text-zinc-950">{{ o.id }}</div>
            <div class="mt-1 text-sm text-zinc-600">Status: {{ o.status || '—' }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['auth'] })
useHead({ title: 'Account' })
const sdk = useMedusaClient()
const { customer, isLoading, refresh, logout } = useCustomer()
await refresh()

const { data, pending: ordersPending } = await useAsyncData('orders', async () => {
  try {
    const res = await sdk.store.order.list({ limit: 20 } as any)
    return (res as any).orders ?? []
  } catch {
    return []
  }
})

const orders = computed(() => (data.value as any) ?? [])

const onLogout = async () => {
  await logout()
  await navigateTo('/')
}
</script>
