/**
 * Mode-aware ProductCard chip taxonomy.
 *
 * Per the v2 IA recommendation the storefront splits into two commerce surfaces
 * with distinct value propositions:
 *
 *  - `/shop`   — D2C own-brand merch (Studio Canon). Chips emphasise scarcity
 *                and editorial signals (BEST SELLER, NEW DROP, LOW STOCK,
 *                STUDIO CANON).
 *  - `/studio` — B2B custom service + print-on-demand. Chips emphasise
 *                operational guarantees (FROM 25 UNITS, 48H E-PROOF, POD READY,
 *                CUSTOM PRINT).
 *
 * A small set of chips applies in any context (MADE IN EUROPE, B CORP) and is
 * marked with `mode: 'any'` so it survives whichever filter the consumer picks.
 *
 * Why a central catalog rather than free-form `string[]` badges:
 *  1. The label set becomes auditable — design can grep one file to know what
 *     can possibly appear on a card.
 *  2. Urgency styling (`urgent: true` vs default) lives next to the label so
 *     we don't drift between callers.
 *  3. The mode guard prevents B2B chips bleeding onto a D2C card after the
 *     two-surface split — a regression that's easy to make once both pages
 *     read from the same Medusa product feed.
 *
 * v18 chip discipline (per merchery audit):
 *  Previously chips rendered with multiple background tones (white / pistacho
 *  / warm) which created visual noise across the PLP grid. We've collapsed to
 *  ONE base background (white) and reserved the pistacho fill for a SINGLE
 *  signal — `LOW STOCK` — because scarcity is the only chip that has to
 *  short-circuit a scan. Everything else is a calmer trust/value cue and
 *  should sit at the same visual weight, with the LABEL doing the work of
 *  differentiating intent.
 */

export type CommerceMode = 'shop' | 'studio' | 'pod' | 'auto'

export interface Chip {
  /** Stable identifier used as the v-for key and the metadata lookup key. */
  key: string
  /** Display label — already upper-cased, the component does not transform. */
  label: string
  /** Surface where the chip is allowed to appear. `'any'` = both. */
  mode: CommerceMode | 'any'
  /**
   * Urgency flag. When `true`, the chip paints with the brand pistacho fill
   * so it pops against the calmer white chips around it. Reserved for ONE
   * signal across the whole catalog: `low_stock`. Adding `urgent: true` to a
   * second chip will visually re-introduce the noise this flag was created to
   * eliminate, so think twice before doing so. Defaults to `false` (white).
   */
  urgent?: boolean
}

export const CHIP_CATALOG: Record<string, Chip> = {
  // -------------------------------------------------------------------------
  // D2C /shop chips — Studio Canon own-brand merchandise.
  // -------------------------------------------------------------------------
  best_seller: { key: 'best_seller', label: 'BEST SELLER', mode: 'shop' },
  new_drop: { key: 'new_drop', label: 'NEW DROP', mode: 'shop' },
  // The single highlighted chip in the catalog — pistacho fill, scarcity cue.
  low_stock: { key: 'low_stock', label: 'LOW STOCK', mode: 'shop', urgent: true },
  studio_canon: { key: 'studio_canon', label: 'STUDIO CANON', mode: 'shop' },

  // -------------------------------------------------------------------------
  // B2B /studio chips — custom print + POD service guarantees.
  // -------------------------------------------------------------------------
  from_25_units: { key: 'from_25_units', label: 'FROM 25 UNITS', mode: 'studio' },
  e_proof_48h: { key: 'e_proof_48h', label: '48H E-PROOF', mode: 'studio' },
  pod_ready: { key: 'pod_ready', label: 'POD READY', mode: 'pod' },
  custom_print: { key: 'custom_print', label: 'CUSTOM PRINT', mode: 'studio' },

  // -------------------------------------------------------------------------
  // Universal — render regardless of the active commerce surface.
  // -------------------------------------------------------------------------
  made_in_europe: { key: 'made_in_europe', label: 'MADE IN EUROPE', mode: 'any' },
  b_corp: { key: 'b_corp', label: 'B CORP', mode: 'any' },
}

