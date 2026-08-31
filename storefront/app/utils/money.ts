// ===========================================================================
// !! BRANCH IS NOT MERGEABLE UNTIL THE PRICE MIGRATION HAS RUN !!
//
//   Required first: ghostmark/src/scripts/migrate-price-units.ts --apply
//
// This file no longer divides by 100. The catalogue in the shared database
// is still seeded in the OLD minor-unit convention, so until that migration
// runs the storefront will render 100x too high (a £22 tote shows £2,200).
// That is deliberate and expected on this branch. Do not "fix" it by
// re-adding a division here: that re-creates the bug described below.
// See the landing sequence in the migration script's header.
// ===========================================================================
//
// Shared money formatting helpers: single source of truth for the storefront.
//
// ---------------------------------------------------------------------------
// What is actually established (supersedes the 2026-04-25 note that was here)
// ---------------------------------------------------------------------------
// The previous version of this header observed that a "£22 product" returned
// `calculated_amount = 2200` and concluded the API ships minor units. That
// inference was backwards, and it is the origin of a 100x overcharge:
//
//   1. Medusa v2 stores and returns prices in MAJOR currency units. This is
//      an explicit v1 -> v2 breaking change: "a price of $10.00 is now
//      represented as 10 instead of 1000" (docs.medusajs.com, Introduction >
//      From v1 to v2 > Prices are Stored in Major Units; corroborated by
//      Fundamentals > Data Models > Big Numbers).
//
//   2. So `calculated_amount = 2200` never meant "£22.00 in pence". It meant
//      Medusa was faithfully reporting a price of £2,200.00. The catalogue
//      had been seeded with v1-era minor-unit integers and never migrated.
//
//   3. Dividing by 100 here made the screen look right and nothing else. The
//      backend kept using the real (100x) figure everywhere it mattered.
//      Proof, pulled from `payment_session.data` in the live database: an
//      order with `total = 34000 gbp` produced a Stripe PaymentIntent with
//      `amount: 3400000`; Stripe was asked to charge £34,000.00 while
//      checkout displayed £340.00.
//
// The backend is correct; the storefront was wrong. The fix is therefore in
// two halves that MUST land together:
//      (a) this file stops dividing            <- done, here
//      (b) the seeded amounts are divided once <- migrate-price-units.ts
// Doing only (a) shows £2,200 for a £22 tote and leaves the overcharge fully
// intact. Doing only (b) shows £0.22. Neither half is safe alone.
//
// ---------------------------------------------------------------------------
// Locale
// ---------------------------------------------------------------------------
// Every formatter MUST pass an explicit locale. The seven ad-hoc formatters
// this module replaced used `Intl.NumberFormat(undefined, ...)`, which asks
// the *host* for its default locale: Node's on the SSR pass, the visitor's
// browser on hydration. For any visitor whose browser is not en-GB (say
// `de-DE`: "2.200,00 £" vs "£2,200.00") the server HTML and the client render
// disagree, which is a hydration mismatch by construction, and it fires on
// PDP, cart and checkout simultaneously. `DEFAULT_LOCALE` is a constant so
// both passes are deterministic. If per-visitor locale formatting is ever
// wanted, it must come from a value that is stable across SSR and hydration
// (an i18n cookie or the route), never from `undefined`.
//
// Currency fallback is likewise a single constant. The replaced formatters
// disagreed among themselves ('gbp', 'usd', 'USD'), so the same amount could
// render as £ on the PDP and $ in the cart drawer.
//
// ---------------------------------------------------------------------------
// Conventions
// ---------------------------------------------------------------------------
//   - All callers pass an object so optional args can grow without rewriting
//     every call site.
//   - Unrenderable inputs (null, NaN, missing currency) return the en-dash
//     placeholder `'–'` rather than "NaN", "£0.00" or an empty string, so a
//     loading value never collapses the line height and never reads as free.
//   - `Intl.NumberFormat` failure (e.g. an unknown currency code from a
//     misconfigured region) degrades to a deterministic `"<amount> <CODE>"`
//     string so the UI keeps functioning on malformed data.
// ---------------------------------------------------------------------------

