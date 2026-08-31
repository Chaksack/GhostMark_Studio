// ---------------------------------------------------------------------------
// Cart line item → commerce mode.
//
// Single source of truth for the 5-tier inference chain. Previously duplicated
// across CartDropdown.vue, CartModeBanner.vue, cart.vue, and checkout.vue:
// drift between them was a real risk if the backend taxonomy changed (one
// site updated, three forgotten). All four now route through this module.
//
// Resolution order (first match wins):
//   1. product.type.value: canonical Medusa taxonomy ('apparel' | 'pod')
//   2. line item metadata.commerce_mode
//   3. variant.metadata.commerce_mode
//   4. variant.product.metadata.commerce_mode
//   5. Custom-design signals (line metadata.design_data | preview_url)
//   6. MOQ heuristic: quantity >= 25 → pod
//   7. Default → apparel
//
// Legacy v0 seed metadata used 'shop' / 'studio' as commerce_mode values.
// Those are mapped to 'apparel' / 'pod' respectively for backwards compat;
// once the catalog is fully migrated to product.type.value the metadata path
// becomes vestigial but the cost of carrying it is one branch per check.
//
// Imported explicitly via `import { ... } from '~/utils/cartMode'` to match
// the convention used by sibling utils (~/utils/filters, ~/utils/money,
// ~/utils/chips). Nuxt 4 auto-imports from `app/utils/` are configured but
// every consumer in this codebase still imports explicitly for grep-ability.
// ---------------------------------------------------------------------------

export type CartLineMode = 'apparel' | 'pod'

// MOQ heuristic threshold: kept as the final fallback for legacy lines with
// zero metadata. Matches the bulk/MOQ pivot used by the POD configurator.
const POD_MOQ_FALLBACK = 25

const POD_VALUES = new Set(['pod', 'studio'])
const APPAREL_VALUES = new Set(['apparel', 'shop'])

function classify(raw: unknown): CartLineMode | null {
  const v = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  if (POD_VALUES.has(v)) return 'pod'
  if (APPAREL_VALUES.has(v)) return 'apparel'
  return null
}

/**
 * Resolve the commerce mode for a single cart line item.
 *
 * Defensive optional chaining at every level: legacy carts, partial fetches,
 * or unhydrated line items may be missing any tier. Always returns a concrete
 * mode; never throws.
 */
export function inferLineMode(item: any): CartLineMode {
  // 1. Source of truth: product.type.value (canonical backend taxonomy)
  const fromType = classify(item?.variant?.product?.type?.value)
  if (fromType) return fromType

  // 2. Line-level metadata override (explicit per-line classification)
  const fromLineMeta = classify(item?.metadata?.commerce_mode)
  if (fromLineMeta) return fromLineMeta

  // 3. Variant-level metadata fallback
  const fromVariantMeta = classify(item?.variant?.metadata?.commerce_mode)
  if (fromVariantMeta) return fromVariantMeta

  // 4. Product-level metadata fallback
  const fromProductMeta = classify(item?.variant?.product?.metadata?.commerce_mode)
  if (fromProductMeta) return fromProductMeta

  // 5. Custom-design signals: uploaded designs are POD by definition
  if (item?.metadata?.design_data) return 'pod'
  if (item?.metadata?.preview_url) return 'pod'

  // 6. MOQ heuristic: final fallback for legacy lines with zero metadata
  if ((item?.quantity ?? 0) >= POD_MOQ_FALLBACK) return 'pod'

  // 7. Default: treat as in-stock apparel (D2C path)
  return 'apparel'
}

/**
 * Aggregate mode of an entire cart's line items.
 *
 *   - `'empty'`   when items.length === 0
 *   - `'mixed'`   when both pod + apparel lines are present
 *   - `'pod'`     when every line resolves to pod
 *   - `'apparel'` when every line resolves to apparel
 *
 * Used to drive the mixed-mode delivery banner (cart, checkout) and the
 * estimated-delivery copy on the checkout summary.
 */
export type CartAggregateMode = 'apparel' | 'pod' | 'mixed' | 'empty'

export function inferCartMode(items: any[] | null | undefined): CartAggregateMode {
  if (!items || items.length === 0) return 'empty'
  const modes = new Set(items.map(inferLineMode))
  if (modes.size > 1) return 'mixed'
  return modes.has('pod') ? 'pod' : 'apparel'
}

/**
 * Stable per-line marker for "needs e-proof before production". True for any
 * POD line that doesn't yet have a `preview_url` on its metadata, OR any line
 * that explicitly requests proof / carries uploaded design data.
 *
 * Mirrors the legacy `needsProof` predicate used by CartDropdown + cart.vue:
 * a `requires_proof` flag, custom `design_data`, or a `preview_url` all
 * trigger the badge. The util now centralises that logic so the cart and
 * dropdown can't drift on which signal counts.
 */
export function needsEProof(item: any): boolean {
  const meta = item?.metadata || {}
  return Boolean(meta.requires_proof || meta.design_data || meta.preview_url)
}
