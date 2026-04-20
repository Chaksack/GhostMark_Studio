<template>
  <div class="group relative">
    <button
      class="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-transparent bg-transparent text-zinc-950 hover:border-zinc-200 hover:bg-zinc-100"
      type="button"
      aria-label="Wishlist"
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M12 21s-7-4.6-9.5-8.7C.2 8.6 2.6 5.7 6 5.5c1.9-.1 3.2.8 4 1.8.8-1 2.1-1.9 4-1.8 3.4.2 5.8 3.1 3.5 6.8C19 16.4 12 21 12 21z" />
      </svg>
      <span
        v-if="wishCount"
        class="absolute right-1.5 top-1.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-zinc-950 px-[5px] text-[11px] font-extrabold text-white"
      >
        {{ wishCount }}
      </span>
    </button>
    <div
      class="pointer-events-none absolute right-0 top-full z-[80] w-[320px] pt-2 opacity-0 invisible translate-y-1 transition duration-150 ease-out group-hover:pointer-events-auto group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100"
    >
      <div class="rounded-xl border border-zinc-200 bg-white shadow-xl">
        <div class="border-b border-zinc-100 px-4 py-3">
          <h3 class="text-sm font-bold text-zinc-950">Saved Items ({{ wishCount }})</h3>
        </div>

        <div v-if="!items.length" class="px-4 py-8 text-center">
          <svg class="mx-auto mb-3 text-zinc-300" viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 21s-7-4.6-9.5-8.7C.2 8.6 2.6 5.7 6 5.5c1.9-.1 3.2.8 4 1.8.8-1 2.1-1.9 4-1.8 3.4.2 5.8 3.1 3.5 6.8C19 16.4 12 21 12 21z" />
          </svg>
          <p class="text-sm text-zinc-500">No saved items yet</p>
          <p class="mt-1 text-xs text-zinc-400">Click the heart icon on products to save them</p>
        </div>

        <ul v-else class="max-h-[280px] divide-y divide-zinc-100 overflow-y-auto">
          <li v-for="item in items" :key="item.id" class="flex items-start gap-3 px-4 py-3">
            <NuxtLink :to="`/products/${item.handle}`" class="h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg border border-zinc-100 bg-zinc-50">
              <img
                v-if="item.thumbnail"
                :src="item.thumbnail"
                :alt="item.title"
                class="h-full w-full object-cover"
                loading="lazy"
              />
              <div v-else class="flex h-full w-full items-center justify-center text-zinc-300">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="m9 14 2-2 4 4" /><circle cx="15" cy="9" r="1.5" /></svg>
              </div>
            </NuxtLink>
            <div class="min-w-0 flex-1">
              <NuxtLink :to="`/products/${item.handle}`" class="block truncate text-sm font-medium text-zinc-950 hover:underline">
                {{ item.title }}
              </NuxtLink>
              <p class="mt-0.5 text-sm font-semibold text-zinc-700">{{ item.price }}</p>
            </div>
            <button
              class="mt-0.5 flex-shrink-0 rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
              type="button"
              :aria-label="`Remove ${item.title} from saved`"
              @click.prevent="remove(item.id)"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </li>
        </ul>

        <div class="border-t border-zinc-100 px-4 py-3">
          <NuxtLink
            to="/wishlist"
            class="block w-full rounded-lg bg-zinc-950 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-zinc-800"
          >
            View Wishlist
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { hydrate, items, count: wishCount, remove } = useWishlist()

onMounted(() => {
  hydrate()
})
</script>
