<template>
  <section class="mx-auto w-full max-w-rail overflow-hidden px-gutter">
    <div class="relative">
      <!--
        Carousel track. The translateX transition is wrapped in a class that
        respects prefers-reduced-motion: users who opt out of motion get an
        instant slide change (transform still applies) without the 500ms ease.
      -->
      <div
        class="carousel-track flex"
        :style="{ transform: `translateX(-${current * 100}%)` }"
      >
        <div
          v-for="(q, i) in testimonials"
          :key="i"
          class="w-full flex-shrink-0 py-6 sm:py-10 lg:py-16"
        >
          <!--
            Card max-width caps the prose at the editorial reading rail (680px)
            so the quote never runs edge-to-edge on tablet/desktop. Padding
            ramps from 24px on phones to 48px on lg+, 48px on a 320 viewport
            ate roughly 30% of the card.
          -->
          <figure class="mx-auto max-w-[680px] rounded-[0.5rem] bg-offWhite p-6 sm:p-8 md:p-10 lg:p-12">
            <blockquote class="font-serif text-[16px] leading-[22px] text-ink-950 sm:text-[20px] sm:leading-[27px] md:text-[24px] md:leading-[32px] lg:text-[30px] lg:leading-[38px]">
              &ldquo;{{ q.quote }}&rdquo;
            </blockquote>
            <figcaption class="mt-5 text-[13px] text-greyText sm:mt-6 sm:text-[14px]">
              <span class="font-medium text-ink-950">{{ q.author }}</span> &middot; {{ q.role }}
            </figcaption>
          </figure>
        </div>
      </div>

      <!--
        Navigation dots. The button is a 44x44 invisible touch target with the
        visible pill centered inside via pseudo-flex (inline-flex children
        center). Keeps WCAG 2.5.5 (target size: minimum 44x44) without
        bloating the dot strip's visual footprint.
      -->
      <div class="flex items-center justify-center gap-1 pb-2 sm:gap-2 sm:pb-4">
        <button
          v-for="(_, i) in testimonials"
          :key="i"
          class="group inline-flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-950 focus-visible:ring-offset-2"
          type="button"
          :aria-label="`Go to testimonial ${i + 1}`"
          :aria-current="i === current ? 'true' : undefined"
          @click="current = i"
        >
          <span
            class="block h-2 rounded-full transition-all duration-200"
            :class="i === current ? 'w-6 bg-black' : 'w-2 bg-greyLines [@media(hover:hover)]:group-hover:bg-ink-400'"
            aria-hidden="true"
          />
        </button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
// Placeholder copy: illustrative only. Replace with real customer testimonials
// once sourced. Attribution to "Internal beta tester" makes clear these are not
// real customers and avoids any impersonation risk.
const testimonials = [
  {
    quote: "Built to spec, on time, every time. The print quality is exactly what our team needed for the launch event.",
    author: "Studio team",
    role: "Internal beta tester",
  },
  {
    quote: "The level of finish is unusual at this price point. We've ordered four runs and the quality has been consistent.",
    author: "Studio team",
    role: "Internal beta tester",
  },
  {
    quote: "From file upload to delivery, the process was simple. The mockup preview matched what showed up in the box.",
    author: "Studio team",
    role: "Internal beta tester",
  },
]

const current = ref(0)
</script>

<style scoped>
/*
  Default: smooth eased translate between slides.
  prefers-reduced-motion: instant slide change. The transform still runs (so
  the active slide is in view), it just isn't animated. This matches the
  LogoBar pattern of opt-out-aware motion.
*/
.carousel-track {
  transition: transform 500ms cubic-bezier(0.4, 0, 0.2, 1);
  will-change: transform;
}
@media (prefers-reduced-motion: reduce) {
  .carousel-track {
    transition: none;
  }
}
</style>
