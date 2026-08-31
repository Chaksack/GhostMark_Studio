/* ============================================================================
 * DO NOT RUN THIS SCRIPT. IT WOULD DESTROY THE ATELIER-HOODIE CATALOGUE
 * AND REPRICE IT AT GBP 8,900.00 PER VARIANT.
 * ============================================================================
 *
 * Two independent defects, either one sufficient to refuse.
 *
 * 1. FLIPPED UNIT CONVENTION.
 *    `:prices` below writes `{ amount: 8900, currency_code: "gbp" }`. That was
 *    correct when written, because the catalogue stored MINOR units then.
 *
 *    THE CONVENTION FLIPPED ON 2026-08-30. migrate-price-units converted the
 *    catalogue to MAJOR units. Verified live against the database that day:
 *
 *        atelier-hoodie, gbp base:  89        <- correct, MAJOR (GBP 89.00)
 *        this script would write:   8900      <- GBP 8,900.00, 100x
 *
 *    Same inversion as fix-gift-card-prices.ts. See its banner.
 *
 * 2. IT DELETES EVERY VARIANT FIRST, AND THE DELETION IS NOT RECOVERABLE
 *    FROM ANY LEDGER.
 *    Step 1 (`batchProductVariantsWorkflow ... delete`) removes every live
 *    variant, and step 2 drops every option. Measured live on 2026-08-30:
 *
 *        live variants on atelier-hoodie ............... 32
 *        live gbp price rows (7-rung ladder x 32) ..... 224
 *        rows ledgered in gms_quantity_tier_migration .. 576
 *          (6 real rungs x 32 variants x 3 currencies)
 *
 *    The rebuild creates 32 variants with ONE gbp price and NO quantity
 *    ladder, so the 25/50/100/200/300/400 breaks are gone. Worse, the
 *    quantity-tier ledger records those 576 rows by price_id only. Once the
 *    variants are deleted those ids no longer exist, so that ledger's rollback
 *    reports them as "already gone from the price table" and CLOSES THE LEDGER
 *    for them. The ladder becomes unrecoverable by any automated path.
 *
 * The header below still claims "Idempotency: ... Safe to invoke repeatedly."
 * That sentence was true of the shape and was never true of the CONTENT: each
 * run destroys the priced ladder and rewrites the base price 100x high. It is
 * left in place, and contradicted here, because deleting it would hide that a
 * plausible-looking safety claim is what made this file dangerous to leave
 * ungated.
 *
 * This is worse than a stale comment. A stale comment misleads a reader who
 * can push back; stale executable intent just runs. The code is internally
 * consistent and only the world moved, so no typecheck, test, or review of
 * this file in isolation would catch it.
 *
 * Before running this again: rewrite the amount for major units, decide what
 * happens to the quantity ladder it destroys, or delete the file. The hard
 * gate below exists so that decision is made deliberately rather than by
 * someone running a plausibly-named script.
 * ========================================================================== */

import { ExecArgs } from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils";
import {
  batchProductVariantsWorkflow,
  deleteProductOptionsWorkflow,
  updateProductsWorkflow,
} from "@medusajs/medusa/core-flows";

/**
 * Enrich the seeded `atelier-hoodie` product so the storefront PDP renders
 * rich variant + image data: 3 option groups (Gender x Color x Size) ->
 * 32 variants, plus 4 product images and a thumbnail.
 *
 * Tactic (Medusa v2.11):
 *   1. Look up the existing product by handle.
 *   2. `batchProductVariantsWorkflow` -> delete the 4 stale single-Size variants
 *      (you cannot leave them behind: their option-values reference the old
 *      Size option that we are about to drop, and `updateProductsWorkflow`
 *      will not re-key existing variants onto a new option set).
 *   3. `deleteProductOptionsWorkflow` -> drop the lingering "Size" option so
 *      the new options array starts from a clean slate.
 *   4. `updateProductsWorkflow` -> set thumbnail + images, declare the 3 new
 *      options, and create all 32 (Gender, Color, Size) variants in one shot.
 *
 * Idempotency: re-running first wipes whatever variants/options currently
 * exist on the product, then rebuilds them. Safe to invoke repeatedly.
 *
 * Inventory: variants are created with `manage_inventory: false` to avoid
 * forcing 32 stock-level rows. The PDP just needs them to render and price.
 */
