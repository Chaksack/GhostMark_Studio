<script setup lang="ts">
import {
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
} from '@headlessui/vue'
import UiSheet from './ui/overlay/UiSheet.vue'
import UiButton from './ui/UiButton.vue'

/**
 * AppMobileNav — slide-in mobile navigation drawer.
 *
 * Mounted by `AppHeader` as:
 *   <AppMobileNav v-model:open="mobileNavOpen" />
 *
 * Composition:
 *   - Renders inside <UiSheet side="left" size="md"> which itself wraps a
 *     Headless UI <Dialog>. That gives us focus trap, body scroll lock,
 *     Esc-to-close, backdrop-click-to-close, and focus restoration on
 *     close — for free, with no additional wiring here.
 *   - Each top-level category is a <Disclosure> from @headlessui/vue.
 *     The slot prop `open` is aliased to `isOpen` to avoid shadowing the
 *     component's `open` prop in the template scope.
 *   - All click-to-navigate elements call `close()` so the sheet collapses
 *     before the route transition completes — this prevents a flash of
 *     stale UI on the destination page.
 *
 * Motion:
 *   Disclosure expand/collapse uses a max-height + opacity transition with
 *   token durations (`duration-base` / `duration-fast`) and the project's
 *   `ease-emphasis` curve. The `motion-reduce:transition-none` variant is
 *   applied for a Tailwind-side guard, and the global `tokens.css` rule
 *   clamps any remaining transitions to ~0ms under prefers-reduced-motion.
 */

interface Props {
  open: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
}>()

const close = () => {
  emit('update:open', false)
}

// Phase 7: categories now come from Medusa via `useCategories()` (with a
// graceful static fallback when the backend is offline). The composable
// shares its `useAsyncData` cache key with `AppHeader`, so the desktop
// mega-menu and this drawer hydrate from one round trip.
const { categories } = useCategories()
</script>

<template>
  <UiSheet
    :open="open"
    side="left"
    size="md"
    title="Menu"
    @update:open="emit('update:open', $event)"
  >
    <!--
      Override UiSheet's default header so the brand mark sits next to
      the close affordance and tapping the wordmark also dismisses the
      sheet (it routes home, but we close first so the destination page
      doesn't paint underneath an open drawer).
    -->
    <template #header>
      <div
        class="flex items-center justify-between border-b border-ink-100 px-6 py-4"
      >
        <NuxtLink
          to="/"
          class="font-display text-[24px] font-normal text-ink-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900 rounded-sm"
          @click="close"
        >
          GhostMark
        </NuxtLink>
        <button
          type="button"
          aria-label="Close menu"
          class="p-2 hover:bg-ink-50 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900 motion-reduce:transition-none"
          @click="close"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </template>

    <!-- Body: collapsible category groups + quick actions + footer meta. -->
    <nav class="px-2 py-4 overflow-y-auto" aria-label="Mobile">
      <ul class="flex flex-col">
        <li v-for="group in categories" :key="group.handle">
          <Disclosure v-slot="{ open: isOpen }">
            <DisclosureButton
              class="w-full flex items-center justify-between px-4 py-3.5 text-left font-body text-[15px] text-ink-950 hover:bg-cream-tile rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900"
            >
              <span>{{ group.label }}</span>
              <svg
                :class="[
                  'h-4 w-4 transition-transform duration-base ease-emphasis motion-reduce:transition-none',
                  isOpen && 'rotate-180',
                ]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </DisclosureButton>
            <transition
              enter-active-class="transition-[max-height,opacity] duration-base ease-emphasis overflow-hidden motion-reduce:transition-none"
              enter-from-class="max-h-0 opacity-0"
              enter-to-class="max-h-[600px] opacity-100"
              leave-active-class="transition-[max-height,opacity] duration-fast ease-emphasis overflow-hidden motion-reduce:transition-none"
              leave-from-class="max-h-[600px] opacity-100"
              leave-to-class="max-h-0 opacity-0"
            >
              <DisclosurePanel as="ul" class="pl-4 pb-2 flex flex-col">
                <li v-for="item in group.items" :key="item.handle">
                  <NuxtLink
                    :to="`/products?c=${group.handle}&category=${item.handle}`"
                    class="block px-4 py-2.5 text-[14px] text-ink-700 hover:text-ink-950 hover:bg-cream-tile/50 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900"
                    @click="close"
                  >
                    {{ item.label }}
                  </NuxtLink>
                </li>
              </DisclosurePanel>
            </transition>
          </Disclosure>
        </li>
      </ul>

      <!-- Quick actions — primary user flows surfaced below the taxonomy. -->
      <div
        class="mt-6 px-4 flex flex-col gap-3 border-t border-ink-100 pt-6"
      >
        <UiButton
          as="NuxtLink"
          to="/account"
          variant="outline"
          size="md"
          block
          @click="close"
        >
          My account
        </UiButton>
        <UiButton
          as="NuxtLink"
          to="/wishlist"
          variant="ghost"
          size="md"
          block
          @click="close"
        >
          Wishlist
        </UiButton>
        <UiButton
          as="NuxtLink"
          to="/cart"
          variant="merchery"
          size="md"
          block
          @click="close"
        >
          Cart
        </UiButton>
      </div>

      <!-- Footer meta: live region + currency from `useRegion`. The selector
           wraps the meta line in a button that opens its own UiSheet — Headless
           UI's Dialog stack handles the nested overlay focus management. -->
      <div class="mt-6 px-4 pb-6">
        <RegionSelector variant="meta" />
      </div>
    </nav>
  </UiSheet>
</template>
