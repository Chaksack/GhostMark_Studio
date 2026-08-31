// ===========================================================================
// productVariant: resolve the ONE fact that tells two near-identical
// catalogue entries apart.
// ===========================================================================
//
// THE PROBLEM THIS EXISTS TO SOLVE
//
// Measured against the live catalogue (26 products, /store/products), 12 of
// them are one half of a near-identical pair whose only difference is encoded
// in a " - " suffix on the title:
//
//   Steel Bottle - 500ml        Steel Bottle - 750ml
//   Insulated Tumbler - Black   Insulated Tumbler - Cream
//   Ceramic Mug - Cream         Ceramic Mug - Sage
//   Studio Notebook - A5        Studio Notebook - A6
//   Studio Tee - Cream          Studio Tee - Charcoal
//   Heavyweight Sweatshirt - Black / - Cream
//
// On a browse card that suffix is the LAST thing in a two-line clamped title,
// which is the least scannable position on the card: the differentiating half
// sits behind a shared prefix that the eye has already read on the card next
// to it. Measured at 1440 on /products, 24 of 24 titles render on one line, so
// every one of those pairs presents as the same string with a tail the reader
// has to work for.
//
// Photography does not rescue it and cannot be made to. Catalogue imagery is
// placeholder (Unsplash) and is assigned per CATEGORY, so "Studio Tee -
// Charcoal" currently shows a cream shirt and "Studio Tee - Cream" shows a
// white one. The photo actively contradicts the colourway. Any fix that leans
// on the image is a fix that works only after real photography lands, and the
// grid has to hold today.
//
// So the differentiator gets promoted out of the title into its own slot with
// a fixed position and a fixed visual weight, which is what makes a column of
// them comparable.
//
// -----------------------------------------------------------------------------
// WHERE THE DATA COMES FROM, in priority order
// -----------------------------------------------------------------------------
//
//  1. A real multi-value `Color` product option. One product has this today
//     (Atelier Hoodie: Faded Black / Bone / Sage / Faded Powder). This is
//     structured data and is always preferred.
//
//  2. The " - " title suffix, classified against an explicit lexicon.
//
//  3. A single-value `Size` option whose value is a real measure rather than
//     a placeholder. This is structured data too and it is how the mugs,
//     candle, tea towel and sticker packs carry their spec:
//        Ceramic Mug   Size[350ml]      Studio Candle  Size[220g]
//        Linen Tea Towel Size[50x70cm]  Sticker Pack   Size[Pack of 8]
//     Values like "One Size" and "Standard" are placeholders and are ignored.
//
// HONEST NOTE ON (2). Reading the title suffix IS a heuristic, and this repo
// has been bitten by heuristics before, which is why commerce mode branches on
// `product.type.value` and never on a guess. The difference is that for these
// nine products the colourway EXISTS NOWHERE ELSE: there is no colour option,
// no metadata key, nothing on the variant. The suffix is the only record of
// it. So the parse is deliberately conservative rather than clever:
//
//   - it splits only on a literal " - " (spaced hyphen), never a bare hyphen,
//     so "Heavyweight Sweatshirt" and "50x70cm" are untouched;
//   - it only splits on the LAST occurrence, so a family name may contain one;
//   - a suffix it cannot classify is left in the title rather than promoted,
//     so an unrecognised word can never be painted as a colour it is not.
//
// The right long-term fix is a real `Color` option (or `metadata.colourway`)
// on those nine products, at which point branch (1) picks them up and branch
// (2) stops firing. Flagged to the backend lane; see coord/GRID.md.
// ===========================================================================

/** A named colour and the ink it paints as a swatch. */
export interface Swatch {
  name: string
  hex: string
}

