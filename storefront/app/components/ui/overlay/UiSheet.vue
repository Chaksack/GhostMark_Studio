<script setup lang="ts">
import { computed } from 'vue'
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionRoot,
  TransitionChild,
} from '@headlessui/vue'

/**
 * UiSheet — slide-in drawer / mobile bottom-sheet primitive.
 *
 * Built on top of Headless UI's `Dialog`, which provides:
 *   - role="dialog" + aria-modal="true"
 *   - Focus trap inside the panel
 *   - Body scroll lock while open
 *   - Esc-to-close + initial focus management
 *   - Focus restoration to the trigger on close
 *
 * The visual chrome (positioning, slide direction, sizing) is supplied here.
 * Animations are 320ms cubic-bezier(0.22, 1, 0.36, 1) for the panel slide
 * and 240ms ease-out for the backdrop fade. `prefers-reduced-motion` is
 * honored globally via `tokens.css` (transitions clamp to 0.01ms).
 *
 * Consumer pattern for responsive side switching (drawer on desktop,
 * bottom-sheet on mobile):
 *
 *   const isDesktop = useMediaQuery('(min-width: 640px)')
 *   const side = computed(() => (isDesktop.value ? 'right' : 'bottom'))
 *
 * The primitive itself stays unaware of breakpoints.
 */

type Side = 'right' | 'left' | 'bottom'
type Size = 'sm' | 'md' | 'lg'

interface Props {
  open: boolean
  side?: Side
  size?: Size
  title?: string
  closable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  side: 'right',
  size: 'md',
  title: undefined,
  closable: true,
})

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
}>()

// ---------------------------------------------------------------------------
// Layout: position + slide direction per `side`
// ---------------------------------------------------------------------------
const positionClass = computed(() => {
  switch (props.side) {
    case 'left':
      return 'fixed top-0 left-0 h-full'
    case 'bottom':
      return 'fixed bottom-0 left-0 right-0'
    case 'right':
    default:
      return 'fixed top-0 right-0 h-full'
  }
})

const sideChromeClass = computed(() => {
  switch (props.side) {
    case 'left':
      return 'border-r border-ink-200'
    case 'bottom':
      return 'border-t border-ink-200 rounded-t-xl'
    case 'right':
    default:
      return 'border-l border-ink-200'
  }
})

const widthClass = computed(() => {
  // Bottom sheet spans the full viewport width — no max-width cap.
  if (props.side === 'bottom') return 'w-full'

  switch (props.size) {
    case 'sm':
      return 'w-full max-w-sm'
    case 'lg':
      return 'w-full max-w-[480px]'
    case 'md':
    default:
      return 'w-full max-w-md'
  }
})

const heightClass = computed(() => {
  if (props.side !== 'bottom') return ''

  switch (props.size) {
    case 'sm':
      return 'max-h-[40vh]'
    case 'lg':
      return 'max-h-[80vh]'
    case 'md':
    default:
      return 'max-h-[60vh]'
  }
})

// ---------------------------------------------------------------------------
// Animation tokens — Tailwind `from`/`to` translate utilities per side.
// 320ms slide / 240ms fade, both with motion-reduce escape hatch.
// ---------------------------------------------------------------------------
const slideFromClass = computed(() => {
  switch (props.side) {
    case 'left':
      return '-translate-x-full motion-reduce:translate-x-0'
    case 'bottom':
      return 'translate-y-full motion-reduce:translate-y-0'
    case 'right':
    default:
      return 'translate-x-full motion-reduce:translate-x-0'
  }
})

const slideToClass = computed(() => {
  switch (props.side) {
    case 'left':
      return 'translate-x-0'
    case 'bottom':
      return 'translate-y-0'
    case 'right':
    default:
      return 'translate-x-0'
  }
})

// Headless UI <TransitionChild> takes raw class strings via `enter`/`leave`
// — it does not interpolate Tailwind utilities at runtime, but plain strings
// of utility classes are fine. `ease-[…]` is the arbitrary-value bracket
// form for cubic-bezier. The same string also appears in safelist territory
// so Tailwind keeps it in the production CSS.
const ENTER_BASE = 'transition-transform duration-[320ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:duration-0'
const LEAVE_BASE = 'transition-transform duration-[280ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:duration-0'

// ---------------------------------------------------------------------------
// Close handler — Headless calls @close with no value; we always coerce to
// `false` so the parent `v-model:open` updates predictably.
// ---------------------------------------------------------------------------
const close = () => {
  if (!props.closable) return
  emit('update:open', false)
}

// Headless `Dialog`'s `@close` fires on Esc + backdrop click. When
// `closable` is false we still need a no-op handler so the prop is bound.
const onDialogClose = () => {
  close()
}
</script>

<template>
  <TransitionRoot :show="open" as="template">
    <Teleport to="body">
      <!--
        We deliberately do NOT pass `aria-labelledby` here. Headless UI's
        <Dialog> wires `aria-labelledby` automatically when a <DialogTitle>
        renders inside it (whether from our default header or a consumer-
        supplied slot). For the rare case where neither a `title` prop nor
        a slot-rendered DialogTitle exists, we fall back to `aria-label` so
        screen readers still get a name instead of "dialog".
      -->
      <Dialog
        :class="['relative z-drawer']"
        :aria-label="title ? undefined : 'Dialog'"
        @close="onDialogClose"
      >
        <!-- Backdrop -->
        <TransitionChild
          as="template"
          enter="transition-opacity duration-[240ms] ease-out motion-reduce:duration-0"
          enter-from="opacity-0"
          enter-to="opacity-100"
          leave="transition-opacity duration-[200ms] ease-out motion-reduce:duration-0"
          leave-from="opacity-100"
          leave-to="opacity-0"
        >
          <div
            class="fixed inset-0 bg-ink-900/45 backdrop-blur-[2px]"
            aria-hidden="true"
          />
        </TransitionChild>

        <!-- Panel -->
        <TransitionChild
          as="template"
          :enter="ENTER_BASE"
          :enter-from="slideFromClass"
          :enter-to="slideToClass"
          :leave="LEAVE_BASE"
          :leave-from="slideToClass"
          :leave-to="slideFromClass"
        >
          <DialogPanel
            :class="[
              'flex flex-col bg-cream-50 shadow-elev-3',
              'focus:outline-none',
              positionClass,
              sideChromeClass,
              widthClass,
              heightClass,
            ]"
          >
            <!-- Header (default or slot-overridden) -->
            <slot name="header" :close="close">
              <div
                class="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-ink-100 bg-cream-50 px-6 py-4"
              >
                <DialogTitle
                  v-if="title"
                  id="ui-sheet-title"
                  class="font-display text-lg leading-none text-ink-900"
                >
                  {{ title }}
                </DialogTitle>
                <span v-else aria-hidden="true" />

                <button
                  v-if="closable"
                  type="button"
                  aria-label="Close"
                  class="-mr-2 inline-flex h-9 w-9 items-center justify-center rounded-md p-2 text-ink-700 transition-colors duration-fast hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-300 motion-reduce:transition-none"
                  @click="close"
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
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </slot>

            <!-- Body -->
            <div class="flex-1 overflow-y-auto">
              <slot />
            </div>

            <!-- Optional footer -->
            <div v-if="$slots.footer" class="sticky bottom-0 z-10 border-t border-ink-100 bg-cream-50 px-6 py-4">
              <slot name="footer" />
            </div>
          </DialogPanel>
        </TransitionChild>
      </Dialog>
    </Teleport>
  </TransitionRoot>
</template>
