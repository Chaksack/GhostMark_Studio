<script setup lang="ts">
// =============================================================================
// ProductCardChips — small horizontal trust/value-prop chip rendered above the
// product title.
//
// As of the v2 IA mode-aware refactor this component is a *dumb renderer* over
// a typed `Chip[]` (see `~/utils/chips`). The parent (`ProductCard`) is now
// responsible for:
//   1. Resolving raw badge keys from product metadata.
//   2. Filtering them to the active commerce mode — derived primarily from
//      `product.type.value` (`'apparel'` -> D2C chips, `'pod'` -> B2B/POD
//      chips), with the explicit `mode` prop as a fallback.
//   3. Capping the count for the target breakpoint.
// All this component does is paint each chip with the right surface treatment.
//
// v18 chip discipline (per merchery audit):
//   The previous variant axis (`default` / `highlight`) created visual noise
//   because too many chips earned the highlight tone — the eye couldn't tell
//   which signal actually mattered. We've collapsed to a single base surface
//   (white + light inset ring) and reserved pistacho for the ONE chip that
//   should pop on a scan: `LOW STOCK` (`chip.urgent === true`). Every other
//   chip differentiates by LABEL, not by color.
//
// We deliberately avoid `backdrop-blur-sm` (GPU-expensive and only useful when
// the chip overlaps a mid-tone area). Long labels truncate with an ellipsis at
// `max-w-[140px]` rather than wrapping inside the chip.
//
// Bug 21 fix (P1) preserved: the parent still slices to a single chip on the
// PLP, so the absolute strip never wraps to a second line on mobile.
// =============================================================================
import type { Chip } from '~/utils/chips'

defineProps<{
  chips: Chip[]
}>()
</script>

<template>
  <div v-if="chips.length" class="flex flex-wrap gap-x-2 gap-y-1">
    <span
      v-for="chip in chips"
      :key="chip.key"
      :class="[
        'text-[10px] font-medium uppercase tracking-[0.06em] px-[6px] py-[3px] md:px-2 md:py-1 rounded ring-1 ring-inset truncate max-w-[140px] pointer-events-auto',
        chip.urgent
          ? 'bg-pistacho text-ink-950 ring-pistacho/60'
          : 'bg-white text-ink-950 ring-greyLines/30',
      ]"
    >
      {{ chip.label }}
    </span>
  </div>
</template>
