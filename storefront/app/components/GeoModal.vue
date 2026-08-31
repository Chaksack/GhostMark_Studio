<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { StoreRegion } from '@medusajs/types'
import UiModal from './ui/overlay/UiModal.vue'
import UiButton from './ui/UiButton.vue'

/**
 * GeoModal: first-visit "looks like you are visiting from X" prompt.
 *
 * Detection strategy (best-effort, never authoritative):
 *   1. Read `Intl.DateTimeFormat().resolvedOptions().timeZone` and map a
 *      handful of well-known IANA zones to ISO-3166 alpha-2 codes. This is
 *      more reliable than `navigator.language` (which mostly reports the
 *      keyboard locale) and degrades gracefully, if we cannot map the zone
 *      we fall back to the language hint.
 *   2. With a candidate ISO-2 in hand we look it up against the live
 *      Medusa region catalogue. The first region whose `countries[]`
 *      contains the ISO-2 wins.
 *   3. If the detected region matches the active region, we silently mark
 *      the modal dismissed and never show it.
 *
 * Persistence: a flag in localStorage (`gms_geo_dismissed`) suppresses the
 * modal for returning visitors. We do not write a cookie or call any
 * remote service.
 */

const dismissedKey = 'gms_geo_dismissed'
const dismissed = useState<boolean>('gms_geo_dismissed', () => false)
const ready = useState<boolean>('gms_geo_dismissed_ready', () => false)

const open = ref<boolean>(false)
const regions = ref<StoreRegion[]>([])
const selectedRegionId = ref<string>('')

const { regionId: activeRegionCookie, region: activeRegion, ensureRegion } = useRegion()

// SSR cannot run the SDK with a region cookie, so fetch regions only in
// the browser. The modal is wrapped in <ClientOnly> in the layout; this
// handler is the matching client-only data fetcher.
const sdk = useMedusaClient()

// --- Detection ---------------------------------------------------------------

// Curated IANA timezone -> ISO-3166-1 alpha-2 map. Covers the bands a
// premium-merch storefront actually serves; we lean on the language fallback
// for the long tail. New regions land in `regions.ts` (Medusa) and get
// reflected here when the merchant adds the country.
const TZ_TO_COUNTRY: Record<string, string> = {
  // Europe
  'Europe/London': 'GB',
  'Europe/Dublin': 'IE',
  'Europe/Paris': 'FR',
  'Europe/Berlin': 'DE',
  'Europe/Madrid': 'ES',
  'Europe/Rome': 'IT',
  'Europe/Amsterdam': 'NL',
  'Europe/Brussels': 'BE',
  'Europe/Vienna': 'AT',
  'Europe/Lisbon': 'PT',
  'Europe/Stockholm': 'SE',
  'Europe/Oslo': 'NO',
  'Europe/Copenhagen': 'DK',
  'Europe/Helsinki': 'FI',
  'Europe/Warsaw': 'PL',
  'Europe/Prague': 'CZ',
  'Europe/Zurich': 'CH',
  'Europe/Athens': 'GR',
  // Americas
  'America/New_York': 'US',
  'America/Chicago': 'US',
  'America/Denver': 'US',
  'America/Los_Angeles': 'US',
  'America/Toronto': 'CA',
  'America/Vancouver': 'CA',
  'America/Mexico_City': 'MX',
  // APAC
  'Asia/Tokyo': 'JP',
  'Asia/Singapore': 'SG',
  'Asia/Hong_Kong': 'HK',
  'Asia/Seoul': 'KR',
  'Australia/Sydney': 'AU',
  'Australia/Melbourne': 'AU',
  'Pacific/Auckland': 'NZ',
}

const detectCountry = (): string | null => {
  if (typeof Intl === 'undefined') return null
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (tz && TZ_TO_COUNTRY[tz]) return TZ_TO_COUNTRY[tz]
  } catch {
    // Intl missing or restricted: fall through to language heuristic.
  }
  if (typeof navigator !== 'undefined') {
    const langs = navigator.languages?.length
      ? navigator.languages
      : [navigator.language]
    for (const lang of langs) {
      const match = lang?.match(/-([A-Z]{2})\b/i)?.[1]
      if (match) return match.toUpperCase()
    }
  }
  return null
}

const detectedCountry = ref<string | null>(null)

const detectedRegion = computed<StoreRegion | null>(() => {
  const cc = detectedCountry.value
  if (!cc) return null
  const target = cc.toLowerCase()
  return (
    regions.value.find((r) =>
      r.countries?.some((c) => c.iso_2?.toLowerCase() === target),
    ) ?? null
  )
})

const detectedRegionLabel = computed<string>(() => {
  if (!detectedRegion.value) return 'another region'
  // Prefer the country display name where possible, reads as
  // "visiting from United Kingdom" instead of "visiting from Europe".
  const country = detectedRegion.value.countries?.find(
    (c) => c.iso_2?.toLowerCase() === detectedCountry.value?.toLowerCase(),
  )
  return country?.display_name || country?.name || detectedRegion.value.name
})

