import { computed, onMounted, watch } from 'vue'

/**
 * useConsent: GDPR cookie-consent reader/writer.
 *
 * Persistence: localStorage under the `gms_cookie_consent` key.
 * The state is hydrated lazily on the client (no SSR mismatch) and the
 * shared Nuxt `useState` keeps every consumer in lockstep across the app.
 *
 * Public surface:
 *   - `consent`:         reactive `ConsentState` ref
 *   - `hasAnalytics`:    computed boolean (decided AND opted-in)
 *   - `hasMarketing`:    computed boolean (decided AND opted-in)
 *   - `acceptAll()`:     opt in to everything
 *   - `rejectAll()`:     keep only essential
 *   - `save()`:          flush current toggles + mark decided
 *   - `reopen()`:        wipe `decided` so the banner reappears
 *   - `ready`:           true once the localStorage rehydrate has run
 */

export interface ConsentState {
  decided: boolean
  essential: boolean
  analytics: boolean
  marketing: boolean
  decidedAt: number | null
}

const STORAGE_KEY = 'gms_cookie_consent'

const defaultState = (): ConsentState => ({
  decided: false,
  essential: true,
  analytics: false,
  marketing: false,
  decidedAt: null,
})

export const useConsent = () => {
  // Shared client-side state. SSR renders the default (banner hidden until
  // mount confirms no decision exists) so we never flash on hydrated pages.
  const consent = useState<ConsentState>('gms_cookie_consent', () => defaultState())
  const ready = useState<boolean>('gms_cookie_consent_ready', () => false)

  const persist = (next: ConsentState): void => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // localStorage may be disabled (private mode, quota). Fail soft:
      // the in-memory state still drives the UI for this session.
    }
  }

  const hydrate = (): void => {
    if (ready.value) return
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<ConsentState>
        consent.value = {
          decided: Boolean(parsed.decided),
          essential: true,
          analytics: Boolean(parsed.analytics),
          marketing: Boolean(parsed.marketing),
          decidedAt: typeof parsed.decidedAt === 'number' ? parsed.decidedAt : null,
        }
      }
    } catch {
      // Malformed payload: reset to default and keep going.
      consent.value = defaultState()
    }
    ready.value = true
  }

  // Kick rehydration on first mount + auto-persist any subsequent mutation.
  onMounted(() => {
    hydrate()
    watch(consent, (next) => {
      if (!ready.value) return
      persist(next)
    }, { deep: true })
  })

  const acceptAll = (): void => {
    consent.value = {
      decided: true,
      essential: true,
      analytics: true,
      marketing: true,
      decidedAt: Date.now(),
    }
  }

  const rejectAll = (): void => {
    consent.value = {
      decided: true,
      essential: true,
      analytics: false,
      marketing: false,
      decidedAt: Date.now(),
    }
  }

  const save = (): void => {
    consent.value = {
      ...consent.value,
      decided: true,
      essential: true,
      decidedAt: Date.now(),
    }
  }

  const reopen = (): void => {
    consent.value = { ...consent.value, decided: false }
  }

  const hasAnalytics = computed<boolean>(
    () => consent.value.decided && consent.value.analytics,
  )
  const hasMarketing = computed<boolean>(
    () => consent.value.decided && consent.value.marketing,
  )

  return {
    consent,
    ready,
    hasAnalytics,
    hasMarketing,
    acceptAll,
    rejectAll,
    save,
    reopen,
  }
}
