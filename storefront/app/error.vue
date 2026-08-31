<script setup lang="ts">
import { computed, ref } from 'vue'
import type { NuxtError } from '#app'

/**
 * app/error.vue: the global backstop.
 *
 * ---------------------------------------------------------------------------
 * What this replaces
 * ---------------------------------------------------------------------------
 * Nothing. There was no error.vue and no catch-all route, so every unmatched
 * URL fell through to Nuxt's built-in error page: no header, no footer, no
 * search, no logo, neither Fraunces nor Inter Tight, a dev stack-trace panel,
 * one "Go back home" link, and a <title> reading
 * "404 - Page not found: /orders/track-my-order | Nuxt".
 *
 * `/orders/track-my-order` is not a hypothetical, it is the URL a customer
 * guesses when they want to track an order. Guessing a URL is a navigation
 * attempt, and answering it by ejecting them from the store entirely is the
 * worst possible response to a customer who is actively trying to buy from us.
 *
 * ---------------------------------------------------------------------------
 * Contract (verified against Nuxt 4 docs + the installed type)
 * ---------------------------------------------------------------------------
 * - `error.vue` sits at the root of srcDir and receives a single `error` prop
 *   of type NuxtError. It REPLACES <NuxtPage>, and (unlike a page) it gets
 *   no layout automatically. `<NuxtLayout>` here is what keeps AppHeader and
 *   AppFooter on screen.
 * - NuxtError in Nuxt 4 exposes `status`; `statusCode` still exists but is
 *   marked @deprecated (node_modules/nuxt/dist/app/composables/error.d.ts).
 *   We read `status` first and fall back, so this is correct on both.
 * - `clearError({ redirect })` resolves the handled error and navigates. It is
 *   the ONLY supported way out: mutating the prop does nothing.
 *
 * Layout note: the top offset for the fixed header belongs to
 * layouts/default.vue (owned elsewhere and in flight). We deliberately set no
 * offset of our own so this page inherits whatever the layout settles on.
 *
 * ---------------------------------------------------------------------------
 * Shape
 * ---------------------------------------------------------------------------
 * 404 leads with search. That is the single highest-value control on a 404,
 * the customer arrived with an intent expressed as a URL, and a search field
 * is the only widget that can still serve that intent. Selfridges keeps its
 * full chrome and its populated search field on a zero-result page and then
 * offers adjacent inventory; Squarespace keeps header and footer and names
 * more than one recovery route. Assembly, Headspace and Coinbase each offer a
 * lone "go back" button, which is precisely the dead end we are removing.
 *
 * One screen. No illustration, no apology copy beyond a sentence.
 */

const props = defineProps<{ error?: NuxtError }>()

const route = useRoute()

const status = computed(() => Number(props.error?.status ?? props.error?.statusCode ?? 500))
const isNotFound = computed(() => status.value === 404)

useHead(() => ({
  // Kills "404 - Page not found: /orders/track-my-order | Nuxt".
  //
  // The brand suffix is spelled out here rather than left to the global
  // `titleTemplate`. On a fatal error Nuxt renders error.vue INSTEAD of
  // app.vue, so app.vue's setup (and therefore its titleTemplate) never
  // runs. Verified in the browser: the first cut of this file rendered a bare
  // "Page not found" with no " · GhostMark". Any future edit that assumes the
  // template applies here will silently drop the brand again.
  title: isNotFound.value
    ? 'Page not found · GhostMark'
    : 'Something went wrong · GhostMark',
  meta: [{ name: 'robots', content: 'noindex, follow' }],
}))

// -- 404: inline search -----------------------------------------------------
// Submitting hands off to /search?q=, then clears the error so the app renders
// the real page rather than this one. `clearError` must run for the redirect
// to take: while an error is held, <NuxtPage> is not mounted at all.
const query = ref('')

const onSearch = async () => {
  const q = query.value.trim()
  if (!q) return
  await clearError({ redirect: `/search?q=${encodeURIComponent(q)}` })
}

// -- 5xx: retry -------------------------------------------------------------
// Re-enter the same URL. Clearing the error remounts <NuxtPage>, which re-runs
// the page's useAsyncData, so a transient backend blip recovers in place.
// `route.fullPath` is read here in an event handler only, never rendered, so
// it cannot contribute to a hydration mismatch.
const retrying = ref(false)

const onRetry = async () => {
  if (retrying.value) return
  retrying.value = true
  try {
    await clearError({ redirect: route.fullPath })
  }
  finally {
    retrying.value = false
  }
}
</script>

<template>
  <NuxtLayout>
    <div class="bg-white text-ink-950">
      <section class="mx-auto max-w-rail px-gutter py-section">
        <!-- ================================================================
             404: lead with search, then three named destinations.
             ================================================================ -->
        <UiEmptyState
          v-if="isNotFound"
          variant="empty"
          size="lg"
          heading-tag="h1"
          eyebrow="404"
          :live="false"
          title="We can't find that page."
          description="The link may be old, or the address slightly off. Search the catalog below, or pick up one of the routes underneath."
          :boxed="false"
        >
          <!-- The highest-value control on this page. `role=search` gives it a
               landmark so it is reachable directly by assistive tech. -->
          <form
            role="search"
            class="mt-2 flex w-full max-w-[300px] items-center gap-2"
            @submit.prevent="onSearch"
          >
            <label class="sr-only" for="error-search">
              Search the GhostMark Studio catalog
            </label>
            <UiInput
              id="error-search"
              v-model="query"
              type="search"
              size="lg"
              name="q"
              placeholder="Search for a blank, colour or finish"
              autocomplete="off"
            />
            <UiButton
              variant="merchery"
              size="lg"
              type="submit"
            >
              Search
            </UiButton>
          </form>

          <template #actions>
            <UiButton as="NuxtLink" to="/products" variant="outline" size="md">
              Browse all products
            </UiButton>
            <UiButton as="NuxtLink" to="/account/orders" variant="outline" size="md">
              Your orders
            </UiButton>
            <UiButton as="NuxtLink" to="/help" variant="outline" size="md">
              Help &amp; delivery
            </UiButton>
          </template>
        </UiEmptyState>

        <!-- ================================================================
             Everything else: our fault, so say so and offer a way through.
             ================================================================ -->
        <UiEmptyState
          v-else
          variant="error"
          size="lg"
          heading-tag="h1"
          :eyebrow="`Error ${status}`"
          :live="false"
          title="Something went wrong at our end."
          description="Nothing you did caused this, and your cart is untouched. Try the page again. If it keeps happening, we'd like to hear about it."
          :boxed="false"
        >
          <template #actions>
            <UiButton
              variant="merchery"
              size="md"
              :loading="retrying"
              @click="onRetry"
            >
              Try again
            </UiButton>
            <UiButton as="NuxtLink" to="/contact" variant="outline" size="md">
              Contact us
            </UiButton>
          </template>
        </UiEmptyState>
      </section>
    </div>
  </NuxtLayout>
</template>
