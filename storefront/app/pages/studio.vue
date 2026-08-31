<script setup lang="ts">
/**
 * /studio: folded back into the single catalogue.
 *
 * WHY THIS IS A REDIRECT AND NOT A PAGE. Print on demand is a production
 * method, not a product category. Every object in the catalogue can be
 * printed to order, and the data says so plainly: all 20 apparel products
 * carry `is_customizable`, `moq`, `print_locations` and `quantity_tiers`,
 * the same capability record as the products whose Medusa `type` reads
 * 'pod'. Splitting them into two shelves described a distinction that does
 * not exist in the catalogue and does not exist in the service either. The
 * same presses, the same proof cycle and the same lead times serve both.
 *
 * This route briefly held a dedicated POD shelf listing the two products
 * that happened to be typed 'pod' AND carry print zones. That was wrong on
 * both axes: it fragmented one catalogue into two, and `type` was never the
 * capability field anyway, since two of the five typed 'pod' cannot be
 * customised at all and a third is a test fixture.
 *
 * `/shop` is deliberately NOT folded in. It is the own-brand D2C line, a
 * genuinely separate proposition rather than a filtered view of this
 * catalogue.
 *
 * 302 and not 301: this route has changed meaning twice in one day, and a
 * permanent redirect is cached hard by browsers. Promote it to 301 once the
 * catalogue shape has been stable for a while.
 *
 * The previous POD shelf is not lost. Its service copy, the two ways in
 * fork and the guarantee slab are worth relocating onto the catalogue
 * itself, which is what "fold into" should ultimately mean.
 */
definePageMeta({
  redirect: '/products',
})
</script>

<template>
  <div />
</template>
