<script setup lang="ts">
/**
 * MobileFilterSheet — full-height bottom-sheet drawer used by the PLP
 * to surface the facet pills (and a sort sheet) on screens below `lg`.
 *
 * Why bottom-sheet over modal:
 *   - Mobile thumb reach: the close affordance + sticky CTA stay anchored
 *     to the bottom edge where the thumb already lives.
 *   - 100dvh handles iOS Safari's dynamic viewport (URL bar collapse) so
 *     the sheet doesn't get clipped or jump when the chrome animates.
 *   - Teleporting to <body> keeps it above any sticky header/nav stacking
 *     context without us having to micromanage z-index across the tree.
 *
 * Body scroll lock: we toggle `document.body.style.overflow = 'hidden'`
 * while open so the page underneath doesn't scroll-chain when the user
 * scrolls inside the sheet. We restore on close + on unmount (defensive,
 * in case the host route navigates while the sheet is open).
 *
 * Emits:
 *   - `update:open` — v-model:open contract for the host page
 *   - `clear` — host clears its own filter refs (the sheet doesn't own state)
 */
import { onBeforeUnmount, onMounted, watch } from 'vue'

const props = withDefaults(defineProps<{
  open: boolean
  title?: string
  resultCount?: number
}>(), {
  title: 'Filters',
  resultCount: undefined,
})

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'clear'): void
}>()

// Body scroll lock — only touch document on the client (SSR safety).
watch(() => props.open, (open) => {
  if (typeof document === 'undefined') return
  document.body.style.overflow = open ? 'hidden' : ''
})

// Escape closes the sheet for keyboard users. Bound at document level so the
// listener catches the key even if focus has wandered out of the dialog tree
// (e.g. into a slotted FilterPill popover that just lost focus).
function onKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.open) {
    emit('update:open', false)
  }
}

onMounted(() => {
  if (typeof document === 'undefined') return
  document.addEventListener('keydown', onKeyDown)
})

onBeforeUnmount(() => {
  if (typeof document === 'undefined') return
  document.body.style.overflow = ''
  document.removeEventListener('keydown', onKeyDown)
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-from-class="opacity-0"
      enter-active-class="transition-opacity duration-200"
      leave-to-class="opacity-0"
      leave-active-class="transition-opacity duration-200"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-[100] bg-black/40 lg:hidden"
        aria-hidden="true"
        @click.self="$emit('update:open', false)"
      />
    </Transition>
    <Transition
      enter-from-class="translate-y-full"
      enter-active-class="transition-transform duration-300 ease-out"
      leave-to-class="translate-y-full"
      leave-active-class="transition-transform duration-300 ease-in"
    >
      <div
        v-if="open"
        class="fixed inset-x-0 bottom-0 z-[101] bg-white rounded-t-[1rem] shadow-[0_-8px_32px_rgba(0,0,0,0.12)] max-h-[85dvh] flex flex-col lg:hidden"
        role="dialog"
        :aria-label="title"
        aria-modal="true"
      >
        <div class="flex items-center justify-between px-5 py-4 border-b border-greyLines">
          <h3 class="text-[16px] font-medium text-ink-950">
            {{ title }}
          </h3>
          <button
            type="button"
            class="grid place-items-center min-h-[44px] min-w-[44px] -mr-2 p-2 text-greyText hover:text-ink-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-950 focus-visible:ring-offset-1 rounded"
            aria-label="Close filters"
            @click="$emit('update:open', false)"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <!-- Body — overscroll-contain so swipes inside the sheet don't chain
             into the page scroll underneath (iOS Safari default). -->
        <div class="flex-1 overflow-y-auto overscroll-contain p-5 space-y-6">
          <slot />
        </div>
        <!-- Sticky footer — sized 48px so both Clear and Apply hit WCAG touch
             target rules even on the smallest covered viewports (320). -->
        <div class="border-t border-greyLines p-4 flex gap-3">
          <button
            type="button"
            class="flex-1 inline-flex items-center justify-center min-h-[48px] border border-greyLines rounded-[0.25rem] text-[14px] font-medium text-ink-950 hover:bg-uiGrey focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-950 focus-visible:ring-offset-1"
            @click="$emit('clear')"
          >
            Clear all
          </button>
          <button
            type="button"
            class="flex-1 inline-flex items-center justify-center min-h-[48px] bg-ink-950 text-cream-50 rounded-[0.25rem] text-[14px] font-medium uppercase tracking-[0.04em] hover:bg-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-950 focus-visible:ring-offset-1"
            @click="$emit('update:open', false)"
          >
            Show {{ resultCount ?? '' }} results
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
