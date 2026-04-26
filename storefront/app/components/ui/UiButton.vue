<script setup lang="ts">
import { computed } from 'vue'
import { NuxtLink } from '#components'
import UiSpinner from './UiSpinner.vue'

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'merchery'
type Size = 'sm' | 'md' | 'lg'
type Shape = 'pill' | 'rounded' | 'square'
type Tag = 'button' | 'a' | 'NuxtLink'
type ButtonType = 'button' | 'submit' | 'reset'

interface Props {
  variant?: Variant
  size?: Size
  shape?: Shape
  loading?: boolean
  disabled?: boolean
  block?: boolean
  as?: Tag
  to?: string
  type?: ButtonType
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  // Default shape flipped to merchery-style flat rectangle. Existing
  // consumers that explicitly pass `shape="pill"` keep their look.
  shape: 'square',
  loading: false,
  disabled: false,
  block: false,
  as: 'button',
  to: undefined,
  type: 'button',
})

const emit = defineEmits<{
  (e: 'click', event: MouseEvent): void
}>()

const isDisabled = computed(() => props.disabled || props.loading)

const tag = computed(() => {
  if (props.as === 'NuxtLink') return NuxtLink
  if (props.as === 'a') return 'a'
  return 'button'
})

const variantClasses: Record<Variant, string> = {
  primary: 'bg-ink-900 text-cream-50 hover:bg-ink-700',
  secondary: 'bg-cream-100 text-ink-900 hover:bg-cream-200',
  ghost: 'text-ink-700 hover:bg-ink-50',
  outline: 'border border-ink-200 bg-white text-ink-900 hover:border-ink-300 hover:bg-ink-50',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  // Editorial / merchery.co primary CTA — flat ink slab, square corners,
  // sentence case. Pair with `shape="square"` for the canonical look.
  merchery: 'bg-merchery-ink text-merchery-cta hover:bg-ink-700',
}

const sizeClasses: Record<Size, string> = {
  sm: 'h-9 px-4 text-[13px]',
  md: 'h-11 px-5 text-sm',
  lg: 'h-[50px] px-7 text-[15px]',
}

const shapeClasses: Record<Shape, string> = {
  pill: 'rounded-full',
  rounded: 'rounded-md',
  square: 'rounded-none',
}

const classes = computed(() => [
  'inline-flex items-center justify-center gap-2 font-medium select-none',
  // Include `transform` in the transition list so the active-press snap
  // tweens instead of jumping. Duration stays at `fast` (120ms) — the
  // press feedback should feel immediate, not animated.
  'transition-[background,color,border,box-shadow,transform] duration-fast ease-emphasis',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900 focus-visible:ring-offset-2 focus-visible:ring-offset-cream-50',
  // Tactile press: 1px downward nudge while the pointer is held.
  // `disabled:active:translate-y-0` keeps disabled buttons inert so they
  // don't register press feedback the click handler will refuse anyway.
  // `motion-reduce:active:translate-y-0` honors user preference.
  'active:translate-y-[1px] disabled:active:translate-y-0 motion-reduce:active:translate-y-0',
  'disabled:cursor-not-allowed disabled:opacity-60',
  'motion-reduce:transition-none',
  variantClasses[props.variant],
  sizeClasses[props.size],
  shapeClasses[props.shape],
  props.block ? 'w-full' : '',
])

const elementProps = computed<Record<string, unknown>>(() => {
  if (props.as === 'NuxtLink') {
    return {
      to: props.to,
      'aria-disabled': isDisabled.value || undefined,
      tabindex: isDisabled.value ? -1 : undefined,
    }
  }
  if (props.as === 'a') {
    return {
      href: isDisabled.value ? undefined : props.to,
      'aria-disabled': isDisabled.value || undefined,
      tabindex: isDisabled.value ? -1 : undefined,
    }
  }
  return {
    type: props.type,
    disabled: isDisabled.value,
  }
})

const onClick = (event: MouseEvent) => {
  if (isDisabled.value) {
    event.preventDefault()
    event.stopPropagation()
    return
  }
  emit('click', event)
}
</script>

<template>
  <component
    :is="tag"
    v-bind="elementProps"
    :class="classes"
    :aria-busy="loading || undefined"
    @click="onClick"
  >
    <span v-if="loading" class="inline-flex shrink-0 items-center">
      <UiSpinner :size="size === 'lg' ? 18 : 16" />
    </span>
    <span v-else-if="$slots.leading" class="inline-flex shrink-0 items-center">
      <slot name="leading" />
    </span>

    <span class="inline-flex items-center">
      <slot />
    </span>

    <span v-if="$slots.trailing" class="inline-flex shrink-0 items-center">
      <slot name="trailing" />
    </span>
  </component>
</template>
