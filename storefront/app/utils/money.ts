// ---------------------------------------------------------------------------
// Shared money formatting helpers — single source of truth for the storefront.
//
// Backend convention (verified 2026-04-25 against the local Medusa instance):
//   - GET /store/products?fields=*variants.calculated_price returns
//     `calculated_price.calculated_amount = 2200` for a £22 product.
//   - GET /store/carts/:id returns `cart.subtotal = 2200`,
//     `items[0].unit_price = 2200`, `items[0].total = 2200` for the same item.
//
//   => This deployment ships amounts in MINOR currency units (pence / cents).
//      The Medusa V2 docs note the API CAN expose major-unit decimals, but
//      our region/currency/store config is plainly returning integer minor
//      units. Convert here, in exactly one place.
//
// If the backend ever flips to major-unit decimals, pass `isMinor: false` at
// the call site (or change the divisor constant) — every consumer is funnelled
// through these helpers.
//
// Conventions:
//   - All callers pass an object so optional args (locale, fractionDigits,
//     isMinor) can grow without rewriting every call site.
//   - Unrenderable inputs (null, NaN, missing currency) return the em-dash
//     placeholder `'—'`. This matches the existing convention in
//     `pages/cart.vue` and `pages/account/orders/[id].vue` and prevents the
//     UI from collapsing the line height when a value is loading.
//   - We intentionally fall through `Intl.NumberFormat` failure (e.g. an
//     unknown currency code from a misconfigured region) to a deterministic
//     `"<amount> <CODE>"` string so the UI never shows "NaN" or blanks.
// ---------------------------------------------------------------------------

const MINOR_UNITS_PER_MAJOR = 100
const PLACEHOLDER = '—'

export interface FormatMoneyInput {
  /** Amount as returned by Medusa V2 (minor units by default — see `isMinor`). */
  amount?: number | string | null
  /** ISO 4217 currency code. Falls back to GBP. */
  currency_code?: string | null
  /** BCP 47 locale tag. Defaults to `en-GB` to match storefront copy. */
  locale?: string
  /** Override the default 2-decimal rendering. */
  fractionDigits?: number
  /**
   * If the value is already a major-unit decimal (e.g. 35 for £35.00) pass
   * `false` to skip the ÷100 conversion. Defaults to `true` because every
   * known producer in this codebase emits minor units.
   */
  isMinor?: boolean
}

/**
 * Format a Medusa V2 monetary amount.
 *
 * Returns `'—'` when the input cannot be rendered. Never throws: an unknown
 * currency code degrades to a `${amount} ${CODE}` string so the UI keeps
 * functioning even with malformed data.
 */
export function formatMoney(input: FormatMoneyInput | null | undefined): string {
  if (!input) return PLACEHOLDER
  const {
    amount,
    currency_code,
    locale = 'en-GB',
    fractionDigits = 2,
    isMinor = true,
  } = input

  const numeric = typeof amount === 'string' ? Number(amount) : amount
  if (numeric == null || typeof numeric !== 'number' || !Number.isFinite(numeric)) {
    return PLACEHOLDER
  }

  const value = isMinor ? numeric / MINOR_UNITS_PER_MAJOR : numeric
  const code = (currency_code || 'GBP').toUpperCase()

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: code,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(value)
  }
  catch {
    return `${value.toFixed(fractionDigits)} ${code}`
  }
}

/**
 * Convenience helper for `StoreProductVariant.calculated_price`.
 *
 * The Medusa SDK only populates `calculated_price` when a region or pricing
 * context was passed at fetch time — without one this returns `'—'` rather
 * than a misleading "£0.00".
 */
export function formatVariantPrice(
  variant:
    | {
      calculated_price?: {
        calculated_amount?: number | null
        currency_code?: string | null
      } | null
      // Some seeded products surface `prices[]` instead — preserved for the
      // legacy fixtures the design system was wired against pre-region.
      prices?: { amount?: number | null, currency_code?: string | null }[] | null
    }
    | null
    | undefined,
  currencyCode?: string | null,
): string {
  if (!variant) return PLACEHOLDER
  const cp = variant.calculated_price
  const fallback = variant.prices?.[0]
  const amount = cp?.calculated_amount ?? fallback?.amount ?? null
  const code = currencyCode ?? cp?.currency_code ?? fallback?.currency_code ?? null
  return formatMoney({ amount, currency_code: code })
}

/**
 * Pick the lowest-priced variant from a product, comparing on
 * `calculated_price.calculated_amount`. Variants without a calculated price
 * are skipped (so a product with one priced + one unpriced variant still
 * yields a useful "From" price). Returns `null` when nothing is priced.
 */
export function cheapestVariant<
  V extends { calculated_price?: { calculated_amount?: number | null } | null },
>(variants: V[] | null | undefined): V | null {
  if (!variants?.length) return null
  let best: V | null = null
  let bestAmount = Number.POSITIVE_INFINITY
  for (const v of variants) {
    const amt = v?.calculated_price?.calculated_amount
    if (typeof amt !== 'number' || !Number.isFinite(amt)) continue
    if (amt < bestAmount) {
      bestAmount = amt
      best = v
    }
  }
  return best
}
