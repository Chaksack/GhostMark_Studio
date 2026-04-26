<template>
  <!--
    Brand marquee. Two strategies depending on user motion preference:
    - Default: continuous CSS marquee. The list is duplicated so the seam
      is invisible (translateX(-50%) lands on the start of the second copy).
    - prefers-reduced-motion: animation is disabled and the wrapper becomes
      horizontally scrollable so users can still pan through the full set
      without trailing brand marks being clipped mid-word.

    NOTE: The brand marks below are placeholder wordmarks rendered as
    SVG using each brand's typeface conventions. They are NOT licensed
    brand assets and should be replaced with the real GhostMark client
    roster (and corresponding licensed marks) before production launch.
  -->
  <section class="overflow-hidden border-y border-greyLines bg-offWhite py-6 lg:py-8">
    <div
      class="logo-marquee flex items-center gap-x-12 lg:gap-x-16 whitespace-nowrap"
      :class="{ 'reduce-motion-static': reduceMotion }"
    >
      <img
        v-for="(logo, i) in duplicatedLogos"
        :key="`${logo.slug}-${i}`"
        :src="`/img/logos/${logo.slug}.svg`"
        :alt="`${logo.name} logo`"
        class="h-6 w-auto shrink-0 text-greyText opacity-50 transition-opacity duration-300 hover:opacity-100 lg:h-8"
        loading="lazy"
        decoding="async"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

interface BrandLogo {
  slug: string
  name: string
}

const logos: BrandLogo[] = [
  { slug: 'wetransfer', name: 'WeTransfer' },
  { slug: 'deliveroo', name: 'Deliveroo' },
  { slug: 'spotify', name: 'Spotify' },
  { slug: 'oatly', name: 'Oatly' },
  { slug: 'highsnobiety', name: 'Highsnobiety' },
  { slug: 'dior', name: 'Dior' },
  { slug: 'accenture', name: 'Accenture' },
  { slug: 'bain', name: 'Bain & Company' },
  { slug: 'caudalie', name: 'Caudalie' },
  { slug: 'deloitte', name: 'Deloitte' },
]

// Duplicate the array so the marquee can loop seamlessly: when the track
// reaches translateX(-50%) it lands on the first item of the second copy,
// which is visually identical to translateX(0).
const duplicatedLogos = computed<BrandLogo[]>(() => [...logos, ...logos])

// reduceMotion stays false during SSR + initial client render so markup
// matches and Vue doesn't fire a hydration warning. We then promote to the
// real user preference one tick after mount; the @media query in the
// scoped style sheet already handles the visual side regardless.
const reduceMotion = ref(false)
onMounted(() => {
  if (typeof window !== 'undefined' && window.matchMedia) {
    requestAnimationFrame(() => {
      reduceMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    })
  }
})
</script>

<style scoped>
.logo-marquee {
  width: max-content;
  animation: scroll 60s linear infinite;
  will-change: transform;
}

@keyframes scroll {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(-50%);
  }
}

/*
  Reduced-motion fallback: stop the marquee and let the row scroll naturally
  so trailing brand marks aren't clipped mid-word.
*/
@media (prefers-reduced-motion: reduce) {
  .logo-marquee,
  .reduce-motion-static {
    animation: none;
    transform: none;
    width: 100%;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .logo-marquee::-webkit-scrollbar,
  .reduce-motion-static::-webkit-scrollbar {
    display: none;
  }
}
</style>
