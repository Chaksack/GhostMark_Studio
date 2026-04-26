<script setup lang="ts">
import { computed, ref } from 'vue'
import UiButton from './ui/UiButton.vue'

/**
 * CookieBanner — bottom-anchored GDPR consent strip.
 *
 * Renders three top-level actions (Customise / Reject non-essential / Accept
 * all) plus a Customise drawer with category toggles. Persistence and the
 * decided/analytics/marketing flags are owned by `useConsent()` — this
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
      class="fixed inset-x-0 bottom-0 z-[60] border-t border-ink-200 bg-cream-warm shadow-[0_-12px_32px_-16px_rgba(20,18,16,0.18)]"
      role="region"
      aria-label="Cookie consent"
    >
      <div
        class="mx-auto flex max-w-[1320px] flex-col gap-6 px-gutter py-6 lg:flex-row lg:items-center lg:gap-10"
      >
        <!-- Copy column ------------------------------------------------- -->
        <div class="flex-1">
          <p
            class="mb-2 font-body text-eyebrow uppercase tracking-[0.16em] text-ink-500"
          >
            Cookies
          </p>
          <p class="font-body text-body leading-relaxed text-ink-700">
            We use cookies to keep the studio running, measure how shelves
            perform, and — only with your blessing — tailor what you see on
            your next visit. Essentials are always on; the rest is a choice.
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
          class="flex flex-wrap items-center gap-3 lg:flex-nowrap"
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
