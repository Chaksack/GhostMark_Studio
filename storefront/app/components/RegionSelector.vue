<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { StoreRegion } from '@medusajs/types'
import UiSheet from './ui/overlay/UiSheet.vue'

/**
 * RegionSelector — locale + currency pill that opens a UiSheet listing every
 * region exposed by the Medusa backend. Selecting a region calls
 * `useRegion().setRegion(id)`; downstream refetch (cart, wishlist) is a
 * follow-up Phase 7.x task tracked in `useRegion.ts`.
 *
 * Visual variants:
 *   - `pill`    — bordered button used in the header trust strip
 *   - `meta`    — caption-weight inline text used in the footer + mobile nav
 *
 * The component is presentation-only on the data side: it consumes the
 * shared `useRegion` composable so both SSR and CSR see the same active
 * region without prop-drilling.
 */

type Variant = 'pill' | 'meta'

interface Props {
  variant?: Variant
  staticLanguage?: string
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'pill',
  staticLanguage: 'EN',
})

const { region, regions, loadRegions, setRegion } = useRegion()

const isOpen = ref<boolean>(false)
const isSwitching = ref<string | null>(null)

// Locale display: prefer the country's display_name (e.g. "United Kingdom"),
// fall back to the region name (e.g. "Europe") so single-country regions
// read naturally and multi-country regions still render something useful.
const localeDisplay = computed<string>(() => {
  if (!region.value) return '—'
  const country = region.value.countries?.[0]
  return country?.display_name || country?.name || region.value.name
})

const currencyDisplay = computed<string>(() => {
  return region.value?.currency_code?.toUpperCase() ?? '—'
})

// Pill copy keeps the language token static — no i18n yet.
const pillLabel = computed<string>(() => {
  if (props.variant === 'meta') return `${props.staticLanguage} · ${currencyDisplay.value}`
  return localeDisplay.value
})

const ariaLabel = computed<string>(() => {
  return `Change region. Currently ${localeDisplay.value}, ${currencyDisplay.value}.`
})

const open = async (): Promise<void> => {
  isOpen.value = true
  // Lazy-load the list on first open so we don't pay the fetch cost on
  // every page render. `loadRegions` is idempotent / cached.
  await loadRegions()
}

const close = (): void => {
  isOpen.value = false
}

const onSelect = async (r: StoreRegion): Promise<void> => {
  if (isSwitching.value) return
  isSwitching.value = r.id

  try {
    const next = await setRegion(r.id)
    // Foundation log only — Phase 7.x will wire cart/wishlist refetch.
    if (import.meta.client) {
      // eslint-disable-next-line no-console
      console.info('[RegionSelector] region switched to', next?.id, next?.name)
    }
    close()
  }
  finally {
    isSwitching.value = null
  }
}

onMounted(() => {
  // Warm the catalogue once per session so the sheet opens instantly.
  void loadRegions()
})
</script>

<template>
  <button
    v-if="variant === 'pill'"
    type="button"
    :aria-label="ariaLabel"
    :aria-haspopup="'dialog'"
    :aria-expanded="isOpen"
    class="cursor-pointer rounded-full border border-ink-200 bg-transparent px-2.5 py-1.5 text-caption text-ink-500 transition-colors duration-fast hover:bg-cream-50 hover:text-ink-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900 focus-visible:ring-offset-2 focus-visible:ring-offset-cream-warm motion-reduce:transition-none"
    @click="open"
  >
    {{ pillLabel }} · {{ staticLanguage === 'EN' ? 'English' : staticLanguage }}
  </button>

  <button
    v-else
    type="button"
    :aria-label="ariaLabel"
    :aria-haspopup="'dialog'"
    :aria-expanded="isOpen"
    class="text-eyebrow font-body uppercase text-ink-500 transition-colors duration-fast hover:text-ink-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900 focus-visible:ring-offset-2 focus-visible:ring-offset-cream-warm motion-reduce:transition-none"
    @click="open"
  >
    {{ pillLabel }}
  </button>

  <UiSheet
    :open="isOpen"
    side="right"
    size="sm"
    title="Choose your region"
    @update:open="isOpen = $event"
  >
    <div class="flex flex-col gap-1 px-4 py-5">
      <p class="px-2 pb-3 font-body text-caption text-ink-500">
        Prices, currency, and shipping options update instantly when you switch.
      </p>

      <ul
        v-if="regions.length"
        class="flex flex-col"
        role="listbox"
        aria-label="Available regions"
      >
        <li v-for="r in regions" :key="r.id" role="presentation">
          <button
            type="button"
            role="option"
            :aria-selected="region?.id === r.id"
            :disabled="isSwitching === r.id"
            class="group flex w-full items-center justify-between gap-3 rounded-md px-3 py-3 text-left transition-colors duration-fast hover:bg-cream-tile focus-visible:bg-cream-tile focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900 disabled:cursor-progress disabled:opacity-60 motion-reduce:transition-none"
            @click="onSelect(r)"
          >
            <span class="flex flex-col gap-1">
              <span class="font-body text-[15px] leading-tight text-ink-950">
                {{ r.countries?.[0]?.display_name || r.countries?.[0]?.name || r.name }}
              </span>
              <span class="text-eyebrow font-body uppercase text-ink-500">
                {{ r.name }} · {{ r.currency_code.toUpperCase() }}
              </span>
            </span>
            <span
              v-if="region?.id === r.id"
              aria-hidden="true"
              class="inline-flex h-5 w-5 items-center justify-center rounded-full bg-ink-950 text-cream-50"
            >
              <svg
                viewBox="0 0 24 24"
                width="12"
                height="12"
                fill="none"
                stroke="currentColor"
                stroke-width="3"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </span>
          </button>
        </li>
      </ul>

      <p
        v-else
        class="px-3 py-6 text-center font-body text-caption text-ink-500"
      >
        Loading regions…
      </p>
    </div>
  </UiSheet>
</template>
