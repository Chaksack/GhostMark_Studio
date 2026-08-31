<template>
  <!--
    MobileNav: full-screen mobile navigation overlay.

    Mounted by AppHeader as:
        <MobileNav v-model:open="mobileNavOpen" />

    Layout (lg:hidden, burger overlay is mobile-only, <lg):
      1. Backdrop  (fixed inset-0, click-self closes)
      2. Sliding panel (88vw / max 400px) with three regions:
         - Top band: GhostMark wordmark + close button (44x44)
         - Search input (full-width, h-44, mobile thumb friendly)
         - Scrollable category list (native <details> for disclosure)
         - Bottom utility band: Account / Saved / Cart trio + footer links

    A11y guarantees:
      - role="dialog" + aria-modal="true" for assistive tech
      - aria-label set from `title` prop (defaults to "Main navigation")
      - Body scroll locked while open via document.body.style.overflow
      - Escape key closes (listener attached inside onMounted, removed
        on unmount, keeps SSR safe and prevents leaks)
      - Route change auto-closes (no stale chrome on navigation)
      - First focusable element (search input) receives focus on open
      - Each tappable target is min-h-44 for WCAG 2.5.5

    SSR: Teleport `to="body"` is guarded by Nuxt, `<Teleport>` is
    rendered server-side only when its target exists; in the browser
    it mounts to document.body so positioning escapes any transformed
    ancestor.
  -->
  <Teleport to="body">
    <Transition
      enter-from-class="opacity-0"
      enter-active-class="transition-opacity duration-200"
      leave-to-class="opacity-0"
      leave-active-class="transition-opacity duration-200"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-[120] bg-black/40 lg:hidden"
        aria-hidden="true"
        @click.self="closeOverlay"
      />
    </Transition>
    <Transition
      enter-from-class="-translate-x-full"
      enter-active-class="transition-transform duration-300 ease-out"
      leave-to-class="-translate-x-full"
      leave-active-class="transition-transform duration-300 ease-in"
    >
      <div
        v-if="open"
        id="mobile-nav"
        ref="dialogRef"
        class="fixed inset-y-0 left-0 z-[121] flex w-[88vw] max-w-[400px] flex-col bg-white shadow-2xl lg:hidden"
        role="dialog"
        aria-modal="true"
        :aria-label="title || 'Main navigation'"
      >
        <!-- Top header band -->
        <div class="flex items-center justify-between px-5 py-4 border-b border-greyLines">
          <NuxtLink
            to="/"
            class="text-[24px] font-extrabold leading-none tracking-[0.2px]"
            aria-label="GhostMark home"
            @click="closeOverlay"
          >
            GhostMark
          </NuxtLink>
          <button
            type="button"
            class="grid place-items-center min-h-[44px] min-w-[44px] -m-2 p-2 text-greyText hover:text-ink-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 rounded"
            aria-label="Close menu"
            @click="closeOverlay"
          >
            <Icon name="close" :size="20" />
          </button>
        </div>

        <!-- Search (full-width, focuses on open) -->
        <div class="px-5 py-4 border-b border-greyLines">
          <form class="relative" @submit.prevent="onSearchSubmit">
            <label class="sr-only" for="mobile-nav-search">Search products</label>
            <input
              id="mobile-nav-search"
              ref="searchInput"
              v-model="searchQuery"
              type="search"
              name="q"
              placeholder="Search products"
              autocomplete="off"
              class="w-full bg-offWhiteLight rounded-[5px] h-[44px] px-[14px] pr-[36px] text-ink-950 placeholder:text-greyText focus:outline-none focus:ring-2 focus:ring-greyLines"
            />
            <button
              type="submit"
              class="absolute right-[0.4rem] top-1/2 grid h-11 w-11 min-h-[44px] min-w-[44px] -translate-y-1/2 place-items-center rounded-full text-greyText hover:text-ink-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2"
              aria-label="Search"
            >
              <Icon name="search" :size="20" />
            </button>
          </form>
        </div>

        <!--
          Scrollable middle region. Hosts THREE tiers in priority order:
            Tier 1: Mode entries (D2C Studio Canon vs B2B POD). These
            are the two product-type axes the storefront pivots on, so
            they get top placement, large type, and full-width cards.
            Tier 2: Category list (existing). Native <details>/<summary>
            chosen over HeadlessUI Disclosure because the markup is
            leaner, expansion is keyboard-accessible by default, and we
            don't need controlled state for sub-sections (each user
            expand is independent).
        -->
        <nav class="flex-1 overflow-y-auto" aria-label="Mobile categories">
          <!-- TIER 1: Mode entries: primary axes (product type) -->
          <div class="border-b border-greyLines">
            <NuxtLink
              to="/shop"
              :class="[
                'block px-5 py-5 border-b border-greyLines transition-colors hover:bg-uiGrey focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2',
                isShopActive ? 'bg-uiGrey' : '',
              ]"
              @click="closeOverlay"
            >
              <p class="gm-spec mb-1 text-ink-600">D2C · Studio Canon</p>
              <p class="text-[18px] leading-[22px] font-medium text-ink-950">Shop the Studio Canon</p>
              <p class="text-[13px] leading-[16px] text-greyText mt-1">Apparel sold as-is. Per-unit, in stock.</p>
            </NuxtLink>
            <NuxtLink
              :to="POD_SURFACE"
              :class="[
                'block px-5 py-5 transition-colors hover:bg-uiGrey focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2',
                isPodActive ? 'bg-uiGrey' : '',
              ]"
              @click="closeOverlay"
            >
              <p class="gm-spec mb-1 text-ink-600">Everything we make</p>
              <p class="text-[18px] leading-[22px] font-medium text-ink-950">All products</p>
              <!--
                "E-proof in 48h" is qualified ON PURPOSE, do not un-qualify it.
                It was unconditional here while this entry linked to a POD-only
                surface, which was true of everything it reached. The entry now
                points at the WHOLE catalogue, where the promise holds for 2 of
                26 products: `e_proof_48h` is carried by cable-organiser and
                tech-pouch and by nothing else, measured against :9000 on
                2026-08-31, and chips.ts:130 scopes it `mode: 'pod'`.

                The first clause needs no qualifier and is not hedging: "buy
                as-is, or put your mark on it" is exactly the one-catalogue
                two-ways-to-buy model this route was folded into. Only the
                service commitment had to be attached to the path that earns
                it.
              -->
              <p class="text-[13px] leading-[16px] text-greyText mt-1">Buy as-is, or put your mark on it. Custom work proofed in 48h.</p>
            </NuxtLink>
          </div>

          <!-- TIER 2: Categories: filters within the modes above -->
          <div class="px-5 pt-5 pb-2">
            <p class="gm-spec text-ink-600">Browse by category</p>
          </div>
          <ul class="divide-y divide-greyLines">
            <li v-for="c in visibleCategories" :key="c.key">
              <!--
                Live Medusa children: if the category has descendants we
                expose them as an expandable group with the "All …" deep
                link first. Categories with no children render as a flat
                row so the drawer stays uniform.

                Both this list and the child list below are filtered by
                PRODUCT count, matching the desktop row, ten of the fourteen
                top-levels have zero products and are no longer offered here
                either. See the note in AppHeader.vue.
              -->
              <details v-if="visibleChildren(c).length" class="group">
                <summary class="flex items-center justify-between min-h-[56px] px-5 py-4 text-[16px] font-medium text-ink-950 cursor-pointer list-none hover:bg-uiGrey">
                  <span>{{ c.label }}</span>
                  <span class="inline-flex transition group-open:rotate-90">
                    <Icon name="chevron-right" :size="14" />
                  </span>
                </summary>
                <ul class="pb-3 bg-offWhite">
                  <li>
                    <NuxtLink
                      :to="c.to"
                      class="block px-8 py-3 text-[15px] text-ink-700 hover:text-ink-950 min-h-[44px]"
                      @click="closeOverlay"
                    >
                      All {{ c.label.toLowerCase() }}
                    </NuxtLink>
                  </li>
                  <li v-for="item in visibleChildren(c)" :key="item.handle">
                    <NuxtLink
                      :to="`/categories/${item.handle}`"
                      class="block px-8 py-2 text-[15px] text-ink-700 hover:text-ink-950 min-h-[44px]"
                      @click="closeOverlay"
                    >
                      {{ item.label }}
                    </NuxtLink>
                  </li>
                </ul>
              </details>
              <NuxtLink
                v-else
                :to="c.to"
                class="flex items-center min-h-[56px] px-5 py-4 text-[16px] font-medium text-ink-950 hover:bg-uiGrey"
                @click="closeOverlay"
              >
                {{ c.label }}
              </NuxtLink>
            </li>
          </ul>
        </nav>

        <!-- Bottom utility band: account trio + footer links -->
        <div class="border-t border-greyLines p-5 bg-offWhite space-y-3">
          <div class="grid grid-cols-3 gap-3">
            <NuxtLink
              to="/account"
              class="flex items-center justify-center gap-2 min-h-[44px] rounded border border-greyLines text-[14px] text-ink-950 hover:bg-uiGrey focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2"
              @click="closeOverlay"
            >
              <Icon name="user" :size="20" />
              Account
            </NuxtLink>
            <NuxtLink
              to="/wishlist"
              class="flex items-center justify-center gap-2 min-h-[44px] rounded border border-greyLines text-[14px] text-ink-950 hover:bg-uiGrey focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2"
              @click="closeOverlay"
            >
              <Icon name="wishlist" :size="20" />
              Saved
            </NuxtLink>
            <NuxtLink
              to="/cart"
              class="flex items-center justify-center gap-2 min-h-[44px] rounded border border-greyLines text-[14px] text-ink-950 hover:bg-uiGrey focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2"
              @click="closeOverlay"
            >
              <Icon name="cart" :size="20" />
              Cart
            </NuxtLink>
          </div>
          <div class="flex flex-wrap gap-x-4 gap-y-2 text-[13px] text-greyText">
            <NuxtLink to="/about" class="hover:text-ink-950" @click="closeOverlay">About</NuxtLink>
            <NuxtLink to="/contact" class="hover:text-ink-950" @click="closeOverlay">Contact</NuxtLink>
            <NuxtLink to="/help" class="hover:text-ink-950" @click="closeOverlay">Help</NuxtLink>
            <NuxtLink to="/returns" class="hover:text-ink-950" @click="closeOverlay">Returns</NuxtLink>
            <NuxtLink to="/accessibility" class="hover:text-ink-950" @click="closeOverlay">Accessibility</NuxtLink>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { POD_SURFACE, isPodSurface } from '~/utils/routes'
