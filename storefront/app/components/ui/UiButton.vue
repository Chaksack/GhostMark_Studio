<script setup lang="ts">
import { computed } from 'vue'
import { NuxtLink } from '#components'
import UiSpinner from './UiSpinner.vue'

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'outlineStrong' | 'danger' | 'merchery'
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
  // Border was `ink-200`, which is 1.48:1 against the button's own white
  // fill and 1.14:1 against `cream-warm`. On a bordered button the border
  // IS the control boundary, so at those ratios the control had no
  // perceivable extent — SC 1.4.11 asks 3:1 of it. Worse, `hover:ink-300`
  // (2.29:1) was also under, so hovering did not rescue it either.
  //
  // `ink-500` is the LIGHTEST step that clears 3:1 on every ground this
  // variant is painted on — white 5.90, cream-50 5.61, cream-warm 4.55 —
  // the same selection rule the ink-500 token itself was chosen by.
  // `ink-400` was the tempting smaller change and it fails: 2.89:1 on
  // cream-warm, which is exactly the ground the cookie banner sits on.
  //
  // This IS a visible change across ~38 buttons: a hairline becomes a
  // legible outline. That is the fix, not a side effect — the hairline was
  // the defect.
  outline: 'border border-ink-500 bg-white text-ink-900 hover:border-ink-700 hover:bg-ink-50',
  // Same shape as `outline`, at the weight of a filled primary: the border
  // matches the `merchery` slab's own ink, so the two read as an equal
  // pair rather than as a primary and an afterthought.
  //
  // This exists for CONSENT, and the requirement there is not merely
  // legibility. A reject control is expected to be as prominent and as
  // easy to reach as accept; a grey-outlined button beside a solid black
  // one is arguably not that, whatever it measures. Use this wherever a
  // choice must not be visually steered — not as a general "louder
  // outline", which is what `outline` is now for.
  outlineStrong:
    'border border-merchery-ink bg-transparent text-ink-950 hover:bg-merchery-ink hover:text-merchery-cta',
  // Routed through the `semantic` group so this and UiBadge finally agree on
  // what danger looks like: they previously shipped two different hues
  // (`red-600` here, `accent-terracotta/15` there). `red-*` is also a
  // Tailwind stock ramp that appears nowhere else in this warm palette.
  // cream-50 on the solid measures 5.99:1.
  danger: 'bg-semantic-danger-solid text-cream-50 hover:bg-semantic-danger-fg',
  // Editorial / merchery.co primary CTA: flat ink slab, square corners,
  // sentence case. Pair with `shape="square"` for the canonical look.
  merchery: 'bg-merchery-ink text-merchery-cta hover:bg-ink-700',
}

// Sizes now sit on the declared type ramp instead of reaching outside it:
// `text-[13px]` → `text-caption`, `text-[15px]` → `text-lead`. `text-sm` is
// Tailwind's own 14px step and stays.
//
// Touch target. `sm` is a 36px control, which clears WCAG 2.2 SC 2.5.8
// (Target Size Minimum, 24×24, AA) but misses the 44px that SC 2.5.5 (AAA)
// and every platform HIG ask for. Growing it to 44px unconditionally would
// wreck the control rhythm on pointer devices, where 36px is the correct
// size and the extra 8px is dead space.
//
// So the *hit area* grows and the *box* does not: on touch-primary devices
// (`pointer-coarse`, a variant added in tailwind.config.ts) a pseudo-element
// is stretched to 44px, vertically centred on the button and pinned to its
// inline edges. Clicks on it route to the button because it is inside the
// button. Layout is untouched, so nothing reflows and no design changes.
//
// `md` (44px) and `lg` (50px) already meet the target and need no help.
const TOUCH_TARGET_SM
  = 'relative pointer-coarse:before:absolute pointer-coarse:before:inset-x-0'
    + ' pointer-coarse:before:top-1/2 pointer-coarse:before:h-11'
    + ' pointer-coarse:before:-translate-y-1/2 pointer-coarse:before:content-[\'\']'

const sizeClasses: Record<Size, string> = {
  sm: `h-9 px-4 text-caption ${TOUCH_TARGET_SM}`,
  md: 'h-11 px-5 text-sm',
  lg: 'h-[50px] px-7 text-lead',
}

const shapeClasses: Record<Shape, string> = {
  pill: 'rounded-full',
  rounded: 'rounded-md',
  square: 'rounded-none',
}

const classes = computed(() => [
  'inline-flex items-center justify-center gap-2 font-medium select-none',
  // Include `transform` in the transition list so the active-press snap
  // tweens instead of jumping. Duration stays at `fast` (120ms): the
  // press feedback should feel immediate, not animated.
  'transition-[background,color,border,box-shadow,transform] duration-fast ease-emphasis',
  // Canonical focus recipe. The offset is load-bearing, not decorative.
  // See the `semantic.focus` comment in tailwind.config.ts. Keep the five
  // classes together; splitting them is what breaks conformance.
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-cream-50',
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
