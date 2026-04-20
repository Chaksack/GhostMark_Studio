<template>
  <section class="overflow-hidden border-y border-zinc-200 bg-white py-6">
    <div class="flex animate-scroll items-center gap-12 whitespace-nowrap">
      <span
        v-for="(logo, i) in [...logos, ...logos]"
        :key="i"
        class="flex-shrink-0 text-[14px] font-semibold uppercase tracking-[0.12em] text-zinc-400"
      >
        {{ logo }}
      </span>
    </div>
  </section>
</template>

<script setup lang="ts">
const logos = [
  'Oatly',
  'Highsnobiety',
  'Spotify',
  'Caudalie',
  'WeTransfer',
  'Deliveroo',
  'Deloitte',
  'Deliciously Ella',
  'Bain & Company',
  'Organic Basics',
  'Dior',
  'Accenture',
]
</script>

<style scoped>
@keyframes scroll {
  0% {
    transform: translateX(0);
  }
  100% {
    transform: translateX(-50%);
  }
}
.animate-scroll {
  animation: scroll 30s linear infinite;
}
</style>