import Icon from '~/components/ui/Icon.vue'

const props = defineProps<{
  open: boolean
  title?: string
}>()

// Live categories: useCategories() is a useState-backed singleton, so
// the list AppHeader resolves on the server is the same instance we read
// here. `ensureResolved()` is a no-op once cached, so calling it on a
// component that opens lazily costs nothing.
const { categories, ensureResolved } = useCategories()
await ensureResolved()

// Product counts. AppHeader resolves these via
// `useAsyncData('gms-category-product-counts')` and mounts this component, so
// by the time we render the payload key already exists, `useNuxtData` reads
// that cache rather than issuing a second identical request.
//
// Fails open exactly like the desktop row: no counts known → show everything.
// A drawer that flashes empty is a much worse failure than one that briefly
// offers a dead category.
const { data: productCountByHandle } = useNuxtData<Record<string, number>>('gms-category-product-counts')
const countsKnown = computed(() => Object.keys(productCountByHandle.value ?? {}).length > 0)

function visibleChildren(c: { items?: Array<{ label: string, handle: string }> }) {
  const items = c.items ?? []
  if (!countsKnown.value) return items
  return items.filter(i => (productCountByHandle.value?.[i.handle] ?? 0) > 0)
}

// `max`, not sum: seeded catalogues tag a product with both its leaf and its
// ancestors, so a parent's own tally already includes its children's.
function productCount(c: { handle: string, items?: Array<{ label: string, handle: string }> }): number {
  const tally = productCountByHandle.value ?? {}
  const own = tally[c.handle] ?? 0
  const viaChildren = (c.items ?? []).reduce((sum, k) => sum + (tally[k.handle] ?? 0), 0)
  return Math.max(own, viaChildren)
}

