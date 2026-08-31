<script setup lang="ts">
// =============================================================================
// ProductCardChips: the editorial eyebrow above a product card's title.
//
// This component is a dumb renderer over a typed `Chip[]` (see `~/utils/chips`).
// `ProductCard` resolves the keys, filters them to the commerce mode, drops the
// ones that don't belong on a browse card, and caps the count. All this does is
// paint them.
//
// -----------------------------------------------------------------------------
// v21: chips left the photograph
// -----------------------------------------------------------------------------
// These used to be pill-shaped badges absolutely positioned over the product
// image. They are now small-caps text in the meta block, above the title.
//
// Three reasons, in order of weight:
//
//  1. No major apparel reference puts a status chip on the photo. lululemon
//     sets "TRENDING" / "BEST GIFT" in the meta block above the title; Urban
//     Outfitters and Selfridges keep the image clean but for the wishlist
//     heart. Selfridges' brand eyebrow is exactly this treatment.
//  2. The photo is the card's whole job. The old implementation's own comment
//     said it wanted "the photo as the dominant visual" and then covered it.
//  3. The claims were landing on the wrong pictures. Catalogue photography is
//     assigned per category, not per product, so "MADE IN EUROPE" was sitting
//     over a candle and "BEST SELLER" over a photo of reading glasses.
//
// Losing the pill also removes the white fill and inset ring that existed only
// to keep the label legible against an arbitrary photograph. Against the page
// background the label needs no chrome at all, which is the point of an
// eyebrow, and one less surface in a grid that had too many.
//
// -----------------------------------------------------------------------------
// Urgency
// -----------------------------------------------------------------------------
// Exactly one chip in the catalog carries `urgent` (`LOW STOCK`). It used to
// earn a pistacho FILL; as text it takes the semantic warning foreground
// instead. Colour still does the work, the surface is gone, and the semantic
// token means this tracks the design system rather than a raw palette value.
//
// -----------------------------------------------------------------------------
// Wrapping
// -----------------------------------------------------------------------------
// Bug 21 (P1) was a 3-chip strip wrapping to two lines at ≤390px and eating the
// top of the thumbnail. It cannot recur: there is no overlay left to eat, the
// row is `flex-nowrap`, and the second chip is hidden below `md` so a 163px
// 2-up mobile card renders exactly one. The breakpoint is pure CSS, so a
// server-rendered grid has no hydration mismatch to worry about.
// =============================================================================
import type { Chip } from '~/utils/chips'

defineProps<{
  chips: Chip[]
}>()
</script>

<template>
  <!--
    The eyebrow row is ALWAYS rendered, even with no chips.

    Dropping the ubiquitous `made_in_europe` from browse cards leaves 8 of 26
    products with no eyebrow at all. If the row collapsed on those, their
    titles would start ~19px higher than their neighbours', and every grid row
    mixing the two would misalign its titles, prices and commerce lines, the
    same defect the title's reserved two lines fixes one element down.

    So the row reserves its height unconditionally. `min-h-[1.2rem]` is a
    spacing value covering one 12px/1.2 eyebrow line; it is not a type size.
    `aria-hidden` when empty so the reserved box is never announced as a blank
    element by a screen reader.
  -->
  <div
    :aria-hidden="chips.length ? undefined : 'true'"
    class="mb-[2px] flex min-h-[1.2rem] flex-nowrap items-baseline gap-x-[0.6rem] overflow-hidden"
  >
    <span
      v-for="(chip, i) in chips"
      :key="chip.key"
      :class="[
        'text-eyebrow font-medium uppercase truncate',
        chip.urgent ? 'text-semantic-warning-fg' : 'text-ink-500',
        // Second chip is desktop-only, see the wrapping note above.
        i > 0 ? 'hidden md:inline-block' : '',
      ]"
    >
      {{ chip.label }}
    </span>
  </div>
</template>