export default async function enrichHoodie({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);

  // Hard gate. See the DO NOT RUN banner at the top of this file. This script
  // deletes every atelier-hoodie variant (32 live, carrying a 7-rung price
  // ladder and 576 ledgered tier rows) and rebuilds them at `amount: 8900`,
  // which is GBP 8,900.00 under the MAJOR-unit convention adopted 2026-08-30.
  // Throws rather than returns: a `return` exits 0 and any CI wrapper checking
  // the exit status would read the refusal as a successful run.
  if (process.env.I_HAVE_FIXED_THE_UNIT_CONVENTION !== "yes") {
    const msg =
      "[enrich-hoodie] REFUSING TO RUN. This script deletes all 32 " +
      "atelier-hoodie variants (destroying a 7-rung quantity ladder and 576 " +
      "rows ledgered in gms_quantity_tier_migration, unrecoverable once the " +
      "price ids are gone) and rebuilds them at amount 8900 gbp, which is " +
      "GBP 8,900.00 since the catalogue moved to MAJOR units on 2026-08-30. " +
      "Fix the arithmetic and decide what happens to the quantity ladder " +
      "(or delete this file) before re-enabling.";
    logger.error(msg);
    throw new Error(msg);
  }

  const productService = container.resolve(Modules.PRODUCT);

  const handle = "atelier-hoodie";
  const [product] = await productService.listProducts(
    { handle: [handle] },
    { relations: ["options", "options.values", "variants", "images"] }
  );

  if (!product) {
    logger.error(`PRODUCT_NOT_FOUND: ${handle}`);
    return;
  }
  logger.info(`Found product: ${product.id} (${product.title})`);
  logger.info(
    `Pre-state: options=${product.options?.length ?? 0}, variants=${product.variants?.length ?? 0}, images=${product.images?.length ?? 0}`
  );

  // 1. Delete every existing variant on the product.
  if (product.variants?.length) {
    const variantIds = product.variants.map((v) => v.id);
    await batchProductVariantsWorkflow(container).run({
      input: {
        product_id: product.id,
        delete: variantIds,
      },
    });
    logger.info(`Deleted ${variantIds.length} existing variant(s).`);
  }

  // 2. Delete every existing option on the product.
  if (product.options?.length) {
    const optionIds = product.options.map((o) => o.id);
    await deleteProductOptionsWorkflow(container).run({
      input: { ids: optionIds },
    });
    logger.info(`Deleted ${optionIds.length} existing option(s).`);
  }

  // 3. Define the new shape.
  const placeholderImages = [
    { url: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=900&q=80" },
    { url: "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=900&q=80" },
    { url: "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=900&q=80" },
    { url: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=900&q=80" },
  ];
  const thumbnail = placeholderImages[0].url;

  const targetOptions = [
    { title: "Gender", values: ["Men", "Women"] },
    { title: "Color", values: ["Faded Black", "Bone", "Sage", "Faded Powder"] },
    { title: "Size", values: ["S", "M", "L", "XL"] },
  ];

  // 2 x 4 x 4 = 32 combinations.
  const slug = (s: string) =>
    s
      .toUpperCase()
      .replace(/\s+/g, "")
      .replace(/[^A-Z0-9]/g, "");

  const variants: Array<{
    title: string;
    sku: string;
    options: Record<string, string>;
    prices: Array<{ amount: number; currency_code: string }>;
    manage_inventory: boolean;
  }> = [];

  for (const gender of targetOptions[0].values) {
    for (const color of targetOptions[1].values) {
      for (const size of targetOptions[2].values) {
        variants.push({
          title: `${color} / ${size} / ${gender}`,
          sku: `AH-${gender[0]}-${slug(color)}-${size}`,
          options: { Gender: gender, Color: color, Size: size },
          prices: [{ amount: 8900, currency_code: "gbp" }],
          manage_inventory: false,
        });
      }
    }
  }

  // 4. Apply: thumbnail + images + new options + new variants in one workflow.
  await updateProductsWorkflow(container).run({
    input: {
      products: [
        {
          id: product.id,
          thumbnail,
          images: placeholderImages,
          options: targetOptions,
          variants,
        },
      ],
    },
  });
  logger.info(
    `Updated product with ${targetOptions.length} options, ${variants.length} variants, ${placeholderImages.length} images.`
  );

  // 5. Verify.
  const [verified] = await productService.listProducts(
    { handle: [handle] },
    { relations: ["options", "options.values", "variants", "images"] }
  );
  logger.info(
    `Post-state: options=${verified.options?.length ?? 0}, variants=${verified.variants?.length ?? 0}, images=${verified.images?.length ?? 0}, thumbnail=${verified.thumbnail ? "set" : "missing"}`
  );
}
