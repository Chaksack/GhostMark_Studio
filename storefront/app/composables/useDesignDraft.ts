// =============================================================================
// useDesignDraft: the persistence hop between the dedicated design surface
// (/design/[handle]) and the product page that commits the line item.
//
// WHY THIS EXISTS
//   The inline editor never needed persistence: the canvas and the
//   "Add to cart" button were on the same page, so the Konva stage was still
//   mounted when the payload was collected. A dedicated surface breaks that.
//   The customer positions artwork at /design/tech-pouch and then NAVIGATES,
//   which unmounts the editor and, with it, every `URL.createObjectURL` handle
//   it owned. `onBeforeUnmount` in DesignEditor.vue revokes them explicitly,
//   and it is right to: a blob URL that outlives its component is a leak.
//
//   So the artwork cannot travel as an object URL. It travels as
//   `originalUrl`, the durable server-side copy that `uploadOriginalFile()`
//   already writes to /uploads/designs/<yyyy-mm>/<dd>/<uuid>.<ext> at drop
//   time. That field was added for production print rendering; it doubles as
//   the restore path, which is what the `filename: string | null` note on
//   AttachedDesign was written for.
//
// WHAT IS STORED, AND WHAT IS DELIBERATELY NOT
//   Stored: the durable URL, the placement numbers (all in the 600x800 virtual
//   space), the chosen technique, and the COMMIT PAYLOAD captured at save time.
//   Not stored: File handles, HTMLImageElement, object URLs, or anything else
//   that cannot survive a structured-clone round trip. If it cannot be
//   JSON.stringify'd it does not belong in a draft.
//
// WHY sessionStorage AND NOT localStorage
//   A design draft is a within-visit intent. localStorage would resurrect a
//   draft weeks later and silently attach a stale /uploads/designs URL to a
//   new cart, and those files are reapable. Session scope is the same lifetime
//   the cart cookie already assumes, so the two cannot disagree. This is a
//   correctness choice, not a storage-size one.
//
// WHY NOT PINIA
//   Not installed, and this lane may not run `npm install`. Nuxt's own
//   `useState` is SSR-safe, shared across components and survives client-side
//   route changes, which is the entire requirement. sessionStorage backs it so
//   the draft also survives a hard reload or a deep link straight to /design.
// =============================================================================

export const DESIGN_DRAFT_VERSION = 1 as const

/**
 * One print location's restorable state.
 *
 * `originalUrl` is REQUIRED here even though it is nullable on SideState. A
 * slot whose background upload never landed has nothing durable to restore
 * from, so it is not draftable and is written out as `null`. Persisting a slot
 * we cannot rehydrate would produce a draft that claims artwork it cannot
 * show, which is worse than an empty one.
 */
export interface DesignDraftSlot {
  originalUrl: string
  originalFilename: string | null
  originalMimeType: string | null
  position: { x: number; y: number }
  scale: number
  rotation: number
  /** Presentation only. Never enters the commit payload. */
  fitMode: string
}

/**
 * Exactly what `collectDesignPayload()` returns, carried verbatim.
 *
 * This is the load-bearing half of the draft. The surface collects it at SAVE
 * time, while its Konva stage is still mounted and can be captured to PNG at
 * full 600x800. The PDP then commits this object as-is. The PDP never needs a
 * stage of its own, which is what makes the save/commit split possible at all.
 */
export interface DesignDraftCommit {
  design_data: Record<string, unknown>
  preview_url: string
}

export interface DesignDraft {
  version: typeof DESIGN_DRAFT_VERSION
  productId: string
  handle: string
  variantId: string | null
  activeKey: string
  technique: string | null
  slots: Record<string, DesignDraftSlot | null>
  commit: DesignDraftCommit | null
  savedAt: number
}

const STORAGE_PREFIX = 'gm.design-draft.v1.'

const storageKey = (productId: string): string => `${STORAGE_PREFIX}${productId}`

/**
 * Narrow an unknown parsed blob to a DesignDraft.
 *
 * sessionStorage is attacker-adjacent (any script on the origin can write it)
 * and, more mundanely, it is a place where an OLD build's shape lingers after
 * a deploy. Both cases arrive here as "this is not what I expect", so both get
 * the same answer: drop it and behave as though there were no draft. A draft
 * is a convenience; failing closed costs the customer one re-upload, whereas
 * trusting a malformed one puts unverified values into a cart payload.
 */
const isDraft = (v: unknown): v is DesignDraft => {
  if (!v || typeof v !== 'object') return false
  const d = v as Partial<DesignDraft>
  return (
    d.version === DESIGN_DRAFT_VERSION &&
    typeof d.productId === 'string' &&
    typeof d.handle === 'string' &&
    typeof d.activeKey === 'string' &&
    typeof d.savedAt === 'number' &&
    !!d.slots &&
    typeof d.slots === 'object'
  )
}

export function useDesignDrafts() {
  // Shared across every component in the app for this request/session.
  // Seeded empty on BOTH server and client so the first client render matches
  // the server's; sessionStorage is read in `hydrate()`, never during setup.
  // Reading it during setup is the classic hydration-mismatch bug: the server
  // has no sessionStorage, so it renders "no draft" while the client renders
  // "draft", and Vue patches over it silently and inconsistently.
  const drafts = useState<Record<string, DesignDraft>>('gm-design-drafts', () => ({}))

  /** Read one product's draft out of sessionStorage into shared state. */
  const hydrate = (productId: string): DesignDraft | null => {
    if (!import.meta.client || !productId) return null
    if (drafts.value[productId]) return drafts.value[productId] ?? null
    let raw: string | null = null
    try {
      raw = window.sessionStorage.getItem(storageKey(productId))
    } catch {
      // Safari private mode and "block all cookies" both throw on access
      // rather than returning null. An in-memory-only draft still works for
      // the SPA navigation case, which is the common one.
      return null
    }
    if (!raw) return null
    try {
      const parsed: unknown = JSON.parse(raw)
      if (!isDraft(parsed)) {
        window.sessionStorage.removeItem(storageKey(productId))
        return null
      }
      drafts.value = { ...drafts.value, [productId]: parsed }
      return parsed
    } catch {
      try { window.sessionStorage.removeItem(storageKey(productId)) } catch { /* ignore */ }
      return null
    }
  }

  const get = (productId: string): DesignDraft | null =>
    (productId && drafts.value[productId]) || null

  const save = (draft: DesignDraft): void => {
    drafts.value = { ...drafts.value, [draft.productId]: draft }
    if (!import.meta.client) return
    try {
      window.sessionStorage.setItem(storageKey(draft.productId), JSON.stringify(draft))
    } catch {
      // Quota or a locked-down storage policy. The in-memory copy still
      // carries the customer through PDP -> surface -> PDP in one SPA
      // session, which is the flow this exists for. Losing it on a hard
      // reload is a degradation, not a failure, so we do not surface an
      // error the customer cannot act on.
    }
  }

  const clear = (productId: string): void => {
    if (!productId) return
    const next = { ...drafts.value }
    delete next[productId]
    drafts.value = next
    if (!import.meta.client) return
    try { window.sessionStorage.removeItem(storageKey(productId)) } catch { /* ignore */ }
  }

  return { drafts, hydrate, get, save, clear }
}
