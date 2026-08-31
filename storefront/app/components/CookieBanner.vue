<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import UiButton from './ui/UiButton.vue'

/**
 * CookieBanner: bottom-anchored GDPR consent strip.
 *
 * Renders three top-level actions (Customise / Reject non-essential / Accept
 * all) plus a Customise drawer with category toggles. Persistence and the
 * decided/analytics/marketing flags are owned by `useConsent()`, this
 * component is a thin presentational shell that mounts once globally
 * inside the default layout's `<ClientOnly>` boundary.
 *
 * Visibility rules:
 *   - Hidden during SSR (state is the unrehydrated default with `decided=false`,
 *     but the `<ClientOnly>` mount in default.vue gates the entire tree).
 *   - On the client we wait for the `ready` flag (one tick after mount)
 *     before showing anything, so a returning visitor never sees a flash
 *     of the banner before localStorage rehydrates.
 */

const { consent, ready, acceptAll, rejectAll, save } = useConsent()

const showCustomize = ref<boolean>(false)

const visible = computed<boolean>(() => ready.value && !consent.value.decided)

const onSavePreferences = (): void => {
  save()
  showCustomize.value = false
}

/**
 * --consent-height : how much of the bottom of the viewport this banner eats.
 *
 * WHY THIS EXISTS (P0, found by EDITOR, reproduced by SWEEP):
 * the banner is `fixed bottom-0 z-[60]`, so it does not participate in layout
 * and nothing below it is reachable. At 390x844 it measured 309px tall (37%
 * of the viewport) which put the PDP quantity steppers, "Add to cart" and the
 * footer region trigger all UNDER it. A first-time mobile visitor (the exact
 * session where the banner is guaranteed to show) could not add to cart.
 *
 * A screenshot cannot see this: the pixels look fine; it is pointer
 * interception that fails. Verify with elementFromPoint hit-testing, not eyes.
 *
 * So the banner now MEASURES itself and publishes that height on :root.
 * Two kinds of consumer:
 *   - page flow  -> tokens.css puts it on body{padding-bottom}, so ordinary
 *                   content can always be scrolled clear of the banner.
 *   - fixed bars -> `bottom: var(--consent-height)` lifts a sticky action bar
 *                   to sit ON TOP of the banner instead of beneath it.
 * Consumers: PDP sticky add-to-cart (EDITOR), footer bottom bar (SWEEP).
 *
 * It is a live measurement rather than a hardcoded number on purpose, the
 * banner's height changes with viewport width, with font scaling, and when the
 * Customise drawer opens. A constant would be correct at exactly one width.
 */
const rootEl = ref<HTMLElement | null>(null)
let ro: ResizeObserver | null = null

const publishHeight = (px: number): void => {
  if (import.meta.server) return
  document.documentElement.style.setProperty('--consent-height', `${Math.ceil(px)}px`)
}

const teardown = (): void => {
  ro?.disconnect()
  ro = null
  publishHeight(0)
}

/*
 * `immediate: true` is not decoration. Today the banner mounts AFTER `ready`
 * flips, so there is a genuine null -> el transition for the watcher to catch.
 * But that is a behavioural dependency on useConsent's timing, not on anything
 * this component controls: if `ready` ever resolves synchronously (an SSR
 * hydration change, a cached consent state, a composable refactor) the element
 * is present on first render, there is no transition, and the initial publish
 * silently stops firing, leaving --consent-height unset and the P0 back.
 * Flagged by EDITOR. Costs nothing, removes the coupling.
 */
watch(rootEl, (el) => {
  ro?.disconnect()
  ro = null
  if (!el) {
    // Banner dismissed: release the reserved space in the same tick, otherwise
    // every page keeps a dead 120px gutter at the bottom for the rest of the
    // session.
    publishHeight(0)
    return
  }
  ro = new ResizeObserver(([entry]) => {
    if (entry) publishHeight(entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height)
  })
  ro.observe(el)
  publishHeight(el.getBoundingClientRect().height)
}, { immediate: true, flush: 'post' })

onBeforeUnmount(teardown)
</script>

