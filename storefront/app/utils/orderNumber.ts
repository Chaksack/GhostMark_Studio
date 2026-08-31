// ---------------------------------------------------------------------------
// orderNumber: the ONE storefront definition of the customer-facing order id.
//
// WHY THIS FILE EXISTS
//   `formatOrderNumber()` was declared inline in checkout.vue's <script setup>,
//   which meant it was not exported and therefore not importable. The moment a
//   second storefront surface needed to render the same id (the confirmation
//   route at /order/confirmed/[number]) the only options were "copy it" or
//   "lift it". printMetadata.ts already documents this exact repo bruise:
//   this function is the standing example of hand-synced duplication. Adding
//   another copy to fix a duplication bug would have been absurd, so: LIFT.
//
//   Net effect on the duplicate count: it goes DOWN, not up. checkout.vue no
//   longer declares its own; it imports this one, as does the confirmation page.
//
// REMAINING COPIES, DELIBERATELY NOT TOUCHED (different package, no shared
// module graph with the storefront — a storefront util cannot be imported by
// the Medusa backend):
//   ghostmark/src/subscribers/order-notifications.ts   (confirmation email)
//   ghostmark/src/scripts/backfill-order-number.ts     (metadata backfill)
//
//   CRITICAL: those two and this one MUST render the same string. The email and
//   the confirmation page name the same order; a divergence is a support ticket
//   every single time. Change the format in all three in the same commit.
//
// FORMAT: `GMS-<ULID>`, derived from Medusa's internal `order.id`
//   order_01KTD3WAPW1S99VDWFP789Z455  ->  GMS-01KTD3WAPW1S99VDWFP789Z455
//
// We use the ULID rather than Medusa's auto-increment `display_id` because the
// integer leaks order velocity (#3 tells a competitor we have shipped two
// orders before this one) and is not unique enough to quote in support.
// ---------------------------------------------------------------------------

/** The namespace every customer-facing GhostMark order number carries. */
export const ORDER_NUMBER_PREFIX = 'GMS-'

/** Medusa prefixes every order ULID with this. */
const MEDUSA_ORDER_PREFIX = 'order_'

/**
 * Internal Medusa order id -> customer-facing order number.
 *
 * Idempotent: re-running on an already-formatted id returns it unchanged, so it
 * is safe to call on a value of unknown provenance (e.g. a route param that may
 * already be in display form).
 *
 * Returns `null` for a missing id so callers can `v-if` the row out rather than
 * rendering "GMS-null".
 */
export function formatOrderNumber(internalId: string | null | undefined): string | null {
  if (!internalId) return null
  if (internalId.startsWith(ORDER_NUMBER_PREFIX)) return internalId
  return `${ORDER_NUMBER_PREFIX}${internalId.replace(new RegExp(`^${MEDUSA_ORDER_PREFIX}`), '')}`
}

/**
 * The inverse: customer-facing order number -> internal Medusa order id.
 *
 * This is what makes `GMS-<ULID>` usable as a URL segment. The confirmation
 * route is addressed by the number the customer can actually read off their
 * email, and this turns it back into something the Store API will accept.
 *
 * Also idempotent, and tolerant of the two things people actually paste:
 * lowercase (URLs get lowercased by well-meaning clients and email scanners)
 * and surrounding whitespace.
 *
 * Returns `null` when the input cannot be a valid order number. Callers MUST
 * treat null as "not found" and must not fall through to an unfiltered lookup:
 * that is the difference between a 404 and an enumeration primitive.
 */
export function parseOrderNumber(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = String(value).trim()
  if (!trimmed) return null

  // Strip whichever prefix is present, case-insensitively, then normalise.
  const bare = trimmed
    .replace(/^GMS-/i, '')
    .replace(/^order_/i, '')
    .toUpperCase()

  // A Crockford base32 ULID: 26 chars, no I/L/O/U. Anything else is not an
  // order id we issued, and we refuse it here rather than forwarding junk to
  // the backend.
  if (!/^[0-9A-HJKMNP-TV-Z]{26}$/.test(bare)) return null

  return `${MEDUSA_ORDER_PREFIX}${bare}`
}
