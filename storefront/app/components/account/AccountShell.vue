<script setup lang="ts">
import { computed, ref } from 'vue'

/**
 * AccountShell: the dashboard chrome shared by every authenticated
 * `/account/**` page (overview, orders, profile, addresses).
 *
 * Pattern choice: a per-page wrapper component instead of a Nuxt layout file.
 *   - Pages keep using the default site layout (AppHeader / AppFooter), so
 *     the global trust strip + mega-menu render unchanged.
 *   - Each page can still set its own `<title>` via `useHead` and its own
 *     middleware via `definePageMeta`, without the layout file having to
 *     coordinate shared data fetching.
 *   - Sidebar nav copy and active-state styling live in exactly one place,
 *     so adding a route is a single-line change.
 *
 * Sidebar nav uses an editorial vertical rail: serif heading + sentence-case
 * NuxtLinks, with the active item picked up by `routerLinkExactActiveClass`
 * (overview) or `routerLinkActiveClass` (sub-pages).
 */

interface Props {
  /** Page title shown above the main content (serif display). */
  pageTitle: string
  /** Eyebrow above the page title, short, uppercase, sets context. */
  eyebrow?: string
  /** Optional descriptive sentence below the title. */
  intro?: string
}

withDefaults(defineProps<Props>(), {
  eyebrow: 'My account',
  intro: undefined,
})

const { customer, logout } = useCustomer()

interface NavItem {
  to: string
  label: string
  exact?: boolean
}

const navItems: NavItem[] = [
  { to: '/account', label: 'Overview', exact: true },
  { to: '/account/orders', label: 'Orders' },
  { to: '/account/profile', label: 'Profile' },
  { to: '/account/addresses', label: 'Addresses' },
  { to: '/wishlist', label: 'Wishlist' },
]

const greetingName = computed(() => {
  const first = String(customer.value?.first_name || '').trim()
  if (first) return first
  const email = String(customer.value?.email || '').trim()
  const local = email.split('@')[0]
  return local || 'there'
})

const isLoggingOut = ref(false)

const onLogout = async () => {
  if (isLoggingOut.value) return
  isLoggingOut.value = true
  try {
    await logout()
    await navigateTo('/')
  }
  finally {
    isLoggingOut.value = false
  }
}
</script>

<template>
  <section class="bg-cream-50">
    <div class="mx-auto max-w-rail px-gutter py-section">
      <!-- Page header band ------------------------------------------------ -->
      <header class="mb-10 lg:mb-14">
        <p class="text-eyebrow font-body uppercase text-ink-500">
          {{ eyebrow }}
        </p>
        <h1 class="mt-3 font-display text-display-sm text-ink-950">
          {{ pageTitle }}
        </h1>
        <p
          v-if="intro"
          class="mt-3 max-w-2xl font-body text-body text-ink-700"
        >
          {{ intro }}
        </p>
      </header>

      <div class="grid gap-12 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-16">
        <!-- Sidebar ------------------------------------------------------ -->
        <aside class="lg:sticky lg:top-28 lg:self-start">
          <p class="text-eyebrow font-body uppercase text-ink-500">
            Signed in as
          </p>
          <p class="mt-2 truncate font-display text-[20px] leading-tight text-ink-950">
            {{ greetingName }}
          </p>
          <p class="mt-1 truncate font-body text-caption text-ink-500">
            {{ customer?.email }}
          </p>

          <nav
            aria-label="Account sections"
            class="mt-8 border-l border-ink-200"
          >
            <NuxtLink
              v-for="item in navItems"
              :key="item.to"
              :to="item.to"
              :exact-active-class="item.exact ? 'text-ink-950 border-l-2 border-ink-950 -ml-px font-medium' : ''"
              :active-class="item.exact ? '' : 'text-ink-950 border-l-2 border-ink-950 -ml-px font-medium'"
              class="block py-2.5 pl-4 font-body text-body text-ink-700 transition-colors duration-fast hover:text-ink-950 focus-visible:outline-none focus-visible:bg-cream-tile focus-visible:text-ink-950 motion-reduce:transition-none"
            >
              {{ item.label }}
            </NuxtLink>
          </nav>

          <div class="mt-8 border-t border-ink-200 pt-6">
            <button
              type="button"
              :disabled="isLoggingOut"
              class="font-body text-caption text-ink-500 transition-colors duration-fast hover:text-ink-950 focus-visible:outline-none focus-visible:text-ink-950 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
              @click="onLogout"
            >
              {{ isLoggingOut ? 'Signing out…' : 'Sign out' }}
            </button>
          </div>
        </aside>

        <!-- Main content slot ------------------------------------------- -->
        <main class="min-w-0">
          <slot />
        </main>
      </div>
    </div>
  </section>
</template>
