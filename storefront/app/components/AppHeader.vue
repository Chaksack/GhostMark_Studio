<template>
  <!--
    Header system, breakpoint-tiered:
      1. Mobile (<md): bg-white compact row: burger (left) + logo (center) +
         cart (right). Search, categories, account, wishlist, region, and
         utility links all live inside <MobileNav>, the full-screen burger
         overlay mounted at the bottom of this template.
      2. Tablet (>=md, <lg): inline grid with logo + search + actions,
         unchanged from the previous design.
      3. Desktop fixed warmGrey (`hidden lg:flex`): logo + 58rem search +
         account/wishlist/cart at h-[68px].
      4. Shared category nav band: hidden below lg (categories live in the
         burger), fixed below the warmGrey bar on desktop
         (`lg:fixed lg:top-[68px] lg:h-[50px]`).
    Clearance for BOTH fixed bands is owned by <main> in
    layouts/default.vue (`lg:pt-[var(--header-offset)]`), NOT by each page.
    The two band heights below are the same custom properties that offset is
    derived from: see the :root block in that layout.
  -->
  <header class="border-b border-greyLines sticky top-0 z-50 bg-white lg:hidden" role="banner">
    <div>
      <!--
        Mobile compact row (<md): burger (left) + logo (center) + cart (right).
        Search, categories, account, wishlist, and utility links all live
        inside the burger overlay to keep the chrome under thumb reach.
      -->
      <div class="mx-auto flex w-full max-w-rail items-center justify-between gap-3 bg-white px-gutter py-3 md:hidden">
        <button
          type="button"
          aria-label="Open menu"
          :aria-expanded="mobileNavOpen"
          aria-controls="mobile-nav"
          class="grid place-items-center min-h-[44px] min-w-[44px] -m-2 p-2 text-ink-950 hover:bg-uiGrey rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2"
          @click="mobileNavOpen = true"
        >
          <Icon name="burger" :size="22" />
        </button>

        <NuxtLink to="/" class="inline-flex items-center -my-3 py-3 text-[22px] font-extrabold leading-none tracking-[0.2px]" aria-label="Home">GhostMark</NuxtLink>

        <NuxtLink
          to="/cart"
          class="relative grid place-items-center min-h-[44px] min-w-[44px] -m-2 p-2 text-ink-950 hover:bg-uiGrey rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2"
          aria-label="Cart"
        >
          <Icon name="cart" :size="20" />
          <ClientOnly>
            <span
              v-if="cartCount"
              class="absolute -top-1 -right-1 inline-flex min-w-[18px] h-[18px] items-center justify-center px-1 rounded-full bg-ink-950 text-cream-50 text-[12px] font-bold tabular-nums"
            >
              {{ cartCount }}
            </span>
          </ClientOnly>
        </NuxtLink>
      </div>

      <!-- Tablet (>=md, <lg) inline grid: keeps the inline search bar for mid-size viewports -->
      <div
        class="mx-auto hidden w-full max-w-rail items-center gap-4 bg-white px-gutter py-2 lg:py-[18px] [grid-template-columns:1fr_minmax(240px,560px)_1fr] md:grid"
      >
        <NuxtLink to="/" class="inline-flex items-center -my-2 py-2 text-[28px] font-extrabold leading-none tracking-[0.2px]" aria-label="Home">GhostMark</NuxtLink>

        <form class="relative" @submit.prevent="onSearch">
          <label class="sr-only" for="site-search">Search for a product</label>
          <input
            id="site-search"
            v-model="searchQuery"
            class="w-full bg-offWhiteLight rounded-[5px] h-[44px] px-[14px] pr-[36px] text-ink-950 placeholder:text-greyText focus:outline-none focus:ring-2 focus:ring-greyLines"
            type="search"
            name="q"
            placeholder="Search for a product"
            autocomplete="off"
          />
          <button
            class="absolute right-[0.4rem] top-1/2 flex h-11 w-11 min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center rounded-full text-greyText hover:text-ink-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2"
            type="submit"
            aria-label="Search"
          >
            <Icon name="search" :size="20" />
          </button>
        </form>

        <div class="flex items-center justify-end gap-2.5">
          <WishlistDropdown />
          <CartDropdown />
          <AppAccountMenu
            :is-authenticated="hasActiveSession"
            :customer-display-name="customerDisplayName"
            :customer-email="customerEmail"
            :account-initial="accountInitial"
            :is-logging-out="isLoggingOut"
            @unauthenticated-click="onUnauthenticatedAccountClick"
            @account="goToAccount"
            @logout="onLogout"
          />
        </div>
      </div>
    </div>
  </header>

  <!--
    Desktop fixed warmGrey header: band 1 of 2. Its height is the
    `--header-band-primary` half of `--header-offset`; <main> in the layout
    reads the sum, so the two can never drift apart again.
  -->
  <header
    class="fixed top-0 z-20 w-full h-[var(--header-band-primary)] flex-none bg-warmGrey hidden lg:flex"
    role="banner"
    aria-label="navigation desktop"
  >
    <!--
      On the page rail, like every other band.

      This was `ml-[3rem] mr-[16px]`: 48px on the left, 16px on the right.
      Asymmetric by 32px, so the logo could not line up with the content
      below it and the right-hand actions could not line up with the right
      edge of the product grid. Nothing on the page could agree with the
      header because the header did not agree with itself.

      Brand-owned storefronts anchor the header to the content column
      rather than to the viewport: lululemon sets the wordmark on exactly
      the left edge of the H1 and the grid beneath it
      (https://mobbin.com/screens/ad4b2661-d133-4360-b2cb-02ea34aabe70),
      and Depop does the same with its logo over the category row
      (https://mobbin.com/screens/c3a278dd-a2bf-4433-b521-18e61b92169d).
      `justify-between` is kept, so the actions still sit hard right, but
      now hard right means the rail's right edge, not the viewport's.
    -->
    <nav class="hidden lg:flex h-full w-full mx-auto max-w-rail px-gutter items-center justify-between gap-[20px]">
      <NuxtLink
        to="/"
        class="inline-flex items-center -my-2 py-2 text-[28px] font-extrabold leading-none tracking-[0.2px]"
        aria-label="Home"
      >
        GhostMark
      </NuxtLink>

      <form class="relative" @submit.prevent="onSearch">
        <label class="sr-only" for="site-search-desktop">Search for a product</label>
        <input
          id="site-search-desktop"
          v-model="searchQuery"
          class="bg-offWhiteLight rounded-[5px] h-[44px] w-[580px] max-w-[580px] px-[20px] text-ink-950 placeholder:text-greyText focus:outline-none focus:ring-2 focus:ring-greyLines"
          type="search"
          name="q"
          placeholder="Search for a product"
          autocomplete="off"
        />
        <button
          class="absolute right-[0.4rem] top-1/2 -translate-y-1/2 flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-greyText hover:text-ink-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2"
          type="submit"
          aria-label="Search"
        >
          <Icon name="search" :size="20" />
        </button>
      </form>

      <div class="flex items-center gap-2.5">
        <WishlistDropdown />
        <CartDropdown />
        <AppAccountMenu
          :is-authenticated="hasActiveSession"
          :customer-display-name="customerDisplayName"
          :customer-email="customerEmail"
          :account-initial="accountInitial"
          :is-logging-out="isLoggingOut"
          @unauthenticated-click="onUnauthenticatedAccountClick"
          @account="goToAccount"
          @logout="onLogout"
        />
      </div>
    </nav>
  </header>

  <!--
    Desktop category nav. Hidden below lg, on mobile, categories live
    inside <MobileNav>. On desktop this is the fixed band directly under
    the warmGrey bar at top-[68px], h-[50px], white with a hairline
    greyLines bottom border, the row that holds the mega-menu on hover.
  -->
  <nav
    class="relative hidden bg-white border-b border-greyLines lg:fixed lg:flex lg:top-[var(--header-band-primary)] lg:left-0 lg:right-0 lg:z-10 lg:h-[var(--header-band-nav)] lg:shadow-[0_1px_0_rgba(0,0,0,0.04)]"
    aria-label="Categories"
  >
      <div class="mx-auto flex w-full max-w-rail flex-nowrap items-center justify-start gap-[20px] overflow-x-auto px-gutter py-3 lg:h-full lg:justify-center lg:py-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <!--
          Mode entries: the storefront's two product-type axes.
          Rendered font-medium with default ink-950 colour to outweigh
          the ink-600 category links that follow. These are primary
          entry points (what KIND of product); categories below are
          filters WITHIN those modes.
          Active state explicit:
            - "Shop" highlights for /shop and any /shop/* sub-route
            - "Studio" highlights on /studio and on the legacy
              /products?type=pod view, which still works and is still linkable
        -->
        <NuxtLink
          to="/shop"
          :class="[
            'inline-flex min-h-[44px] items-center gap-2 border-b px-0.5 py-1.5 font-medium transition shrink-0 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2',
            isShopActive ? 'border-ink-950 text-ink-950' : 'border-transparent text-ink-950 hover:border-ink-950',
          ]"
        >
          Shop
        </NuxtLink>
        <NuxtLink
          :to="POD_SURFACE"
          :class="[
            'inline-flex min-h-[44px] items-center gap-2 border-b px-0.5 py-1.5 font-medium transition shrink-0 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2',
            isPodActive ? 'border-ink-950 text-ink-950' : 'border-transparent text-ink-950 hover:border-ink-950',
          ]"
        >
          All products
        </NuxtLink>

        <!-- Visual separator between primary modes and category filters -->
        <span class="hidden lg:inline-block h-4 w-px bg-greyLines mx-2 shrink-0" aria-hidden="true" />

        <!--
          Live category nav: sourced from Medusa via useCategories().
          Top-levels with children render as HeadlessUI Menu dropdowns
          (apparel/drinkware/accessories/lifestyle today). Top-levels
          without children get bucketed under "More ▾" so the row
          stays under 8 visible entries no matter how flat the taxonomy
          gets. Both buckets keep their entry as a NAVIGABLE link to
          the parent landing page, the dropdown is sub-category-only.

          IMPORTANT: the surrounding `<div>` is `overflow-x-auto` so that
          when the lg viewport is narrow the row can horizontally scroll.
          That clips any absolutely-positioned child (including the
          dropdown panel) below the 50px row. To escape the clip we
          `<Teleport to="body">` each MenuItems panel and position it
          with `fixed` coordinates derived from the trigger button.
          Headless UI's click-outside, focus return, and ESC behaviour
          are component-level (not DOM-position-dependent), so they all
          continue to work after the teleport.
        -->
        <Menu
          v-for="c in nestedCategories"
          :key="c.key"
          v-slot="{ open }"
          as="div"
          class="relative shrink-0"
        >
          <MenuButton
            :ref="(el: any) => registerMenuButton(c.key, el)"
            class="inline-flex min-h-[44px] items-center gap-1 border-b border-transparent px-0.5 py-1.5 text-ink-600 transition hover:text-ink-950 hover:border-ink-950 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2"
            :class="{ 'text-ink-950 border-ink-950': open }"
            @click="trackMenu(c.key)"
          >
            <span>{{ c.label }}</span>
            <svg
              class="h-3 w-3 transition-transform"
              :class="{ 'rotate-180': open }"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              aria-hidden="true"
            >
              <path d="M3 4.5L6 7.5L9 4.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </MenuButton>
          <Teleport to="body">
            <Transition
              enter-active-class="transition duration-150 ease-out"
              enter-from-class="opacity-0 -translate-y-1"
              enter-to-class="opacity-100 translate-y-0"
              leave-active-class="transition duration-100 ease-in"
              leave-from-class="opacity-100 translate-y-0"
              leave-to-class="opacity-0 -translate-y-1"
            >
              <MenuItems
                v-if="open"
                static
                class="fixed z-50 min-w-[120px] origin-top-left rounded-md border border-greyLines bg-white py-1 shadow-lg focus:outline-none"
                :style="getPanelStyle(c.key, 'left')"
              >
                <!-- Parent landing page entry: keeps the "see everything in X" path. -->
                <MenuItem v-slot="{ active }">
                  <NuxtLink
                    :to="c.to"
                    class="block px-4 py-2 text-[13px] font-medium transition"
                    :class="active ? 'bg-cream-50 text-ink-950' : 'text-ink-950'"
                  >
                    All {{ c.label.toLowerCase() }}
                  </NuxtLink>
                </MenuItem>
                <div class="my-1 h-px bg-greyLines" aria-hidden="true" />
                <MenuItem
                  v-for="child in visibleChildren(c)"
                  :key="child.handle"
                  v-slot="{ active }"
                >
                  <NuxtLink
                    :to="`/categories/${child.handle}`"
                    class="block px-4 py-2 text-[13px] transition"
                    :class="active ? 'bg-cream-50 text-ink-950' : 'text-ink-700 hover:text-ink-950'"
                  >
                    {{ child.label }}
                  </NuxtLink>
                </MenuItem>
              </MenuItems>
            </Transition>
          </Teleport>
        </Menu>

        <!--
          Flat top-levels: childless categories that DO have products,
          rendered inline as plain links.

          This slot used to be a "More ▾" disclosure holding every childless
          top-level, because the row was split on CHILD count. Measured against
          the live Store API, all ten entries it collected had ZERO products:
          Stationary & Business, Gifts, Men Clothing, Women clothing, Tote
          bags, Mugs, Hats, Cards, Notebooks, Kids & baby clothing. Every one
          of the catalogue's 26 products sits under the four that happened to
          have children (Apparel 8, Drinkware 6, Accessories 6, Lifestyle 4).

          They were also a SECOND taxonomy (cut by audience and occasion)
          competing with the form-based one beside it, and it shipped three
          straight duplicates: /mugs (0 products) alongside /drinkware-mugs
          (2), /tote-bags alongside /accessories-totes, /notebooks alongside
          /accessories-notebooks.

          The row now splits on PRODUCT count, which empties the bucket
          entirely, and a disclosure control that opens onto nothing is worse
          than no control, so the bucket went with it. This loop is what
          survives it: a childless top-level that a merchant populates
          tomorrow appears here inline, no code change, no bucket coming back.
          Today it renders nothing.
        -->
        <NuxtLink
          v-for="c in flatCategories"
          :key="c.key"
          :to="c.to"
          class="inline-flex min-h-[44px] shrink-0 items-center border-b border-transparent px-0.5 py-1.5 text-ink-600 whitespace-nowrap transition hover:border-ink-950 hover:text-ink-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2"
        >
          {{ c.label }}
        </NuxtLink>
      </div>
  </nav>

  <AuthModal v-model="isAuthModalOpen" :initial-mode="authModalMode" @success="onAuthSuccess" />

  <!--
    Full-screen mobile burger overlay. Mounted once, controlled by
    `mobileNavOpen`. Categories are now read from `useCategories()`
    inside the overlay itself, single source of truth, no prop drilling.
  -->
  <MobileNav v-model:open="mobileNavOpen" />
</template>

<script setup lang="ts">
import { POD_SURFACE, isPodSurface } from '~/utils/routes'
import MobileNav from '~/components/MobileNav.vue'
import Icon from '~/components/ui/Icon.vue'
import { Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/vue'

// Live taxonomy: sourced from Medusa once per app boot, shared via
// useState. Awaited in setup so the SSR render emits the resolved list
// (no flash of empty nav on first paint when backend is reachable).
const { categories, ensureResolved } = useCategories()
await ensureResolved()

const sdk = useMedusaClient()

// ---------------------------------------------------------------------------
// Category product counts
// ---------------------------------------------------------------------------
// `useCategories()` gives us the SHAPE of the taxonomy but no product counts,
// and that composable belongs to another workstream this cycle, so the count
// is harvested here rather than by widening it. One Store API call, asking for
// `id` + `categories.{id,handle}` and nothing else, keyed through
// `useAsyncData` so the SSR result rides the payload and hydration does not
// refetch.
//
// Tallied by HANDLE, not id: the sub-category shape the dropdowns iterate
// (`CategoryItem`) carries a handle and no id.
const { data: productCountByHandle } = await useAsyncData(
  'gms-category-product-counts',
  async (): Promise<Record<string, number>> => {
    try {
      const res: any = await sdk.store.product.list({
        limit: 1000,
        fields: 'id,categories.id,categories.handle',
      } as any)
      const tally: Record<string, number> = {}
      const products = (res?.products ?? []) as Array<{ categories?: Array<{ handle?: string }> }>
      for (const product of products) {
        for (const cat of product.categories ?? []) {
          if (cat?.handle) tally[cat.handle] = (tally[cat.handle] ?? 0) + 1
        }
      }
      return tally
    }
    catch {
      // Never throw out of the header. An unreachable backend degrades to
      // "counts unknown", which fails OPEN below instead of blanking the nav.
      return {}
    }
  },
  { default: (): Record<string, number> => ({}) },
)

// Distinguishes "measured, and these categories are genuinely empty" from
// "never measured". The two have to behave differently or a failed request
// would read as a catalogue with nothing in it.
const countsKnown = computed(() => Object.keys(productCountByHandle.value ?? {}).length > 0)

// Sub-categories, filtered the same way. An empty sub-category is at least as
// useless as an empty top-level, the dropdown is where a shopper is most
// committed to finding something, so it is the worst place to hand them a
// dead end.
function visibleChildren(c: { items?: Array<{ label: string, handle: string }> }) {
  const items = c.items ?? []
  if (!countsKnown.value) return items
  return items.filter(i => (productCountByHandle.value?.[i.handle] ?? 0) > 0)
}

// Seeded catalogues tag a product with BOTH its leaf category and its
// ancestors, so a parent's own tally already contains its children's. A
// catalogue that tags leaves only would leave the parent at 0. `max` is
// correct under both shapes and cannot double-count under either.
function productCount(c: { handle: string, items?: Array<{ label: string, handle: string }> }): number {
  const tally = productCountByHandle.value ?? {}
  const own = tally[c.handle] ?? 0
  const viaChildren = (c.items ?? []).reduce((sum, k) => sum + (tally[k.handle] ?? 0), 0)
  return Math.max(own, viaChildren)
}

// Partition the live taxonomy for the desktop nav.
//
// The previous rule split on CHILD count, a structural fact about how the
// tree happens to be shaped. It put every childless top-level into a "More"
// bucket, which against the live catalogue meant ten links to ten categories
// with zero products in them (see the template note where that bucket was).
//
// The rule is now PRODUCT count, the only fact a nav should encode: can a
// shopper actually buy something behind this link? Ten of the fourteen
// top-levels answer no and are gone from both the desktop row and the mobile
// drawer.
//
//   - `visibleCategories` → has at least one purchasable product
//   - `nestedCategories`  → of those, the ones with non-empty children →
//                           each renders as a dropdown
//   - `flatCategories`    → of those, the ones without → rendered inline as
//                           plain links; empty today, kept so a newly
//                           populated childless category self-heals into the
//                           nav with no code change
//
// Fails open: until the count query resolves (and permanently, if it errors)
// every category stays visible. A nav that briefly shows too much is a far
// smaller failure than one that flashes empty.
const visibleCategories = computed(() =>
  countsKnown.value
    ? (categories.value ?? []).filter(c => productCount(c) > 0)
    : (categories.value ?? []),
)
const nestedCategories = computed(() =>
  visibleCategories.value.filter(c => visibleChildren(c).length > 0),
)
const flatCategories = computed(() =>
  visibleCategories.value.filter(c => visibleChildren(c).length === 0),
)

// ---------------------------------------------------------------------------
// Desktop category dropdown positioning
// ---------------------------------------------------------------------------
// The category nav row uses `overflow-x-auto` (so the row can horizontally
// scroll at narrow lg viewports). That overflow ALSO clips any absolutely-
// positioned descendant on the Y axis, so a stock HeadlessUI Menu rendered
// inline below the trigger button is invisible: the panel exists in the DOM
// but every pixel below the 50px row is cropped out.
//
// We solve it by teleporting each MenuItems panel to <body> and positioning
// it with `position: fixed` coordinates derived from the trigger button's
// bounding rect. The position is recomputed on:
//   - the MenuButton click (we cache the trigger ref by category key)
//   - scroll / resize while the panel is open (handled by reactive triggers)
//
// We keep one ref per trigger button (`menuButtonEls`), and one tick counter
// (`positionTick`) bumped on scroll/resize so getPanelStyle re-runs.
const menuButtonEls = new Map<string, HTMLElement>()
const positionTick = ref(0)

// Template ref callback. HeadlessUI's <MenuButton> exposes an `$el` on the
// component instance (it renders a real <button>), so we drill into that to
// get the DOM node we can call getBoundingClientRect on.
function registerMenuButton(key: string, instance: any) {
  const el: HTMLElement | null = instance?.$el ?? (instance instanceof HTMLElement ? instance : null)
  if (el) {
    menuButtonEls.set(key, el)
  } else {
    menuButtonEls.delete(key)
  }
}

// Force a recompute when the user clicks a trigger, useful when the row
// has been horizontally scrolled between opens.
function trackMenu(_key: string) {
  positionTick.value++
}

// Coordinate generator. Reads the trigger's bounding rect at render time and
// returns a `fixed`-positioned style object. `align` controls whether the
// panel's left or right edge anchors under the trigger.
function getPanelStyle(key: string, align: 'left' | 'right'): Record<string, string> {
  // Touch the tick so the computation re-runs when we tell it to.
  void positionTick.value
  const el = menuButtonEls.get(key)
  if (!el) return { visibility: 'hidden' }
  const r = el.getBoundingClientRect()
  // Sit the panel 6px below the trigger, matching the previous `mt-1` look.
  const top = `${Math.round(r.bottom + 6)}px`
  if (align === 'right') {
    // Anchor right edge of panel to right edge of trigger.
    const right = `${Math.round(window.innerWidth - r.right)}px`
    return { top, right }
  }
  return { top, left: `${Math.round(r.left)}px` }
}

// Reposition on viewport changes so an open panel stays glued to its trigger.
// Cheap: only bumps a counter; the computed style runs again from the next
// render tick. Listeners are scoped to client-side only (Nuxt SSR safe).
if (import.meta.client) {
  const onLayoutChange = () => {
    positionTick.value++
  }
  onMounted(() => {
    window.addEventListener('scroll', onLayoutChange, { passive: true, capture: true })
    window.addEventListener('resize', onLayoutChange, { passive: true })
  })
  onBeforeUnmount(() => {
    window.removeEventListener('scroll', onLayoutChange, { capture: true })
    window.removeEventListener('resize', onLayoutChange)
  })
}

const route = useRoute()

// Active-state for the two top-tier mode entries in the desktop category
// nav. NuxtLink's default `router-link-active` can't express either rule:
//   - "Shop" must light up for /shop AND any /shop/* sub-route
//   - "Studio" must light up on /studio AND on the legacy
//     /products?type=pod catalogue view, which is not redirected
const isShopActive = computed(() => route.path.startsWith('/shop'))
const isPodActive = computed(() => isPodSurface(route.path, route.query))

const { customer, logout, refresh } = useCustomer()
const isAuthModalOpen = ref(false)
const isLoggingOut = ref(false)
const authModalMode = ref<'login' | 'register'>('login')
const authChecked = ref(false)
const hasActiveSession = computed(() => Boolean(customer.value?.id || customer.value?.email))
const customerEmail = computed(() => String(customer.value?.email || 'Account'))
const customerDisplayName = computed(() => {
  const firstName = String(customer.value?.first_name || '').trim()
  if (firstName) return firstName

  const email = customerEmail.value
  const localPart = email.split('@')[0]?.trim()
  return localPart || 'Account'
})
const accountInitial = computed(() => {
  const firstName = String(customer.value?.first_name || '').trim()
  const email = String(customer.value?.email || '').trim()
  return (firstName || email || 'A').charAt(0).toUpperCase()
})

const searchQuery = ref('')

// Submit → /search?q=.
//
// This posted to `/products?search=` for its whole life, and
// `pages/products/index.vue` has never read `route.query.search`, so every
// search in the site header landed on the full unfiltered catalogue with no
// acknowledgement that a search had happened. Meanwhile `pages/search.vue`
// reads `?q=` correctly (and `?type=` for pod/apparel narrowing), works, and
// had zero inbound links from anywhere in the app.
const onSearch = async () => {
  const q = searchQuery.value.trim()
  if (!q) return
  await navigateTo(`/search?q=${encodeURIComponent(q)}`)
}

// Mobile burger state. The compact mobile row now exposes a single
// burger button which opens MobileNav, search lives inside that
// overlay alongside categories, account, wishlist, and utility links.
const mobileNavOpen = ref(false)

// Cart badge for the mobile right-side cart link. We read directly from
// useCart() so the count stays in sync with the rest of the app, and
// wrap the badge in <ClientOnly> in the template to avoid SSR mismatch.
const { cart } = useCart()
const cartCount = computed(() => {
  const items = (cart.value?.items || []) as Array<{ quantity?: number }>
  return items.reduce((sum, item) => sum + (item.quantity || 0), 0)
})

const authRouteMode = computed<'login' | 'register' | null>(() => {
  const rawMode = Array.isArray(route.query.auth) ? route.query.auth[0] : route.query.auth
  return rawMode === 'login' || rawMode === 'register' ? rawMode : null
})

const verifySession = async () => {
  if (hasActiveSession.value) {
    authChecked.value = true
    return true
  }

  const result = await refresh().catch(() => null)
  authChecked.value = true
  return Boolean(result?.id || result?.email || customer.value?.id || customer.value?.email)
}

const closeAuthModal = () => {
  isAuthModalOpen.value = false

  if (!authRouteMode.value) return
  void navigateTo({ path: route.path, query: { ...route.query, auth: undefined } }, { replace: true })
}

const onUnauthenticatedAccountClick = async () => {
  if (!authChecked.value) {
    const loggedIn = await verifySession()
    if (loggedIn) {
      await navigateTo('/account')
      return
    }
  }

  authModalMode.value = 'login'
  isAuthModalOpen.value = true
}

const goToAccount = async () => {
  await navigateTo('/account')
}

const onLogout = async () => {
  isLoggingOut.value = true

  try {
    await logout()
    authChecked.value = true
    await navigateTo('/')
  } finally {
    isLoggingOut.value = false
  }
}

const onAuthSuccess = async () => {
  authChecked.value = true
  closeAuthModal()
  await navigateTo('/account')
}

const syncAuthModalFromRoute = async () => {
  if (!authRouteMode.value) return

  authModalMode.value = authRouteMode.value

  if (hasActiveSession.value) {
    await navigateTo('/account', { replace: true })
    return
  }

  if (!authChecked.value) {
    const loggedIn = await verifySession()
    if (loggedIn) {
      await navigateTo('/account', { replace: true })
      return
    }
  }

  isAuthModalOpen.value = true
}

onMounted(() => {
  if (hasActiveSession.value) {
    authChecked.value = true
  } else {
    verifySession().catch(() => undefined)
  }

  syncAuthModalFromRoute().catch(() => undefined)
})

watch(
  () => customer.value,
  (value) => {
    if (!value?.id && !value?.email) return
    authChecked.value = true
  },
)

watch(
  () => authRouteMode.value,
  () => {
    syncAuthModalFromRoute().catch(() => undefined)
  },
)

// Note: MobileNav handles its own route-change auto-close.
</script>
