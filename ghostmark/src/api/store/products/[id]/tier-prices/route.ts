// =============================================================================
// GET /store/products/:id/tier-prices
//
// Returns the quantity-price ladder for a product's variants, RESOLVED THROUGH
// THE SAME PRICING MODULE THE CART USES. This is the endpoint that lets the PDP
// stop deriving prices from `product.metadata.quantity_tiers`.
//
//   /store/products/prod_123/tier-prices?region_id=reg_123
//   /store/products/prod_123/tier-prices?region_id=reg_123&variant_id=variant_9
//   /store/products/prod_123/tier-prices?currency_code=gbp
//   /store/products/prod_123/tier-prices?region_id=reg_123&from_quantity=25
//
// -----------------------------------------------------------------------------
// WHY THIS EXISTS
// -----------------------------------------------------------------------------
// Medusa's Store product endpoints cannot answer "what does this cost at
// quantity 250?". `setPricingContext`
// (@medusajs/medusa/dist/api/utils/middlewares/products/set-pricing-context.js)
// builds the whole pricing context as:
//
//     const pricingContext = { region_id: region.id, currency_code: region.currency_code }
//     // + customer.groups when authenticated
//
// There is no `quantity` query parameter on /store/products or
// /store/product-variants, so `variant.calculated_price` is ALWAYS the
// quantity-1 price. That gap is why the ladder was mirrored into product
// metadata in the first place, and that mirror caused two production defects in
// one day: a ladder that was advertised but never charged, and then metadata
// keeping minor units after the price table moved to major.
//
// The cart resolves a line by putting the line quantity into the pricing
// context (@medusajs/core-flows/dist/cart/workflows/get-variants-and-items-with-prices.js):
//
//     context: { ...baseContext, quantity: item.quantity }
//     const calculatedPriceSets = await pricingService.calculatePrices({ id: priceSetIds }, { context })
//     input.unitPrice = calculatedPriceSet.calculated_amount
//
// This route makes the SAME call with the SAME context shape, so what the PDP
// renders and what the cart charges cannot diverge, they are the same number
// from the same resolver.
//
// -----------------------------------------------------------------------------
// CONTRACT: agreed with the storefront owner of products/[handle].vue.
// Do not change these without talking to that call site first.
// -----------------------------------------------------------------------------
//  1. KEYED BY VARIANT, never by product. A product-level ladder works only
//     while every variant shares a price. That is true of this catalogue today
//     (32/32 variants of atelier-hoodie agree at every rung) but it is an
//     observation about current data, NOT a guarantee. The first size-based
//     price would make a product-keyed route quote a figure the cart refuses,
//     and it would fail on the button. So the response is always per variant.
//
//  2. RETURNS line_total FOR EVERY RUNG, INCLUDING THE FIRST. The caller must
//     NOT compute quantity * unit_amount itself: that recreates a second source
//     of truth in JavaScript, which is exactly the class of bug this route
//     removes. We return the number we would charge.
//
//     `from_quantity` exists to keep that promise honest. Without it the first
//     rung is always quantity 1, so a storefront with a minimum order quantity
//     had to multiply the FIRST rung itself, and the first rung is the
//     default-selected option, i.e. the headline price of every POD product and
//     the number most customers actually read and buy at. Leaving exactly that
//     one to the client was the worst possible place to split the arithmetic.
//     Three of four line totals computed server-side and the fourth left to JS
//     is not a boundary, it is a bug waiting for a rounding change.
//
//     This does NOT put policy in the pricing layer. The route never reads
//     `metadata.moq`, has no concept of a minimum order, and enforces nothing:
//     it accepts any floor from any caller for any reason. The STOREFRONT reads
//     metadata.moq and passes it. Policy stays in metadata and at the call site;
//     only the multiplication moved, and multiplication was always ours, that
//     is what line_total is. The quantity a customer is quoted at is an INPUT to
//     a price calculation, not a leak of policy into it.
//
//  3. NO save_pct. That is presentation, it needs a baseline choice (cheapest
//     rung vs the rung below) and it is not money. It belongs to the caller.
//
//  4. currency_code IS REPEATED ON EVERY RUNG, not just at the top level. It
//     costs nothing and it means a partially-resolved ladder can never silently
//     mix currencies.
//
//  5. A FLAT-PRICED VARIANT IS 200 WITH `tiers: [...]` CONTAINING JUST THE BASE
//     RUNG, never a 404. "This variant has no volume discount" is a legitimate
//     state, not an error, and forcing the caller to treat it as one guarantees
//     it gets mishandled.
//
// -----------------------------------------------------------------------------
// from_quantity: ANCHORING THE LADDER
// -----------------------------------------------------------------------------
// Optional positive integer. Anchors the ladder at a caller-supplied floor:
// rungs below it are dropped, and the floor itself is emitted as a rung priced
// at whatever price applies AT that quantity, with line_total computed here.
//
//   tech-pouch, from_quantity=25   ->  25 @ 32     total 800
//                                      50 @ 29.44  total 1472
//                                      100 @ 27.2  total 2720
//                                      250 @ 24.96 total 6240
//
// Omitted, or 1, is byte-identical to the unanchored response. Flat-priced and
// no-minimum products are therefore unaffected.
//
// NAMING: this is `from_quantity`, NOT `min_quantity`, deliberately. `min_quantity`
// is a COLUMN on the `price` table meaning "this price row applies from N units".
// Reusing that name for a request filter would put two different meanings on one
// word in a file that reads both, and the next person would reasonably assume it
// filters price rows by their own min_quantity. It does not, it selects which
// QUANTITIES to quote.
//
// ORDER MATTERS: anchoring happens BEFORE duplicate-rung collapsing. Collapsing
// first would let a floor of 25 be absorbed into the quantity-1 rung and vanish
// from the response. Because collapsing keeps the FIRST rung of any equal-priced
// run, and the anchor is always first, the anchor rung can never be the one
// dropped.
//
// -----------------------------------------------------------------------------
// BREAKPOINTS COME FROM THE PRICE TABLE, NOT FROM METADATA
// -----------------------------------------------------------------------------
//     SELECT DISTINCT min_quantity FROM price
//      WHERE price_set_id = ANY(...) AND deleted_at IS NULL
//        AND min_quantity IS NOT NULL AND currency_code = ...
//
// so the ladder's shape and its prices come from one place. Nothing here reads
// `metadata.quantity_tiers`. Once the PDP calls this route, that metadata key
// should be DELETED rather than left populated as a fallback, a populated
// fallback is a second price source that activates precisely when the first is
// unavailable, i.e. it quotes from unvalidated data at the exact moment nothing
// can check it. That is how the original defect survived.
//
// -----------------------------------------------------------------------------
// NO N+1
// -----------------------------------------------------------------------------
// One SQL query for the variants and their price sets, one for the breakpoints,
// then ONE calculatePrices call per distinct breakpoint covering ALL price sets
// at once (the pricing module accepts an array of price set ids). So the number
// of module calls is the number of rungs (typically 4 to 7) and does NOT grow
// with the number of variants. A 32-variant product costs the same as a
// 1-variant one.
//
// -----------------------------------------------------------------------------
// CACHING: DELIBERATELY NONE, AND HERE IS THE REASONING
// -----------------------------------------------------------------------------
// This route sends `Cache-Control: private, no-store`.
//
// That is a deliberate choice, not an oversight. A stale price here has exactly
// the same customer-visible shape as the bug this route exists to remove: a
// page quoting a number the cart will not honour. The window between an admin
// price edit and a cache expiry is a window in which the storefront lies, and
// it is indistinguishable to the customer from the defect we just spent three
// migrations fixing.
//
// The work is cheap enough not to need it: two indexed SELECTs plus N small
// resolver calls where N is the rung count, all on primary-key/indexed paths
// (`IDX_price_price_set_id` covers the hot one).
//
// IF a cache is ever added, these are the terms:
//   KEY          (variant_id, currency_code). Region only matters via the
//                currency it resolves to, and via customer-group rules, so if
//                group pricing is ever used on these variants, the customer
//                group set MUST enter the key or authenticated users will be
//                served each other's prices.
//   INVALIDATED  by any INSERT/UPDATE/DELETE on a `price` row belonging to that
//                variant's price set. In practice: an admin price edit
//                (updateProductVariantsWorkflow -> price set update), a price
//                list activating or expiring, and any of the pricing migrations
//                in src/scripts.
//   THE TRAP     Medusa does not emit a reliable "this price set changed" event
//                to subscribe to, which is precisely why time-based expiry is
//                tempting and precisely why it is wrong here. Do not add a TTL
//                cache and call it invalidation.
//
// -----------------------------------------------------------------------------
// AUTH
// -----------------------------------------------------------------------------
// This returns nothing a customer cannot already obtain by adding items to a
// cart, so it is readable like the rest of /store. Customer groups ARE honoured
// when the request is authenticated, mirroring setPricingContext, so a customer
// with group pricing sees on the PDP what they will be charged.
// =============================================================================

