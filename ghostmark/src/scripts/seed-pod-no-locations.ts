/* ============================================================================
 * DO NOT RUN THIS SCRIPT. ITS PRICES ARE 100x TOO HIGH.
 * ============================================================================
 *
 * `:108-110` write MINOR units, and say so in their own trailing comments:
 *
 *        { currency_code: "gbp", amount: 1500 },  // GBP 15.00
 *        { currency_code: "usd", amount: 2000 },  // USD 20.00
 *        { currency_code: "eur", amount: 1800 },  // EUR 18.00
 *
 * THE CONVENTION FLIPPED ON 2026-08-30. migrate-price-units converted the
 * catalogue to MAJOR units, so `amount: 1500` now means GBP 1,500.00 and the
 * comment beside it is the giveaway: the comment states the intent, the
 * literal no longer expresses it.
 *
 * Before running this again: divide the three amounts by 100, or delete the
 * file.
 * ========================================================================== */

// =============================================================================
// seed-pod-no-locations: create a single POD product that is flagged
// customisable but has ZERO print_locations metadata, so the storefront's
// `isPODWithoutLocations` PDP branch can be exercised against a real SKU.
//
// Why this exists
// ---------------
// pages/products/[handle].vue computes:
//
//     isPODWithoutLocations = isPOD && isCustomizable && printLocations.length === 0
//
// where the three live POD products in the seed catalogue all fall into one
// of two buckets:
//
//   1. `metadata.is_customizable === false`  (studio-sticker-pack,
//      logo-sticker-sheet): these short-circuit the customisable branch
//      entirely.
//   2. `metadata.is_customizable === true` AND `metadata.print_locations`
//      populated (cable-organiser, tech-pouch): these render the
//      DesignEditor, NOT the email-artwork CTA.
//
// Nothing in the live catalogue hits the exact `isPODWithoutLocations` cell,
// so the new "email artwork brief" Step-2 affordance card ([data-test=
// "pod-no-locations"]) has only ever been verified statically. This seed
// closes that gap with a tiny purpose-built fixture.
//
// Critical detail: image fallback
// --------------------------------
// The storefront's `printLocations` resolver has a Path-3 fallback that
// synthesises a single "Front" zone from `images[0].url` or `thumbnail`
// when an `is_customizable=true` product has no metadata. To force the
// branch we must NOT ship images or a thumbnail on this fixture; otherwise
// `printLocations.length` becomes 1 and the email-CTA never renders. The
// product is intentionally image-less.
//
// What it creates
// ---------------
//   - 1 product: "Studio Laser Coaster" (handle: studio-laser-coaster)
//   - 1 variant: "1 coaster" (GBP/USD/EUR minor units)
//   - Tagged with the `pod` product type (resolved via type_id lookup,
//     created by seed-product-types.ts; failure mode is documented below)
//   - metadata.is_customizable = true   (triggers customisable branch)
//   - metadata.print_locations  = []    (forces the empty-locations cell)
//   - No images, no thumbnail           (defeats the image-fallback path)
//   - Linked to the default sales channel
//   - Status: PUBLISHED (immediately visible to the Store API)
//
// Idempotency
// -----------
//   - Short-circuits if a product with handle 'studio-laser-coaster' already
//     exists; re-runs are a no-op.
//   - The `pod` product type is REQUIRED (not lazily created). If it's
//     missing, seed-product-types.ts hasn't been run yet; this script
//     refuses to proceed rather than silently inventing a type the catalogue
//     doesn't own.
//
// Dry run
// -------
//   pnpm exec medusa exec ./src/scripts/seed-pod-no-locations.ts -- --dry-run
//   (or set env var DRY_RUN=1)
//
// Apply
// -----
//   pnpm exec medusa exec ./src/scripts/seed-pod-no-locations.ts
//
// Storefront verification
// -----------------------
// After applying, navigate to /products/studio-laser-coaster on the
// storefront and confirm the [data-test="pod-no-locations"] Step-2
// affordance card renders.
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
const HANDLE = "studio-laser-coaster"
const TITLE = "Studio Laser Coaster"
const SUBTITLE = "Walnut coaster, laser-engraved with your studio mark."
// NOTE: the clause below reads "...yet. Email the artwork team..." with a FULL
// STOP, not an em dash and not a comma. Both halves are independent clauses, so
// a comma would be a splice. This is the source half of migrate-product-copy.ts
// (ledger gms_product_copy_migration). The live database value was corrected in
// the same pass. Keep the two in step, or the next reseed reintroduces the dash.
const DESCRIPTION =
  "Solid 4mm walnut coaster, hand-finished and laser-engraved with your logo " +
  "or studio mark. Print zones for this product aren't published in the " +
  "self-serve customizer yet. Email the artwork team after checkout and we'll " +
  "send a proof in 48 hours."

const TYPE_VALUE = "pod"

