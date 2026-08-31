<script setup lang="ts">
/**
 * /account/login: a real, crawlable, correctly-titled sign-in route.
 *
 * ---------------------------------------------------------------------------
 * What was here before
 * ---------------------------------------------------------------------------
 * The entire file was two lines:
 *
 *     await navigateTo({ path: '/', query: { auth: 'login' } }, { replace: true })
 *
 * That is a redirect to the HOMEPAGE with a query string, which AppHeader
 * (:595, :652) claims in order to open <AuthModal>. The modal itself is good,
 * Headless UI Dialog, real focus trap, scroll lock verified against wheel
 * input, focus lands on the email field, and it carries the explicit
 * focus-restore workaround at :157-183. Nothing is wrong with the modal.
 *
 * What was wrong is that the ROUTE stopped existing. After the redirect:
 *
 *   document.title  …… "Home · GhostMark"
 *   <h1>            …… "Objects we design. Objects we make for you."
 *   URL             …… /?auth=login
 *
 * So every bookmark, every browser-history entry, every link a customer pasted
 * to a colleague, and every crawler that asked for the sign-in page was told
 * this is the homepage. `replace: true` also means the route never even leaves
 * a history entry of its own. A `useHead()` on the old stub could not fix it:
 * the redirect fires during setup, the stub unmounts, and index.vue's own head
 * wins whatever this file had declared.
 *
 * ---------------------------------------------------------------------------
 * Why a page AND a modal, rather than one or the other
 * ---------------------------------------------------------------------------
 * Checked against comparable commerce on Mobbin rather than assumed, because
 * "modal or page" is a real design question and the answer turned out to be
 * both:
 *
 *   Selfridges : dedicated sign-in route, breadcrumbed "Home > Sign in
 *                 Register", split into "Registered customers" and "New to
 *                 selfridges.com?". The closest peer to this storefront.
 *   Uvodo, Shop: dedicated /login route.
 *   Etsy, Urban Outfitters: modal over the current page, opened from a header
 *                 link WHILE BROWSING.
 *
 * The distinction is intent, not preference. Sign-in reached mid-task (adding
 * to a wishlist, starting checkout) must not lose the customer's place, so it
 * is a modal. Sign-in reached deliberately (typed, bookmarked, linked, or
 * crawled) is a destination and needs to be a page with a title. Keeping only
 * the modal broke the second case; keeping only a page would break the first.
 *
 * This file therefore restores the destination WITHOUT duplicating the
 * credential form. The form lives in exactly one place (AuthModal) and is
 * opened over a page that is itself titled, headed, and indexable. Duplicating
 * the form here would recreate precisely the two-sources-of-truth problem I
 * just removed from AppFooter's region label.
 */

const isAuthOpen = ref(true)

useHead({
  // Bare title: a global titleTemplate appends "· GhostMark", so spelling the
  // brand out here rendered "Sign in · GhostMark · GhostMark". Matches the
  // convention in faq.vue:94 and wishlist.vue:46.
  title: 'Sign in',
  meta: [
    {
      name: 'description',
      content:
        'Sign in to your GhostMark Studio account to track orders, revisit saved projects and reorder past runs.',
    },
  ],
})

/**
 * Closing the modal must not strand the customer on a page whose only control
 * is the modal they just dismissed, so closing returns them to the catalogue.
 * `replace` keeps the dismissed sign-in out of the back-button history, going
 * "back" from the shop should reach wherever they came from, not reopen this.
 */
const onClose = async (open: boolean) => {
  isAuthOpen.value = open
  if (!open) await navigateTo('/products', { replace: true })
}

const onSuccess = async () => {
  isAuthOpen.value = false
  await navigateTo('/account')
}
</script>

<template>
  <div class="mx-auto max-w-rail px-gutter py-16 lg:py-24">
    <!--
      This content is the page's reason to exist: it is what a crawler indexes
      and what renders behind the modal. It follows Selfridges' two-column
      split (returning customer on the left, new customer on the right) so
      the page still answers "am I in the right place?" if the modal is
      dismissed or never opens.
    -->
    <p class="font-body text-eyebrow uppercase tracking-widest text-ink-500">
      GhostMark account
    </p>

    <h1 class="mt-3 max-w-[16ch] font-serif text-display-md text-ink-950 text-balance">
      Sign in to your account.
    </h1>

    <div class="mt-10 grid gap-10 border-t border-ink-200 pt-10 md:grid-cols-2 md:gap-16">
      <section>
        <h2 class="font-serif text-[22px] text-ink-950">Returning customer</h2>
        <p class="mt-2 max-w-[46ch] font-body text-body leading-relaxed text-ink-700 text-pretty">
          Sign in to track live orders, revisit saved projects and reorder a
          past run without re-uploading your artwork.
        </p>
        <UiButton class="mt-5" @click="isAuthOpen = true">
          Sign in
        </UiButton>
      </section>

      <section class="md:border-l md:border-ink-200 md:pl-16">
        <h2 class="font-serif text-[22px] text-ink-950">New to GhostMark?</h2>
        <p class="mt-2 max-w-[46ch] font-body text-body leading-relaxed text-ink-700 text-pretty">
          Creating an account takes a moment. You will get proofs, production
          updates and delivery tracking in one place, and your designs stay
          available for reorders.
        </p>
        <!-- `as="NuxtLink"` is required for `to` to render a link at all,
             UiButton defaults to `as: 'button'` and only swaps in NuxtLink
             when told to (UiButton.vue:45). -->
        <UiButton variant="secondary" class="mt-5" as="NuxtLink" to="/account/register">
          Create an account
        </UiButton>
      </section>
    </div>

    <AuthModal
      v-model="isAuthOpen"
      initial-mode="login"
      @update:model-value="onClose"
      @success="onSuccess"
    />
  </div>
</template>
