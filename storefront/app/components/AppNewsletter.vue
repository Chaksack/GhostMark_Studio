<template>
  <aside aria-labelledby="footer-newsletter-heading" class="rounded-lg bg-pistacho p-6 md:p-10 lg:p-12">
      <div class="max-w-[100rem] flex flex-col gap-[3rem] md:gap-[4rem] lg:gap-[5rem]">
        <h2 id="footer-newsletter-heading" class="text-[2.4rem] leading-[2.8rem] md:text-[3.2rem] md:leading-[3.8rem] lg:text-[4rem] lg:leading-[4.6rem]">
          Subscribe, and get access to exclusive news, sneak peeks on new launches.
        </h2>
        <div>
          <form class="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full" @submit.prevent="onSubscribe">
            <div class="space-y-2 flex-grow">
              <label class="sr-only" for="footer-email">Enter your email address</label>
              <input
                id="footer-email"
                v-model="email"
                name="email"
                type="email"
                autocomplete="email"
                required
                placeholder="Enter your email address"
                class="flex w-full bg-white flex-grow leading-[2rem] border border-transparent focus:border-ink-950 focus:outline-none px-[2rem] h-[5rem] rounded-[0.25rem]"
              />
            </div>
            <button
              type="submit"
              class="bg-ink-950 text-cream-50 hover:bg-ink-700 transition-colors duration-fast border border-ink-950 px-[2.4rem] h-[5rem] rounded-[0.25rem] text-[14px] font-medium uppercase tracking-[0.04em] whitespace-nowrap"
            >
              Subscribe
            </button>
          </form>
          <p class="mt-4 text-[12px] leading-[1.6] text-ink-700 max-w-[60ch]">
            By subscribing you agree to receive occasional emails from GhostMark Studio. Unsubscribe anytime — see our <NuxtLink to="/privacy" class="underline hover:no-underline">privacy policy</NuxtLink>.
          </p>
        </div>
      </div>
  </aside>
</template>

<script setup lang="ts">
const email = ref('')

const onSubscribe = () => {
  // UI-only scaffold
  email.value = ''
}
</script>
