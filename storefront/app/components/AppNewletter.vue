<template>
    <div class="mx-auto w-full max-w-screen-3xl px-5 py-10 sm:px-6 lg:px-8">
        <section class="rounded-xl bg-[#72CA97] p-7 sm:p-8">
        <h2 class="max-w-7xl text-3xl lg:mb-10 font-semibold leading-tight tracking-tight text-zinc-950 sm:text-4xl">
          Subscribe, and get access to exclusive news, sneak<br class="hidden sm:block" />
          peaks on new launches
        </h2>

        <form class="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center" @submit.prevent="onSubscribe">
          <label class="sr-only" for="footer-email">Enter your email address</label>
          <input
            id="footer-email"
            v-model="email"
            type="email"
            autocomplete="email"
            placeholder="Enter your email address"
            class="max-w-3xl flex-1 rounded-none border border-zinc-200 bg-white px-4 py-3 text-zinc-950 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300 focus:ring-offset-2 focus:ring-offset-emerald-50"
          />
          <button
            type="submit"
            class="inline-flex w-full items-center justify-center border border-zinc-950 bg-zinc-950 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-900 sm:w-auto"
          >
            Subscribe
          </button>
        </form>
      </section>
    </div>
    </template>

    <script setup lang="ts">
const email = ref('')

const onSubscribe = () => {
  // UI-only scaffold
  email.value = ''
}
</script>