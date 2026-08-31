// =============================================================================
// printMetadata: the ONE parser for a product's print zones and decoration
// techniques.
//
// WHY THIS FILE EXISTS
//   These resolvers were inline computeds in products/[handle].vue. The
//   dedicated design surface at /design/[handle] is a separate ROUTE with no
//   props from the PDP, so it has to resolve the same metadata from the same
//   product object. Copying 60 lines of three-path fallback logic into a second
//   file would have created exactly the failure this repo has already been bitten
//   by: `formatOrderNumber()` is duplicated across four files that must be kept
//   in sync by hand, and the pdf-utils money comment drifted from its own line
//   numbers within a single session.
//
//   So: lift, do not copy. This is a VERBATIM extraction of the [handle].vue
//   logic, behaviour-for-behaviour, verified by diffing parsed output across the
//   whole live catalogue before and after the swap. If you change a rule here you
//   change it for the PDP and the surface at once, which is the point.
//
// PURE BY CONSTRUCTION: no refs, no computeds, no component context. Takes a
// product-shaped object, returns plain data. That is what lets it be tested
// against the catalogue from a plain node script with no browser.
// =============================================================================

export interface PrintArea { x: number; y: number; width: number; height: number }

export interface PrintLocation {
  key: string
  label: string
  mockup_url?: string | null
  area?: PrintArea
}

export interface Technique {
  key: string
  label: string
  surcharge?: number
}

/**
 * The minimum shape these resolvers read. Deliberately structural rather than
 * `StoreProduct`, so the util does not drag a Medusa type into places that only
 * have a partial product (and so the node verification script can feed it raw
 * JSON straight off the store API).
 */
export interface PrintMetadataSource {
  metadata?: Record<string, unknown> | null
  images?: Array<{ url?: string | null }> | null
  thumbnail?: string | null
}

const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])

const titleCase = (s: string): string =>
  s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())

/**
 * `is_customizable` is opt-OUT, not opt-in: absent means customisable.
 * Accepts the string 'false' as well as the boolean because metadata written
 * through the admin JSON editor arrives stringified.
 */
export const isCustomizable = (product: PrintMetadataSource | null | undefined): boolean => {
  const flag = product?.metadata?.is_customizable
  if (flag === false || flag === 'false') return false
  return true
}

/**
 * print_locations resolver with backwards-compat fallback chain:
 *   1. metadata.print_locations  (canonical, set by seed agent)
 *   2. metadata.mockup_front + mockup_back  (legacy 2-zone shape)
 *   3. images[0]/images[1] OR thumbnail  (best-effort default for products
 *      that have no metadata at all but still need a customisation surface)
 *   4. empty array  (only when the product is explicitly not customisable)
 */
export const parsePrintLocations = (
  product: PrintMetadataSource | null | undefined,
): PrintLocation[] => {
  if (!product) return []
  if (!isCustomizable(product)) return []

  const meta = product.metadata ?? {}

  // Path 1: canonical metadata.print_locations
  const raw = asArray(meta.print_locations)
  if (raw.length) {
    return raw
      .map((entry): PrintLocation | null => {
        if (!entry || typeof entry !== 'object') return null
        const e = entry as Record<string, unknown>
        const key = typeof e.key === 'string' ? e.key : null
        if (!key) return null
        const label = typeof e.label === 'string' && e.label
          ? e.label
          : titleCase(key.replace(/-/g, ' '))
        const mockup_url = typeof e.mockup_url === 'string' ? e.mockup_url : null
        const a = e.area as Record<string, unknown> | undefined
        const area = a && typeof a.x === 'number' && typeof a.y === 'number'
          && typeof a.width === 'number' && typeof a.height === 'number'
          ? { x: a.x, y: a.y, width: a.width, height: a.height }
          : undefined
        return { key, label, mockup_url, area }
      })
      .filter((l): l is PrintLocation => l !== null)
  }

  // Path 2: legacy mockup_front / mockup_back metadata.
  const mockupFront = typeof meta.mockup_front === 'string' ? meta.mockup_front : null
  const mockupBack = typeof meta.mockup_back === 'string' ? meta.mockup_back : null
  if (mockupFront || mockupBack) {
    const out: PrintLocation[] = []
    out.push({
      key: 'front',
      label: 'Front',
      mockup_url: mockupFront ?? product.images?.[0]?.url ?? null,
    })
    if (mockupBack || (product.images?.length ?? 0) > 1) {
      out.push({
        key: 'back',
        label: 'Back',
        mockup_url: mockupBack ?? product.images?.[1]?.url ?? null,
      })
    }
    return out
  }

  // Path 3: zero metadata, but flagged customisable. Fall back to a single
  // "Front" zone using the first product image. This keeps the legacy MVP
  // behaviour alive for unmigrated SKUs.
  const fallbackUrl = product.images?.[0]?.url ?? product.thumbnail ?? null
  if (fallbackUrl) {
    return [{ key: 'front', label: 'Front', mockup_url: fallbackUrl }]
  }
  return []
}

/**
 * Decoration techniques, empty array if the merchant hasn't set any.
 *
 * ⚠️ `surcharge` IS MINOR-UNIT MONEY and is passed through UNCONVERTED.
 * DesignEditor.vue's template divides by 100 at the point of display and there
 * is a 17-line comment there explaining why. Do NOT normalise it here: that
 * template is the only consumer, and "helpfully" converting in the parser
 * would silently divide the surcharge twice.
 */
export const parseTechniques = (
  product: PrintMetadataSource | null | undefined,
): Technique[] => {
  const meta = product?.metadata ?? {}
  const raw = asArray(meta.techniques)
  return raw
    .map((entry): Technique | null => {
      if (!entry || typeof entry !== 'object') return null
      const e = entry as Record<string, unknown>
      const key = typeof e.key === 'string' ? e.key : null
      if (!key) return null
      const label = typeof e.label === 'string' && e.label ? e.label : titleCase(key)
      const surcharge = typeof e.surcharge === 'number' ? e.surcharge : undefined
      return { key, label, surcharge }
    })
    .filter((t): t is Technique => t !== null)
}