// Single variant. GBP-base in MINOR units (pence). The rest of the catalogue
// (e.g. workshop-tote at £22.00 -> 2200) follows the same convention and the
// storefront divides calculated_amount by 100 at render time. USD/EUR
// equivalents are FX-rounded heuristics; real pricing should come from a
// finance-owned table or live FX feed before launch.
const VARIANT = {
  title: "1 coaster",
  sku: "GMS-COASTER-1",
  prices: [
    { currency_code: "gbp", amount: 1500 }, // £15.00
    { currency_code: "usd", amount: 2000 }, // $20.00
    { currency_code: "eur", amount: 1800 }, // €18.00
  ],
}

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------
export default async function seedPodNoLocations({ args, container }: ExecArgs) {
  // Hard gate. See the DO NOT RUN banner at the top of this file.
  // Throws rather than returns: a `return` exits 0 and any CI wrapper
  // checking the exit status would read the refusal as a successful run.
  if (process.env.I_HAVE_FIXED_THE_UNIT_CONVENTION !== "yes") {
    const msg =
      "[seed-pod-no-locations] REFUSING TO RUN. Its prices at :108-110 are MINOR " + "units (1500 = GBP 15.00), but the catalogue moved to MAJOR units on " + "2026-08-30. Divide them by 100 (or delete this file) before re-enabling.";
    console.error(msg);
    throw new Error(msg);
  }
  const productService = container.resolve(Modules.PRODUCT)
  const salesChannelService = container.resolve(Modules.SALES_CHANNEL)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  const dryRun =
    process.env.DRY_RUN === "1" ||
    (Array.isArray(args) && args.includes("--dry-run"))

  if (dryRun) {
    logger.info("[seed-pod-no-locations] DRY-RUN mode: no writes will happen.")
  }

  // ---------------------------------------------------------------------------
  // 1) Short-circuit if the product already exists. Idempotency win: re-runs
  //    are safe and cheap.
  // ---------------------------------------------------------------------------
  const existingProducts = await productService.listProducts(
    { handle: HANDLE },
    { take: 1, select: ["id", "handle"] },
  )
  if (existingProducts.length > 0) {
    logger.info(
      `[seed-pod-no-locations] product already seeded: ${HANDLE} ` +
        `(${existingProducts[0].id}). Exiting.`,
    )
    return
  }

  // ---------------------------------------------------------------------------
  // 2) Resolve the 'pod' product type. This script REQUIRES the type to
  //    exist (created by seed-product-types.ts). We refuse to lazily create
  //    it here because the rest of the catalogue's type taxonomy is owned
  //    by that script. Silently minting a duplicate type from a fixture
  //    seed would mask a real ordering bug.
  // ---------------------------------------------------------------------------
  const existingTypes = await productService.listProductTypes(
    { value: [TYPE_VALUE] },
    { take: 1 },
  )
  if (existingTypes.length === 0) {
    logger.error(
      `[seed-pod-no-locations] product type '${TYPE_VALUE}' not found. Run ` +
        `seed-product-types.ts first so the catalogue's type taxonomy exists.`,
    )
    return
  }
  const typeId = existingTypes[0].id
  logger.info(`[seed-pod-no-locations] type exists: ${TYPE_VALUE} (${typeId})`)

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
      "[seed-pod-no-locations] no 'Default Sales Channel' found: product " +
        "will not be visible on the storefront until linked to a channel " +
        "manually.",
    )
  }
  const salesChannelId = channels[0]?.id

  // ---------------------------------------------------------------------------
  // 4) Build the product payload.
  //
  //    Metadata shape is the WHOLE POINT of this fixture:
  //      - is_customizable: true   -> storefront's isCustomizable === true
  //      - print_locations: []     -> printLocations.length === 0 after the
  //                                   resolver's Path-1 short-circuits on a
  //                                   zero-length array.
  //
  //    NOTE: no `images`, no `thumbnail`. The storefront's Path-3 fallback
  //    synthesises a "Front" zone from images[0]/thumbnail when
  //    is_customizable=true and metadata is absent. Supplying either would
  //    make printLocations.length === 1 and DEFEAT THE TEST FIXTURE.
  //
  //    `commerce_mode: 'pod'` and `flow: 'pod'` mirror the existing live
  //    POD products' metadata shape (studio-sticker-pack, logo-sticker-sheet)
  //    so chip / IA layers that read commerce_mode still treat this as POD.
  // ---------------------------------------------------------------------------
  const productInput = {
    title: TITLE,
    subtitle: SUBTITLE,
    description: DESCRIPTION,
    handle: HANDLE,
    discountable: true,
    type_id: typeId,
    status: ProductStatus.PUBLISHED,
    options: [
      {
        title: "Size",
        values: [VARIANT.title],
      },
    ],
    variants: [
      {
        title: VARIANT.title,
        sku: VARIANT.sku,
        manage_inventory: false, // dev fixture; not physically stocked
        allow_backorder: false,
        options: { Size: VARIANT.title },
        prices: VARIANT.prices,
      },
    ],
    sales_channels: salesChannelId ? [{ id: salesChannelId }] : undefined,
    metadata: {
      commerce_mode: "pod",
      flow: "pod",
      // Triggers the customisable branch in pages/products/[handle].vue.
      is_customizable: true,
      // Explicit empty array is the SIGNAL that fires the new
      // isPODWithoutLocations cell: Path-1 of the resolver short-circuits
      // on a zero-length array and falls through to Path-2/3, both of
      // which also resolve to [] because we ship no mockup_* keys and no
      // images. End result: printLocations.length === 0 ->
      // [data-test="pod-no-locations"] renders.
      print_locations: [] as unknown[],
    },
  }

  if (dryRun) {
    logger.info(
      `[seed-pod-no-locations] DRY-RUN would create product: ${HANDLE} ` +
        `(type=${TYPE_VALUE}, 1 variant @ £15.00, metadata.is_customizable=true, ` +
        `metadata.print_locations=[]).`,
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
    logger.error("[seed-pod-no-locations] workflow returned no product. Check logs.")
    return
  }

  logger.info(
    `[seed-pod-no-locations] created product ${product.id} (${product.handle}) ` +
      `with ${product.variants?.length ?? 0} variant. type=${TYPE_VALUE}, ` +
      `metadata.is_customizable=true, metadata.print_locations=[].`,
  )
}