// --- Lifecycle ---------------------------------------------------------------

const hydrate = (): void => {
  if (typeof window === 'undefined') return
  try {
    dismissed.value = window.localStorage.getItem(dismissedKey) === '1'
  } catch {
    dismissed.value = false
  }
  ready.value = true
}

const persistDismissed = (): void => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(dismissedKey, '1')
  } catch {
    // Storage disabled: accept the next-visit re-prompt as graceful failure.
  }
  dismissed.value = true
}

onMounted(async () => {
  hydrate()
  if (dismissed.value) return

  // Make sure the active region is resolved before we compare.
  await ensureRegion()

  // Pull the catalogue. Cheap (single GET, ~50 regions max) and only on
  // first visit thanks to the dismissed flag above.
  try {
    const res = await sdk.store.region.list({ limit: 50 } as Record<string, unknown>)
    regions.value = ((res as { regions?: StoreRegion[] })?.regions ?? []) as StoreRegion[]
  } catch {
    // SDK unavailable / network blip: bail silently. The user keeps the
    // active region and the modal simply never appears this session.
    return
  }

  detectedCountry.value = detectCountry()

  if (!detectedRegion.value) {
    // Nothing to recommend: don't bother the user.
    return
  }

  const activeId
    = (activeRegion.value as { id?: string } | null)?.id
    ?? (activeRegionCookie.value as string | null)
    ?? null

  if (activeId && detectedRegion.value.id === activeId) {
    // Already on the right region, record the dismissal so we don't even
    // run the SDK call on the next visit.
    persistDismissed()
    return
  }

  selectedRegionId.value = detectedRegion.value.id
  open.value = true
})

// Default the dropdown to the detected region as soon as it resolves.
watch(detectedRegion, (next) => {
  if (next && !selectedRegionId.value) selectedRegionId.value = next.id
})

// --- Actions -----------------------------------------------------------------

const onConfirm = (): void => {
  if (selectedRegionId.value && selectedRegionId.value !== activeRegionCookie.value) {
    // Write the canonical region cookie that `useRegion` reads. A full
    // reload is the cleanest way to refetch the cart, currency and
    // category prices in lockstep without coupling to other composables.
    activeRegionCookie.value = selectedRegionId.value
    persistDismissed()
    open.value = false
    if (typeof window !== 'undefined') {
      window.location.reload()
    }
    return
  }
  persistDismissed()
  open.value = false
}

const onDismiss = (): void => {
  persistDismissed()
  open.value = false
}

const handleOpenChange = (value: boolean): void => {
  if (!value) onDismiss()
}
</script>

<template>
  <UiModal
    :open="open"
    size="md"
    title="Choose your region"
    @update:open="handleOpenChange"
  >
    <div class="px-2 py-2">
      <p class="mb-3 font-body text-eyebrow uppercase tracking-[0.16em] text-ink-500">
        Region
      </p>
      <h3
        class="mb-3 font-display text-display-sm leading-tight text-ink-950"
      >
        Visiting from
        <span class="italic text-ink-700">{{ detectedRegionLabel }}</span>?
      </h3>
      <p class="mb-6 font-body text-body leading-relaxed text-ink-700">
        You have landed on the international shelf. Switch to the
        local edition for accurate pricing, currency, and shipping windows,
        or stay where you are. Your call.
      </p>

      <label
        for="geo-region-select"
        class="mb-1.5 block font-body text-[13px] font-medium text-ink-800"
      >
        Switch shelf
      </label>
      <div class="relative">
        <select
          id="geo-region-select"
          v-model="selectedRegionId"
          class="block w-full appearance-none rounded-none border border-ink-200 bg-cream-50 px-4 py-3 pr-10 font-body text-body text-ink-950 transition-colors duration-fast focus:border-ink-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink-900 focus-visible:ring-offset-2 focus-visible:ring-offset-cream-50 motion-reduce:transition-none"
        >
          <option value="" disabled>Choose a region…</option>
          <option
            v-for="r in regions"
            :key="r.id"
            :value="r.id"
          >
            {{ r.name }} · {{ r.currency_code?.toUpperCase() }}
          </option>
        </select>
        <span
          aria-hidden="true"
          class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-500"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </div>

      <div class="mt-8 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center">
        <UiButton
          variant="ghost"
          size="md"
          shape="square"
          @click="onDismiss"
        >
          Stay on current shelf
        </UiButton>
        <UiButton
          variant="merchery"
          size="md"
          shape="square"
          :disabled="!selectedRegionId"
          @click="onConfirm"
        >
          Confirm
        </UiButton>
      </div>
    </div>
  </UiModal>
</template>
