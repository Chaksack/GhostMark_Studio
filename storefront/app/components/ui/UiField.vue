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
    <!--
      `text-ink-800` referenced a token that did not exist, so the label had
      no colour of its own and simply inherited whatever the surrounding
      context happened to be. ink-800 now exists and measures 13.35:1 on
      cream-50. `text-[13px]` / `text-[12px]` move onto the declared ramp as
      `text-caption` / `text-micro`, same sizes, no longer escaping it.
    -->
    <label
      v-if="label"
      :for="fieldId"
      class="text-caption font-medium text-ink-800"
    >
      {{ label }}
      <span
        v-if="required"
        aria-hidden="true"
        class="ml-0.5 text-semantic-danger-fg"
      >*</span>
      <span v-if="required" class="sr-only"> (required)</span>
    </label>

    <slot />

    <!--
      Error copy uses the semantic danger ink (8.44:1 on cream-50) rather
      than Tailwind's stock `red-600`, so it matches the invalid border
      UiInput draws immediately above it. The `role="alert"` is what carries
      the error to a screen reader; colour is never the only cue, since the
      message is also programmatically tied to the input via aria-describedby.
    -->
    <p
      v-if="error"
      :id="describedById"
      role="alert"
      class="text-micro text-semantic-danger-fg"
    >
      {{ error }}
    </p>
    <p
      v-else-if="help"
      :id="describedById"
      class="text-micro text-ink-500"
    >
      {{ help }}
    </p>
  </div>
</template>
