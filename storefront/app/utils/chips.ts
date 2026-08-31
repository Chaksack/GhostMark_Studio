/**
 * Mode-aware ProductCard chip taxonomy.
 *
 * Per the v2 IA recommendation the storefront splits into two commerce surfaces
 * with distinct value propositions:
 *
 *  - `/shop`:   D2C own-brand merch (Studio Canon). Chips emphasise scarcity
 *                and editorial signals (BEST SELLER, NEW DROP, LOW STOCK,
 *                STUDIO CANON, IN STOCK).
 *  - `/studio`: B2B custom service + print-on-demand. Chips emphasise
 *                operational guarantees (FROM 25 UNITS, 48H E-PROOF, POD READY,
 *                CUSTOM PRINT, B2B).
 *
 * NOTE ON THE NAME `'studio'`: it is a COMMERCE MODE, not a route reference.
 * It has always been an alias of `'pod'` on the `CommerceMode` axis below.
 * For a long time this docblock and the one on `visibleChipsForMode` both
 * described chips appearing "on /studio cards" while /studio was a pure
 * editorial page that rendered no cards at all, so the sentence was true of
 * the mode and false of the route. /studio is now the print-on-demand shelf,
 * which makes both readings agree. Do not re-derive the mode from the URL.
 *
 * v20 chip alignment with `product.type.value`:
 *  Chips are now driven by the Medusa product type field: `product.type.value`
 *  returns either `'pod'` or `'apparel'`. We map those to the existing chip
 *  modes:
 *    `'apparel'` -> D2C chips (alias of `'shop'`)
 *    `'pod'`     -> B2B/POD chips (existing `'pod'` / `'studio'` family)
 *
 *  We keep the original `'shop'`/`'studio'`/`'pod'`/`'auto'` axis on
 *  `CommerceMode` for backwards-compat with the existing PLP / Discover /
 *  search callers that pass `mode` explicitly. New code should prefer to read
 *  `product.type.value` and use `'apparel'` / `'pod'`.
 *
 * A small set of chips applies in any context (MADE IN EUROPE, B CORP) and is
 * marked with `mode: 'any'` so it survives whichever filter the consumer picks.
 *
 * Why a central catalog rather than free-form `string[]` badges:
 *  1. The label set becomes auditable: design can grep one file to know what
 *     can possibly appear on a card.
 *  2. Urgency styling (`urgent: true` vs default) lives next to the label so
 *     we don't drift between callers.
 *  3. The mode guard prevents B2B chips bleeding onto a D2C card after the
 *     two-surface split, a regression that's easy to make once both pages
 *     read from the same Medusa product feed.
 *
 * v18 chip discipline (per merchery audit):
 *  Previously chips rendered with multiple background tones (white / pistacho
 *  / warm) which created visual noise across the PLP grid. We've collapsed to
 *  ONE base background (white) and reserved the pistacho fill for a SINGLE
 *  signal (`LOW STOCK`) because scarcity is the only chip that has to
 *  short-circuit a scan. Everything else is a calmer trust/value cue and
 *  should sit at the same visual weight, with the LABEL doing the work of
 *  differentiating intent.
 */

/**
 * Commerce surface / product-type axis driving chip visibility.
 *
 *  - `'apparel'` and `'shop'` are siblings: both render the D2C own-brand
 *    chip set. `'apparel'` is the canonical product-type-derived value;
 *    `'shop'` remains for legacy `mode` props on the PLP wrapper.
 *  - `'pod'` and `'studio'` are siblings: both render the B2B/POD chip set.
 *    `'pod'` is the canonical product-type-derived value; `'studio'` remains
 *    for legacy `mode` props on the Studio surface.
 *  - `'auto'` short-circuits the filter and shows every resolvable chip
 *    (search / discover surfaces where the click destination is unknown).
 */
export type CommerceMode = 'apparel' | 'shop' | 'pod' | 'studio' | 'auto'

