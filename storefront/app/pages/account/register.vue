<script setup lang="ts">
/**
 * /account/register: the sign-up half of the pair. See account/login.vue for
 * the full rationale; the short version is that this file was also a bare
 *
 *     await navigateTo({ path: '/', query: { auth: 'register' } }, { replace: true })
 *
 * so "create an account" resolved to a page titled "Home · GhostMark" whose
 * <h1> read "Objects we design. Objects we make for you." A customer who
 * bookmarked or shared the sign-up link sent people to the homepage.
 *
 * Same structure as login: a real titled, crawlable destination that renders
 * the reasons to register, with the credential form still living only in
 * AuthModal so there is exactly one copy of it.
 */

const isAuthOpen = ref(true)

useHead({
  // Bare title: the global titleTemplate appends "· GhostMark".
  title: 'Create an account',
  meta: [
    {
      name: 'description',
      content:
        'Create a GhostMark Studio account to track production, approve proofs and reorder past runs without re-uploading artwork.',
    },
  ],
})

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
    <p class="font-body text-eyebrow uppercase tracking-widest text-ink-500">
      GhostMark account
    </p>

    <h1 class="mt-3 max-w-[16ch] font-serif text-display-md text-ink-950 text-balance">
      Create your account.
    </h1>

    <div class="mt-10 grid gap-10 border-t border-ink-200 pt-10 md:grid-cols-2 md:gap-16">
      <section>
        <h2 class="font-serif text-[22px] text-ink-950">What an account gets you</h2>
        <ul class="mt-4 flex flex-col gap-3 font-body text-body leading-relaxed text-ink-700">
          <li>Live production and delivery tracking on every order.</li>
          <li>Digital proofs to approve before anything is printed.</li>
          <li>Saved projects, so a reorder never means re-uploading artwork.</li>
        </ul>
        <UiButton class="mt-6" @click="isAuthOpen = true">
          Create an account
        </UiButton>
      </section>

      <section class="md:border-l md:border-ink-200 md:pl-16">
        <h2 class="font-serif text-[22px] text-ink-950">Already have one?</h2>
        <p class="mt-2 max-w-[46ch] font-body text-body leading-relaxed text-ink-700 text-pretty">
          Sign in to pick up where you left off: saved projects, past runs and
          anything currently in production.
        </p>
        <UiButton variant="secondary" class="mt-5" as="NuxtLink" to="/account/login">
          Sign in
        </UiButton>
      </section>
    </div>

    <AuthModal
      v-model="isAuthOpen"
      initial-mode="register"
      @update:model-value="onClose"
      @success="onSuccess"
    />
  </div>
</template>
