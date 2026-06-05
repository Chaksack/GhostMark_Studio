// =============================================================================
// seed-shipping-gbp — idempotently set up a UK-covering flat-rate shipping
// option so GBP carts can resolve a shipping rate at checkout.
//
// Why this exists
// ---------------
// Medusa v2's `/store/shipping-options?cart_id=...` filters returned options
// down to those whose service zone covers the cart's shipping_address country
// AND whose shipping profile matches the cart items' profiles AND whose
// `prices[]` resolves for the cart's currency/region.
//
// In this environment:
//   - Only one shipping option exists ("Standard"), seeded by an earlier
//     dev fixture into a "Test shipping" service zone whose geo zones do NOT
//     include "gb".
//   - The full `seed.ts` was never run end-to-end (or its fulfillment set
//     was wiped), so the "European Warehouse delivery" zone it would have
//     created — which DOES include "gb" — is absent.
//
// Result: UK carts surface zero shipping options, the checkout flow advances
// to payment without `addShippingMethod`, and `cart.complete()` rejects with
// 400: "No shipping method selected but the cart contains items that
// require shipping."
//
// What this script does
// ---------------------
// 1. Looks up (or creates) a "UK Warehouse" fulfillment set with a single
//    service zone covering geo_zone country_code=gb.
// 2. Links it to the existing default stock location.
// 3. Creates a single flat-rate "UK Standard" shipping option attached to
//    that zone + the default shipping profile, with GBP/USD/EUR prices in
//    MINOR units (£10.00 / $13.00 / €12.00).
// 4. Logs each step. Re-runs short-circuit on existing names.
//
// What it does NOT touch
// ----------------------
// - Existing "Standard" / "Express Shipping" options in other zones.
// - Existing fulfillment sets / service zones.
// - Product → shipping-profile links (handled by
//   `fix-product-shipping-profiles.ts`, which MUST run first or alongside).
//
// Dry run
// -------
//   pnpm exec medusa exec ./src/scripts/seed-shipping-gbp.ts -- --dry-run
//   (or set env var DRY_RUN=1)
//
// Apply
// -----
//   pnpm exec medusa exec ./src/scripts/seed-shipping-gbp.ts
// =============================================================================
import { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import {
  createShippingOptionsWorkflow,
} from "@medusajs/medusa/core-flows"

const FULFILLMENT_SET_NAME = "UK Warehouse delivery"
const SERVICE_ZONE_NAME = "United Kingdom"
const SHIPPING_OPTION_NAME = "UK Standard"

// MINOR units (pence / cents) — matches the rest of the catalogue.
// (workshop-tote at £22.00 stores 2200.)
const PRICES = [
  { currency_code: "gbp", amount: 1000 }, // £10.00
  { currency_code: "usd", amount: 1300 }, // $13.00
  { currency_code: "eur", amount: 1200 }, // €12.00
]

export default async function seedShippingGbp({ args, container }: ExecArgs) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const fulfillment = container.resolve(Modules.FULFILLMENT)
  const stockLocation = container.resolve(Modules.STOCK_LOCATION)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  const dryRun =
    process.env.DRY_RUN === "1" ||
    (Array.isArray(args) && args.includes("--dry-run"))

  if (dryRun) {
    logger.info("[seed-shipping-gbp] DRY-RUN — no writes.")
  }

  // 1) Default shipping profile must exist (created by seed.ts).
  const profiles = await fulfillment.listShippingProfiles({ type: "default" })
  if (!profiles.length) {
    logger.warn(
      "[seed-shipping-gbp] no default shipping profile — run seed.ts first.",
    )
    return
  }
  const shippingProfileId = profiles[0].id

  // 2) Find or create the UK fulfillment set + service zone.
  const existingSets = await fulfillment.listFulfillmentSets({
    name: FULFILLMENT_SET_NAME,
  })

  let fulfillmentSet = existingSets[0]
  let serviceZoneId: string

  if (fulfillmentSet) {
    logger.info(
      `[seed-shipping-gbp] fulfillment set exists: ${FULFILLMENT_SET_NAME} (${fulfillmentSet.id})`,
    )
    // Reload with service zones expanded so we have the zone id.
    const reloaded = await fulfillment.listFulfillmentSets(
      { id: fulfillmentSet.id },
      { relations: ["service_zones"] },
    )
    fulfillmentSet = reloaded[0]
    const ukZone = fulfillmentSet.service_zones?.find(
      (z: any) => z.name === SERVICE_ZONE_NAME,
    )
    if (!ukZone) {
      logger.warn(
        `[seed-shipping-gbp] fulfillment set exists but lacks service zone "${SERVICE_ZONE_NAME}". Manual intervention required.`,
      )
      return
    }
    serviceZoneId = ukZone.id
  } else {
    if (dryRun) {
      logger.info(
        `[seed-shipping-gbp] DRY-RUN would create fulfillment set "${FULFILLMENT_SET_NAME}" + service zone "${SERVICE_ZONE_NAME}" (geo: gb)`,
      )
      // Continue to the option-creation dry-run logging below.
      serviceZoneId = "dryrun_zone"
    } else {
      const created = await fulfillment.createFulfillmentSets({
        name: FULFILLMENT_SET_NAME,
        type: "shipping",
        service_zones: [
          {
            name: SERVICE_ZONE_NAME,
            geo_zones: [{ country_code: "gb", type: "country" }],
          },
        ],
      })
      fulfillmentSet = created
      serviceZoneId = fulfillmentSet.service_zones[0].id
      logger.info(
        `[seed-shipping-gbp] created fulfillment set ${fulfillmentSet.id} + zone ${serviceZoneId}`,
      )

      // 2b) Link the UK fulfillment set to the (only) stock location so
      //     reservations + inventory checks resolve correctly.
      const locations = await stockLocation.listStockLocations({})
      if (locations.length) {
        await link.create({
          [Modules.STOCK_LOCATION]: { stock_location_id: locations[0].id },
          [Modules.FULFILLMENT]: { fulfillment_set_id: fulfillmentSet.id },
        })
        logger.info(
          `[seed-shipping-gbp] linked fulfillment set -> stock location ${locations[0].id}`,
        )
      } else {
        logger.warn(
          "[seed-shipping-gbp] no stock locations found — skipping link.",
        )
      }
    }
  }

  // 3) Find or create the UK Standard shipping option.
  const { data: existingOpts } = await query.graph({
    entity: "shipping_option",
    fields: ["id", "name", "service_zone_id"],
  })
  const ukOpt = existingOpts.find(
    (o: any) => o.name === SHIPPING_OPTION_NAME && o.service_zone_id === serviceZoneId,
  )

  if (ukOpt) {
    logger.info(
      `[seed-shipping-gbp] shipping option exists: ${SHIPPING_OPTION_NAME} (${ukOpt.id}) — skipping.`,
    )
    return
  }

  if (dryRun) {
    logger.info(
      `[seed-shipping-gbp] DRY-RUN would create shipping option "${SHIPPING_OPTION_NAME}" (zone=${serviceZoneId}, profile=${shippingProfileId}) with prices ${JSON.stringify(PRICES)}`,
    )
    return
  }

  await createShippingOptionsWorkflow(container).run({
    input: [
      {
        name: SHIPPING_OPTION_NAME,
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: serviceZoneId,
        shipping_profile_id: shippingProfileId,
        type: {
          label: "Standard",
          description: "Ship in 2-3 days (UK).",
          code: "uk-standard",
        },
        prices: PRICES,
        rules: [
          { attribute: "enabled_in_store", value: "true", operator: "eq" },
          { attribute: "is_return", value: "false", operator: "eq" },
        ],
      },
    ],
  })

  logger.info(
    `[seed-shipping-gbp] created shipping option "${SHIPPING_OPTION_NAME}" — UK carts can now resolve a rate.`,
  )
}
