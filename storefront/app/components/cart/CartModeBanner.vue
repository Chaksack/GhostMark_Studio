<template>
  <div
    v-if="showBanner"
    class="rounded-[0.5rem] bg-uiHighlight border border-greyLines/50 px-5 py-4 mb-6"
    role="status"
    aria-live="polite"
  >
    <p class="text-[14px] font-medium text-ink-950 mb-1">Your order has two delivery tracks</p>
    <p class="text-[13px] leading-[1.55] text-ink-700">
      <strong class="text-ink-950">Studio Canon</strong> items ship in 1-2 business days.
      <strong class="text-ink-950">Custom &amp; POD</strong> items begin production after you approve the e-proof
      (we email it within 48 hours) and ship 2-4 weeks later. Both ship together where possible.
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { inferCartMode } from '~/utils/cartMode'

const props = defineProps<{
  items: any[] // cart line items
}>()

// Banner renders only when the cart spans BOTH pod + apparel lines. The
// aggregate-mode helper returns 'mixed' exactly in that case (and 'empty' /
// 'pod' / 'apparel' otherwise) so the check stays declarative.
const showBanner = computed(() => inferCartMode(props.items) === 'mixed')
</script>