export interface Chip {
  /** Stable identifier used as the v-for key and the metadata lookup key. */
  key: string
  /** Display label: already upper-cased, the component does not transform. */
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
  /**
   * May this chip occupy the PLP card's chip slot?
   *
   * Defaults to `true`. Set `false` for chips that are still valid facts
   * (and still render on the PDP, which consumes the unfiltered catalog) but
   * that have no business spending the one or two slots a browse card has.
   * Two distinct failure modes are excluded here:
   *
   *  1. NOT EXCEPTIONAL. `made_in_europe` is on 24 of 26 catalogue products.
   *     A signal carried by ~92% of the grid differentiates nothing; it just
   *     wins the slot on the cards that have nothing else, which is precisely
   *     backwards. (Verified against the live Store API, not assumed.)
   *  2. NOW STATED ELSEWHERE. `from_25_units` and `pod_ready` describe the
   *     commerce model, and the commerce model moved to the persistent meta
   *     line under the price (see `resolveCardMinimum`). Leaving them as
   *     chips would say the same thing twice, in two type sizes, and would
   *     re-introduce the very inconsistency the meta line exists to remove:
   *     a badge that appears on some cards cannot be scanned down a column,
   *     which is the whole reason Faire sets minimums as meta text and
   *     reserves badges for the exceptional ("Top Shop", "Up to 10% off").
   */
  plp?: boolean
}