// MedusaStoreRequest, not MedusaRequest: it is the /store variant whose
// `auth_context` is OPTIONAL (framework/dist/http/types.d.ts:157). This route
// works for guests and honours customer-group pricing when signed in, so an
// optional auth context is exactly the right shape, AuthenticatedMedusaRequest
// would wrongly assert the customer is always present.
import { MedusaStoreRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

/** Round money to 2dp. NEVER Math.round() a major-unit amount to whole units. */
const money2 = (n: number): number => Math.round(n * 100) / 100

type Rung = {
  quantity: number
  unit_amount: number
  line_total: number
  currency_code: string
}

export async function GET(req: MedusaStoreRequest, res: MedusaResponse) {
  const productId = req.params.id
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const knex: any = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const pricing: any = req.scope.resolve(Modules.PRICING)

  const variantId = (req.query.variant_id as string) || null
  const regionId = (req.query.region_id as string) || null

  // Optional ladder anchor. See "from_quantity" in the header.
  const rawFrom = req.query.from_quantity
  let fromQuantity = 1
  if (rawFrom !== undefined && rawFrom !== null && rawFrom !== "") {
    const n = Number(rawFrom)
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
      return res.status(400).json({
        message:
          `from_quantity must be a positive integer if supplied; received ` +
          `${JSON.stringify(rawFrom)}.`,
      })
    }
    fromQuantity = n
  }
  let currencyCode = ((req.query.currency_code as string) || "").toLowerCase() || null

  // -- Resolve currency, preferring the region (mirrors setPricingContext) -----
  if (!currencyCode) {
    if (!regionId) {
      return res.status(400).json({
        message:
          "Either region_id or currency_code is required to price a ladder.",
      })
    }
    const { data: regions } = await query.graph({
      entity: "region",
      fields: ["id", "currency_code"],
      filters: { id: regionId },
    })
    if (!regions?.length) {
      return res.status(404).json({ message: `Region ${regionId} not found.` })
    }
    currencyCode = String(regions[0].currency_code).toLowerCase()
  }

  // -- Variants + their price sets, one query ---------------------------------
  const { rows: variantRows } = await knex.raw(
    `SELECT v.id AS variant_id, vps.price_set_id
       FROM product_variant v
       JOIN product_variant_price_set vps
         ON vps.variant_id = v.id AND vps.deleted_at IS NULL
      WHERE v.deleted_at IS NULL
        AND v.product_id = ?
        ${variantId ? "AND v.id = ?" : ""}
      ORDER BY v.id`,
    variantId ? [productId, variantId] : [productId],
  )

  if (!variantRows.length) {
    return res.status(404).json({
      message: variantId
        ? `Variant ${variantId} not found on product ${productId}, or it has no prices.`
        : `Product ${productId} has no priced variants.`,
    })
  }

  const priceSetIds: string[] = variantRows.map((r: any) => r.price_set_id)

  // -- Breakpoints, straight from the price rows ------------------------------
  const { rows: bpRows } = await knex.raw(
    `SELECT DISTINCT min_quantity
       FROM price
      WHERE price_set_id = ANY(?)
        AND deleted_at IS NULL
        AND price_list_id IS NULL
        AND currency_code = ?
        AND min_quantity IS NOT NULL
      ORDER BY min_quantity`,
    [priceSetIds, currencyCode],
  )

  // The floor is always a rung (quantity 1 when unanchored: the base price a
  // customer gets before any volume threshold applies). Every price-table
  // breakpoint STRICTLY ABOVE the floor is a rung too; anything at or below it
  // is subsumed by the floor rung, which is priced at whatever applies there.
  //
  // Anchoring happens HERE, before the collapse below, see the header.
  const breakpoints: number[] = [
    fromQuantity,
    ...bpRows
      .map((r: any) => Number(r.min_quantity))
      .filter((q: number) => q > fromQuantity),
  ]
    .filter((q, i, a) => a.indexOf(q) === i)
    .sort((a, b) => a - b)

  // -- Customer groups, mirroring setPricingContext ----------------------------
  const baseContext: Record<string, unknown> = {
    currency_code: currencyCode,
  }
  if (regionId) baseContext.region_id = regionId
  if (req.auth_context?.actor_id) {
    const { data: groups } = await query.graph({
      entity: "customer_group",
      fields: ["id"],
      filters: { customers: { id: req.auth_context.actor_id } },
    })
    if (groups?.length) {
      baseContext.customer = { groups: groups.map((g: any) => ({ id: g.id })) }
    }
  }

  // -- One resolver call per rung, covering every price set at once ------------
  const byVariant = new Map<string, Rung[]>()
  for (const r of variantRows) byVariant.set(r.variant_id, [])

  for (const q of breakpoints) {
    const results = await pricing.calculatePrices(
      { id: priceSetIds },
      { context: { ...baseContext, quantity: q } },
    )
    const bySet = new Map<string, any>(
      (results ?? []).map((p: any) => [p.id, p]),
    )
    for (const r of variantRows) {
      const calc = bySet.get(r.price_set_id)
      if (!calc || calc.calculated_amount === null || calc.calculated_amount === undefined) {
        continue
      }
      const unit = money2(Number(calc.calculated_amount))
      byVariant.get(r.variant_id)!.push({
        quantity: q,
        unit_amount: unit,
        line_total: money2(unit * q),
        currency_code: String(calc.currency_code ?? currencyCode).toLowerCase(),
      })
    }
  }

  // Collapse consecutive rungs that resolve to the same unit price. A rung that
  // costs the same as the one below it is not a tier, and rendering it as one
  // invites "why does 50 cost the same as 25?".
  const variants = variantRows.map((r: any) => {
    const raw = byVariant.get(r.variant_id) ?? []
    const tiers: Rung[] = []
    for (const rung of raw) {
      const prev = tiers[tiers.length - 1]
      if (!prev || prev.unit_amount !== rung.unit_amount) tiers.push(rung)
    }
    return { variant_id: r.variant_id, tiers }
  })

  // See the CACHING section in the header, this is deliberate.
  res.setHeader("Cache-Control", "private, no-store")

  return res.json({
    product_id: productId,
    currency_code: currencyCode,
    region_id: regionId,
    // Echoed so a caller can assert the anchor it asked for is the anchor it got.
    from_quantity: fromQuantity,
    variants,
  })
}
