<template>
  <div class="min-h-screen bg-[#f5f1ec]">
    <section class="border-b border-zinc-200 bg-white">
      <div class="mx-auto w-full max-w-screen-xl px-5 py-12 sm:px-6 lg:px-8 lg:py-16">
        <p class="text-[12px] font-semibold uppercase tracking-[0.22em] text-zinc-500">Saved For Later</p>
        <div class="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 class="font-serif text-[34px] leading-none text-zinc-950 sm:text-[42px]">Your wishlist</h1>
            <p class="mt-3 max-w-2xl text-[15px] text-zinc-600">Keep track of the products you want to revisit, compare, or order next.</p>
          </div>
          <div class="text-[14px] text-zinc-500">{{ enrichedItems.length }} item{{ enrichedItems.length === 1 ? '' : 's' }}</div>
        </div>
      </div>
    </section>

    <section class="mx-auto w-full max-w-screen-xl px-5 py-10 sm:px-6 lg:px-8">
      <div v-if="!enrichedItems.length" class="rounded-3xl border border-zinc-200 bg-white px-6 py-16 text-center sm:px-10">
        <svg class="mx-auto h-14 w-14 text-zinc-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z" />
        </svg>
        <h2 class="mt-5 font-serif text-[28px] text-zinc-950">Your wishlist is empty</h2>
        <p class="mx-auto mt-3 max-w-xl text-[15px] text-zinc-500">Browse the catalog and save products to keep them handy here.</p>
        <NuxtLink
          to="/products"
          class="mt-7 inline-flex h-[48px] items-center justify-center rounded-lg bg-zinc-950 px-8 text-[14px] font-medium text-white hover:bg-zinc-800"
        >
          Explore products
        </NuxtLink>
      </div>

      <div v-else class="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <article
          v-for="item in enrichedItems"
          :key="item.id"
          class="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm"
        >
          <NuxtLink :to="`/products/${item.handle}`" class="relative block aspect-[4/3] overflow-hidden bg-zinc-100">
            <img
              v-if="item.thumbnail"
              :src="item.thumbnail"
              :alt="item.title"
              class="h-full w-full object-cover transition-transform duration-300 hover:scale-[1.03]"
              loading="lazy"
            />
            <div v-else class="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-200/70 to-zinc-100">
              <svg class="h-10 w-10 text-zinc-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="m21 15-5-5L5 21" />
              </svg>
            </div>
            <!-- Type chip — top-left, mirrors ProductCardChips visual weight.
                 Hidden when type fetch hasn't resolved or item has no type
                 mapping (offline-tolerant). -->
            <span
              v-if="item.typeChipLabel"
              class="absolute left-3 top-3 inline-flex items-center bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-950 shadow-sm"
              :data-test="`wishlist-type-chip-${item.typeChipMode}`"
            >
              {{ item.typeChipLabel }}
            </span>
          </NuxtLink>

          <div class="p-6">
            <div class="flex items-start justify-between gap-4">
              <div>
                <NuxtLink :to="`/products/${item.handle}`" class="text-[18px] font-semibold text-zinc-950 hover:underline">
                  {{ item.title }}
                </NuxtLink>
                <p class="mt-1 text-[15px] text-zinc-600">{{ item.price }}</p>
              </div>
              <button
                class="inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 text-zinc-500 hover:border-zinc-300 hover:text-zinc-950"
                type="button"
                :aria-label="`Remove ${item.title} from wishlist`"
                @click="remove(item.id)"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div class="mt-6 flex gap-3">
              <NuxtLink
                :to="`/products/${item.handle}`"
                class="flex-1 rounded-lg bg-zinc-950 px-4 py-3 text-center text-[14px] font-medium text-white hover:bg-zinc-800"
              >
                View product
              </NuxtLink>
              <button
                class="rounded-lg border border-zinc-200 px-4 py-3 text-[14px] font-medium text-zinc-950 hover:bg-zinc-50"
                type="button"
                @click="remove(item.id)"
              >
                Remove
              </button>
            </div>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
/**
 * Wishlist page — saved-for-later grid.
 *
 * Type-chip enrichment (v22):
 *   The local useWishlist store is intentionally minimal — handle/title/price
 *   only — so the user's saved set survives across sessions without backend
 *   sync. To surface `product.type.value` ("apparel" vs "pod") on each card
 *   we pull the live product records for every saved handle in one batched
 *   SDK call and merge the result back into the local items. The merge is
 *   offline-tolerant: a failed fetch leaves the local fields intact and just
 *   hides the chip slot. We don't touch useWishlist itself — keeping the
 *   composable scope unchanged per the v22 mission constraints.
 *
 * Why we fetch by handle rather than id:
 *   Medusa's Store API accepts `handle: string[]` on `product.list()` and the
 *   handle is the stable key already persisted by useWishlist. Using `id`
 *   would mean refactoring useWishlist to store the canonical product id —
 *   out of scope for this round.
 */

useHead({ title: 'Wishlist' })

const { hydrate, items, remove } = useWishlist()
const sdk = useMedusaClient()

interface FetchedProduct {
  id?: string
  handle?: string
  type?: { value?: string } | null
}

const fetched = ref<FetchedProduct[]>([])

// Lazy fetch — runs once on client mount, after hydrate() has populated items.
// We watch `items` (post-hydrate) so newly added items between sessions still
// resolve a chip on subsequent visits.
async function enrichFromBackend() {
  const handles = items.value.map(i => i.handle).filter((h): h is string => !!h)
  if (!handles.length) {
    fetched.value = []
    return
  }
  try {
    const res = await sdk.store.product.list({
      handle: handles,
      limit: handles.length,
      fields: 'id,handle,*type',
    } as Record<string, unknown>)
    fetched.value = (res as { products?: FetchedProduct[] })?.products ?? []
  }
  catch {
    // Offline / 5xx — leave previously-fetched data alone. Chips simply
    // won't render for unresolved items, which matches the "no type" case
    // and keeps the grid usable on a degraded network.
  }
}

// Build a handle → type.value lookup so the template can resolve a chip in
// O(1) per row. Falls back to undefined when the handle wasn't returned by
// the batched fetch (network error, product unpublished server-side, etc.).
const typeByHandle = computed<Record<string, string | undefined>>(() => {
  const map: Record<string, string | undefined> = {}
  for (const p of fetched.value) {
    if (!p?.handle) continue
    map[p.handle] = (p.type?.value || '').toLowerCase() || undefined
  }
  return map
})

// Final view model passed to the template: original wishlist fields plus
// `typeChipLabel` / `typeChipMode` for the chip overlay. Sorting/order is
// preserved from useWishlist (insertion order) so the user's grid layout
// doesn't reshuffle between visits.
const enrichedItems = computed(() =>
  items.value.map((item) => {
    const t = typeByHandle.value[item.handle]
    let label: string | null = null
    let mode: 'apparel' | 'pod' | null = null
    if (t === 'apparel') {
      label = 'STUDIO CANON'
      mode = 'apparel'
    }
    else if (t === 'pod') {
      label = 'POD READY'
      mode = 'pod'
    }
    return {
      ...item,
      typeChipLabel: label,
      typeChipMode: mode,
    }
  }),
)

onMounted(async () => {
  hydrate()
  await enrichFromBackend()
})

// Re-run enrichment when the local set changes (new add from another tab via
// the storage event hydrated into the shared useState, or removal here).
watch(
  () => items.value.map(i => i.handle).join('|'),
  async () => {
    if (import.meta.client) await enrichFromBackend()
  },
)
</script>
