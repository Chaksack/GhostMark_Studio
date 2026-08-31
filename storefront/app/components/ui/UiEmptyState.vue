<script setup lang="ts">
import { computed } from 'vue'
// Explicit relative import rather than the auto-import, matching UiButton's own
// `import UiSpinner from './UiSpinner.vue'`. Primitives inside ui/ resolve each
// other directly so the folder stays self-contained.
import UiButton from './UiButton.vue'

/**
 * UiEmptyState: the one component that stops the storefront rendering two
 * states where there are three.
 *
 * ---------------------------------------------------------------------------
 * Why this exists
 * ---------------------------------------------------------------------------
 * Every page in this app used to collapse "the backend failed" into "there is
 * nothing here". `catch { return [] }` turns a 500 into "No orders yet." for a
 * customer who has ordered fifty times; it turns a dropped connection into
 * "No products match 'hoodie'", which blames the customer's search term for
 * the store's own outage and then sends them away. The two states need
 * opposite copy, opposite affordances, and opposite blame:
 *
 *   empty:   the query succeeded and the answer is genuinely nothing.
 *            Forward motion: browse, explore, start something.
 *   error:   the query never completed. We do not know the answer.
 *            Recovery: retry, then a human.
 *
 * The rule this component enforces is simply that you cannot render one
 * without choosing which it is.
 *
 * ---------------------------------------------------------------------------
 * Treatment
 * ---------------------------------------------------------------------------
 * The error variant is deliberately NOT a red alert. It sits on `cream-tile`
 * with a single 2px `semantic-warning-solid` rule along the top edge. A warm
 * store should not shout at a customer about its own outage: the failure is
 * ours, and a scarlet danger panel reads as "you did something wrong". The
 * rule is enough to mark the block as different in kind without alarming
 * anyone, and the state is never signalled by colour alone (WCAG 1.4.1): the
 * eyebrow, the headline and the retry affordance all say it in text.
 *
 * `warning` rather than `danger`: danger is for destructive and irreversible
 * things the customer is about to do. A backend that did not answer is neither:
 * it is transient, it is our fault, and the correct response is to try
 * again, so the chroma should match that.
 *
 * ---------------------------------------------------------------------------
 * Accessibility
 * ---------------------------------------------------------------------------
 * - `role="status"` (implicit `aria-live="polite"`, `aria-atomic="true"`) so a
 *   screen-reader user who triggers a search, or watches a list refresh, is
 *   told what happened. Polite rather than assertive: this never interrupts.
 *   On an SSR'd first paint the region is present from the start and correctly
 *   announces nothing; it only speaks on a genuine state change.
 * - The headline is a real heading by default (`headingTag`), so the state is
 *   reachable by heading navigation rather than being a floating paragraph.
 * - Retry is a real `<button>` via UiButton, and reports `aria-busy` while the
 *   caller's refresh is in flight.
 */

type Variant = 'empty' | 'error'
type Size = 'md' | 'lg'
type HeadingTag = 'h1' | 'h2' | 'h3' | 'p'

interface Props {
  /**
   * `empty` = the request succeeded and returned nothing.
   * `error` = the request failed and we do not know what it would have returned.
   */
  variant?: Variant
  /** Short uppercase kicker. Falls back to a per-variant default. */
  eyebrow?: string | null
  /** Headline. Falls back to a per-variant default. */
  title?: string
  /** Supporting sentence. Falls back to a per-variant default. */
  description?: string | null
  /** `lg` promotes the headline to display-lg, used by app/error.vue. */
  size?: Size
  /** Heading element for the title. `h2` suits most in-page states. */
  headingTag?: HeadingTag
  /** Draw the surrounding card. Pass false when the caller already owns a box. */
  boxed?: boolean
  /** Label for the retry control (error variant). */
  retryLabel?: string
  /** Set false to suppress the built-in retry button. */
  retryable?: boolean
  /** True while the caller's refresh() is in flight. */
  busy?: boolean
  /** Support link shown beside retry. Pass null to suppress. */
  helpTo?: string | null
  helpLabel?: string
  /**
   * Announce as a live region. True for in-page state changes (a search that
   * resolves to nothing, a list that fails to load). That is the whole point.
   * Pass false on a full-document render such as app/error.vue, where the
   * navigation and the <h1> already announce and a live region would only add
   * a duplicate utterance.
   */
  live?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'empty',
  eyebrow: undefined,
  title: undefined,
  description: undefined,
  size: 'md',
  headingTag: 'h2',
  boxed: true,
  retryLabel: 'Try again',
  retryable: true,
  busy: false,
  helpTo: '/help',
  helpLabel: 'Get help',
  live: true,
})

