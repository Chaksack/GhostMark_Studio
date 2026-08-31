<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionRoot,
  TransitionChild,
} from '@headlessui/vue'

/**
 * UiSheet: slide-in drawer / mobile bottom-sheet primitive.
 *
 * Built on top of Headless UI's `Dialog`, which provides:
 *   - role="dialog" + aria-modal="true"
 *   - Body scroll lock while open
 *   - Esc-to-close + initial focus management
 *   - Focus restoration to the trigger on close
 *
 *   - Tab containment, via the FocusTrap's TabLock feature
 *
 * An earlier revision of this docblock claimed Tab containment was NOT
 * provided and added a hand-rolled cycle to compensate. That was wrong; both
 * the claim and the cycle have been removed. See the containment note below
 * for the source citations.
 *
 * The same revision justified itself by saying "AppMobileNav is a consumer,
 * so the whole mobile navigation inherited this hole". That is not the case:
 * AppMobileNav.vue has no non-comment references anywhere in app/, the
 * header renders MobileNav.vue, which does not use this primitive. The only
 * importer of UiSheet is RegionSelector.vue, and RegionSelector is itself
 * only rendered inside AppMobileNav, so as of this change UiSheet has no
 * reachable consumer in the running app. Keep that in mind before treating
 * anything here as load-bearing for mobile navigation.
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
  // Bottom sheet spans the full viewport width, no max-width cap.
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
// Animation tokens: Tailwind `from`/`to` translate utilities per side.
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

// Headless UI <TransitionChild> takes raw class strings via `enter`/`leave`.
// It does not interpolate Tailwind utilities at runtime, but plain strings
// of utility classes are fine. `ease-[…]` is the arbitrary-value bracket
// form for cubic-bezier. The same string also appears in safelist territory
// so Tailwind keeps it in the production CSS.
const ENTER_BASE = 'transition-transform duration-[320ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:duration-0'
const LEAVE_BASE = 'transition-transform duration-[280ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:duration-0'

// ---------------------------------------------------------------------------
// Close handler: Headless calls @close with no value; we always coerce to
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

// ---------------------------------------------------------------------------
// Focus restoration (WCAG 2.4.3 Focus Order)
// ---------------------------------------------------------------------------
//
// Closing the overlay must return the keyboard to whatever opened it,
// otherwise focus falls back to <body> and the next Tab restarts from the top
// of the document, for a sheet opened from deep in a page, that strands the
// user completely.
//
// Headless UI's FocusTrap nominally does this via its RestoreFocus feature
// (bit 16, which IS enabled, see the containment note), but it does not
// fire. Verified empirically against BOTH this version and the unmodified
// file at HEAD (focus the trigger, press Enter, press Escape, and
// `document.activeElement` is BODY in both cases), and explained at source
// in @headlessui/vue@1.7.23 `dist/headlessui.dev.cjs`:
//
//   3032  onUnmounted(() => mounted.value = false)      // registered FIRST
//   3034  useRestoreFocus({ ownerDocument },
//   3036    computed(() => mounted.value && (features & 16)))
//   3175  onUnmounted(() => {                            // registered SECOND
//   3176    if (!enabled.value) return                   // <- always true
//   3178    focusElement(getRestoreElement())            // never reached
//
// Vue runs unmount hooks in registration order, so 3032 clears `mounted`
// before 3175 reads it; `enabled` is therefore already false and the restore
// returns early every time. Pre-existing library behaviour, not something
// this component introduced, so it has to be supplied explicitly.
//
// We snapshot the trigger on open and restore it after close. The restore is
// deferred past the leave transition, because putting focus back while the
// panel is still unmounting lets the trap's teardown steal it again.
const restoreTarget = ref<HTMLElement | null>(null)

watch(
  () => props.open,
  (isOpen, wasOpen) => {
    if (isOpen && !wasOpen) {
      const active = document.activeElement
      restoreTarget.value = active instanceof HTMLElement ? active : null
      return
    }

    if (!isOpen && wasOpen) {
      const target = restoreTarget.value
      restoreTarget.value = null
      if (!target) return
      // 320ms clears the longest leave transition either overlay uses.
      window.setTimeout(() => {
        // The trigger may have been unmounted while the overlay was open
        // (e.g. a row deleted from behind a confirm dialog), only restore
        // to something still connected and still focusable.
        if (target.isConnected) target.focus()
      }, 320)
    }
  },
)

// ---------------------------------------------------------------------------
// Keyboard containment (WCAG 2.1.2 / 2.4.3)
// ---------------------------------------------------------------------------
//
// This file used to carry a hand-rolled Tab cycle here, justified by the
// claim that @headlessui/vue turns its own Tab lock OFF for a non-nested
// dialog and delegates containment to `inert`. That claim was FALSE and the
// cycle has been removed. Read directly from the installed
// @headlessui/vue@1.7.23 (`dist/headlessui.dev.cjs`):
//
//   3009-3014  None=1  InitialFocus=2  TabLock=4  FocusLock=8
//              RestoreFocus=16  All=30
//   4205       leaf: FocusTrap.features.All & ~FocusTrap.features.FocusLock
//
// 30 & ~8 === 22 === InitialFocus | TabLock | RestoreFocus. Only FocusLock
// (8) is cleared. TabLock (4) stays ON, and it is genuinely used: at 3112
// and 3127 the FocusTrap renders a focusable `Hidden` sentinel
// (`data-headlessui-focus-guard="true"`) either side of the trapped subtree
// whenever `features & 4`. Tabbing off the last control lands on a sentinel,
// whose onFocus (3055) calls `focusIn(container, First|Last)` and wraps focus
// back inside. That path does not involve `inert` at all.
//
// FocusLock (useFocusLock, 3233) is the separate focus-EVENT lock that yanks
// focus back on any focus change, including a click outside the page. It is
// disabled on purpose so the user can still reach browser chrome.
//
// The hand-rolled cycle raced the sentinels: it preventDefault()ed and
// focused first/last computed from `[data-ui-sheet-panel]` descendants only,
// while the sentinels sit OUTSIDE the panel.
//
// SEPARATELY, and still true: this template used to wrap the Dialog in a
// redundant `<Teleport to="body">`. Headless UI decides what to mark `inert`
// by walking `body > *` for the child containing its internal "main tree
// node" marker; the Teleport moved that marker out of `#__nuxt` and into
// <body> as its own direct child, so the library inerted the stray marker
// instead of the application root, and the page behind the sheet stayed
// fully tabbable. The Teleport bought nothing (Dialog already portals its
// own content) and it has been removed. Do not reinstate it. (Verified
// after removal: `#__nuxt` carries aria-hidden/inert while a sheet is open.)
//
// Measured on a throwaway harness route with the handler removed: 32
// consecutive stops forward and 32 backward, in this sheet, in UiModal, and
// in a UiSheet nested inside a UiSheet (as AppMobileNav does), every stop
// inside the panel and the cycle wrapping on a stable period.
//
// `data-ui-sheet-panel` is retained even though its only consumer (the removed
// cycle) is gone: it is a stable, styling-independent hook for focus and
// visual-regression tests, and it is not part of the public prop API.

// ---------------------------------------------------------------------------
// Escape
// ---------------------------------------------------------------------------
//
// Handled here as well as by Headless UI's own document-level listener, so
// dismissal is a property of this component. Tab is deliberately NOT handled;
// see the containment note above.
const onKeydown = (event: KeyboardEvent) => {
  if (event.key !== 'Escape') return
  // Respect `closable: false`: a sheet that cannot be dismissed by its own
  // close button must not be dismissable by Escape either.
  if (!props.closable) return
  event.preventDefault()
  event.stopPropagation()
  close()
}
</script>

<template>
  <!--
    NOTE: there used to be a `<Teleport to="body">` wrapping this Dialog.
    It has been removed deliberately, and it should not be added back.

    <Dialog> already portals its own content to a Headless UI portal root
    at the end of <body>, so the Teleport bought nothing visually, but it
    relocated the library's internal "main tree node" marker out of
    `#__nuxt` and into <body>, which made Headless UI apply `inert` to that
    stray marker instead of to the application root. The result was a sheet
    that looked modal but left the entire page behind it tabbable. See the
    containment note in the script block.

    We deliberately pass NEITHER `aria-labelledby` NOR `aria-label`.
    Headless UI wires `aria-labelledby` automatically when a <DialogTitle>
    renders inside (from our default header or a consumer-supplied slot).

    `aria-label` used to be `title ? undefined : \'Dialog\'`, which gave an
    untitled sheet the accessible name "Dialog", so a screen reader
    announced "Dialog, dialog", displacing the role with a duplicate of it.
    That is worse than no name. Untitled sheets are now announced by role
    alone, and a consumer needing a name can pass `aria-label` directly: it
    falls through to <Dialog> via Vue attribute inheritance instead of being
    clobbered by this binding.

    `role` is stated explicitly rather than left to the library default.
  -->
  <TransitionRoot :show="open" as="template">
    <Dialog
      :class="['relative z-drawer']"
      role="dialog"
      @close="onDialogClose"
      @keydown="onKeydown"
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
            data-ui-sheet-panel
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
                class="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-ink-200 bg-cream-50 px-6 py-4"
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
                  class="-mr-2 inline-flex h-9 w-9 items-center justify-center rounded-md p-2 text-ink-700 transition-colors duration-fast pointer-coarse:h-11 pointer-coarse:w-11 hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-cream-50 motion-reduce:transition-none"
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
            <div v-if="$slots.footer" class="sticky bottom-0 z-10 border-t border-ink-200 bg-cream-50 px-6 py-4">
              <slot name="footer" />
            </div>
          </DialogPanel>
        </TransitionChild>
    </Dialog>
  </TransitionRoot>
</template>
