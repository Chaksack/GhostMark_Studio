<script setup lang="ts">
import { computed } from 'vue'

/**
 * UiBadge: small uppercase status pill used for order status, fulfillment
 * state, and other discrete enumerated values.
 *
 * Variants are mapped onto the Ghostmark token scale (cream / sage / ink /
 * accent.terracotta). Default `neutral` is the safe fallback used by the
 * order detail page until Medusa's status enum is exhaustively mapped.
 *
 * Usage:
 *   <UiBadge variant="success">Captured</UiBadge>
 *
 * Accessibility: badges are decorative-by-default. They live next to the
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

// Every status variant now resolves through the `semantic` token group, so
// this component and UiButton cannot drift apart again. They previously
// disagreed outright: UiButton's `danger` was `bg-red-600` while this badge's
// `danger` was `accent-terracotta/15`, two different hues, both claiming to
// mean "destructive".
//
// Each variant is the same three-part recipe (surface + fg + border). The
// border is not cosmetic: it is the non-colour cue that keeps the badge
// legible for users who can't separate the surface tints from each other,
// and it gives the pill an edge on grounds (cream-tile, uiHighlight) where a
// pale wash would otherwise dissolve.
const variantClasses: Record<Variant, string> = {
  // Quiet warm default: unknown / pending statuses. ink-700 on ink-100
  // measures 9.29:1.
  neutral: 'bg-ink-100 text-ink-700 border-ink-200',
  // 7.82:1. Deliberately NOT `merchery-sage`: that value is a decorative
  // full-bleed marketing slab on /returns, /sustainability and six other
  // pages, and a colour cannot be both brand furniture and a status signal
  // without the signal eroding.
  success: 'bg-semantic-success-surface text-semantic-success-fg border-semantic-success-border',
  // 7.33:1.
  warning: 'bg-semantic-warning-surface text-semantic-warning-fg border-semantic-warning-border',
  // 7.48:1. Was `accent-terracotta` on `accent-terracotta/15` = 3.18:1 at
  // 13px, below the 4.5:1 AA floor for body-size text.
  danger: 'bg-semantic-danger-surface text-semantic-danger-fg border-semantic-danger-border',
  // 6.61:1.
  info: 'bg-semantic-info-surface text-semantic-info-fg border-semantic-info-border',
}

const variantClass = computed(() => variantClasses[props.variant])
</script>

<template>
  <span
    :class="[
      'inline-flex items-center border px-2.5 py-1 font-body text-caption uppercase tracking-normal',
      variantClass,
    ]"
  >
    <slot />
  </span>
</template>
