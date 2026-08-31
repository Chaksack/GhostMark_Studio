<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionRoot,
  TransitionChild,
} from '@headlessui/vue'

type Size = 'sm' | 'md' | 'lg'

interface Props {
  open: boolean
  size?: Size
  title?: string
  /**
   * Element to receive focus when the dialog opens. Forwarded to Headless
   * UI's `<Dialog :initial-focus>`. Pass an `HTMLElement` ref (e.g. an
   * exposed `inputEl` from `UiInput`) so focus lands on the first useful
   * form control instead of the dialog root or close button.
   *
   * `null` / undefined falls back to Headless UI's default behavior
   * (focuses the dialog panel itself, then traps Tab inside).
   */
  initialFocus?: HTMLElement | null
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  title: undefined,
  initialFocus: null,
})

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
}>()

const sizeClass: Record<Size, string> = {
  sm: 'sm:max-w-sm',
  md: 'md:max-w-md',
  lg: 'lg:max-w-[560px]',
}

const panelSize = computed(() => sizeClass[props.size])

const close = (value = false) => {
  emit('update:open', value)
}

// ---------------------------------------------------------------------------
// Focus restoration (WCAG 2.4.3 Focus Order)
// ---------------------------------------------------------------------------
//
// Closing the overlay must return the keyboard to whatever opened it,
// otherwise focus falls back to <body> and the next Tab restarts from the top
// of the document. For a sheet opened from deep in a page, that strands the
// user completely.
//
// Headless UI's FocusTrap nominally does this via its RestoreFocus feature
// (bit 16, which IS enabled; see the containment note), but it does not
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
        // (e.g. a row deleted from behind a confirm dialog). Only restore
        // to something still connected and still focusable.
        if (target.isConnected) target.focus()
      }, 320)
    }
  },
)

// ---------------------------------------------------------------------------
// Keyboard containment (WCAG 2.1.2 No Keyboard Trap / 2.4.3 Focus Order)
// ---------------------------------------------------------------------------
//
// This file used to carry a hand-rolled Tab cycle here, justified by the
// claim that Headless UI "is not listening for Tab" in a non-nested dialog.
// That claim was FALSE and the cycle has been removed. Read directly from the
// installed @headlessui/vue@1.7.23 (`dist/headlessui.dev.cjs`):
//
//   3009-3014  None=1  InitialFocus=2  TabLock=4  FocusLock=8
//              RestoreFocus=16  All=30
//   4205       leaf: FocusTrap.features.All & ~FocusTrap.features.FocusLock
//
// 30 & ~8 === 22 === InitialFocus | TabLock | RestoreFocus. Only FocusLock
// (8) is cleared. TabLock (4) stays ON.
//
// The two are different features and were being conflated:
//   - FocusLock (useFocusLock, 3233) is the focus-EVENT lock: it yanks focus
//     back on any focus change, including a click on browser chrome. Headless
//     UI turns it off deliberately so the user is not held hostage.
//   - TabLock (4) is the Tab containment, and it does NOT depend on `inert`.
//     At 3112 and 3127 the FocusTrap renders a focusable `Hidden` sentinel
//     (`data-headlessui-focus-guard="true"`) either side of the trapped
//     subtree whenever `features & 4`. Tabbing off the last control lands on
//     a sentinel, whose onFocus (3055) calls
//     `focusIn(container, First|Last, { skipElements: [relatedTarget] })`
//     and wraps focus straight back inside.
//
// The hand-rolled cycle raced that mechanism: it preventDefault()ed and
// focused first/last computed from `[data-ui-modal-panel]` descendants only,
// while the sentinels sit OUTSIDE the panel, so any stop the library
// resolved outside the panel was overridden by our own guess.
//
// Measured on a throwaway harness route with the handler removed: 32
// consecutive stops forward and 32 backward, in this modal and in UiSheet
// (including a UiSheet nested inside a UiSheet, as AppMobileNav does), every
// stop inside the panel and the cycle wrapping on a stable period. The
// library's containment is correct and sufficient on its own.
//
// `data-ui-modal-panel` is retained even though its only consumer (the removed
// cycle) is gone: it is a stable, styling-independent hook for focus and
// visual-regression tests, and it is not part of the public prop API.

// ---------------------------------------------------------------------------
// Escape
// ---------------------------------------------------------------------------
//
// Headless UI binds its own Escape listener on the owner document's
// defaultView. We also handle it here so dismissal is a property of this
// component rather than of a library internal, and so it keeps working if
// that binding is ever scoped differently.
//
// Tab is deliberately NOT handled: see the containment note above.
const onKeydown = (event: KeyboardEvent) => {
  if (event.key !== 'Escape') return
  event.preventDefault()
  event.stopPropagation()
  close(false)
}
</script>

<template>
  <!--
    `role` and `aria-modal` are supplied by <Dialog> itself (it renders
    role="dialog" by default and aria-modal="true" whenever it is open).
    Passing `role` explicitly documents that at the call site rather than
    leaving it as an invisible library default.

    We deliberately pass NO `aria-label`. This used to be
    `:aria-label="title ? undefined : \'Dialog\'"`, which gave an untitled
    dialog the accessible name "Dialog". Verified in the harness, the AX
    name computed to literally "Dialog", so a screen reader announced
    "Dialog, dialog". That is worse than no name at all: it displaces the
    role with a duplicate of it and tells the user nothing.

    With `title` set (both live consumers set it) the <DialogTitle> below
    registers its id and Headless UI wires `aria-labelledby` to it. With no
    title, the dialog is announced by role alone, and a consumer that needs a
    name can now simply pass `aria-label`; it falls through to <Dialog> via
    Vue attribute inheritance instead of being clobbered by this binding.

    `z-modal` (1400) previously resolved to nothing (the token had never
    been declared), so this overlay shipped with no z-index at all and
    depended entirely on portal paint order to land above the page.
  -->
  <TransitionRoot :show="open" as="template">
    <Dialog
      class="relative z-modal"
      role="dialog"
      :initial-focus="initialFocus ?? undefined"
      @close="close"
      @keydown="onKeydown"
    >
      <TransitionChild
        as="template"
        enter="duration-200 ease-emphasis motion-reduce:duration-0"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="duration-150 ease-emphasis motion-reduce:duration-0"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <div
          class="fixed inset-0 bg-ink-900/50 backdrop-blur-[2px]"
          aria-hidden="true"
        />
      </TransitionChild>

      <div class="fixed inset-0 overflow-y-auto">
        <div class="flex min-h-full items-center justify-center p-4 sm:p-6">
          <TransitionChild
            as="template"
            enter="duration-200 ease-emphasis motion-reduce:duration-0"
            enter-from="opacity-0 translate-y-2 scale-[0.98] motion-reduce:translate-y-0 motion-reduce:scale-100"
            enter-to="opacity-100 translate-y-0 scale-100"
            leave="duration-150 ease-emphasis motion-reduce:duration-0"
            leave-from="opacity-100 translate-y-0 scale-100"
            leave-to="opacity-0 translate-y-2 scale-[0.98] motion-reduce:translate-y-0 motion-reduce:scale-100"
          >
            <DialogPanel
              data-ui-modal-panel
              :class="[
                'relative w-full rounded-xl border border-ink-200 bg-cream-50 shadow-elev-3',
                'p-6',
                panelSize,
              ]"
            >
              <DialogTitle v-if="title" class="sr-only">
                {{ title }}
              </DialogTitle>
              <slot />
            </DialogPanel>
          </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>