const emit = defineEmits<{
  /** Wire this to the caller's `useAsyncData` refresh(). */
  (e: 'retry'): void
}>()

const isError = computed(() => props.variant === 'error')

// Per-variant copy defaults. A caller that knows what failed should pass a
// specific title ("We couldn't load your orders."). The generic fallback is
// here so no call site can accidentally ship an unlabelled state.
const resolvedEyebrow = computed(() => {
  if (props.eyebrow !== undefined) return props.eyebrow
  return isError.value ? 'Something went wrong' : null
})

const resolvedTitle = computed(() => {
  if (props.title) return props.title
  return isError.value ? "We couldn't load this." : 'Nothing here yet.'
})

const resolvedDescription = computed(() => {
  if (props.description !== undefined) return props.description
  // The load-bearing sentence of the whole component: the customer did not
  // cause this, and it is probably transient.
  return isError.value ? 'This is on us, not you. Try again in a moment.' : null
})

const titleClasses = computed(() => [
  'font-display font-normal text-ink-950',
  props.size === 'lg' ? 'text-display-lg' : 'text-display-md',
])

const rootClasses = computed(() => [
  'flex flex-col items-center text-center',
  props.size === 'lg' ? 'gap-5 px-gutter py-section' : 'gap-4 px-6 py-16',
  props.boxed ? 'border' : '',
  // Warm, not alarming, but still actually visible. The rule uses
  // `semantic-warning-solid` (#7E541B), ~5.5:1 against the cream-tile panel.
  // The first cut used `-border` (#F4CB99), which measures 1.35:1 on that same
  // tile: it differs from the panel in hue far more than in luminance, so it
  // read as a faint wash rather than a rule and would disappear entirely for a
  // viewer with reduced colour discrimination. "Warm, not alarming" only works
  // if it is legible; invisible is not restraint, it is absence.
  //
  // Still never the sole signal (WCAG 1.4.1): the eyebrow, the headline and
  // the retry button each carry the state in text.
  props.boxed && isError.value ? 'border-ink-200 border-t-2 border-t-semantic-warning-solid bg-cream-tile' : '',
  props.boxed && !isError.value ? 'border-ink-200 bg-white' : '',
])
</script>

<template>
  <div
    :role="live ? 'status' : undefined"
    :data-variant="variant"
    :class="rootClasses"
  >
    <p
      v-if="resolvedEyebrow"
      class="text-eyebrow font-body uppercase"
      :class="isError ? 'text-semantic-warning-fg' : 'text-ink-500'"
    >
      {{ resolvedEyebrow }}
    </p>

    <component
      :is="headingTag"
      :class="titleClasses"
    >
      {{ resolvedTitle }}
    </component>

    <p
      v-if="resolvedDescription"
      class="max-w-[46ch] font-body text-caption text-ink-500"
    >
      {{ resolvedDescription }}
    </p>

    <!-- Free-form slot: search fields, suggested products, a category row,
         anything that keeps the page from being a dead end. -->
    <slot />

    <!--
      Actions. Callers can replace the row wholesale (`#actions`) or append to
      the default one (`#extra-actions`). The error default is retry-then-human,
      which is the pair Etsy and Amazon both land on; neither ever offers a
      keyword suggestion on a failed load, because a keyword was never the
      problem.
    -->
    <div class="mt-2 flex flex-wrap items-center justify-center gap-3">
      <slot name="actions">
        <UiButton
          v-if="isError && retryable"
          variant="merchery"
          size="md"
          :loading="busy"
          @click="emit('retry')"
        >
          {{ retryLabel }}
        </UiButton>

        <UiButton
          v-if="isError && helpTo"
          as="NuxtLink"
          :to="helpTo"
          variant="outline"
          size="md"
        >
          {{ helpLabel }}
        </UiButton>
      </slot>

      <slot name="extra-actions" />
    </div>
  </div>
</template>
