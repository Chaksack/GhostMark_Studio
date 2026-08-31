<script setup lang="ts">
/**
 * UiSpinner: decorative loading indicator.
 *
 * ACCESSIBILITY: this component is deliberately silent to assistive tech.
 *
 * It previously carried `role="status"` AND `aria-hidden="true"` on the same
 * element. Those cancel: `aria-hidden` removes the node from the
 * accessibility tree entirely, taking the `status` role and its implicit
 * live region with it. The net effect was that every loading state in the
 * app announced to nobody, while *looking* like it had been handled: the
 * worst of both, because the `role="status"` reads as done at a glance.
 *
 * Resolving it in the other direction (dropping `aria-hidden`, keeping the
 * role) would be worse. A bare spinner has no accessible name, so a screen
 * reader would announce an empty live region (a blip of nothing), and it
 * would fire on every mount of every button in a list.
 *
 * So the spinner is decorative, and the announcement is the *consumer's*
 * job, because only the consumer knows the sentence. Wrap the message, not
 * the spinner:
 *
 *   <p role="status" class="flex items-center gap-2">
 *     <UiSpinner />
 *     Saving your address…
 *   </p>
 *
 * Or keep the visible text out of the live region and announce separately:
 *
 *   <UiSpinner />
 *   <span role="status" class="sr-only">Saving your address…</span>
 *
 * UiButton already handles its own case correctly: it sets `aria-busy` on
 * the button element while `loading` is true, which is the right signal for
 * a control that is busy but keeps its own accessible name.
 */
interface Props {
  size?: number
}

withDefaults(defineProps<Props>(), {
  size: 16,
})
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
    focusable="false"
    class="animate-spin text-current motion-reduce:animate-none"
  >
    <circle
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      stroke-opacity="0.25"
      stroke-width="3"
    />
    <path
      d="M22 12a10 10 0 0 1-10 10"
      stroke="currentColor"
      stroke-width="3"
      stroke-linecap="round"
    />
  </svg>
</template>
