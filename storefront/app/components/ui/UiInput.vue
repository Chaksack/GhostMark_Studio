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

const sizeClasses: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm rounded-md',
  md: 'h-11 px-3.5 text-sm rounded-md',
  lg: 'h-12 px-4 text-[15px] rounded-md',
}

const classes = computed(() => [
  'w-full border bg-white text-ink-900 placeholder:text-ink-500',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-300 focus-visible:ring-offset-2 focus-visible:ring-offset-cream-50',
  'disabled:bg-ink-50 disabled:text-ink-400 disabled:cursor-not-allowed',
  'transition-[border-color,box-shadow] duration-fast ease-emphasis motion-reduce:transition-none',
  isInvalid.value ? 'border-red-500' : 'border-ink-200',
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
// not the DOM node — exposing `inputEl` gives callers a stable, typed handle.
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