export interface VariantDescriptor {
  /**
   * How the card should render this:
   *   `swatches`  multi-colourway product: a row of dots plus an overflow count
   *   `colourway` single named colour: one dot plus its name
   *   `spec`      a measure or format (750 ml, A5, 350 ml): mono, tabular
   *   `none`      nothing distinguishing; the card renders a reserved blank
   */
  kind: 'swatches' | 'colourway' | 'spec' | 'none'
  /**
   * The title with a promoted suffix removed. When nothing was promoted this
   * is the title verbatim. NEVER used as the accessible name: the card keeps
   * the full product title for its link label so browse, cart, wishlist and
   * search all announce the same string.
   */
  family: string
  /** Human label for the differentiator. Empty when `kind` is `none`. */
  label: string
  /** Single swatch ink, present when `kind` is `colourway`. */
  swatch?: string
  /** Swatch row, present when `kind` is `swatches`. Capped by the caller. */
  swatches?: Swatch[]
  /** Colourways beyond those in `swatches`. 0 when none were dropped. */
  overflow?: number
}

/**
 * Colour lexicon.
 *
 * Every ink here is drawn from the house palette where one exists, so a
 * swatch is never a new colour entering the system by the back door:
 *
 *   black / charcoal / cream  are the exact inks in `.gm-colour-bar`
 *                             (#1F1C18, #3F3A33, #EDE0D1 in tokens.css)
 *   sage                      is the house sage (#C5C99B)
 *
 * The remainder (oat, bone, powder) are catalogue colours with no house
 * equivalent and are set as the nearest warm neutral in the same family.
 *
 * These are SWATCH FILLS ONLY. None of them is ever used as text or as a
 * background behind text, so none of them needs to clear a text contrast
 * ratio. Perceivability of the swatch as a component is carried by its ring,
 * not by the fill, which is what lets a cream dot sit on a cream page. See
 * `ProductCardVariant.vue`.
 */
const COLOUR_LEXICON: Record<string, string> = {
  black: '#1F1C18',
  'faded black': '#4A4640',
  charcoal: '#3F3A33',
  graphite: '#3F3A33',
  ink: '#1F1C18',
  cream: '#EDE0D1',
  bone: '#E8E2D6',
  oat: '#DCD3C0',
  sand: '#DCD3C0',
  natural: '#E8E2D6',
  white: '#F6F3EE',
  sage: '#C5C99B',
  olive: '#8A8C63',
  'faded powder': '#E3C9C2',
  powder: '#E3C9C2',
  clay: '#C4744F',
  rust: '#8F3F27',
  navy: '#2A3242',
}

/**
 * Does this string read as a measure or a format rather than a colour?
 *
 * Covers every shape the live catalogue actually uses:
 *   750ml  500ml  350ml  220g  50x70cm  A5  A6
 *   Pack of 8   Sheet of 12   1 coaster
 *
 * Anchored at both ends on purpose. A loose test would classify a colour that
 * merely contains a digit, and the failure mode of a wrong classification is a
 * measure rendered as a colour swatch, which is a visible lie.
 */
const MEASURE_RE = /^(?:a[0-9]|\d+(?:\.\d+)?\s*(?:ml|l|g|kg|cm|mm|oz|pt)|\d+\s*x\s*\d+\s*(?:cm|mm|in)?|(?:pack|sheet|set|box)\s+of\s+\d+|\d+\s+\w+)$/i

/**
 * Option values that carry no information and must never become a spec token.
 * "One Size" on a tote tells a shopper nothing that distinguishes it from the
 * tote beside it, which is the entire job of this slot.
 */
const PLACEHOLDER_SIZES = new Set(['one size', 'standard', 'default', 'os', 'universal'])

/** Title-case a lexicon key or a raw colour word for display. */
const titleCase = (s: string): string =>
  s.replace(/\b[a-z]/g, c => c.toUpperCase())

/**
 * Normalise a measure for display: "750ml" becomes "750 ML", "50x70cm"
 * becomes "50x70 CM". The spec slot renders in the mono `.gm-spec` voice with
 * tabular figures, so putting a space between figure and unit lets the digits
 * of "500 ML" and "750 ML" line up vertically down a grid column. That
 * alignment is the whole reason this is a separate slot rather than a suffix.
 */
const formatMeasure = (raw: string): string => {
  const m = raw.trim().match(/^(\d+(?:\.\d+)?(?:\s*x\s*\d+(?:\.\d+)?)?)\s*([a-z]+)$/i)
  if (m) return `${m[1]!.replace(/\s*x\s*/i, 'x')} ${m[2]!.toUpperCase()}`
  return raw.trim().toUpperCase()
}