/**
 * Single explicit locale for all monetary formatting. See the "Locale" note
 * above. This must never be `undefined`.
 */
export const DEFAULT_LOCALE = 'en-GB'

/** Currency assumed when a payload carries no currency code of its own. */
export const DEFAULT_CURRENCY = 'GBP'

/** Rendered when an amount cannot be displayed. */
export const PLACEHOLDER = '–'

export interface FormatMoneyInput {
  /**
   * Amount as returned by Medusa v2, in MAJOR currency units
   * (35 means £35.00). No scaling is applied.
   */
  amount?: number | string | null
  /** ISO 4217 currency code. Falls back to `DEFAULT_CURRENCY`. */
  currency_code?: string | null
  /** BCP 47 locale tag. Defaults to `DEFAULT_LOCALE`; keep it deterministic. */
  locale?: string
  /** Override the default 2-decimal rendering. */
  fractionDigits?: number
}

/**
 * Format a Medusa v2 monetary amount.
 *
 * The input is taken as major units and rendered as-is. Returns `'–'` when
 * the input cannot be rendered. Never throws.
 */
export function formatMoney(input: FormatMoneyInput | null | undefined): string {
  if (!input) return PLACEHOLDER
  const {
    amount,
    currency_code,
    locale = DEFAULT_LOCALE,
    fractionDigits = 2,
  } = input

  const numeric = typeof amount === 'string' ? Number(amount) : amount
  if (numeric == null || typeof numeric !== 'number' || !Number.isFinite(numeric)) {
    return PLACEHOLDER
  }

  const code = (currency_code || DEFAULT_CURRENCY).toUpperCase()

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: code,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(numeric)
  }
  catch {
    return `${numeric.toFixed(fractionDigits)} ${code}`
  }
}

/**
 * Same contract as `formatMoney`, but returns `null` instead of the em-dash
 * placeholder when the amount is unrenderable.
 *
 * Several call sites want to hide a whole row (`v-if="shipping"`) rather than
 * print a dash. They previously each hand-rolled a nullable formatter. This
 * keeps that behaviour available without a second implementation.
 */
export function formatMoneyOrNull(input: FormatMoneyInput | null | undefined): string | null {
  const out = formatMoney(input)
  return out === PLACEHOLDER ? null : out
}

/**
 * Numeric-only variant for non-display consumers (JSON-LD `price`, analytics
 * payloads) that need the bare decimal string rather than a currency-styled
 * one. Kept here so those consumers cannot drift back into their own scaling
 * assumptions: that drift is exactly what produced the 100x bug.
 */
export function toAmountString(
  amount: number | string | null | undefined,
  fractionDigits = 2,
): string | null {
  const numeric = typeof amount === 'string' ? Number(amount) : amount
  if (numeric == null || typeof numeric !== 'number' || !Number.isFinite(numeric)) {
    return null
  }
  return numeric.toFixed(fractionDigits)
}

/**
 * Convenience helper for `StoreProductVariant.calculated_price`.
 *
 * The Medusa SDK only populates `calculated_price` when a region or pricing
 * context was passed at fetch time; without one this returns `'–'` rather
 * than a misleading "£0.00".
 */
export function formatVariantPrice(
  variant:
    | {
      calculated_price?: {
        calculated_amount?: number | null
        currency_code?: string | null
      } | null
      // Some seeded products surface `prices[]` instead, preserved for the
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
 * Read the effective amount off a variant, preferring the region-aware
 * `calculated_price` and falling back to the legacy `prices[]` array.
 * Returns `null` when the variant carries no usable price.
 */
export function variantAmount(
  variant:
    | {
      calculated_price?: { calculated_amount?: number | null } | null
      prices?: { amount?: number | null }[] | null
    }
    | null
    | undefined,
): number | null {
  const amt = variant?.calculated_price?.calculated_amount ?? variant?.prices?.[0]?.amount
  return typeof amt === 'number' && Number.isFinite(amt) ? amt : null
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
