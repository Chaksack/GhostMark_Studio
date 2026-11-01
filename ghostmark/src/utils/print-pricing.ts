// =============================================================================
// Print-location surcharge pricing for customised line items.
// =============================================================================
//
// THE RULE
// --------
//   unit_price = (the tier price Medusa would charge for this variant at this
//                 quantity, in the cart's currency)
//              + (the fee of every print location that actually carries
//                 artwork, in the cart's currency)
//
// The storefront NEVER supplies a price. It supplies a variant, a quantity and
// the design payload; everything that costs money is read here from the
// product record and the pricing module.
//
// WHERE THE FEES LIVE
// -------------------
// On each entry of `product.metadata.print_locations`, as major units keyed by
// lower-case currency code:
//
//     { key: "front", label: "Front (chest)", area: {...},
//       surcharge: { gbp: 8, eur: 9, usd: 10 } }
//
// A location with NO `surcharge` at all costs nothing to print. That is the
// state of every product until a merchant sets one in admin, and it preserves
// today's behaviour (customising was free) rather than inventing a price.
//
// A location with a `surcharge` that lacks the cart's currency is REFUSED,
// never treated as zero. A merchant who priced the front at £8 and forgot EUR
// has not decided EUR customers print for free, and silently charging €0 is
// how that mistake would reach production unnoticed.
//
// WHY THE BASE PRICE IS RESOLVED HERE AND NOT READ FROM THE VARIANT
// -----------------------------------------------------------------
// A line added with an explicit `unit_price` is a custom-price line: Medusa
// stops pricing it (`is_custom_price`). So the tier ladder, which the cart
// normally applies by putting the line quantity into the pricing context
// (core-flows get-variants-and-items-with-prices.js), would stop applying.
// We make the SAME `calculatePrices` call with the SAME context shape the cart
// does, so a customised line still gets the tier its quantity earns.
// See also api/store/products/[id]/tier-prices/route.ts, which does the same.
// =============================================================================

import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { defaultStoreCartFields } from "@medusajs/medusa/api/store/carts/query-config"

/** Round money to 2dp. Never Math.round() a major-unit amount to whole units. */
export const money2 = (n: number): number => Math.round(n * 100) / 100

export const MAX_CUSTOM_QUANTITY = 10_000
/** A design payload is positions/scales/URLs. 200 KB is generous; 20 MB is abuse. */
export const MAX_DESIGN_JSON_BYTES = 200_000

export type PrintLocation = {
  key: string
  label: string
  surcharge: Record<string, number> | null
}

export type LocationFee = { key: string; label: string; amount: number }

export type PrintSurcharge = {
  currency_code: string
  base_unit: number
  fee_per_unit: number
  locations: LocationFee[]
}

export class CustomisationError extends Error {
  constructor(message: string, readonly status: 400 | 404 | 422 = 422) {
    super(message)
    this.name = "CustomisationError"
  }
}

// -----------------------------------------------------------------------------
// Pure helpers (unit-tested in utils/__tests__/print-pricing.unit.spec.ts)
// -----------------------------------------------------------------------------

/** Read print locations off product metadata, tolerating seeded string JSON. */
export function readPrintLocations(metadata: Record<string, unknown> | null | undefined): PrintLocation[] {
  let raw: unknown = metadata?.print_locations
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw)
    } catch {
      return []
    }
  }
  if (!Array.isArray(raw)) return []
  const out: PrintLocation[] = []
  for (const loc of raw) {
    if (!loc || typeof loc !== "object") continue
    const key = (loc as any).key
    if (typeof key !== "string" || !key) continue
    const label = typeof (loc as any).label === "string" && (loc as any).label ? (loc as any).label : key
    out.push({ key, label, surcharge: readSurcharge((loc as any).surcharge) })
  }
  return out
}

function readSurcharge(raw: unknown): Record<string, number> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const out: Record<string, number> = {}
  for (const [cur, amt] of Object.entries(raw as Record<string, unknown>)) {
    const n = typeof amt === "number" ? amt : Number(amt)
    if (/^[a-z]{3}$/i.test(cur) && Number.isFinite(n) && n >= 0) out[cur.toLowerCase()] = money2(n)
  }
  return Object.keys(out).length ? out : null
}

/** Is this a path our own upload handler wrote? Same rule the editor restores by. */
export function isUploadPath(url: unknown): url is string {
  return typeof url === "string" && url.startsWith("/uploads/") && !url.startsWith("//") && !url.includes("..")
}

/**
 * Parse the design payload and return the print-location keys that carry
 * artwork, restricted to the product's real locations.
 *
 * Throws when the payload is malformed, names a location the product does not
 * have, carries artwork URLs that are not our own uploads, or carries no
 * artwork at all (a "customised" line with nothing printed on it is a plain
 * line, and must go through the plain route).
 */
