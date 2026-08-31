<script setup lang="ts">
import { computed, inject, ref, useId } from 'vue'
import { UiFieldKey } from './ui-field-context'

type Size = 'sm' | 'md' | 'lg'

interface Props {
  modelValue?: string | number
  type?: string
  invalid?: boolean
  size?: Size
  id?: string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  type: 'text',
  invalid: false,
  size: 'md',
  id: undefined,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | number): void
}>()

defineOptions({
  inheritAttrs: false,
})

const field = inject(UiFieldKey, null)
const fallbackId = useId()

const inputId = computed(() => props.id ?? field?.id.value ?? fallbackId)
const isInvalid = computed(() => props.invalid || field?.invalid.value || false)
const describedBy = computed(() => field?.describedById.value)
const isRequired = computed(() => field?.required.value || false)

// `text-base sm:text-sm` is not a typo and not a design change.
//
// iOS Safari zooms the viewport whenever a focused input's computed
// font-size is under 16px, and it does not zoom back out on blur. Every
// control here was 14px, so tapping any field on an iPhone left the user
// zoomed into the form. Rendering 16px below the `sm` breakpoint and the
// intended size at and above it fixes that without touching how the control
// looks on the devices where it was already correct.
//
// `text-[15px]` on `lg` becomes `text-lead`, which is the same 15px, now
// declared in the type ramp instead of bracket-escaped past it.
const sizeClasses: Record<Size, string> = {
  sm: 'h-9 px-3 text-base sm:text-caption rounded-md',
  md: 'h-11 px-3.5 text-base sm:text-sm rounded-md',
  lg: 'h-12 px-4 text-base sm:text-lead rounded-md',
}

const classes = computed(() => [
  'w-full border bg-white text-ink-900 placeholder:text-ink-500',
  // The focus ring was `ring-ink-300`, a token that did not exist, so this
  // silently rendered Tailwind's stock `rgb(59 130 246 / .5)`: a blue focus
  // ring, on every form field, in an entirely warm palette. `ink-300` now
  // exists but is still the wrong choice for a ring (2.29:1 on white, under
  // SC 1.4.11's 3:1 floor), so this points at the semantic focus ink
  // instead. `outline-none` is kept deliberately: in Tailwind it emits a
  // *transparent* outline rather than removing one, which is what keeps the
  // indicator visible in Windows High Contrast / forced-colors mode.
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-cream-50',
  'disabled:bg-ink-50 disabled:text-ink-400 disabled:cursor-not-allowed',
  'transition-[border-color,box-shadow] duration-fast ease-emphasis motion-reduce:transition-none',
  // Invalid border moves off Tailwind's stock red onto the semantic role, so
  // it matches the error text UiField renders directly underneath it.
  isInvalid.value ? 'border-semantic-danger-solid' : 'border-ink-200',
  sizeClasses[props.size],
])

const onInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (props.type === 'number') {
    emit('update:modelValue', target.value === '' ? '' : Number(target.value))
  }
  else {
    emit('update:modelValue', target.value)
  }
}

// Expose the underlying <input> DOM node so parents can:
//   1. Pass it to Headless UI <Dialog :initial-focus> for a11y-correct focus
//      placement on open.
//   2. Programmatically focus / select the field from a watcher.
// A template ref on <UiInput> alone resolves to the component instance proxy,
// not the DOM node. Exposing `inputEl` gives callers a stable, typed handle.
const inputEl = ref<HTMLInputElement | null>(null)

defineExpose({ inputEl })
</script>

<template>
  <input
    :id="inputId"
    ref="inputEl"
    :type="type"
    :value="modelValue"
    :class="classes"
    :aria-invalid="isInvalid || undefined"
    :aria-describedby="describedBy"
    :aria-required="isRequired || undefined"
    :required="isRequired || undefined"
    v-bind="$attrs"
    @input="onInput"
  >
</template>
