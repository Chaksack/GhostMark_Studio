<script setup lang="ts">
/**
 * SectionHeading: the signature device of the "Registration" direction.
 *
 * WHY THIS EXISTS
 * ---------------
 * Before this, every homepage band opened with a bare 64px <h2> and a "View
 * all" link. Measured, five of the seven H2s rendered in Inter Tight (the
 * BODY face) at 64px, and two of them in cold stock neutral while the rest were
 * warm `ink-950`. So the largest type on the page was set in the wrong family
 * and in two different blacks depending on which component you scrolled past.
 * That is the mechanical reason the site read as a wireframe: a wireframe is
 * what you get when every size of type is the same face.
 *
 * THE DEVICE
 * ----------
 * A print job ticket identifies a job before it describes it: a number, a
 * rule, a short spec, then the name. This component is that, literally:
 *
 *     01 ─────────────────────────────────────── STUDIO CANON
 *     Our best sellers                                View all →
 *
 * The index and the spec are set in the mono voice (`.gm-spec`), the title in
 * the display face (`.gm-display`). The rule between them is what makes it
 * read as a document rather than as a heading with decoration above it.
 *
 * Sourced from indexed commerce sites that use spec-sheet captioning:
 *   Runway         https://mobbin.com/sites/sections/c1787a46-d962-4580-a4de-34a98c883798
 *                  ("Object n°7 / The Orange: A Still Life in Motion in Print")
 *   Shopify Supply https://mobbin.com/sites/sections/84e5f6f6-bc86-489d-a542-16f0d8fc0d89
 *                  (monospace terminal label above the grid)
 *
 * ACCESSIBILITY
 * -------------
 * The index and spec are decorative-adjacent but NOT hidden: they carry real
 * information (which band you are in, what kind of product it holds), so they
 * stay in the accessibility tree. Only the rule is aria-hidden.
 *
 * `--gm-ink-accent` is used for the index rather than `--gm-reg`, and that is a
 * measured decision, not a preference: --gm-reg (#C46B4F) is 3.26:1 on offWhite
 * and 2.85:1 on warmGrey, legal for a mark, ILLEGAL for text. --gm-ink-accent
 * (#8F3F27) measures 5.45:1 at its worst (warmGrey) and passes everywhere.
 * The bright terracotta is for geometry only.
 */

interface Props {
  /**
   * Two-digit index, e.g. '01'.
   *
   * DELIBERATELY UNUSED ON THE HOMEPAGE. A numbered marker is only honest when
   * the content actually IS a sequence, when the order carries information
   * the reader needs. "Our best sellers" followed by "Recently added" is not a
   * process, so numbering those bands 01/04 encoded nothing true and was
   * decoration dressed as structure. I shipped it that way first and removed
   * it on review.
   *
   * The prop stays because there IS a legitimate consumer: the checkout steps
   * ("01 / DELIVERY", "02 / PAYMENT") are a real sequence where the order is
   * the information. Use it there; do not use it to make a band look technical.
   */
  index?: string
  /** Short uppercase spec, right of the rule. Keep it under ~18 chars. */
  spec?: string
  /** The heading itself. Set in the display face. */
  title: string
  /** Optional trailing link target. */
  to?: string
  linkLabel?: string
  /** Heading level, so a band can sit under an h1 or an h2 correctly. */
  level?: 2 | 3
}

const props = withDefaults(defineProps<Props>(), {
  index: undefined,
  spec: undefined,
  to: undefined,
  linkLabel: 'View all',
  level: 2,
})

const tag = computed(() => (props.level === 3 ? 'h3' : 'h2'))
</script>

<template>
  <div class="w-full">
    <!-- Job-ticket rail: index ─ rule ─ spec -->
    <div
      v-if="index || spec"
      class="flex items-center gap-3 text-ink-500 sm:gap-4"
    >
      <span
        v-if="index"
        class="gm-spec shrink-0"
        style="color: var(--gm-ink-accent)"
      >{{ index }}</span>

      <span aria-hidden="true" class="gm-rule-line" />

      <span v-if="spec" class="gm-spec shrink-0">{{ spec }}</span>
    </div>

    <!--
      `items-end` aligns the link to the display type's baseline rather than
      its box, which matters a lot at 76px where Fraunces has deep descenders.
    -->
    <div class="mt-3 flex items-end justify-between gap-5 sm:mt-4 sm:gap-8">
      <component
        :is="tag"
        class="gm-display gm-display-lg text-ink-950"
      >
        {{ title }}
      </component>

      <NuxtLink
        v-if="to"
        :to="to"
        class="group shrink-0 pb-1 text-[13px] text-ink-700 underline-offset-4 transition-colors duration-fast ease-emphasis hover:text-ink-950 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-cream-50 motion-reduce:transition-none sm:text-[14px]"
      >
        {{ linkLabel }}
        <span
          aria-hidden="true"
          class="ml-1 inline-block transition-transform duration-fast ease-emphasis group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
        >&rarr;</span>
      </NuxtLink>
    </div>
  </div>
</template>
