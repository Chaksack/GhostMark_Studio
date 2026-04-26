<script setup lang="ts">
import { computed, provide, useId } from 'vue'
import { UiFieldKey } from './ui-field-context'

interface Props {
  label?: string
  error?: string
  help?: string
  required?: boolean
  id?: string
}

const props = withDefaults(defineProps<Props>(), {
  label: undefined,
  error: undefined,
  help: undefined,
  required: false,
  id: undefined,
})

const autoId = useId()
const fieldId = computed(() => props.id ?? autoId)
const invalid = computed(() => Boolean(props.error))
const describedById = computed(() => {
  if (props.error) return `${fieldId.value}-error`
  if (props.help) return `${fieldId.value}-help`
  return undefined
})
const requiredRef = computed(() => Boolean(props.required))

provide(UiFieldKey, {
  id: fieldId,
  invalid,
  describedById,
  required: requiredRef,
})
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <label
      v-if="label"
      :for="fieldId"
      class="text-[13px] font-medium text-ink-800"
    >
      {{ label }}
      <span
        v-if="required"
        aria-hidden="true"
        class="ml-0.5 text-red-600"
      >*</span>
      <span v-if="required" class="sr-only"> (required)</span>
    </label>

    <slot />

    <p
      v-if="error"
      :id="describedById"
      role="alert"
      class="text-[12px] text-red-600"
    >
      {{ error }}
    </p>
    <p
      v-else-if="help"
      :id="describedById"
      class="text-[12px] text-ink-500"
    >
      {{ help }}
    </p>
  </div>
</template>
