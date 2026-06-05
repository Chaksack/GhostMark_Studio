<template>
  <!--
    Header system, breakpoint-tiered:
      1. Mobile (<md): bg-white compact row — burger (left) + logo (center) +
         cart (right). Search, categories, account, wishlist, region, and
         utility links all live inside <MobileNav>, the full-screen burger
         overlay mounted at the bottom of this template.
      2. Tablet (>=md, <lg): inline grid with logo + search + actions —
         unchanged from the previous design.
      3. Desktop fixed warmGrey (`hidden lg:flex`): logo + 58rem search +
         account/wishlist/cart at h-[6.8rem].
      4. Shared category nav band: hidden below lg (categories live in the
         burger), fixed below the warmGrey bar on desktop
         (`lg:fixed lg:top-[6.8rem] lg:h-[5rem]`).
    Page wrappers compensate with `lg:pt-[118px]` (68 + 50) so content clears
    BOTH desktop fixed bands.
  -->
  <header class="border-b border-greyLines sticky top-0 z-50 bg-white lg:hidden" role="banner">
    <nav class="hidden lg:flex bg-offWhite justify-between h-[4.4rem] py-[10px] px-[30px] items-center">
      <div class="flex flex-wrap items-center gap-3.5 text-greyText">
        <span class="font-medium text-zinc-950">GhostMark Studio</span>
        <span aria-hidden="true">·</span>
        <span>Branded objects, made to last</span>
      </div>
      <div class="hidden items-center gap-3.5 sm:flex">
        <NuxtLink to="/about" class="text-greyText hover:text-zinc-950">About</NuxtLink>
        <NuxtLink to="/contact" class="text-greyText hover:text-zinc-950">Contact</NuxtLink>
      </div>
    </nav>

    <div>
      <!--
        Mobile compact row (<md): burger (left) + logo (center) + cart (right).
        Search, categories, account, wishlist, and utility links all live
        inside the burger overlay to keep the chrome under thumb reach.
      -->
      <div class="mx-auto flex w-full items-center justify-between gap-3 bg-white px-5 py-3 sm:px-6 md:hidden">
        <button
          type="button"
          aria-label="Open menu"
          :aria-expanded="mobileNavOpen"
          aria-controls="mobile-nav"
          class="grid place-items-center min-h-[44px] min-w-[44px] -m-2 p-2 text-zinc-950 hover:bg-uiGrey rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
          @click="mobileNavOpen = true"
        >
          <Icon name="burger" :size="22" />
        </button>

        <NuxtLink to="/" class="text-[22px] font-extrabold leading-none tracking-[0.2px]" aria-label="Home">GhostMark</NuxtLink>

        <NuxtLink
          to="/cart"
          class="relative grid place-items-center min-h-[44px] min-w-[44px] -m-2 p-2 text-zinc-950 hover:bg-uiGrey rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
          aria-label="Cart"
        >
          <Icon name="cart" :size="20" />
          <ClientOnly>
            <span
              v-if="cartCount"
              class="absolute -top-1 -right-1 inline-flex min-w-[18px] h-[18px] items-center justify-center px-1 rounded-full bg-zinc-950 text-cream-50 text-[11px] font-bold"
            >
              {{ cartCount }}
            </span>
          </ClientOnly>
        </NuxtLink>
      </div>

      <!-- Tablet (>=md, <lg) inline grid: keeps the inline search bar for mid-size viewports -->
      <div
        class="mx-auto hidden w-full max-w-screen-3xl items-center gap-4 bg-white px-5 py-2 lg:py-[18px] [grid-template-columns:1fr_minmax(240px,560px)_1fr] sm:px-6 md:grid lg:px-8"
      >
        <NuxtLink to="/" class="text-[28px] font-extrabold leading-none tracking-[0.2px]" aria-label="Home">GhostMark</NuxtLink>

        <form class="relative" @submit.prevent="onSearch">
          <label class="sr-only" for="site-search">Search for a product</label>
          <input
            id="site-search"
            v-model="searchQuery"
            class="w-full bg-offWhiteLight rounded-[5px] h-[4.4rem] md:h-[40px] lg:h-[4.4rem] px-[1.4rem] pr-[3.6rem] text-zinc-950 placeholder:text-greyText focus:outline-none focus:ring-2 focus:ring-greyLines"
            type="search"
            name="q"
            placeholder="Search for a product"
            autocomplete="off"
          />
          <button
            class="absolute right-[0.4rem] top-1/2 flex h-11 w-11 min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center rounded-full text-greyText hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
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
    Desktop fixed warmGrey header — h-[6.8rem]. Page wrappers add
    `lg:pt-[118px]` (68 + 50) to clear this band PLUS the category nav below.
  -->
  <header
    class="fixed top-0 z-20 w-full h-[68px] flex-none bg-warmGrey hidden lg:flex"
    role="banner"
    aria-label="navigation desktop"
  >
    <nav class="hidden lg:flex h-full w-full items-center justify-between ml-[3rem] mr-[16px] gap-[20px]">
      <NuxtLink
        to="/"
        class="text-[28px] font-extrabold leading-none tracking-[0.2px]"
        aria-label="Home"
      >
        GhostMark
      </NuxtLink>

      <form class="relative" @submit.prevent="onSearch">
        <label class="sr-only" for="site-search-desktop">Search for a product</label>
        <input
          id="site-search-desktop"
          v-model="searchQuery"
          class="bg-offWhiteLight rounded-[5px] h-[44px] w-[58rem] max-w-[58rem] px-[2rem] text-zinc-950 placeholder:text-greyText focus:outline-none focus:ring-2 focus:ring-greyLines"
          type="search"
          name="q"
          placeholder="Search for a product"
          autocomplete="off"
        />
        <button
          class="absolute right-[0.4rem] top-1/2 -translate-y-1/2 flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-greyText hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
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
    Desktop category nav. Hidden below lg — on mobile, categories live
    inside <MobileNav>. On desktop this is the fixed band directly under
    the warmGrey bar at top-[6.8rem], h-[5rem], white with a hairline
    greyLines bottom border — the row that holds the mega-menu on hover.
  -->
  <nav
    class="relative hidden bg-white border-b border-greyLines lg:fixed lg:flex lg:top-[68px] lg:left-0 lg:right-0 lg:z-10 lg:h-[50px] lg:shadow-[0_1px_0_rgba(0,0,0,0.04)]"
    aria-label="Categories"
  >
      <div class="mx-auto flex w-full max-w-screen-2xl flex-nowrap items-center justify-start gap-[20px] overflow-x-auto px-5 py-3 sm:px-6 lg:h-full lg:justify-center lg:py-0 lg:px-8 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <!--
          Mode entries — the storefront's two product-type axes.
          Rendered font-medium with default ink-950 colour to outweigh
          the zinc-500 category links that follow. These are primary
          entry points (what KIND of product); categories below are
          filters WITHIN those modes.
          Active state explicit:
            - "Shop" highlights for /shop and any /shop/* sub-route
            - "Studio (POD)" highlights only when ?type=pod is set
        -->
        <NuxtLink
          to="/shop"
          :class="[
            'inline-flex min-h-[44px] items-center gap-2 border-b px-0.5 py-1.5 font-medium transition shrink-0 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2',
            isShopActive ? 'border-zinc-950 text-zinc-950' : 'border-transparent text-zinc-950 hover:border-zinc-950',
          ]"
        >
          Shop
        </NuxtLink>
        <NuxtLink
          to="/products?type=pod"
          :class="[
            'inline-flex min-h-[44px] items-center gap-2 border-b px-0.5 py-1.5 font-medium transition shrink-0 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2',
            isPodActive ? 'border-zinc-950 text-zinc-950' : 'border-transparent text-zinc-950 hover:border-zinc-950',
          ]"
        >
          Studio (POD)
        </NuxtLink>

        <!-- Visual separator between primary modes and category filters -->
        <span class="hidden lg:inline-block h-4 w-px bg-greyLines mx-2 shrink-0" aria-hidden="true" />

        <!--
          Live category links — sourced from Medusa via useCategories().
          Mega-menu chrome (featured tiles + curated sub-sections) was
          dropped: that content was editorial seed data that didn't map
          to any backend taxonomy, so every link broke. Simple anchors
          here mirror the merchery reference and stay honest about what
          the catalogue actually contains.
        -->
        <NuxtLink
          v-for="c in categories"
          :key="c.key"
          :to="c.to"
          class="inline-flex min-h-[44px] items-center gap-2 border-b border-transparent px-0.5 py-1.5 text-zinc-500 transition hover:text-zinc-950 hover:border-zinc-950 shrink-0 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
        >
          <span>{{ c.label }}</span>
        </NuxtLink>
      </div>
  </nav>

  <AuthModal v-model="isAuthModalOpen" :initial-mode="authModalMode" @success="onAuthSuccess" />

  <!--
    Full-screen mobile burger overlay. Mounted once, controlled by
    `mobileNavOpen`. Categories are now read from `useCategories()`
    inside the overlay itself — single source of truth, no prop drilling.
  -->
  <MobileNav v-model:open="mobileNavOpen" />
</template>

<script setup lang="ts">
import MobileNav from '~/components/MobileNav.vue'
import Icon from '~/components/ui/Icon.vue'

// Live taxonomy — sourced from Medusa once per app boot, shared via
// useState. Awaited in setup so the SSR render emits the resolved list
// (no flash of empty nav on first paint when backend is reachable).
const { categories, ensureResolved } = useCategories()
await ensureResolved()

const route = useRoute()

// Active-state for the two top-tier mode entries in the desktop category
// nav. NuxtLink's default `router-link-active` can't express either rule:
//   - "Shop" must light up for /shop AND any /shop/* sub-route
//   - "Studio (POD)" must light up only when ?type=pod is set
const isShopActive = computed(() => route.path.startsWith('/shop'))
const isPodActive = computed(() => route.path === '/products' && route.query.type === 'pod')

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
const onSearch = async () => {
  const q = searchQuery.value.trim()
  if (!q) return
  await navigateTo(`/products?search=${encodeURIComponent(q)}`)
}

// Mobile burger state. The compact mobile row now exposes a single
// burger button which opens MobileNav — search lives inside that
// overlay alongside categories, account, wishlist, and utility links.
const mobileNavOpen = ref(false)

// Cart badge for the mobile right-side cart link. We read directly from
// useCart() so the count stays in sync with the rest of the app — and
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
