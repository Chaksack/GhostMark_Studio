<template>
  <section class="mx-auto w-full max-w-screen-3xl overflow-hidden px-5 sm:px-6 lg:px-8">
    <div class="relative">
      <!-- Quotes -->
      <div class="flex transition-transform duration-500 ease-in-out" :style="{ transform: `translateX(-${current * 100}%)` }">
        <blockquote
          v-for="(t, i) in testimonials"
          :key="i"
          class="w-full flex-shrink-0 py-10 text-center lg:py-16"
        >
          <p class="mx-auto max-w-[720px] font-serif text-[24px] leading-[1.35] text-zinc-950 sm:text-[32px] lg:text-[38px]">
            &ldquo;{{ t.quote }}&rdquo;
          </p>
          <footer class="mt-6 text-[14px] text-zinc-500">
            {{ t.author }} &mdash;
            <span class="font-semibold uppercase tracking-wider text-zinc-950">{{ t.company }}</span>
          </footer>
        </blockquote>
      </div>

      <!-- Navigation dots -->
      <div class="flex items-center justify-center gap-2 pb-4">
        <button
          v-for="(_, i) in testimonials"
          :key="i"
          class="h-2 rounded-full transition-all duration-200"
          :class="i === current ? 'w-6 bg-zinc-950' : 'w-2 bg-zinc-300 hover:bg-zinc-400'"
          type="button"
          :aria-label="`Go to testimonial ${i + 1}`"
          @click="current = i"
        />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
const testimonials = [
  {
    quote: "It's beautiful, it's aligned with our values, I wish I could buy it all for myself :)",
    author: 'Alain Etienne',
    company: 'Kazidomi',
  },
  {
    quote: 'Finally, corporate gifts to live up to our brand and planet!',
    author: 'Géraldine Huet',
    company: 'Degroof Petercam',
  },
  {
    quote: 'The perfect combination of beautiful and sustainable merch.',
    author: 'Lukas Fleige',
    company: 'Accenture',
  },
]

const current = ref(0)

let interval: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  interval = setInterval(() => {
    current.value = (current.value + 1) % testimonials.length
  }, 5000)
})

onUnmounted(() => {
  if (interval) clearInterval(interval)
})
</script>
