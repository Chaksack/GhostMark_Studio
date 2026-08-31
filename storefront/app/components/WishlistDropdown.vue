<template>
  <div
    ref="rootRef"
    data-wishlist-dropdown
    class="relative hidden lg:block"
    @mouseenter="open = true"
    @mouseleave="open = false"
    @focusin="open = true"
    @focusout="onBlur"
    @keydown.esc="open = false"
  >
    <button
      class="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-transparent bg-transparent text-ink-950 hover:border-ink-300 hover:bg-ink-100"
      type="button"
      aria-label="Wishlist"
      :aria-expanded="open ? 'true' : 'false'"
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z" />
      </svg>
      <ClientOnly>
        <span
          v-if="wishCount"
          class="absolute right-1.5 top-1.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-ink-950 px-[5px] text-[12px] font-extrabold tabular-nums text-white"
        >
          {{ wishCount }}
        </span>
      </ClientOnly>
    </button>
    <div
      v-if="open"
      class="absolute right-0 top-full z-[80] w-[320px] pt-2"
    >
      <div class="rounded-xl border border-ink-200 bg-white shadow-xl">
        <div class="border-b border-ink-100 px-4 py-3">
          <h3 class="text-sm font-bold text-ink-950">Saved Items ({{ wishCount }})</h3>
        </div>

        <div v-if="!items.length" class="px-4 py-8 text-center">
          <svg class="mx-auto mb-3 text-ink-300" viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z" />
          </svg>
          <p class="text-sm text-ink-600">No saved items yet</p>
          <p class="mt-1 text-xs text-ink-600">Click the heart icon on products to save them</p>
        </div>

        <ul v-else class="max-h-[280px] divide-y divide-ink-100 overflow-y-auto">
          <li v-for="item in items" :key="item.id" class="flex items-start gap-3 px-4 py-3">
            <NuxtLink :to="`/products/${item.handle}`" class="h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg border border-ink-100 bg-cream-50">
              <img
                v-if="item.thumbnail && !failedThumbs.has(item.id)"
                :src="item.thumbnail"
                :alt="item.title"
                class="h-full w-full object-cover"
                loading="lazy"
                @error="failedThumbs.add(item.id)"
              />
              <div v-else class="flex h-full w-full items-center justify-center text-ink-300">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="m9 14 2-2 4 4" /><circle cx="15" cy="9" r="1.5" /></svg>
              </div>
            </NuxtLink>
            <div class="min-w-0 flex-1">
              <NuxtLink :to="`/products/${item.handle}`" class="block truncate text-sm font-medium text-ink-950 hover:underline">
                {{ item.title }}
              </NuxtLink>
              <p class="mt-0.5 text-sm font-semibold text-ink-700">{{ item.price }}</p>
            </div>
            <button
              class="mt-0.5 flex-shrink-0 rounded p-1 text-ink-600 hover:bg-ink-100 hover:text-ink-950"
              type="button"
              :aria-label="`Remove ${item.title} from saved`"
              @click.prevent="remove(item.id)"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </li>
        </ul>

        <div class="border-t border-ink-100 px-4 py-3">
          <NuxtLink
            to="/wishlist"
            class="block w-full rounded-lg bg-ink-950 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-ink-800"
          >
            View Wishlist
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Ids whose thumbnail 404'd. The `v-if="item.thumbnail"` guard only covers an
// ABSENT thumbnail; a present-but-dead URL rendered the <img> and collapsed the
// 56px tile to alt text. Set-keyed because these are v-for rows, a single
// boolean would blank every row once any one failed.
const failedThumbs = reactive(new Set<string>())

const { hydrate, items, count: wishCount, remove } = useWishlist()

const open = ref(false)
const rootRef = ref<HTMLElement | null>(null)

function onBlur() {
  // Defer so document.activeElement reflects the new focus target
  setTimeout(() => {
    if (!rootRef.value) return
    if (!rootRef.value.contains(document.activeElement)) {
      open.value = false
    }
  }, 0)
}

onMounted(() => {
  hydrate()
})
</script>