export function chargedLocationKeys(designDataJson: unknown, locations: PrintLocation[]): string[] {
  if (typeof designDataJson !== "string" || !designDataJson) {
    throw new CustomisationError("designDataJson must be a non-empty JSON string.", 400)
  }
  if (Buffer.byteLength(designDataJson, "utf8") > MAX_DESIGN_JSON_BYTES) {
    throw new CustomisationError("designDataJson is too large.", 400)
  }
  let parsed: any
  try {
    parsed = JSON.parse(designDataJson)
  } catch {
    throw new CustomisationError("designDataJson is not valid JSON.", 400)
  }
  const designs = parsed?.designs
  if (!designs || typeof designs !== "object" || Array.isArray(designs)) {
    throw new CustomisationError("designDataJson.designs is missing.", 400)
  }

  const valid = new Set(locations.map((l) => l.key))
  const keys: string[] = []
  for (const [key, side] of Object.entries(designs as Record<string, any>)) {
    if (side === null || side === undefined) continue
    if (!valid.has(key)) {
      throw new CustomisationError(`"${key}" is not a print location on this product.`, 400)
    }
    // Every URL we persist on a line item must be one we served. The admin
    // widget and the order email both turn these into links.
    for (const field of ["imageUrl", "originalUrl"] as const) {
      const v = side?.[field]
      if (v !== null && v !== undefined && !isUploadPath(v)) {
        throw new CustomisationError(`designs.${key}.${field} must be an uploaded file path.`, 400)
      }
    }
    if (!isUploadPath(side?.originalUrl) && !isUploadPath(side?.imageUrl)) continue
    keys.push(key)
  }
  if (!keys.length) {
    throw new CustomisationError("The design carries no artwork on any print location.", 400)
  }
  return keys
}

/** Fees for the charged locations in one currency. Refuses a partially priced location. */
export function locationFees(locations: PrintLocation[], keys: string[], currencyCode: string): LocationFee[] {
  const cur = currencyCode.toLowerCase()
  return keys.map((key) => {
    const loc = locations.find((l) => l.key === key)!
    if (!loc.surcharge) return { key, label: loc.label, amount: 0 }
    const amount = loc.surcharge[cur]
    if (amount === undefined) {
      throw new CustomisationError(
        `Printing on "${loc.label}" is not priced in ${cur.toUpperCase()} yet.`,
        422,
      )
    }
    return { key, label: loc.label, amount }
  })
}

export function validateQuantity(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw)
  if (!Number.isInteger(n) || n < 1 || n > MAX_CUSTOM_QUANTITY) {
    throw new CustomisationError(`quantity must be a whole number between 1 and ${MAX_CUSTOM_QUANTITY}.`, 400)
  }
  return n
}

/**
 * Made-to-order (studio lane) products keep their minimum when customised;
 * shop products can be customised one at a time.
 */
export function minimumFor(metadata: Record<string, unknown> | null | undefined): number {
  if (String(metadata?.commerce_mode ?? "").toLowerCase() !== "studio") return 1
  const n = Number(metadata?.moq)
  return Number.isInteger(n) && n > 1 ? n : 1
}

export function isCustomisable(metadata: Record<string, unknown> | null | undefined): boolean {
  const v = metadata?.is_customizable
  return v === true || v === "true"
}

// -----------------------------------------------------------------------------
// Pricing-module bound pieces
// -----------------------------------------------------------------------------

type Scope = { resolve: (key: string) => any }

export type CartPricingContext = {
  id: string
  currency_code: string
  region_id: string | null
  customer_id: string | null
}

export async function loadCartContext(scope: Scope, cartId: string): Promise<CartPricingContext> {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "cart",
    fields: ["id", "currency_code", "region_id", "customer_id", "completed_at"],
    filters: { id: cartId },
  })
  const cart = data?.[0]
  if (!cart) throw new CustomisationError(`Cart ${cartId} not found.`, 404)
  if (cart.completed_at) throw new CustomisationError("This cart has already been checked out.", 422)
  return {
    id: cart.id,
    currency_code: String(cart.currency_code).toLowerCase(),
    region_id: cart.region_id ?? null,
    customer_id: cart.customer_id ?? null,
  }
}

export type VariantProduct = {
  variant_id: string
  product_id: string
  metadata: Record<string, unknown>
  price_set_id: string
}

export async function loadVariantProduct(scope: Scope, variantId: string): Promise<VariantProduct> {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "variant",
    fields: ["id", "product.id", "product.metadata", "price_set.id"],
    filters: { id: variantId },
  })
  const v = data?.[0]
  if (!v?.product) throw new CustomisationError(`Variant ${variantId} not found.`, 404)
  if (!v.price_set?.id) throw new CustomisationError(`Variant ${variantId} has no prices.`, 422)
  return {
    variant_id: v.id,
    product_id: v.product.id,
    metadata: (v.product.metadata ?? {}) as Record<string, unknown>,
    price_set_id: v.price_set.id,
  }
}

