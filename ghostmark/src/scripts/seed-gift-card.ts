// =============================================================================
// seed-gift-card — create a "Studio Gift Card" product tagged with the
// gift-card product type so the storefront has at least one SKU available
// for the third commerce mode.
//
// Why this exists
// ---------------
// The gift-card product type was created by seed-product-types.ts but no
// products were ever tagged with it. The storefront branches on
// product.type.value, so without at least one tagged SKU the gift-card flow
// is untestable end-to-end.
//
// What it creates
// ---------------
//   - 1 product: "Studio Gift Card" (handle: studio-gift-card)
//   - 4 denomination variants: £25, £50, £100, £250 (each with GBP / USD / EUR
//     price entries derived from the GBP base)
//   - Tagged with the gift-card product type (created lazily if absent)
//   - Marked is_giftcard=true so Medusa skips shipping requirements
//   - Linked to the default sales channel
//   - Status: PUBLISHED (immediately visible to the Store API)
//
// Idempotency
// -----------
//   - Checks for an existing product on handle 'studio-gift-card' before
//     creating. If present, the script exits cleanly with a "already seeded"
//     log line — no duplicate variants, no price churn.
//   - The gift-card product type is upserted on value. If
//     seed-product-types.ts hasn't been run yet, this script creates the type
//     itself (so it works in either order).
//
// Dry run
// -------
//   pnpm exec medusa exec ./src/scripts/seed-gift-card.ts -- --dry-run
//   (or set env var DRY_RUN=1)
//
// Apply
// -----
//   pnpm exec medusa exec ./src/scripts/seed-gift-card.ts
// =============================================================================
import { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils"
import { createProductsWorkflow } from "@medusajs/medusa/core-flows"

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------
const HANDLE = "studio-gift-card"
const TITLE = "Studio Gift Card"
const SUBTITLE = "Email-delivered. Redeemable on every Studio Canon order."
const DESCRIPTION =
  "A flexible gift for the studios and teams on your list. Choose a denomination, " +
  "and we email a unique code the recipient can redeem on any Studio Canon item. " +
  "Codes don't expire and stack on the same order if you have more than one."

const TYPE_VALUE = "gift-card"

// GBP-base denominations. The USD/EUR equivalents are FX-rounded heuristics
// (close enough for a dev catalog — real pricing should come from a finance-
// owned table or live FX feed before launch).
//
// IMPORTANT — minor units convention
// ----------------------------------
// All `amount` values on Medusa Price rows in this catalogue are stored in
// MINOR units for GBP/USD/EUR (i.e. pence / cents). The storefront divides
// `calculated_amount` by 100 at render time. Confirmed empirically: the rest
// of the catalogue (e.g. workshop-tote at £22.00) stores `calculated_amount`
// as `2200`. Originally these denoms were written as major units which made
// the gift card sell at 1/100th of its face value (£25 -> £0.25). The
// `metadata.denomination_gbp` field below keeps the human-readable major
// value alongside, so downstream consumers (fix-gift-card-prices.ts, future
// FX repricers) can recompute without ambiguity.
const DENOMS: Array<{
  gbp: number
  usd: number
  eur: number
  sku: string
  title: string
  denomination_gbp: number // major units — display / source-of-truth
}> = [
  { gbp: 2500,  usd: 3200,  eur: 3000,  sku: "GMS-GIFT-25",  title: "£25 gift card",  denomination_gbp: 25 },
  { gbp: 5000,  usd: 6500,  eur: 6000,  sku: "GMS-GIFT-50",  title: "£50 gift card",  denomination_gbp: 50 },
  { gbp: 10000, usd: 13000, eur: 12000, sku: "GMS-GIFT-100", title: "£100 gift card", denomination_gbp: 100 },
  { gbp: 25000, usd: 32000, eur: 30000, sku: "GMS-GIFT-250", title: "£250 gift card", denomination_gbp: 250 },
]

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------
export default async function seedGiftCard({ args, container }: ExecArgs) {
  const productService = container.resolve(Modules.PRODUCT)
  const salesChannelService = container.resolve(Modules.SALES_CHANNEL)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  const dryRun =
    process.env.DRY_RUN === "1" ||
    (Array.isArray(args) && args.includes("--dry-run"))

  if (dryRun) {
    logger.info("[seed-gift-card] DRY-RUN mode — no writes will happen.")
  }

  // ---------------------------------------------------------------------------
  // 1) Short-circuit if the product already exists. Idempotency win — re-runs
  //    are safe and cheap.
  // ---------------------------------------------------------------------------
  const existingProducts = await productService.listProducts(
    { handle: HANDLE },
    { take: 1, select: ["id", "handle"] },
  )
  if (existingProducts.length > 0) {
    logger.info(
      `[seed-gift-card] product already seeded: ${HANDLE} (${existingProducts[0].id}). Exiting.`,
    )
    return
  }

  // ---------------------------------------------------------------------------
  // 2) Resolve the gift-card product type. Upsert on `value` — if
  //    seed-product-types.ts has already run the type exists; otherwise create
  //    it ourselves so this script is self-contained.
  // ---------------------------------------------------------------------------
  const existingTypes = await productService.listProductTypes(
    { value: [TYPE_VALUE] },
    { take: 1 },
  )

  let typeId: string
  if (existingTypes.length > 0) {
    typeId = existingTypes[0].id
    logger.info(`[seed-gift-card] type exists: ${TYPE_VALUE} (${typeId})`)
  } else {
    if (dryRun) {
      typeId = `dryrun_${TYPE_VALUE}`
      logger.info(`[seed-gift-card] DRY-RUN would create type: ${TYPE_VALUE}`)
    } else {
      const [createdType] = await productService.createProductTypes([
        {
          value: TYPE_VALUE,
          metadata: { label: "Gift Card", flow: "gift-card" },
        },
      ])
      typeId = createdType.id
      logger.info(`[seed-gift-card] created type: ${TYPE_VALUE} (${typeId})`)
    }
  }

  // ---------------------------------------------------------------------------
  // 3) Resolve the default sales channel so the product is exposed to the
  //    Store API without manual admin wiring.
  // ---------------------------------------------------------------------------
  const channels = await salesChannelService.listSalesChannels(
    { name: "Default Sales Channel" },
    { take: 1 },
  )
  if (channels.length === 0) {
    logger.warn(
      "[seed-gift-card] no 'Default Sales Channel' found — product will not be visible " +
        "on the storefront until linked to a channel manually.",
    )
  }
  const salesChannelId = channels[0]?.id

  // ---------------------------------------------------------------------------
  // 4) Build the product payload. Variants share a single "Denomination" option
  //    so the storefront PDP renders pills (£25 / £50 / £100 / £250).
  // ---------------------------------------------------------------------------
  const productInput = {
    title: TITLE,
    subtitle: SUBTITLE,
    description: DESCRIPTION,
    handle: HANDLE,
    is_giftcard: true,
    discountable: false,
    type_id: typeId,
    status: ProductStatus.PUBLISHED,
    options: [
      {
        title: "Denomination",
        values: DENOMS.map((d) => d.title),
      },
    ],
    variants: DENOMS.map((d) => ({
      title: d.title,
      sku: d.sku,
      manage_inventory: false, // gift cards aren't physically inventoried
      allow_backorder: false,
      options: { Denomination: d.title },
      prices: [
        { currency_code: "gbp", amount: d.gbp },
        { currency_code: "usd", amount: d.usd },
        { currency_code: "eur", amount: d.eur },
      ],
      metadata: {
        // Major units (£) so consumers can render / verify without dividing.
        // The variant's actual `prices[].amount` is in minor units (pence).
        denomination_gbp: d.denomination_gbp,
      },
    })),
    sales_channels: salesChannelId ? [{ id: salesChannelId }] : undefined,
    metadata: {
      commerce_mode: "gift-card",
      flow: "gift-card",
    },
  }

  if (dryRun) {
    logger.info(
      `[seed-gift-card] DRY-RUN would create product: ${HANDLE} with ${DENOMS.length} variants ` +
        `(${DENOMS.map((d) => `£${d.denomination_gbp}`).join(", ")})`,
    )
    return
  }

  // ---------------------------------------------------------------------------
  // 5) Create via the workflow so all subscribers (price-list refresh,
  //    indexer, search ingest) fire.
  // ---------------------------------------------------------------------------
  const { result } = await createProductsWorkflow(container).run({
    input: { products: [productInput as any] },
  })

  const product = result?.[0]
  if (!product) {
    logger.error("[seed-gift-card] workflow returned no product. Check logs.")
    return
  }

  logger.info(
    `[seed-gift-card] created product ${product.id} (${product.handle}) with ` +
      `${product.variants?.length ?? 0} variants. type=${TYPE_VALUE}.`,
  )
}
