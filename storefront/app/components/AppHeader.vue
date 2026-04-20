<template>
  <header class="sticky top-0 z-50 border-b border-zinc-200 bg-zinc-50/90">
    <div class="border-b border-zinc-200 bg-zinc-100/60">
      <div class="mx-auto flex w-full max-w-screen-3xl items-center justify-between gap-3 px-5 py-2.5 sm:px-6 lg:px-8">
        <div class="flex flex-wrap items-center gap-3.5">
          <span class="font-bold">Excellent</span>
          <span class="text-zinc-500">4.8 out of 5</span>
          <span class="text-zinc-500" aria-hidden="true">·</span>
          <span class="text-zinc-500">Trustpilot</span>
        </div>

        <div class="flex flex-wrap items-center gap-3.5 max-[860px]:hidden">
          <NuxtLink to="/about" class="text-zinc-500 hover:text-zinc-950">About</NuxtLink>
          <NuxtLink to="/blog" class="text-zinc-500 hover:text-zinc-950">Resources</NuxtLink>
          <NuxtLink to="/integrations" class="text-zinc-500 hover:text-zinc-950">Integrations</NuxtLink>
          <NuxtLink to="/contact" class="text-zinc-500 hover:text-zinc-950">Contact us</NuxtLink>
          <span class="h-[18px] w-px bg-zinc-200" aria-hidden="true" />
          <button
            class="cursor-pointer rounded-full border border-zinc-200 bg-transparent px-2.5 py-1.5 text-zinc-500 hover:bg-white hover:text-zinc-950"
            type="button"
          >
            Europe · English
          </button>
        </div>
      </div>
    </div>

    <div>
      <div
        class="mx-auto grid w-full max-w-screen-3xl items-center gap-4 bg-white px-5 py-[18px] [grid-template-columns:1fr_minmax(240px,560px)_1fr] max-[860px]:grid-cols-1 sm:px-6 lg:px-8"
      >
        <NuxtLink to="/" class="text-[34px] font-extrabold leading-none tracking-[0.2px]" aria-label="Home">GhostMark</NuxtLink>

        <form class="relative" @submit.prevent="onSearch">
          <label class="sr-only" for="site-search">Search for a product</label>
          <input
            id="site-search"
            v-model="searchQuery"
            class="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 pr-11 text-zinc-950 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300 focus:ring-offset-2 focus:ring-offset-zinc-50"
            type="search"
            name="q"
            placeholder="Search for a product"
            autocomplete="off"
          />
          <button
            class="absolute right-2.5 top-1/2 flex h-[34px] w-[34px] -translate-y-1/2 items-center justify-center rounded-[10px] border border-transparent bg-transparent text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950"
            type="submit"
            aria-label="Search"
          >
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.2-3.2" />
            </svg>
          </button>
        </form>

        <div class="flex items-center justify-end gap-2.5 max-[860px]:justify-start">
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

    <nav class="relative border-t border-zinc-200 bg-white" aria-label="Categories">
      <div class="mx-auto flex w-full max-w-screen-2xl flex-wrap justify-center gap-[18px] px-5 py-3 max-[860px]:justify-start sm:px-6 lg:px-8">
        <div
          v-for="c in categories"
          :key="c.key"
          class="group/menu static"
        >
          <button
            v-if="c.menu"
            class="inline-flex items-center gap-2 border-b border-transparent px-0.5 py-1.5 text-zinc-500 transition hover:text-zinc-950 group-hover/menu:border-zinc-950 group-hover/menu:text-zinc-950 group-focus-within/menu:border-zinc-950 group-focus-within/menu:text-zinc-950"
            type="button"
            aria-haspopup="true"
          >
            <span>{{ c.label }}</span>
            <svg
              viewBox="0 0 24 24"
              width="12"
              height="12"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
              class="transition group-hover/menu:rotate-180 group-focus-within/menu:rotate-180"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>

          <NuxtLink
            v-else
            class="inline-flex items-center gap-2 border-b border-transparent px-0.5 py-1.5 text-zinc-500 transition hover:text-zinc-950"
            :to="c.to"
          >
            <span>{{ c.label }}</span>
          </NuxtLink>

          <div
            v-if="c.menu"
            class="invisible absolute inset-x-0 top-full -mt-px z-[95] translate-y-2 border-t border-[#ece7dd] bg-[#fbfaf7] opacity-0 shadow-[0_28px_90px_-48px_rgba(24,24,27,0.28)] transition duration-180 ease-out pointer-events-none group-hover/menu:visible group-hover/menu:pointer-events-auto group-hover/menu:translate-y-0 group-hover/menu:opacity-100 group-focus-within/menu:visible group-focus-within/menu:pointer-events-auto group-focus-within/menu:translate-y-0 group-focus-within/menu:opacity-100"
          >
            <div class="absolute inset-x-0 -top-5 h-5" aria-hidden="true" />
            <div class="mx-auto grid w-full max-w-screen-3xl grid-cols-[minmax(460px,1.05fr)_minmax(360px,0.95fr)] gap-0 px-5 sm:px-6 lg:px-8">
              <NuxtLink
                :to="c.to"
                class="group relative min-h-[318px] overflow-hidden border-r border-[#ece7dd]"
                :style="{ background: c.menu.featuredBackground }"
              >
                <div class="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.34),rgba(255,255,255,0.04)_40%,rgba(255,255,255,0.18))]" />
                <div class="absolute left-10 right-10 top-9 h-px bg-zinc-700/12" aria-hidden="true" />
                <div class="absolute left-12 top-10 flex items-start gap-4" aria-hidden="true">
                  <div class="relative mt-4 h-[240px] w-[96px] rounded-[48px_48px_16px_16px] bg-white/64 shadow-[0_24px_60px_-35px_rgba(39,39,42,0.55)] backdrop-blur-[1px]">
                    <div class="absolute left-1/2 top-[-18px] h-7 w-px -translate-x-1/2 bg-zinc-700/25" />
                    <div class="absolute left-1/2 top-[-16px] h-5 w-8 -translate-x-1/2 rounded-t-full border border-zinc-700/20 border-b-0" />
                  </div>
                  <div class="relative h-[258px] w-[110px] rounded-[54px_54px_18px_18px] bg-[#ede5d8]/90 shadow-[0_24px_60px_-35px_rgba(39,39,42,0.48)]">
                    <div class="absolute left-1/2 top-[-22px] h-8 w-px -translate-x-1/2 bg-zinc-700/25" />
                    <div class="absolute left-1/2 top-[-20px] h-6 w-9 -translate-x-1/2 rounded-t-full border border-zinc-700/20 border-b-0" />
                  </div>
                  <div class="relative mt-1 h-[268px] w-[118px] rounded-[58px_58px_18px_18px] bg-[#7989ba]/88 shadow-[0_28px_70px_-40px_rgba(39,39,42,0.65)]">
                    <div class="absolute left-1/2 top-[-22px] h-8 w-px -translate-x-1/2 bg-zinc-700/25" />
                    <div class="absolute left-1/2 top-[-20px] h-6 w-9 -translate-x-1/2 rounded-t-full border border-zinc-700/20 border-b-0" />
                  </div>
                  <div class="relative mt-5 h-[238px] w-[102px] rounded-[50px_50px_16px_16px] bg-[#f7f6f2]/92 shadow-[0_24px_60px_-35px_rgba(39,39,42,0.55)]">
                    <div class="absolute left-1/2 top-[-18px] h-7 w-px -translate-x-1/2 bg-zinc-700/25" />
                    <div class="absolute left-1/2 top-[-16px] h-5 w-8 -translate-x-1/2 rounded-t-full border border-zinc-700/20 border-b-0" />
                  </div>
                </div>
                <div class="absolute inset-0 bg-[radial-gradient(circle_at_82%_30%,rgba(255,255,255,0.58),transparent_24%),radial-gradient(circle_at_8%_16%,rgba(255,255,255,0.42),transparent_22%)]" aria-hidden="true" />

                <div class="relative flex h-full flex-col justify-end p-8 lg:p-10">
                  <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-700/55">{{ c.label }}</p>
                  <h3 class="mt-3 max-w-[340px] font-serif text-[30px] leading-[1.02] text-zinc-950">{{ c.menu.featuredTitle }}</h3>
                  <p class="mt-3 max-w-[360px] text-[13px] leading-relaxed text-zinc-700/72">{{ c.menu.featuredDescription }}</p>
                  <span class="mt-6 inline-flex items-center gap-2 text-[13px] font-semibold tracking-[0.01em] text-zinc-950">
                    Shop {{ c.label }}
                    <span class="transition group-hover:translate-x-1">→</span>
                  </span>
                </div>
              </NuxtLink>

              <div class="grid grid-cols-[minmax(220px,1fr)_minmax(170px,220px)] gap-x-12 px-8 py-8 lg:px-10 lg:py-9">
                <div>
                  <p class="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-400">{{ c.menu.sections[0]?.title || c.label }}</p>
                  <div class="mt-4 grid gap-2.5">
                    <NuxtLink
                      v-for="item in c.menu.sections[0]?.items || []"
                      :key="item.label"
                      :to="item.to"
                      class="text-[17px] leading-[1.15] text-zinc-800 transition hover:text-zinc-950"
                    >
                      {{ item.label }}
                    </NuxtLink>
                  </div>
                </div>

                <div class="border-l border-[#ece7dd] pl-8">
                  <div
                    v-for="section in c.menu.sections.slice(1)"
                    :key="section.title"
                    class="mt-7 first:mt-0"
                  >
                    <p class="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-400">{{ section.title }}</p>
                    <div class="mt-3 grid gap-2">
                      <NuxtLink
                        v-for="item in section.items"
                        :key="item.label"
                        :to="item.to"
                        class="text-[13px] leading-[1.25] text-zinc-600 transition hover:text-zinc-950"
                      >
                        {{ item.label }}
                      </NuxtLink>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>

    <AuthModal v-model="isAuthModalOpen" :initial-mode="authModalMode" @success="onAuthSuccess" />
  </header>
</template>

<script setup lang="ts">
type CategoryMenuLink = {
  label: string
  to: string
}

type CategoryMenuSection = {
  title: string
  items: CategoryMenuLink[]
}

type CategoryMenu = {
  featuredTitle: string
  featuredDescription: string
  featuredBackground: string
  sections: CategoryMenuSection[]
}

type CategoryLink = {
  key: string
  label: string
  to: string
  menu?: CategoryMenu
}

const { categories } = defineProps<{
  categories: CategoryLink[]
}>()

const route = useRoute()
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

watch(
  () => route.fullPath,
  () => {
  },
)
</script>