/** The unit price the cart would charge this variant at this quantity. */
export async function tierUnitPrice(
  scope: Scope,
  cart: CartPricingContext,
  priceSetId: string,
  quantity: number,
): Promise<number> {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const pricing = scope.resolve(Modules.PRICING)

  const context: Record<string, unknown> = { currency_code: cart.currency_code, quantity }
  if (cart.region_id) context.region_id = cart.region_id
  if (cart.customer_id) {
    const { data: groups } = await query.graph({
      entity: "customer_group",
      fields: ["id"],
      filters: { customers: { id: cart.customer_id } },
    })
    if (groups?.length) context.customer = { groups: groups.map((g: any) => ({ id: g.id })) }
  }

  const [calc] = (await pricing.calculatePrices({ id: [priceSetId] }, { context })) ?? []
  if (!calc || calc.calculated_amount === null || calc.calculated_amount === undefined) {
    throw new CustomisationError(`This product is not priced in ${cart.currency_code.toUpperCase()}.`, 422)
  }
  return money2(Number(calc.calculated_amount))
}

export type CustomisedQuote = {
  quantity: number
  unit_price: number
  surcharge: PrintSurcharge
}

/** Price a NEW customised line from the product record. */
export async function quoteCustomisedLine(
  scope: Scope,
  cart: CartPricingContext,
  variantId: string,
  rawQuantity: unknown,
  designDataJson: unknown,
): Promise<CustomisedQuote & { product: VariantProduct }> {
  const quantity = validateQuantity(rawQuantity)
  const product = await loadVariantProduct(scope, variantId)
  if (!isCustomisable(product.metadata)) {
    throw new CustomisationError("This product cannot be customised.", 422)
  }
  const locations = readPrintLocations(product.metadata)
  if (!locations.length) throw new CustomisationError("This product has no print locations.", 422)

  const min = minimumFor(product.metadata)
  if (quantity < min) throw new CustomisationError(`This product is made to order: the minimum is ${min}.`, 422)

  const keys = chargedLocationKeys(designDataJson, locations)
  const fees = locationFees(locations, keys, cart.currency_code)
  const base = await tierUnitPrice(scope, cart, product.price_set_id, quantity)
  const feePerUnit = money2(fees.reduce((s, f) => s + f.amount, 0))

  return {
    product,
    quantity,
    unit_price: money2(base + feePerUnit),
    surcharge: { currency_code: cart.currency_code, base_unit: base, fee_per_unit: feePerUnit, locations: fees },
  }
}

/**
 * Re-price an EXISTING customised line at a new quantity. The base re-tiers;
 * the fee stays what the customer was quoted when they added it, because that
 * is the price they agreed to and only our own route can write it.
 */
export async function requoteCustomisedLine(
  scope: Scope,
  cart: CartPricingContext,
  line: { variant_id: string; metadata: Record<string, any> | null },
  rawQuantity: unknown,
): Promise<CustomisedQuote> {
  const quantity = validateQuantity(rawQuantity)
  const stored = line.metadata?.printSurcharge as PrintSurcharge | undefined
  if (!line.metadata?.isCustomized || !stored || typeof stored.fee_per_unit !== "number") {
    throw new CustomisationError("This line is not a priced customised item.", 422)
  }
  if (stored.currency_code !== cart.currency_code) {
    throw new CustomisationError("This line was priced in another currency.", 422)
  }
  const product = await loadVariantProduct(scope, line.variant_id)
  const min = minimumFor(product.metadata)
  if (quantity < min) throw new CustomisationError(`This product is made to order: the minimum is ${min}.`, 422)

  const base = await tierUnitPrice(scope, cart, product.price_set_id, quantity)
  return {
    quantity,
    unit_price: money2(base + stored.fee_per_unit),
    surcharge: { ...stored, base_unit: base },
  }
}

/**
 * The fields a store cart response carries, in the form query.graph accepts.
 * `defaultStoreCartFields` uses the `*relation` shorthand, which core routes
 * expand in their query middleware before use; our routes do not run that
 * middleware, so passing the raw list fails with
 * "Entity 'Cart' does not have property '*region'".
 */
export const storeCartFields: string[] = defaultStoreCartFields.map((f: string) =>
  f.startsWith("*") ? `${f.slice(1)}.*` : f,
)

/** Translate our error into the Medusa error the HTTP layer renders. */
export function toMedusaError(e: unknown): unknown {
  if (!(e instanceof CustomisationError)) return e
  const type =
    e.status === 404 ? MedusaError.Types.NOT_FOUND
      : e.status === 400 ? MedusaError.Types.INVALID_DATA
        : MedusaError.Types.NOT_ALLOWED
  return new MedusaError(type, e.message)
}