export const CHIP_CATALOG: Record<string, Chip> = {
  // -------------------------------------------------------------------------
  // Apparel / D2C chips: Studio Canon own-brand merchandise
  // (`product.type.value === 'apparel'`).
  // -------------------------------------------------------------------------
  best_seller: { key: 'best_seller', label: 'BEST SELLER', mode: 'apparel' },
  new_drop: { key: 'new_drop', label: 'NEW DROP', mode: 'apparel' },
  studio_canon: { key: 'studio_canon', label: 'STUDIO CANON', mode: 'apparel' },
  in_stock: { key: 'in_stock', label: 'IN STOCK', mode: 'apparel' },
  // The single highlighted chip in the catalog: pistacho fill, scarcity cue.
  low_stock: { key: 'low_stock', label: 'LOW STOCK', mode: 'apparel', urgent: true },

  // -------------------------------------------------------------------------
  // POD / B2B chips: custom print + POD service guarantees
  // (`product.type.value === 'pod'`).
  // -------------------------------------------------------------------------
  // `pod_ready` / `from_25_units` restate the commerce model, which the card's
  // meta line now carries on EVERY card rather than on the ~40% that happened
  // to be tagged. PDP keeps them (it does not filter on `plp`).
  pod_ready: { key: 'pod_ready', label: 'POD READY', mode: 'pod', plp: false },
  from_25_units: { key: 'from_25_units', label: 'FROM 25 UNITS', mode: 'pod', plp: false },
  e_proof_48h: { key: 'e_proof_48h', label: '48H E-PROOF', mode: 'pod' },
  b2b: { key: 'b2b', label: 'B2B', mode: 'pod' },
  custom_print: { key: 'custom_print', label: 'CUSTOM PRINT', mode: 'pod' },

  // -------------------------------------------------------------------------
  // Universal: render regardless of the active commerce surface.
  // -------------------------------------------------------------------------
  // On 24 of 26 products: universal, therefore not a differentiator on a grid.
  made_in_europe: { key: 'made_in_europe', label: 'MADE IN EUROPE', mode: 'any', plp: false },
  carbon_aware: { key: 'carbon_aware', label: 'CARBON AWARE', mode: 'any' },
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
  'bestseller': 'best_seller',
  'new drop': 'new_drop',
  'new drops': 'new_drop',
  'new arrival': 'new_drop',
  'new arrivals': 'new_drop',
  'low stock': 'low_stock',
  'in stock': 'in_stock',
  'available': 'in_stock',
  'studio canon': 'studio_canon',
  'canon': 'studio_canon',
  'from 25 units': 'from_25_units',
  'from 25': 'from_25_units',
  'min 25': 'from_25_units',
  'from_25': 'from_25_units',
  '48h e-proof': 'e_proof_48h',
  'e-proof 48h': 'e_proof_48h',
  'e-proof': 'e_proof_48h',
  '48 hour proof': 'e_proof_48h',
  'pod ready': 'pod_ready',
  'print on demand': 'pod_ready',
  'pod': 'pod_ready',
  'b2b': 'b2b',
  'b-2-b': 'b2b',
  'wholesale': 'b2b',
  'custom print': 'custom_print',
  'custom': 'custom_print',
  'made in europe': 'made_in_europe',
  'made in eu': 'made_in_europe',
  'carbon aware': 'carbon_aware',
  'carbon-aware': 'carbon_aware',
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
 *  - Unknown keys are silently dropped (defensive: tolerates legacy seeds).
 *  - `mode: 'any'` chips always pass through.
 *  - `mode === 'auto'` returns everything resolvable, leaving the consumer
 *    free to do its own filtering. Useful in the search PLP where we don't
 *    yet know which surface a click will land on.
 *  - `mode === 'apparel'` and `mode === 'shop'` are treated as siblings.
 *  - `mode === 'pod'` and `mode === 'studio'` are treated as siblings. They are
 *    two names for one commerce mode, NOT two surfaces: `'pod'` is the
 *    canonical value derived from `product.type.value`, `'studio'` is the
 *    older hand-passed spelling. A `pod_ready` chip and a `custom_print` chip
 *    resolve identically under either.
 *
 *  This function filters by MODE only. It cannot tell whether a given product
 *  can actually do what its chips claim, because it never sees the product.
 *  See {@link filterChipKeysByCapability} for that, and use it FIRST.
 */
/**
 * Chip keys that assert a CAPABILITY rather than a fact about the catalogue.
 *
 * The difference matters. `made_in_europe` and `best_seller` describe what a
 * product IS, and they are either right or wrong in the seed. These two
 * describe what a customer can DO with it, and a customer who believes them
 * proceeds to an upload flow that does not exist for that product.
 */
const CAPABILITY_CHIP_KEYS = new Set(['pod_ready', 'custom_print'])

/**
 * Drop capability chips from products whose own metadata denies the capability.
 *
 * THE DEFECT THIS FIXES, measured against :9000 on 2026-08-31 rather than
 * inferred: two of the five `type=pod` products are sticker sheets that carry
 *
 *     metadata.chips = ['pod_ready', 'custom_print']
 *     metadata.is_customizable = false
 *     metadata.print_locations = []   (none, so there is nowhere to print)
 *
 * `pod_ready` is flagged `plp: false` so browse never showed it, but
 * `custom_print` is not, so both sticker packs painted a "CUSTOM PRINT" chip
 * on every grid that renders them. They cannot be custom printed. That is not
 * a cosmetic inconsistency, it is the storefront advertising a service the
 * product does not have, on the one surface whose entire purpose is
 * customisation.
 *
 * WHY THIS IS A CODE FIX AND NOT ONLY A DATA FIX. The right long-term repair
 * is to strip the two keys from those products' `metadata.chips`, and that
 * request is going to the backend. It could not be done here: DATABASE_URL is
 * a shared remote Neon instance holding real customer records, so this lane
 * writes nothing to it. But the guard earns its place even after the data is
 * corrected, because it makes the invariant STRUCTURAL: any future product
 * seeded with `is_customizable: false` and a stray capability chip is
 * silently correct instead of silently lying.
 *
 * THE RULE IS DELIBERATELY ASYMMETRIC. A capability chip is suppressed ONLY on
 * an explicit `is_customizable === false`. Missing, undefined or malformed
 * metadata suppresses NOTHING and the chip is left exactly as it was.
 *
 * That asymmetry is load-bearing and it is a safety call, not fastidiousness.
 * All 20 apparel products also carry `is_customizable`, `moq` and
 * `print_locations`, fully populated. That data is NOT stale and NOT a
 * leftover: `ghostmark/src/scripts/seed-commerce-mode.ts` defines
 * `shop` as "own-brand D2C SKU. Owns its PDP on /shop. May ALSO be
 * customizable via the studio surface, but its canonical home is /shop." The
 * records are intentional and SURFACE-SCOPED, so /shop ignoring them is
 * scoping, not discarding.
 *
 * That is exactly why a truthy check here would be dangerous: it would reach
 * into real, meaningful data on 20 products and draw the wrong conclusion from
 * it. A strict `=== false` cannot. It acts only where the seed has positively
 * stated the ABSENCE of the capability, which today is the two sticker packs
 * and nothing else. Treat "we do not know", "we know it is true elsewhere" and
 * "we know it is false here" as three different things, always.
 *
 * @param keys  raw chip keys, pre-normalisation, as read from product metadata
 * @param metadata  the product's own `metadata` object, or null when absent
 */
export function filterChipKeysByCapability(
  keys: string[],
  metadata: Record<string, unknown> | null | undefined,
): string[] {
  // Strict `=== false`. See the asymmetry note above before loosening this.
  if (metadata?.is_customizable !== false) return keys
  return keys.filter((k) => {
    const normalised = normalizeChipKey(k)
    return !normalised || !CAPABILITY_CHIP_KEYS.has(normalised)
  })
}

export function visibleChipsForMode(
  badgeKeys: string[],
  mode: CommerceMode = 'auto',
): Chip[] {
  // Dedupe on the NORMALIZED key, not on the raw string.
  //
  // BUG THIS FIXES, found by measuring rendered cards rather than by reading
  // this file: 4 of 24 cards on /products were painting "BEST SELLER BEST
  // SELLER", and one "B CORP B CORP".
  //
  // The cause is that a product commonly carries the same fact twice under two
  // spellings, because the seed writes both the v2 taxonomy and the legacy
  // shape:
  //     metadata.chips  ["best_seller", ...]
  //     metadata.badges ["Best sellers", ...]
  // ProductCard collects those into a Set, which correctly removes duplicate
  // RAW strings, but "best_seller" and "Best sellers" are different raw
  // strings. They only become equal AFTER `normalizeChipKey` runs, which
  // happens here, one step too late for that Set to have helped.
  //
  // So the dedupe belongs at the point of normalization. Doing it in the
  // component instead would leave every other consumer of this function
  // exposed, and the whole reason the catalog is centralised (see the header)
  // is that the label set should be auditable in one file.
  const seen = new Set<string>()
  return badgeKeys
    .map(k => normalizeChipKey(k))
    .filter((k): k is string => !!k)
    .filter((k) => {
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
    .map(k => CHIP_CATALOG[k])
    .filter((c): c is Chip => !!c)
    .filter((c) => {
      if (mode === 'auto') return true
      if (c.mode === 'any') return true
      // Apparel <-> shop are siblings (D2C own-brand surface).
      if (mode === 'apparel' || mode === 'shop') {
        return c.mode === 'apparel' || c.mode === 'shop'
      }
      // POD <-> studio are siblings (B2B + custom print surface).
      if (mode === 'pod' || mode === 'studio') {
        return c.mode === 'pod' || c.mode === 'studio'
      }
      return false
    })
}

/**
 * PLP variant of `visibleChipsForMode`.
 *
 * Same mode filter, plus two things a browse grid needs and a PDP does not:
 *   1. Chips flagged `plp: false` are dropped (see the `plp` field's docs for
 *      why each one is flagged).
 *   2. The result is capped, because the chip strip is absolutely positioned
 *      over the product photo and must never grow tall enough to eat it.
 *
 * The cap is deliberately the CALLER's decision and defaults to 2 rather than
 * the previous hard-coded 1: see `ProductCard`'s chip-slot comment for the
 * responsive reasoning.
 */
export function plpChipsForMode(
  badgeKeys: string[],
  mode: CommerceMode = 'auto',
  limit = 2,
): Chip[] {
  return visibleChipsForMode(badgeKeys, mode)
    .filter(c => c.plp !== false)
    .slice(0, Math.max(0, limit))
}

// ===========================================================================
// Commerce disclosure: the persistent meta line under the card price.
// ===========================================================================

/**
 * What a card should tell a shopper about how this product is BOUGHT.
 *
 * `kind` is the shape of the sentence, `moq` the enforced floor (always >= 1).
 */
export interface CardCommerce {
  kind: 'minimum' | 'single' | 'giftcard'
  moq: number
  /**
   * Should the price be prefixed "From"? True only when the displayed figure
   * is genuinely a floor the buyer can move: POD volume tiers discount the
   * unit price as quantity climbs, and the gift card has real per-variant
   * denominations. See `resolveCardCommerce` for why this matters.
   */
  fromPrice: boolean
}

/**
 * Resolve the commerce facts a PLP card should disclose.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS DOES NOT READ `metadata.moq` DIRECTLY
 * ---------------------------------------------------------------------------
 * It is tempting, because `metadata.moq` is populated on 22 of 26 catalogue
 * products. It is also wrong, and the PDP already learned this the expensive
 * way: see the comment block at `pages/products/[handle].vue:1811`.
 *
 * All 20 `apparel` products carry an `moq` of 15/20/25. The BEHAVIOUR below is
 * correct and must not change, but the reason recorded here was wrong: this is
 * not leftover data. Per seed-commerce-mode.ts an own-brand SKU "may ALSO be
 * customizable via the studio surface" while "its canonical home is /shop", so
 * the minimum is real for the studio lane and simply does not apply when the
 * same product is bought as-is. Ignoring it on /shop is SCOPING, not
 * discarding a mistake. Historical note kept because the original text said
 * this was stale left over from an
 * earlier seed. Only 2 of the 5 `pod` products carry one. Reading the field
 * unconditionally is what "made the apparel branch open at qty 25, a £35 tee
 * presented a £875.00 total". The PDP fixed that by resolving the minimum
 * through `product.type.value` and deliberately leaving the catalogue data
 * alone.
 *
 * If this card read the raw field, browse would advertise "min 25" on a tee
 * that the product page then sells you exactly one of. A store contradicting
 * itself between grid and detail is a worse disclosure failure than the silence
 * this meta line was introduced to fix. So the rule is the PDP's rule, and the
 * project convention holds: branch on the resolved product type, never on a
 * metadata heuristic.
 *
 * @param typeValue   `product.type.value`, the canonical discriminator.
 * @param metadata    Raw product metadata (`moq`, `quantity_tiers`).
 * @param priceVaries Whether the product's variants actually differ in price.
 */
export function resolveCardCommerce(
  typeValue: string | null | undefined,
  metadata: Record<string, unknown> | null | undefined,
  priceVaries = false,
): CardCommerce {
  const normalised = String(typeValue ?? '').trim().toLowerCase()

  // Gift cards have no unit economics to describe: denominations, not pieces.
  if (normalised === 'gift-card' || normalised === 'gift_card') {
    return { kind: 'giftcard', moq: 1, fromPrice: priceVaries }
  }

  const isPod = modeFromProductType(typeValue) === 'pod'
  if (!isPod) {
    // Apparel and anything untyped: buy-as-is. The customisation metadata is
    // real but belongs to the studio surface, so it is out of scope here.
    return { kind: 'single', moq: 1, fromPrice: priceVaries }
  }

  // POD: explicit metadata first, then the smallest declared tier, then 1.
  // Mirrors the PDP's `moq` computed exactly so the two can never drift.
  let moq = 1
  const raw = metadata?.moq
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (Number.isFinite(n) && n > 0) {
    moq = Math.floor(n)
  } else {
    const tiers = Array.isArray(metadata?.quantity_tiers)
      ? (metadata!.quantity_tiers as unknown[])
      : []
    const qtys = tiers
      .map((t) => {
        const q = (t as Record<string, unknown>)?.quantity
        const v = typeof q === 'number' ? q : Number(q)
        return Number.isFinite(v) && v > 0 ? Math.floor(v) : null
      })
      .filter((v): v is number => v !== null)
      .sort((a, b) => a - b)
    if (qtys[0]) moq = qtys[0]
  }

  // A POD product with volume tiers quotes a unit price that FALLS as quantity
  // rises, so the displayed figure really is a "from". A POD product without
  // tiers (the sticker packs) is flat-priced and must not claim otherwise.
  const hasTiers = Array.isArray(metadata?.quantity_tiers)
    && (metadata!.quantity_tiers as unknown[]).length > 1

  return {
    kind: moq > 1 ? 'minimum' : 'single',
    moq,
    fromPrice: priceVaries || hasTiers,
  }
}

/**
 * Map a Medusa `product.type.value` (e.g. `'apparel'`, `'pod'`) onto a
 * `CommerceMode` for chip filtering. Returns `null` when the type is unknown
 * or absent, the caller can fall back to its explicit `mode` prop or to
 * `'auto'` so that uncategorised products still render any resolvable chips
 * rather than silently dropping the chip slot.
 */
export function modeFromProductType(
  typeValue: string | null | undefined,
): CommerceMode | null {
  if (!typeValue) return null
  const normalised = String(typeValue).trim().toLowerCase()
  if (normalised === 'apparel') return 'apparel'
  if (normalised === 'pod') return 'pod'
  // Tolerate a couple of obvious aliases without expanding the public API.
  if (normalised === 'shop' || normalised === 'merch') return 'apparel'
  if (normalised === 'studio' || normalised === 'b2b') return 'pod'
  return null
}
