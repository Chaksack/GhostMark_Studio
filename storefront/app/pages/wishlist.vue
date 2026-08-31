<script setup lang="ts">
/**
 * Wishlist page: saved-for-later grid.
 *
 * ---------------------------------------------------------------------------
 * Three states, not two
 * ---------------------------------------------------------------------------
 * This page has two independent sources and they fail differently:
 *
 *   1. The saved set itself, from localStorage via useWishlist. It cannot
 *      "fail", but it also does not exist during SSR, so the server renders
 *      zero items and the client renders N. The old code let that difference
 *      hit the DOM, which meant a customer with a full wishlist saw "Your
 *      wishlist is empty" flash before their items appeared. `hydrated` gates
 *      the branch on the client pass so we never assert emptiness we have not
 *      actually checked.
 *
 *   2. The type-chip enrichment, from the Medusa catalog. This one genuinely
 *      fails, and it used to fail into `catch {}` with a comment explaining
 *      that the chips "simply won't render". They don't: they silently
 *      vanish, with nothing on screen distinguishing "this product has no type
 *      mapping" from "the catalog is unreachable". The failure is now held in
 *      `enrichStatus` and reported inline, above the grid, with a retry. It is
 *      deliberately NOT a full-page error state: the saved items are local and
 *      perfectly usable, so replacing a working grid with an apology would be
 *      a worse outcome than the bug. Degrade the part that broke, not the page.
 *
 * ---------------------------------------------------------------------------
 * Type-chip enrichment (v22)
 * ---------------------------------------------------------------------------
 *   The local useWishlist store is intentionally minimal (handle/title/price
 *   only) so the user's saved set survives across sessions without backend
 *   sync. To surface `product.type.value` ("apparel" vs "pod") on each card
 *   we pull the live product records for every saved handle in one batched
 *   SDK call and merge the result back into the local items. We don't touch
 *   useWishlist itself, keeping the composable scope unchanged per the v22
 *   mission constraints.
 *
 * Why we fetch by handle rather than id:
 *   Medusa's Store API accepts `handle: string[]` on `product.list()` and the
 *   handle is the stable key already persisted by useWishlist. Using `id`
 *   would mean refactoring useWishlist to store the canonical product id,
 *   out of scope for this round.
 */

useHead({ title: 'Wishlist' })

/**
 * Ids whose thumbnail URL failed to load.
 *
 * The `v-if="item.thumbnail"` guard above only covers a MISSING thumbnail. A
 * thumbnail that is present but 404s rendered the <img> anyway and collapsed
 * the tile to raw alt text, which is live today, because two seeded products
 * share an Unsplash id that has since been deleted. Every surface that reads
 * `thumbnail` had the same hole (ProductCard, cart, cart dropdown, wishlist
 * dropdown); this is the wishlist's half.
 *
 * A Set keyed by id rather than a single boolean because these are v-for rows:
 * one flag would blank every row as soon as any one of them failed.
 */
const failedThumbs = reactive(new Set<string>())

const { hydrate, items, remove } = useWishlist()
const sdk = useMedusaClient()

interface FetchedProduct {
  id?: string
  handle?: string
  type?: { value?: string } | null
}

const fetched = ref<FetchedProduct[]>([])

/** False until the client has read localStorage: see note 1 above. */
const hydrated = ref(false)

type EnrichStatus = 'idle' | 'pending' | 'ok' | 'error'
const enrichStatus = ref<EnrichStatus>('idle')

