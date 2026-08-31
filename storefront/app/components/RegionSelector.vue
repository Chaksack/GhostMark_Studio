<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { StoreRegion } from '@medusajs/types'
import UiSheet from './ui/overlay/UiSheet.vue'

/**
 * RegionSelector: locale + currency pill that opens a UiSheet listing every
 * region exposed by the Medusa backend. Selecting a region calls
 * `useRegion().setRegion(id)`; downstream refetch (cart, wishlist) is a
 * follow-up Phase 7.x task tracked in `useRegion.ts`.
 *
 * Visual variants:
 *   - `pill`:    bordered button used in the header trust strip
 *   - `meta`:    caption-weight inline text used in the footer + mobile nav
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
/**
 * Human label for a region.
 *
 * A region with exactly ONE country reads best as that country ("United
 * Kingdom"). A region with several must read as the region ("European Union"),
 * because `countries[0]` is just whatever the API sorted first, for the live
 * catalogue that is Canada inside the United States region and Austria inside
 * the European Union region. Naming an arbitrary member country is worse than
 * naming nothing: it tells a German customer this region is "Austria".
 */
const regionLabelFor = (r: StoreRegion | null | undefined): string => {
  if (!r) return '–'
  const countries = r.countries ?? []
  if (countries.length === 1) {
    const only = countries[0]
    return only?.display_name || only?.name || r.name
  }
  return r.name
}

/** Row headline in the sheet. */
const regionPrimary = (r: StoreRegion): string => regionLabelFor(r)

/**
 * Row supporting line. Currency always; member count only when the region
 * spans more than one country, where it answers "is my country in here?".
 */
const regionSecondary = (r: StoreRegion): string => {
  const currency = r.currency_code?.toUpperCase() ?? '–'
  const count = r.countries?.length ?? 0
  return count > 1 ? `${currency} · ${count} countries` : currency
}

const localeDisplay = computed<string>(() => regionLabelFor(region.value))

const currencyDisplay = computed<string>(() => {
  return region.value?.currency_code?.toUpperCase() ?? '–'
})

// Pill copy keeps the language token static: no i18n yet.
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
    // Foundation log only: Phase 7.x will wire cart/wishlist refetch.
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

  <!--
    `meta` variant: the footer's bottom-bar trigger (AppFooter.vue).

    The globe glyph and the `min-h-[44px]` are not decoration: this variant
    replaced a hand-rolled `<NuxtLink>` in the footer that carried both, and
    dropping them would have been a silent regression in two ways: the icon
    is the only thing that reads as "region" before you parse "EN · GBP", and
    44px is the pointer-target floor. The label itself stays text-only for
    screen readers via `aria-label`; the svg is `aria-hidden`.
  -->
  <button
    v-else
    type="button"
    :aria-label="ariaLabel"
    :aria-haspopup="'dialog'"
    :aria-expanded="isOpen"
    class="inline-flex min-h-[44px] items-center gap-2 rounded-none py-2 font-body text-eyebrow uppercase text-ink-500 transition-colors duration-fast hover:text-ink-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900 focus-visible:ring-offset-2 focus-visible:ring-offset-cream-warm motion-reduce:transition-none"
    @click="open"
  >
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
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
            <!--
              Primary line is the REGION, not `countries[0]`.

              It used to be `r.countries?.[0]?.display_name`, which reads fine
              for a single-country region and is actively misleading for every
              multi-country one: the live catalogue renders the United States
              region as "Canada" and the European Union region as "Austria",
              because those happen to sort first in each `countries` array. A
              customer in Germany scanning this list sees "Austria" set in the
              largest type on the row and reasonably concludes we do not ship
              to them.

              `regionPrimary` keeps the original intent (a single-country
              region still reads "United Kingdom" rather than the bare region
              label) while multi-country regions name the region itself and
              move the member count to the supporting line, which is the
              genuinely useful fact ("does my country fall inside this?").
              Matches Selfridges' "United Kingdom / GBP £" pairing and
              lululemon's country-left / currency-right rows (Mobbin).
            -->
            <span class="flex flex-col gap-1">
              <span class="font-body text-[15px] leading-tight text-ink-950">
                {{ regionPrimary(r) }}
              </span>
              <span class="text-eyebrow font-body uppercase text-ink-500">
                {{ regionSecondary(r) }}
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
