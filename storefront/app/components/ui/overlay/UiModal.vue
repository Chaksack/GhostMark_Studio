<script setup lang="ts">
import { computed } from 'vue'
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
</script>

<template>
  <TransitionRoot :show="open" as="template">
    <Dialog
      class="relative z-modal"
      :initial-focus="initialFocus ?? undefined"
      @close="close"
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
