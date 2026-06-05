<template>
  <!--
    MobileNav — full-screen mobile navigation overlay.

    Mounted by AppHeader as:
        <MobileNav v-model:open="mobileNavOpen" />

    Layout (lg:hidden — burger overlay is mobile-only, <lg):
      1. Backdrop  (fixed inset-0, click-self closes)
      2. Sliding panel (88vw / max 400px) with three regions:
         - Top band: GhostMark wordmark + close button (44x44)
         - Search input (full-width, h-44 — mobile thumb friendly)
         - Scrollable category list (native <details> for disclosure)
         - Bottom utility band: Account / Saved / Cart trio + footer links

    A11y guarantees:
      - role="dialog" + aria-modal="true" for assistive tech
      - aria-label set from `title` prop (defaults to "Main navigation")
      - Body scroll locked while open via document.body.style.overflow
      - Escape key closes (listener attached inside onMounted, removed
        on unmount — keeps SSR safe and prevents leaks)
      - Route change auto-closes (no stale chrome on navigation)
      - First focusable element (search input) receives focus on open
      - Each tappable target is min-h-44 for WCAG 2.5.5

    SSR: Teleport `to="body"` is guarded by Nuxt — `<Teleport>` is
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
            class="grid place-items-center min-h-[44px] min-w-[44px] -m-2 p-2 text-greyText hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 rounded"
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
              class="w-full bg-offWhiteLight rounded-[5px] h-[44px] px-[1.4rem] pr-[3.6rem] text-zinc-950 placeholder:text-greyText focus:outline-none focus:ring-2 focus:ring-greyLines"
            />
            <button
              type="submit"
              class="absolute right-[0.4rem] top-1/2 grid h-11 w-11 min-h-[44px] min-w-[44px] -translate-y-1/2 place-items-center rounded-full text-greyText hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
              aria-label="Search"
            >
              <Icon name="search" :size="20" />
            </button>
          </form>
        </div>

        <!--
          Scrollable middle region. Hosts THREE tiers in priority order:
            Tier 1 — Mode entries (D2C Studio Canon vs B2B POD). These
            are the two product-type axes the storefront pivots on, so
            they get top placement, large type, and full-width cards.
            Tier 2 — Category list (existing). Native <details>/<summary>
            chosen over HeadlessUI Disclosure because the markup is
            leaner, expansion is keyboard-accessible by default, and we
            don't need controlled state for sub-sections (each user
            expand is independent).
        -->
        <nav class="flex-1 overflow-y-auto" aria-label="Mobile categories">
          <!-- TIER 1: Mode entries — primary axes (product type) -->
          <div class="border-b border-greyLines">
            <NuxtLink
              to="/shop"
              :class="[
                'block px-5 py-5 border-b border-greyLines transition-colors hover:bg-uiGrey focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2',
                isShopActive ? 'bg-uiGrey' : '',
              ]"
              @click="closeOverlay"
            >
              <p class="text-[11px] uppercase tracking-[0.16em] text-greyText mb-1">D2C · Studio Canon</p>
              <p class="text-[18px] leading-[22px] font-medium text-zinc-950">Shop the Studio Canon</p>
              <p class="text-[13px] leading-[16px] text-greyText mt-1">Apparel sold as-is. Per-unit, in stock.</p>
            </NuxtLink>
            <NuxtLink
              to="/products?type=pod"
              :class="[
                'block px-5 py-5 transition-colors hover:bg-uiGrey focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2',
                isPodActive ? 'bg-uiGrey' : '',
              ]"
              @click="closeOverlay"
            >
              <p class="text-[11px] uppercase tracking-[0.16em] text-greyText mb-1">B2B · Custom &amp; POD</p>
              <p class="text-[18px] leading-[22px] font-medium text-zinc-950">Customise &amp; print on demand</p>
              <p class="text-[13px] leading-[16px] text-greyText mt-1">Upload your artwork. From 25 pieces. E-proof in 48h.</p>
            </NuxtLink>
          </div>

          <!-- TIER 2: Categories — filters within the modes above -->
          <div class="px-5 pt-5 pb-2">
            <p class="text-[11px] uppercase tracking-[0.16em] text-greyText">Browse by category</p>
          </div>
          <ul class="divide-y divide-greyLines">
            <li v-for="c in categories" :key="c.key">
              <!--
                Live Medusa children: if the category has descendants we
                expose them as an expandable group with the "All …" deep
                link first. Categories with no children render as a flat
                row so the drawer stays uniform.
              -->
              <details v-if="c.items && c.items.length" class="group">
                <summary class="flex items-center justify-between min-h-[56px] px-5 py-4 text-[16px] font-medium text-zinc-950 cursor-pointer list-none hover:bg-uiGrey">
                  <span>{{ c.label }}</span>
                  <span class="inline-flex transition group-open:rotate-90">
                    <Icon name="chevron-right" :size="14" />
                  </span>
                </summary>
                <ul class="pb-3 bg-offWhite">
                  <li>
                    <NuxtLink
                      :to="c.to"
                      class="block px-8 py-3 text-[15px] text-zinc-700 hover:text-zinc-950 min-h-[44px]"
                      @click="closeOverlay"
                    >
                      All {{ c.label.toLowerCase() }}
                    </NuxtLink>
                  </li>
                  <li v-for="item in c.items" :key="item.handle">
                    <NuxtLink
                      :to="`/categories/${item.handle}`"
                      class="block px-8 py-2 text-[15px] text-zinc-700 hover:text-zinc-950 min-h-[44px]"
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
                class="flex items-center min-h-[56px] px-5 py-4 text-[16px] font-medium text-zinc-950 hover:bg-uiGrey"
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
              class="flex items-center justify-center gap-2 min-h-[44px] rounded border border-greyLines text-[14px] text-zinc-950 hover:bg-uiGrey focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
              @click="closeOverlay"
            >
              <Icon name="user" :size="20" />
              Account
            </NuxtLink>
            <NuxtLink
              to="/wishlist"
              class="flex items-center justify-center gap-2 min-h-[44px] rounded border border-greyLines text-[14px] text-zinc-950 hover:bg-uiGrey focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
              @click="closeOverlay"
            >
              <Icon name="wishlist" :size="20" />
              Saved
            </NuxtLink>
            <NuxtLink
              to="/cart"
              class="flex items-center justify-center gap-2 min-h-[44px] rounded border border-greyLines text-[14px] text-zinc-950 hover:bg-uiGrey focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
              @click="closeOverlay"
            >
              <Icon name="cart" :size="20" />
              Cart
            </NuxtLink>
          </div>
          <div class="flex flex-wrap gap-x-4 gap-y-2 text-[13px] text-greyText">
            <NuxtLink to="/about" class="hover:text-zinc-950" @click="closeOverlay">About</NuxtLink>
            <NuxtLink to="/contact" class="hover:text-zinc-950" @click="closeOverlay">Contact</NuxtLink>
            <NuxtLink to="/help" class="hover:text-zinc-950" @click="closeOverlay">Help</NuxtLink>
            <NuxtLink to="/returns" class="hover:text-zinc-950" @click="closeOverlay">Returns</NuxtLink>
            <NuxtLink to="/accessibility" class="hover:text-zinc-950" @click="closeOverlay">Accessibility</NuxtLink>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import Icon from '~/components/ui/Icon.vue'

const props = defineProps<{
  open: boolean
  title?: string
}>()

// Live categories — useCategories() is a useState-backed singleton, so
// the list AppHeader resolves on the server is the same instance we read
// here. `ensureResolved()` is a no-op once cached, so calling it on a
// component that opens lazily costs nothing.
const { categories, ensureResolved } = useCategories()
await ensureResolved()

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
// SSR-guarded — `document` is undefined during prerender.
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
//   - "POD" must light up only when the query string includes type=pod
// Both rules need explicit route inspection.
const isShopActive = computed(() => route.path.startsWith('/shop'))
const isPodActive = computed(() => route.path === '/products' && route.query.type === 'pod')

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

const onSearchSubmit = async () => {
  const q = searchQuery.value.trim()
  if (!q) return
  await navigateTo(`/products?search=${encodeURIComponent(q)}`)
  searchQuery.value = ''
  closeOverlay()
}
</script>
