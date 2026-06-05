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

const props = defineProps<{
  items: any[] // cart line items
}>()

// MOQ heuristic — only consulted as the final fallback when no explicit
// product.type / metadata signal is present. Matches CartDropdown.inferMode.
const POD_MOQ_FALLBACK = 25

type CartLineMode = 'pod' | 'apparel'

/**
 * Mirror of CartDropdown.inferMode — kept inline (no shared util import) to
 * preserve the single-file contract on this component and avoid a circular
 * dep with the dropdown. If the chain here drifts from CartDropdown.vue, fix
 * both sites in lockstep.
 */
function modeOf(item: any): CartLineMode {
  // 1. Source of truth — product.type.value (backend taxonomy)
  const productType = (item?.variant?.product?.type?.value as string | undefined)?.toLowerCase()
  if (productType === 'pod') return 'pod'
  if (productType === 'apparel') return 'apparel'

  // 2. Line-level metadata override
  const lineMode = (item?.metadata?.commerce_mode as string | undefined)?.toLowerCase()
  if (lineMode === 'pod') return 'pod'
  if (lineMode === 'shop' || lineMode === 'apparel') return 'apparel'

  // 3. Variant-level metadata fallback
  const variantMode = (item?.variant?.metadata?.commerce_mode as string | undefined)?.toLowerCase()
  if (variantMode === 'pod') return 'pod'
  if (variantMode === 'shop' || variantMode === 'apparel') return 'apparel'

  // 4. Product-level metadata fallback
  const productMeta = (item?.variant?.product?.metadata?.commerce_mode as string | undefined)?.toLowerCase()
  if (productMeta === 'pod') return 'pod'
  if (productMeta === 'shop' || productMeta === 'apparel') return 'apparel'

  // 5a. Custom-design signals — uploaded designs are POD by definition
  if (item?.metadata?.design_data) return 'pod'
  if (item?.metadata?.preview_url) return 'pod'

  // 5b. MOQ heuristic — final fallback for legacy lines with zero metadata
  if ((item?.quantity ?? 0) >= POD_MOQ_FALLBACK) return 'pod'

  // 6. Default — treat as in-stock apparel (D2C path)
  return 'apparel'
}

const showBanner = computed(() => {
  const items = props.items || []
  if (!items.length) return false
  const modes = new Set(items.map(modeOf))
  return modes.size >= 2
})
</script>