<template>
  <Transition
    enter-active-class="transition duration-300 ease-out"
    enter-from-class="opacity-0 translate-y-6"
    enter-to-class="opacity-100 translate-y-0"
    leave-active-class="transition duration-200 ease-in"
    leave-from-class="opacity-100 translate-y-0"
    leave-to-class="opacity-0 translate-y-6"
  >
    <div
      v-if="visible"
      ref="rootEl"
      class="gm-consent fixed inset-x-0 bottom-0 z-[60] border-t border-ink-200 bg-cream-warm shadow-[0_-12px_32px_-16px_rgba(20,18,16,0.18)]"
      role="region"
      aria-label="Cookie consent"
    >
      <div
        class="mx-auto flex max-w-rail flex-col gap-3 px-gutter py-4 sm:flex-row sm:items-center sm:gap-6 lg:gap-10"
      >
        <!-- Copy column ------------------------------------------------- -->
        <div class="flex-1">
          <p
            class="mb-1 hidden font-body text-eyebrow uppercase tracking-[0.16em] text-ink-600 sm:block"
          >
            Cookies
          </p>
          <p class="font-body text-caption leading-[1.5] text-ink-700 sm:text-body sm:leading-relaxed">
            We use cookies to keep the studio running and to measure how
            shelves perform. Essentials are always on; the rest is your choice.
            <NuxtLink
              to="/privacy"
              class="text-ink-950 underline decoration-dashed decoration-ink-400 underline-offset-4 transition-colors duration-fast hover:decoration-ink-950 motion-reduce:transition-none"
            >
              Read the policy
            </NuxtLink>
          </p>
        </div>

        <!-- Default action row ----------------------------------------- -->
        <div
          v-if="!showCustomize"
          class="flex flex-nowrap items-center gap-2 sm:gap-3"
        >
          <UiButton
            variant="ghost"
            size="sm"
            shape="square"
            @click="showCustomize = true"
          >
            Customise
          </UiButton>
          <UiButton
            variant="outline"
            size="sm"
            shape="square"
            @click="rejectAll"
          >
            Reject non-essential
          </UiButton>
          <UiButton
            variant="merchery"
            size="sm"
            shape="square"
            @click="acceptAll"
          >
            Accept all
          </UiButton>
        </div>

        <!-- Customise drawer ------------------------------------------- -->
        <div
          v-else
          class="flex flex-1 flex-col gap-4 lg:flex-row lg:items-center lg:gap-6"
        >
          <fieldset
            class="flex flex-wrap items-center gap-x-6 gap-y-3 border-l border-ink-200 pl-5"
          >
            <legend class="sr-only">Cookie categories</legend>

            <label
              class="inline-flex select-none items-center gap-2 font-body text-caption text-ink-700"
            >
              <input
                type="checkbox"
                :checked="true"
                disabled
                class="h-4 w-4 cursor-not-allowed accent-ink-950 opacity-70"
                aria-describedby="consent-essential-help"
              >
              <span class="text-ink-950">Essential</span>
              <span id="consent-essential-help" class="text-ink-500">(always on)</span>
            </label>

            <label
              class="inline-flex cursor-pointer select-none items-center gap-2 font-body text-caption text-ink-700"
            >
              <input
                v-model="consent.analytics"
                type="checkbox"
                class="h-4 w-4 cursor-pointer accent-ink-950"
              >
              <span class="text-ink-950">Analytics</span>
            </label>

            <label
              class="inline-flex cursor-pointer select-none items-center gap-2 font-body text-caption text-ink-700"
            >
              <input
                v-model="consent.marketing"
                type="checkbox"
                class="h-4 w-4 cursor-pointer accent-ink-950"
              >
              <span class="text-ink-950">Marketing</span>
            </label>
          </fieldset>

          <div class="flex flex-wrap items-center gap-3">
            <UiButton
              variant="ghost"
              size="sm"
              shape="square"
              @click="showCustomize = false"
            >
              Back
            </UiButton>
            <UiButton
              variant="merchery"
              size="sm"
              shape="square"
              @click="onSavePreferences"
            >
              Save preferences
            </UiButton>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>
