<script setup lang="ts">
/**
 * FilterPill — the merchery PLP facet pill.
 *
 * Anatomy:
 *   [ Label ▾ ]  — closed pill (no count)
 *   [ Label (2) ▾ ]  — active pill, count badge, `bg-uiGrey` background
 *   open ↓
 *   ┌─────────────────────────┐
 *   │ ☐ Option A              │
 *   │ ☐ Option B              │
 *   │ ────────────────────────│
 *   │ Clear            [Done] │
 *   └─────────────────────────┘
 *
 * Behavior:
 *   - `multi` (default true) toggles each option in/out of the array model.
 *   - `multi=false` replaces the model with the picked value and auto-closes.
 *   - Outside-click and Escape both close the popover.
 *   - `Clear` empties the model but leaves the popover open so the operator
 *     can immediately repick.
 *   - `Done` closes the popover without altering state.
 *
 * Accessibility: the trigger advertises `aria-haspopup="listbox"` and
 * mirrors the open state in `aria-expanded`. The popover itself carries
 * `role="listbox"` (single-select) or `role="group"` (multi-select with
 * checkboxes — `listbox` semantics don't fit multi-checkbox panels) and the
 * count badge is wrapped in an `aria-label` so screen readers announce
 * "Category, 2 selected" rather than "Category 2".
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { FilterOption } from '~/utils/filters'

interface Props {
  label: string
  options: readonly FilterOption[] | FilterOption[]
  multi?: boolean
  modelValue?: string | string[]
}

const props = withDefaults(defineProps<Props>(), {
  multi: true,
  modelValue: () => [],
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | string[]): void
}>()

const open = ref(false)
const wrapper = ref<HTMLElement | null>(null)
// `alignRight` flips the popover anchor so the 280px panel doesn't clip the
// viewport when the pill sits near the right edge of the row (e.g. the Sort
// pill at the end of a `justify-between` bar). Re-evaluated each open so a
// resize between opens still picks the correct side.
const alignRight = ref(false)

// `selected` is purely derived — a normalised view that always exposes the
// model as an array of strings so the template doesn't need to branch on
// `multi`. Single-select stores `''` for unset; multi stores `[]`.
const selected = computed<string[]>(() => {
  const v = props.modelValue
  if (Array.isArray(v)) return v
  return v ? [v] : []
})

const count = computed(() => selected.value.length)
const isActive = computed(() => count.value > 0)

const labelWithCount = computed(() =>
  isActive.value ? `${props.label} (${count.value})` : props.label,
)

// `aria-label` mirrors the count in human-readable form so the badge isn't
// announced as a bare number disconnected from its facet.
const triggerAriaLabel = computed(() =>
  isActive.value
    ? `${props.label}, ${count.value} selected`
    : props.label,
)

function isChecked(value: string) {
  return selected.value.includes(value)
}

function toggle(value: string) {
  if (props.multi) {
    const next = isChecked(value)
      ? selected.value.filter(v => v !== value)
      : [...selected.value, value]
    emit('update:modelValue', next)
  }
  else {
    // Single-select replaces the model with the picked value (or clears it
    // if the same option is re-clicked, matching merchery's PLP behavior).
    const next = isChecked(value) ? '' : value
    emit('update:modelValue', next)
    // Auto-close on single-select pick — the operator's intent is committed.
    open.value = false
  }
}

function clear() {
  emit('update:modelValue', props.multi ? [] : '')
}

function close() {
  open.value = false
}

function toggleOpen() {
  open.value = !open.value
  if (open.value) {
    // Defer one tick so the trigger's bounding box is stable, then test
    // whether a 280px popover anchored left would overflow the viewport's
    // right edge. If so, flip to right-anchored so it fans out leftward.
    nextTick(() => {
      const root = wrapper.value
      if (!root) return
      const rect = root.getBoundingClientRect()
      const POPOVER_WIDTH = 280
      const VIEWPORT_PAD = 16
      const wouldOverflow = rect.left + POPOVER_WIDTH > window.innerWidth - VIEWPORT_PAD
      alignRight.value = wouldOverflow
    })
  }
}

// --- Outside-click + Escape ---------------------------------------------
//
// Bound on `mousedown` (not `click`) so a click on the trigger of *another*
// FilterPill closes this one before the other one's `click` fires — without
// this, two pills can briefly be open simultaneously when you whip between
// them. Escape closes for keyboard users and re-focuses the trigger.

function onDocumentMouseDown(event: MouseEvent) {
  if (!open.value) return
  const root = wrapper.value
  if (!root) return
  if (root.contains(event.target as Node)) return
  open.value = false
}

function onKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape' && open.value) {
    open.value = false
    const trigger = wrapper.value?.querySelector<HTMLButtonElement>('button[aria-haspopup]')
    trigger?.focus()
  }
}

onMounted(() => {
  document.addEventListener('mousedown', onDocumentMouseDown)
  document.addEventListener('keydown', onKeyDown)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocumentMouseDown)
  document.removeEventListener('keydown', onKeyDown)
})

// Close if the consumer swaps the option list out from under us (defensive —
// keeps stale popovers from persisting across route navigations that share
// the same FilterPill instance).
watch(() => props.options, () => { open.value = false })
</script>

<template>
  <div ref="wrapper" class="relative">
    <button
      type="button"
      class="px-[1.2rem] py-[1rem] min-h-[44px] flex items-center gap-2 border border-greyLines transition-colors hover:bg-uiGrey focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-950 focus-visible:ring-offset-1"
      :class="{ 'bg-uiGrey': isActive }"
      :aria-expanded="open"
      :aria-label="triggerAriaLabel"
      aria-haspopup="listbox"
      @click="toggleOpen"
    >
      <span>{{ labelWithCount }}</span>
      <svg
        viewBox="0 0 24 24"
        width="12"
        height="12"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        aria-hidden="true"
        class="transition-transform"
        :class="{ 'rotate-180': open }"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>

    <div
      v-if="open"
      class="absolute top-full mt-2 z-30 w-[280px] max-w-[calc(100vw-2rem)] bg-white border border-greyLines shadow-custom rounded-[0.5rem] p-4 max-h-[60vh] overflow-y-auto"
      :class="alignRight ? 'right-0' : 'left-0'"
      :role="multi ? 'group' : 'listbox'"
      :aria-label="`${label} options`"
    >
      <ul class="flex flex-col gap-1">
        <li v-for="option in options" :key="option.value">
          <label class="flex items-center gap-3 min-h-[40px] py-2 cursor-pointer hover:bg-offWhite px-2 rounded">
            <input
              v-if="multi"
              type="checkbox"
              class="h-4 w-4 shrink-0 border border-black"
              :checked="isChecked(option.value)"
              @change="toggle(option.value)"
            >
            <input
              v-else
              type="radio"
              class="h-4 w-4 shrink-0"
              :name="`filter-pill-${label}`"
              :checked="isChecked(option.value)"
              @change="toggle(option.value)"
            >
            <span class="text-sm">{{ option.label }}</span>
          </label>
        </li>
      </ul>

      <div class="flex justify-between items-center mt-3 pt-3 border-t border-greyLines">
        <button
          type="button"
          class="inline-flex items-center min-h-[40px] px-2 text-sm underline-offset-2 hover:underline disabled:opacity-40 disabled:no-underline"
          :disabled="!isActive"
          @click="clear"
        >
          Clear
        </button>
        <button
          type="button"
          class="inline-flex items-center bg-ink-950 text-cream-50 px-4 py-2 min-h-[40px] rounded text-sm hover:bg-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-950 focus-visible:ring-offset-1"
          @click="close"
        >
          Done
        </button>
      </div>
    </div>
  </div>
</template>
