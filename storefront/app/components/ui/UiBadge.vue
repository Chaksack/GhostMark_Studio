<script setup lang="ts">
import { computed } from 'vue'

/**
 * UiBadge — small uppercase status pill used for order status, fulfillment
 * state, and other discrete enumerated values.
 *
 * Variants are mapped onto the Ghostmark token scale (cream / sage / ink /
 * accent.terracotta). Default `neutral` is the safe fallback used by the
 * order detail page until Medusa's status enum is exhaustively mapped.
 *
 * Usage:
 *   <UiBadge variant="success">Captured</UiBadge>
 *
 * Accessibility: badges are decorative-by-default — they live next to the
 * value they qualify (e.g. an order id), so we don't add ARIA. If a badge
 * ever stands alone its caller should wrap it in semantic context.
 */

type Variant = 'neutral' | 'success' | 'warning' | 'danger' | 'info'

interface Props {
  variant?: Variant
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'neutral',
})

const variantClasses: Record<Variant, string> = {
  // Cool quiet default — used for unknown / pending statuses.
  neutral: 'bg-ink-100 text-ink-700',
  // Sage washed surface for positive / completed states.
  success: 'bg-sage-50 text-sage-600',
  // Warm cream for in-flight / awaiting states.
  warning: 'bg-cream-tile text-ink-950',
  // Terracotta wash for cancelled / failed states. Built from the
  // accent token via opacity so we don't introduce a new red scale.
  danger: 'bg-accent-terracotta/15 text-accent-terracotta',
  // Cream-warm for purely informational badges.
  info: 'bg-cream-warm text-ink-700',
}

const variantClass = computed(() => variantClasses[props.variant])
</script>

<template>
  <span
    :class="[
      'inline-flex items-center px-2.5 py-1 font-body text-caption uppercase tracking-normal',
      variantClass,
    ]"
  >
    <slot />
  </span>
</template>