/**
 * Maps legacy human-readable chip strings (from old seed data) to canonical
 * snake_case keys in CHIP_CATALOG. Both case-insensitive and tolerant of
 * pluralization / minor variants.
 *
 * This is a TEMPORARY shim. Once backend seeds emit `metadata.chips: ['best_seller', ...]`
 * directly, this map can be removed.
 */
export const LEGACY_CHIP_ALIAS: Record<string, string> = {
  // Direct legacy strings observed in current seeds
  'best sellers': 'best_seller',
  'best seller': 'best_seller',
  'new drop': 'new_drop',
  'new drops': 'new_drop',
  'new arrival': 'new_drop',
  'new arrivals': 'new_drop',
  'low stock': 'low_stock',
  'studio canon': 'studio_canon',
  'canon': 'studio_canon',
  'from 25 units': 'from_25_units',
  'from 25': 'from_25_units',
  'min 25': 'from_25_units',
  '48h e-proof': 'e_proof_48h',
  'e-proof 48h': 'e_proof_48h',
  'e-proof': 'e_proof_48h',
  'pod ready': 'pod_ready',
  'print on demand': 'pod_ready',
  'pod': 'pod_ready',
  'custom print': 'custom_print',
  'custom': 'custom_print',
  'made in europe': 'made_in_europe',
  'made in eu': 'made_in_europe',
  'b corp': 'b_corp',
  'bcorp': 'b_corp',
}

/**
 * Resolve a raw chip value (snake_case key OR legacy human string) to a
 * canonical CHIP_CATALOG key. Returns null if no match.
 */
export function normalizeChipKey(raw: string | null | undefined): string | null {
  if (!raw) return null
  const trimmed = String(raw).trim()
  // Already canonical?
  if (CHIP_CATALOG[trimmed]) return trimmed
  // Try legacy alias (case-insensitive)
  const aliased = LEGACY_CHIP_ALIAS[trimmed.toLowerCase()]
  if (aliased && CHIP_CATALOG[aliased]) return aliased
  return null
}

/**
 * Resolve raw badge keys (as stored on Medusa product metadata) to fully
 * formed `Chip` objects, filtered to the chips appropriate for the current
 * commerce mode.
 *
 * Behaviour:
 *  - Raw values are first normalized via `normalizeChipKey` so legacy human
 *    strings (e.g. `'Best sellers'`, `'B Corp'`) resolve to the canonical
 *    snake_case keys. This is the temporary shim that lets the storefront
 *    render chips before the backend seed cutover.
 *  - Unknown keys are silently dropped (defensive — tolerates legacy seeds).
 *  - `mode: 'any'` chips always pass through.
 *  - `mode === 'auto'` returns everything resolvable, leaving the consumer
 *    free to do its own filtering. Useful in the search PLP where we don't
 *    yet know which surface a click will land on.
 *  - `mode === 'studio'` and `mode === 'pod'` are treated as siblings — the
 *    POD funnel lives inside the Studio surface, so a `pod_ready` chip should
 *    appear on `/studio` cards and vice versa for `custom_print` on POD cards.
 */
export function visibleChipsForMode(
  badgeKeys: string[],
  mode: CommerceMode = 'auto',
): Chip[] {
  return badgeKeys
    .map(k => normalizeChipKey(k))
    .filter((k): k is string => !!k)
    .map(k => CHIP_CATALOG[k])
    .filter((c): c is Chip => !!c)
    .filter((c) => {
      if (mode === 'auto') return true
      if (c.mode === 'any') return true
      if (mode === 'shop') return c.mode === 'shop'
      if (mode === 'studio') return c.mode === 'studio' || c.mode === 'pod'
      if (mode === 'pod') return c.mode === 'pod' || c.mode === 'studio'
      return false
    })
}