const visibleCategories = computed(() =>
  countsKnown.value
    ? (categories.value ?? []).filter(c => productCount(c) > 0)
    : (categories.value ?? []),
)

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
}>()

const dialogRef = ref<HTMLElement | null>(null)
const searchInput = ref<HTMLInputElement | null>(null)
const searchQuery = ref('')

const closeOverlay = () => {
  emit('update:open', false)
}

// Body scroll lock + focus first interactive element on open.
// SSR-guarded: `document` is undefined during prerender.
watch(
  () => props.open,
  async (open) => {
    if (typeof document === 'undefined') return
    document.body.style.overflow = open ? 'hidden' : ''
    if (open) {
      await nextTick()
      searchInput.value?.focus()
    }
  },
)

// Auto-close on route change so navigation always lands on a clean view.
const route = useRoute()
watch(
  () => route.fullPath,
  () => {
    if (props.open) closeOverlay()
  },
)

// Active-state for the two top-tier mode entries. We can't rely on
// NuxtLink's default `router-link-active` because:
//   - "Shop" must light up for /shop AND /shop/canon (any /shop/*)
//   - "Studio" must light up on /studio AND on the legacy
//     /products?type=pod catalogue view, which is not redirected
// Both rules need explicit route inspection.
const isShopActive = computed(() => route.path.startsWith('/shop'))
const isPodActive = computed(() => isPodSurface(route.path, route.query))

// Escape key handler. Attached/detached with the component lifecycle so
// the listener never leaks and cannot run during SSR.
const onKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && props.open) closeOverlay()
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  if (typeof document !== 'undefined') {
    document.removeEventListener('keydown', onKeydown)
    // Defensive: if component is torn down while open, restore scroll.
    document.body.style.overflow = ''
  }
})

// Submit → /search?q=, matching the desktop header.
//
// This posted to `/products?search=` and `pages/products/index.vue` does not
// read `route.query.search`, so the search silently dropped and the user
// landed on the unfiltered catalogue. `pages/search.vue` reads `?q=` and
// works.
const onSearchSubmit = async () => {
  const q = searchQuery.value.trim()
  if (!q) return
  await navigateTo(`/search?q=${encodeURIComponent(q)}`)
  searchQuery.value = ''
  closeOverlay()
}
</script>