// Lazy fetch: runs once on client mount, after hydrate() has populated items.
// We watch `items` (post-hydrate) so newly added items between sessions still
// resolve a chip on subsequent visits.
async function enrichFromBackend() {
  const handles = items.value.map(i => i.handle).filter((h): h is string => !!h)
  if (!handles.length) {
    fetched.value = []
    enrichStatus.value = 'ok'
    return
  }
  enrichStatus.value = 'pending'
  try {
    const res = await sdk.store.product.list({
      handle: handles,
      limit: handles.length,
      fields: 'id,handle,*type',
    } as Record<string, unknown>)
    fetched.value = (res as { products?: FetchedProduct[] })?.products ?? []
    enrichStatus.value = 'ok'
  }
  catch {
    // Previously-fetched data is left alone so a flaky refresh doesn't strip
    // chips that already resolved. What changed is that we now admit it
    // happened instead of leaving the customer to wonder where the labels went.
    enrichStatus.value = 'error'
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

const retrying = ref(false)

const onRetryEnrich = async () => {
  if (retrying.value) return
  retrying.value = true
  try {
    await enrichFromBackend()
  }
  finally {
    retrying.value = false
  }
}

onMounted(async () => {
  hydrate()
  hydrated.value = true
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

<template>
  <div class="min-h-screen bg-cream-50">
    <section class="border-b border-ink-200 bg-white">
      <div class="mx-auto w-full max-w-rail px-gutter py-section">
        <p class="text-eyebrow font-body uppercase text-ink-500">
          Saved for later
        </p>
        <div class="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 class="font-display text-display-lg font-normal text-ink-950">
              Your wishlist
            </h1>
            <p class="mt-3 max-w-2xl font-body text-body text-ink-700">
              Keep track of the products you want to revisit, compare, or order next.
            </p>
          </div>
          <!-- Count is client-only for the same reason as the grid below: the
               server has no access to localStorage and must not guess. -->
          <ClientOnly>
            <p v-if="hydrated" class="font-body text-caption text-ink-500">
              {{ enrichedItems.length }} item{{ enrichedItems.length === 1 ? '' : 's' }}
            </p>
          </ClientOnly>
        </div>
      </div>
    </section>

    <section class="mx-auto w-full max-w-rail px-gutter py-section">
      <!--
        Partial-failure notice. Scoped to what actually broke (the labels)
        so the grid underneath stays usable. `role=status` because it appears
        after the page has settled.
      -->
      <div
        v-if="enrichStatus === 'error' && enrichedItems.length"
        role="status"
        class="mb-6 flex flex-col gap-3 border border-ink-200 border-t-2 border-t-semantic-warning-solid bg-cream-tile px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <p class="font-body text-caption text-ink-700">
          <span class="font-medium text-ink-950">Product labels didn't load.</span>
          Your saved items are all here, we just couldn't reach the catalog to
          tag them.
        </p>
        <UiButton
          variant="outline"
          size="sm"
          :loading="retrying"
          @click="onRetryEnrich"
        >
          Try again
        </UiButton>
      </div>

      <!-- 1 of 3: not yet read from localStorage --------------------- -->
      <div
        v-if="!hydrated"
        role="status"
        class="flex items-center justify-center gap-3 border border-ink-200 bg-white px-6 py-16 font-body text-caption text-ink-500"
      >
        <UiSpinner :size="16" />
        <span>Loading your saved items…</span>
      </div>

      <!-- 2 of 3: read, and genuinely empty -------------------------- -->
      <!--
        Copy teaches the gesture rather than restating the page title. The old
        line ("Browse the catalog and save products to keep them handy here")
        described what the page is for; it never said how to put anything in
        it. Turo's empty states are the reference here, they name the control
        and the action, so the empty state doubles as the feature's onboarding
        and a first-time visitor leaves knowing something they didn't.
        "The heart on any product" is literally accurate: ProductCard renders a
        heart toggle with an `Add <title> to favorites` label.
      -->
      <UiEmptyState
        v-else-if="!enrichedItems.length"
        variant="empty"
        title="Your wishlist is empty"
        description="Tap the heart on any product to save it here. Saved items stay put between visits, so you can line a few up and decide later."
      >
        <template #actions>
          <UiButton as="NuxtLink" to="/products" variant="merchery" size="md">
            Explore products
          </UiButton>
        </template>
      </UiEmptyState>

      <!-- 3 of 3: saved items ---------------------------------------- -->
      <ul v-else class="grid list-none gap-6 md:grid-cols-2 xl:grid-cols-3">
        <li
          v-for="item in enrichedItems"
          :key="item.id"
          class="overflow-hidden border border-ink-200 bg-white"
        >
          <NuxtLink
            :to="`/products/${item.handle}`"
            class="relative block aspect-[4/3] overflow-hidden bg-cream-tile"
          >
<!--
              `duration-fast`, not `duration-base`: the latter appears in ~10 files
              but is not defined in tailwind.config (transitionDuration has only
              `fast`), so it compiles to nothing. Reported to the tokens owner.
            -->
            <img
              v-if="item.thumbnail && !failedThumbs.has(item.id)"
              :src="item.thumbnail"
              :alt="item.title"
              class="h-full w-full object-cover transition-transform duration-fast ease-emphasis hover:scale-[1.03] motion-reduce:transition-none motion-reduce:hover:scale-100"
              loading="lazy"
              @error="failedThumbs.add(item.id)"
            >
            <div v-else class="flex h-full w-full items-center justify-center bg-cream-tile">
              <svg class="h-10 w-10 text-ink-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="m21 15-5-5L5 21" />
              </svg>
            </div>
            <!--
              Type chip. Hidden when the type fetch hasn't resolved or the item
              has no type mapping, offline-tolerant, and the notice above the
              grid explains the difference between those two cases.

              The comment that used to sit here claimed this "mirrors
              ProductCardChips visual weight". That is no longer true: the card
              agent has moved that chip off the photograph and rendered it as
              small-caps text in a meta block. This overlay is therefore now a
              deliberate divergence, not a mirror, the wishlist card has no
              meta row to put it in. Whoever unifies the two should treat this
              as the open item, not as the reference.
            -->
            <span
              v-if="item.typeChipLabel"
              class="gm-spec absolute left-3 top-3 inline-flex items-center bg-white px-3 py-1 text-ink-950"
              :data-test="`wishlist-type-chip-${item.typeChipMode}`"
            >
              {{ item.typeChipLabel }}
            </span>
          </NuxtLink>

          <div class="p-6">
            <div class="flex items-start justify-between gap-4">
              <div class="min-w-0">
                <NuxtLink
                  :to="`/products/${item.handle}`"
                  class="font-body text-body font-medium text-ink-950 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:underline"
                >
                  {{ item.title }}
                </NuxtLink>
                <p class="mt-1 font-body text-caption text-ink-500">
                  {{ item.price }}
                </p>
              </div>
              <button
                class="inline-flex h-10 w-10 shrink-0 items-center justify-center border border-ink-200 text-ink-500 transition-colors duration-fast hover:border-ink-300 hover:text-ink-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-cream-50 motion-reduce:transition-none"
                type="button"
                :aria-label="`Remove ${item.title} from wishlist`"
                @click="remove(item.id)"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div class="mt-6 flex gap-3">
              <UiButton
                as="NuxtLink"
                :to="`/products/${item.handle}`"
                variant="merchery"
                size="md"
                class="flex-1"
              >
                View product
              </UiButton>
              <UiButton
                variant="outline"
                size="md"
                @click="remove(item.id)"
              >
                Remove
              </UiButton>
            </div>
          </div>
        </li>
      </ul>
    </section>
  </div>
</template>