interface OptionValueLike { value?: string | null }
interface OptionLike { title?: string | null; values?: OptionValueLike[] | null }
interface ProductLike {
  title?: string | null
  options?: OptionLike[] | null
}

const optionByTitle = (product: ProductLike, names: string[]): OptionLike | undefined =>
  (product.options ?? []).find((o) => {
    const t = (o?.title ?? '').trim().toLowerCase()
    return names.includes(t)
  })

const valuesOf = (opt: OptionLike | undefined): string[] =>
  (opt?.values ?? [])
    .map(v => (v?.value ?? '').trim())
    .filter(v => v.length > 0)

/**
 * Resolve the display descriptor for a product card.
 *
 * `maxSwatches` caps the dot row. 4 is the default because the widest live
 * case (Atelier Hoodie) has exactly 4, and because a 2-up mobile card is
 * ~163px wide, where a fifth dot would start competing with the price it
 * shares a row with.
 */
export function resolveVariantDescriptor(
  product: ProductLike | null | undefined,
  maxSwatches = 4,
): VariantDescriptor {
  const title = (product?.title ?? '').trim()
  const none: VariantDescriptor = { kind: 'none', family: title, label: '' }
  if (!product || !title) return none

  // -- 1. A real multi-value colour option. Structured data wins. ----------
  const colourOpt = optionByTitle(product, ['color', 'colour', 'colourway', 'colorway'])
  const colourValues = valuesOf(colourOpt)
  if (colourValues.length > 1) {
    const swatches: Swatch[] = colourValues.slice(0, maxSwatches).map(name => ({
      name,
      // An unknown colour word still gets a dot so the row keeps its shape and
      // the count stays honest; it takes a neutral ink (ink-200) rather than
      // being guessed at, and the accessible name still carries the real word.
      // ink-200 and not the legacy `greyLines`: CHECKOUT measured those two
      // 1.02:1 apart, i.e. the same colour twice, and ruled ink-* canonical.
      hex: COLOUR_LEXICON[name.toLowerCase()] ?? '#D8D4CC',
    }))
    return {
      kind: 'swatches',
      family: title,
      label: `${colourValues.length} colours`,
      swatches,
      overflow: Math.max(0, colourValues.length - swatches.length),
    }
  }

  // -- 2. The " - " title suffix. --------------------------------------------
  // Split on the LAST spaced dash only, so a family name that contains one
  // keeps it. A BARE hyphen is never a split point, which is what protects
  // "Heavyweight Sweatshirt", "50x70cm" and "T-Shirt".
  //
  // All three dash characters are accepted. Measured against the live DB on
  // 2026-08-30, all 15 separators are plain HYPHEN-MINUS (U+002D) and there
  // are zero en or em dashes in any product title, so only the first branch
  // fires today. The other two are here because CHECKOUT flagged the risk
  // that titles carry typographic dashes; that turned out not to be true of
  // this data, but a reseed could make it true tomorrow and the failure mode
  // would be silent: the split simply stops matching and every colourway
  // quietly falls back into the title. Cheap to guard, expensive to notice.
  const match = /^(.*\S)\s+[-–—]\s+(\S.*)$/.exec(title)
  if (match) {
    const family = match[1]!.trim()
    const suffix = match[2]!.trim()

    const hex = COLOUR_LEXICON[suffix.toLowerCase()]
    if (hex) {
      return { kind: 'colourway', family, label: titleCase(suffix), swatch: hex }
    }
    if (MEASURE_RE.test(suffix)) {
      return { kind: 'spec', family, label: formatMeasure(suffix) }
    }
    // Unclassifiable suffix: leave the title whole rather than promote a word
    // we cannot render truthfully. Falls through to the size check below.
  }

  // -- 3. A single-value size option that is a genuine measure. -------------
  const sizeOpt = optionByTitle(product, ['size', 'format', 'volume', 'capacity'])
  const sizeValues = valuesOf(sizeOpt)
  if (sizeValues.length === 1) {
    const v = sizeValues[0]!
    if (!PLACEHOLDER_SIZES.has(v.toLowerCase()) && MEASURE_RE.test(v)) {
      return { kind: 'spec', family: title, label: formatMeasure(v) }
    }
  }

  return none
}
