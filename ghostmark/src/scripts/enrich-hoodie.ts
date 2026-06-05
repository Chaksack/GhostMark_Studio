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
