<script setup lang="ts">
// =============================================================================
// ProductCardVariant: the differentiator token on a browse card.
//
// Renders the one fact that tells this product apart from the near-identical
// one beside it. Sits on the PRICE ROW, right-aligned, opposite the price.
//
// -----------------------------------------------------------------------------
// WHY THE PRICE ROW AND NOT A NEW LINE
// -----------------------------------------------------------------------------
// Because a new line costs vertical rhythm on every card in the grid, and the
// price row is already half empty. Measured at 1440 on /products: the price
// ("£35.00") occupies roughly 55px of a 289px card, so ~80% of that row is
// whitespace on all 24 cards. Putting the differentiator there costs ZERO
// added height and pairs the two facts that actually vary between two cards
// in the same family: what it costs, and which one it is.
//
// It also produces the read the grid needs. Down a column you now get
//
//     £18.00                    500 ML
//     £22.00                    750 ML
//
// with the figures tabular and left-anchored and the specs tabular and
// right-anchored, so both are comparable by eye without reading a word.
//
// REFERENCES (Mobbin, checked rather than recalled):
//   BAGGU      https://mobbin.com/sites/sections/8263a80a-7b39-480f-872b-d7ae4ba11f31
//              Product name then the colourway on its own, typographically
//              separated, plus a "+ 12 MORE" overflow. The closest thing in
//              the index to this exact problem.
//   Bumble     https://mobbin.com/sites/sections/495e4963-741a-42f3-b17e-f0d14ffaaa99
//              Swatch row right-aligned on the meta row, opposite the title
//              and price. This is the layout being taken.
//   Webflow    https://mobbin.com/sites/sections/6400774c-b34b-49db-a9d2-423d6f6dcc01
//   UGLYCASH   https://mobbin.com/sites/sections/965755b4-993d-4535-9091-b3ebde216fe0
//              Colourway dots directly under the meta, each with a visible
//              outline. The outline is the detail that makes a white swatch
//              legible on a white card, and it is why the ring below is not
//              optional decoration.
//   Glossier   https://mobbin.com/sites/sections/355f80cd-92e6-4c1e-aa25-c934999233de
//              Swatch row plus a "+" overflow affordance, and a descriptor
//              line under the title.
//
// -----------------------------------------------------------------------------
// WHY ONE VOICE FOR ALL THREE KINDS
// -----------------------------------------------------------------------------
// Colourway names and measures both render in `.gm-spec` (12px system mono,
// uppercase, 0.08em, tabular-nums). They are different KINDS of fact but they
// occupy the same slot, and a slot that changes typeface depending on its
// contents is not a slot, it is two slots that happen to overlap. One voice
// means the eye finds the differentiator at the same place and the same
// weight on every card, which is the entire mechanism by which a column
// becomes scannable.
//
// `.gm-spec` is the sanctioned device for this: CHECKOUT's ruling is that it
// sets metadata, chips and indices, never a sentence and never a heading. A
// colourway name and a volume are metadata. It also carries a hard 12px floor
// by design, so this component cannot reintroduce sub-12px type.
//
// -----------------------------------------------------------------------------
// ACCESSIBILITY
// -----------------------------------------------------------------------------
// * The colour NAME is always rendered as text next to its dot, so colour is
//   never the sole carrier of meaning (WCAG 1.4.1). The dot accelerates the
//   scan; the word is what actually informs.
// * The dot's ring, not its fill, is what makes it perceivable (WCAG 1.4.11,
//   3:1 for non-text). The fill is a truthful sample of the product colour
//   and is therefore allowed to be cream on a cream page; the ring is a fixed
//   ink-500 hairline that clears 3:1 on every ground in the palette.
//
//   ink-500 (#6E6A60) and not ink-400, and the difference was measured, not
//   guessed. ink-400 renders 3.24:1 against the only ground the grid uses
//   today (offWhite #F1EEE9), which passes. It is still the wrong token: on
//   warmGrey #E5DFD6, which the palette uses for alternating section bands
//   and which BestSellers already paints its end-tile with, ink-400 falls to
//   2.83:1 and FAILS. Nothing would surface that; the dot would simply go
//   quiet on one band. ink-500 is the same value as `semantic-focus` and
//   CHECKOUT has it measured on all six grounds, worst case 4.07:1 on
//   warmGrey, so the swatch cannot be broken by moving a card onto a
//   different band later.
// * Nothing here is interactive, so no target-size obligation is incurred
//   (WCAG 2.2 SC 2.5.8 applies to targets). These dots are deliberately NOT
//   clickable: a per-swatch tap target would need 24x24 each, which at 390 in
//   a 163px-wide card would consume the entire row.
// * The swatch group carries an aria-label naming every colourway, including
//   the ones the row had no room to draw, so the count is never a visual-only
//   fact.
// =============================================================================
import type { VariantDescriptor } from '~/utils/productVariant'

defineProps<{
  variant: VariantDescriptor
}>()
</script>

<template>
  <!--
    `kind === 'none'` renders nothing at all rather than a reserved blank.

    This is the opposite of the decision made for the chips eyebrow one row
    up, and deliberately so. The eyebrow reserves its height because it sits
    ABOVE the title, so a collapsed eyebrow would shift the title, price and
    commerce line of that card out of alignment with its neighbours. This slot
    sits beside the price on a row whose height is already set by the price
    itself, so an absent variant shifts nothing. Reserving here would buy no
    alignment and cost horizontal room on a 163px mobile card.
  -->
  <span
    v-if="variant.kind === 'colourway'"
    class="inline-flex shrink-0 items-center gap-[0.4rem] text-ink-700"
  >
    <span
      class="h-[10px] w-[10px] shrink-0 rounded-full border border-ink-500"
      :style="{ backgroundColor: variant.swatch }"
      aria-hidden="true"
    />
    <span class="gm-spec">{{ variant.label }}</span>
  </span>

  <span
    v-else-if="variant.kind === 'swatches'"
    class="inline-flex shrink-0 items-center gap-[0.3rem]"
    role="img"
    :aria-label="`${variant.label}: ${(variant.swatches ?? []).map(s => s.name).join(', ')}`"
  >
    <span
      v-for="s in variant.swatches"
      :key="s.name"
      class="h-[10px] w-[10px] shrink-0 rounded-full border border-ink-500"
      :style="{ backgroundColor: s.hex }"
    />
    <!--
      Overflow count. Glossier and BAGGU both surface this rather than
      silently truncating, and they are right to: "4 colours shown" and "4
      colours exist" are different promises, and a card that quietly drops the
      difference will be found out on the product page.
    -->
    <span v-if="variant.overflow" class="gm-spec ml-[0.2rem] text-ink-700">+{{ variant.overflow }}</span>
  </span>

  <span
    v-else-if="variant.kind === 'spec'"
    class="gm-spec shrink-0 text-ink-700"
  >{{ variant.label }}</span>
</template>
