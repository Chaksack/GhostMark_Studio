import { ExecArgs } from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils";
import {
  createProductCategoriesWorkflow,
  batchLinkProductsToCategoryWorkflow,
  batchLinkProductsToCollectionWorkflow,
  createRegionsWorkflow,
  updateProductsWorkflow,
} from "@medusajs/medusa/core-flows";

/**
 * Sample-data enrichment for the GhostMark storefront.
 *
 * Idempotent on every step:
 *   A. Nested product categories (Apparel/Drinkware/Accessories/Lifestyle).
 *   B. Link existing products to their categories.
 *   C. Link existing products to existing collections (DTF, Hot Deals).
 *   D. Add thumbnails + 4 Unsplash images to products that have none.
 *   E. Add EU (EUR) and US (USD) regions for the storefront geo-modal.
 *      For new regions, mirror GBP price into EUR/USD on every variant
 *      that is missing those currency price entries.
 *
 * Workflow APIs are imported from `@medusajs/medusa/core-flows` (re-exports
 * `@medusajs/core-flows`). Verified against medusa@2.11.x:
 *   - createProductCategoriesWorkflow        (product-category/workflows/create-product-categories)
 *   - batchLinkProductsToCategoryWorkflow    (product/workflows/batch-products-in-category)
 *   - batchLinkProductsToCollectionWorkflow  (product/workflows/batch-link-products-collection)
 *   - createRegionsWorkflow                  (region/workflows/create-regions)
 *   - updateProductsWorkflow                 (product/workflows/update-products)
 *
 * Re-runnable: every operation pre-checks state and skips work that's
 * already been done. Failures on a single product/category are logged and
 * swallowed so the rest of the seed still progresses.
 */
export default async function seedSample({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const productService = container.resolve(Modules.PRODUCT);
  const regionService = container.resolve(Modules.REGION);

  const stats = {
    categoriesCreated: 0,
    categoriesSkipped: 0,
    categoryLinksMade: 0,
    collectionLinksMade: 0,
    imagesAdded: 0,
    regionsCreated: 0,
    regionsSkipped: 0,
    pricesAdded: 0,
    errors: [] as string[],
  };

  // ---------------------------------------------------------------------------
  // A. Nested categories
  // ---------------------------------------------------------------------------
  // Top-level parents first; then children that reference parents by ID.
  // Each entry: { name, handle, children?: [{ name, handle }] }.
  const tree: Array<{
    name: string;
    handle: string;
    children: Array<{ name: string; handle: string }>;
  }> = [
    {
      name: "Apparel",
      handle: "apparel",
      children: [
        { name: "T-shirts", handle: "apparel-tshirts" },
        { name: "Hoodies", handle: "apparel-hoodies" },
        { name: "Sweatshirts", handle: "apparel-sweatshirts" },
        { name: "Caps", handle: "apparel-caps" },
      ],
    },
    {
      name: "Drinkware",
      handle: "drinkware",
      children: [
        { name: "Mugs", handle: "drinkware-mugs" },
        { name: "Water bottles", handle: "drinkware-bottles" },
        { name: "Tumblers", handle: "drinkware-tumblers" },
      ],
    },
    {
      name: "Accessories",
      handle: "accessories",
      children: [
        { name: "Tote bags", handle: "accessories-totes" },
        { name: "Stickers", handle: "accessories-stickers" },
        { name: "Notebooks", handle: "accessories-notebooks" },
      ],
    },
    {
      name: "Lifestyle",
      handle: "lifestyle",
      children: [
        { name: "Tech", handle: "lifestyle-tech" },
        { name: "Home", handle: "lifestyle-home" },
      ],
    },
  ];

  // Pull every existing category once so we can map handle -> id and skip
  // duplicates without firing per-row queries inside the loop.
  // NOTE: productService.listProductCategories({}) silently returns nothing
  // on this Medusa version (likely an internal default filter on the module
  // service that we can't override here). The remote-query graph honours
  // an empty filter object correctly, so use that as the source of truth.
  const { data: existingCategories } = await query.graph({
    entity: "product_category",
    fields: ["id", "handle"],
  });
  const handleToId = new Map<string, string>(
    (existingCategories as Array<{ id: string; handle: string }>).map((c) => [
      c.handle,
      c.id,
    ])
  );

  // 1. Create missing parents.
  const parentsToCreate = tree
    .filter((p) => !handleToId.has(p.handle))
    .map((p) => ({
      name: p.name,
      handle: p.handle,
      is_active: true,
      is_internal: false,
    }));

  if (parentsToCreate.length) {
    try {
      const { result } = await createProductCategoriesWorkflow(container).run({
        input: { product_categories: parentsToCreate },
      });
      for (const c of result) {
        handleToId.set(c.handle, c.id);
        stats.categoriesCreated++;
        logger.info(`Created parent category: ${c.name} (${c.handle})`);
      }
    } catch (err) {
      const msg = `createProductCategoriesWorkflow(parents) failed: ${(err as Error).message}`;
      logger.error(msg);
      stats.errors.push(msg);
    }
  }
  stats.categoriesSkipped += tree.filter((p) => handleToId.has(p.handle) && !parentsToCreate.find((q) => q.handle === p.handle)).length;

  // 2. Create missing children, parented by lookup.
  const childrenToCreate: Array<{
    name: string;
    handle: string;
    parent_category_id: string;
    is_active: boolean;
    is_internal: boolean;
  }> = [];
  for (const parent of tree) {
    const parentId = handleToId.get(parent.handle);
    if (!parentId) {
      logger.warn(`Skipping children of "${parent.name}": parent not found`);
      continue;
    }
    for (const child of parent.children) {
      if (handleToId.has(child.handle)) {
        stats.categoriesSkipped++;
        continue;
      }
      childrenToCreate.push({
        name: child.name,
        handle: child.handle,
        parent_category_id: parentId,
        is_active: true,
        is_internal: false,
      });
    }
  }

  if (childrenToCreate.length) {
    try {
      const { result } = await createProductCategoriesWorkflow(container).run({
        input: { product_categories: childrenToCreate },
      });
      for (const c of result) {
        handleToId.set(c.handle, c.id);
        stats.categoriesCreated++;
        logger.info(`Created child category: ${c.name} (${c.handle})`);
      }
    } catch (err) {
      const msg = `createProductCategoriesWorkflow(children) failed: ${(err as Error).message}`;
      logger.error(msg);
      stats.errors.push(msg);
    }
  }

  // ---------------------------------------------------------------------------
  // B. Product -> Category links
  // ---------------------------------------------------------------------------
  // Map of product handle -> category handles to assign.
  const productCategoryMap: Record<string, string[]> = {
    "studio-tee-cream": ["apparel", "apparel-tshirts"],
    "studio-tee-charcoal": ["apparel", "apparel-tshirts"],
    "atelier-hoodie": ["apparel", "apparel-hoodies"],
    "workshop-tote": ["accessories", "accessories-totes"],
    "ghostmark-cap": ["apparel", "apparel-caps"],
  };

  // Resolve products + their existing category links so we don't double-link.
  const productHandles = Object.keys(productCategoryMap);
  const products = await productService.listProducts(
    { handle: productHandles },
    { relations: ["categories", "images"] }
  );
  const productByHandle = new Map(products.map((p) => [p.handle, p]));

  // Group: categoryId -> list of product IDs to add. Run one workflow per
  // category to keep the input tight.
  const categoryAdds = new Map<string, string[]>();
  for (const [pHandle, catHandles] of Object.entries(productCategoryMap)) {
    const product = productByHandle.get(pHandle);
    if (!product) {
      logger.warn(`Product not found, skipping link: ${pHandle}`);
      continue;
    }
    const existingCatIds = new Set((product.categories ?? []).map((c) => c.id));
    for (const catHandle of catHandles) {
      const catId = handleToId.get(catHandle);
      if (!catId) {
        logger.warn(`Category not found, skipping link: ${catHandle}`);
        continue;
      }
      if (existingCatIds.has(catId)) continue;
      const arr = categoryAdds.get(catId) ?? [];
      arr.push(product.id);
      categoryAdds.set(catId, arr);
    }
  }

  for (const [catId, productIds] of categoryAdds.entries()) {
    try {
      await batchLinkProductsToCategoryWorkflow(container).run({
        input: { id: catId, add: productIds },
      });
      stats.categoryLinksMade += productIds.length;
      logger.info(`Linked ${productIds.length} product(s) to category ${catId}`);
    } catch (err) {
      const msg = `batchLinkProductsToCategoryWorkflow(${catId}) failed: ${(err as Error).message}`;
      logger.error(msg);
      stats.errors.push(msg);
    }
  }

  // ---------------------------------------------------------------------------
  // C. Product -> Collection links
  // ---------------------------------------------------------------------------
  const collectionMap: Record<string, string[]> = {
    dtf: ["atelier-hoodie", "studio-tee-charcoal"],
    "hot-deals": ["workshop-tote", "ghostmark-cap"],
  };

  const { data: collections } = await query.graph({
    entity: "product_collection",
    fields: ["id", "handle", "products.id"],
  });
  const collectionByHandle = new Map<string, { id: string; productIds: Set<string> }>(
    collections.map((c: { id: string; handle: string; products?: Array<{ id: string }> }) => [
      c.handle,
      { id: c.id, productIds: new Set((c.products ?? []).map((p) => p.id)) },
    ])
  );

  for (const [colHandle, pHandles] of Object.entries(collectionMap)) {
    const col = collectionByHandle.get(colHandle);
    if (!col) {
      logger.warn(`Collection not found, skipping: ${colHandle}`);
      continue;
    }
    const idsToAdd: string[] = [];
    for (const ph of pHandles) {
      const product = productByHandle.get(ph);
      if (!product) {
        logger.warn(`Product not found, skipping collection link: ${ph}`);
        continue;
      }
      if (col.productIds.has(product.id)) continue;
      idsToAdd.push(product.id);
    }
    if (idsToAdd.length === 0) continue;
    try {
      await batchLinkProductsToCollectionWorkflow(container).run({
        input: { id: col.id, add: idsToAdd },
      });
      stats.collectionLinksMade += idsToAdd.length;
      logger.info(`Linked ${idsToAdd.length} product(s) to collection ${colHandle}`);
    } catch (err) {
      const msg = `batchLinkProductsToCollectionWorkflow(${colHandle}) failed: ${(err as Error).message}`;
      logger.error(msg);
      stats.errors.push(msg);
    }
  }

  // ---------------------------------------------------------------------------
  // D. Thumbnails + images
  // ---------------------------------------------------------------------------
  // 4 Unsplash photo IDs per product. Same `?w=900&q=80` style the hoodie uses.
  const photoMap: Record<string, string[]> = {
    "studio-tee-cream": [
      "photo-1521572163474-6864f9cf17ab",
      "photo-1583743814966-8936f5b7be1a",
      "photo-1618354691438-25bc04584c23",
      "photo-1503342217505-b0a15ec3261c",
    ],
    "studio-tee-charcoal": [
      "photo-1576566588028-4147f3842f27",
      "photo-1622445275576-721325763afe",
      "photo-1503341504253-dff4815485f1",
      "photo-1542293787938-c9e299b88066",
    ],
    "workshop-tote": [
      "photo-1591561954557-26941169b49e",
      "photo-1544816155-12df9643f363",
      "photo-1597484661973-ee6cd0b6482c",
      "photo-1605733513597-a8f8341084e6",
    ],
    "ghostmark-cap": [
      "photo-1521369909029-2afed882baee",
      "photo-1588850561407-ed78c282e89b",
      "photo-1534215754734-18e55d13e346",
      "photo-1556306535-0f09a537f0a3",
    ],
  };

  const productUpdates: Array<{
    id: string;
    thumbnail: string;
    images: Array<{ url: string }>;
  }> = [];

  for (const [pHandle, photoIds] of Object.entries(photoMap)) {
    const product = productByHandle.get(pHandle);
    if (!product) continue;
    const hasImages = (product.images?.length ?? 0) > 0;
    const hasThumb = !!product.thumbnail;
    if (hasImages && hasThumb) {
      logger.info(`Skipping images for ${pHandle}: already populated`);
      continue;
    }
    const images = photoIds.map((id) => ({
      url: `https://images.unsplash.com/${id}?w=900&q=80`,
    }));
    productUpdates.push({
      id: product.id,
      thumbnail: images[0].url,
      images,
    });
  }

  if (productUpdates.length) {
    try {
      await updateProductsWorkflow(container).run({
        input: { products: productUpdates },
      });
      for (const u of productUpdates) {
        stats.imagesAdded += u.images.length;
      }
      logger.info(
        `Updated ${productUpdates.length} product(s) with thumbnails + images.`
      );
    } catch (err) {
      const msg = `updateProductsWorkflow(images) failed: ${(err as Error).message}`;
      logger.error(msg);
      stats.errors.push(msg);
    }
  }

  // ---------------------------------------------------------------------------
  // E. Regions (EU + US)
  // ---------------------------------------------------------------------------
  const desiredRegions = [
    {
      name: "European Union",
      currency_code: "eur",
      countries: ["de", "fr", "nl", "be", "it", "es", "pt", "at", "ie"],
    },
    {
      name: "United States",
      currency_code: "usd",
      countries: ["us", "ca"],
    },
  ];

  const existingRegions = await regionService.listRegions({}, { take: 100 });
  const existingRegionNames = new Set(existingRegions.map((r) => r.name));

  const regionsToCreate = desiredRegions.filter(
    (r) => !existingRegionNames.has(r.name)
  );
  stats.regionsSkipped = desiredRegions.length - regionsToCreate.length;

  if (regionsToCreate.length) {
    try {
      const { result } = await createRegionsWorkflow(container).run({
        input: { regions: regionsToCreate },
      });
      stats.regionsCreated = result.length;
      for (const r of result) {
        logger.info(`Created region: ${r.name} (${r.currency_code})`);
      }
    } catch (err) {
      const msg = `createRegionsWorkflow failed: ${(err as Error).message}`;
      logger.error(msg);
      stats.errors.push(msg);
    }
  }

  // ---------------------------------------------------------------------------
  // E.2  Mirror GBP prices into EUR + USD on every variant that lacks them.
  // ---------------------------------------------------------------------------
  // Rough conversion: GBP -> EUR x 1.15, GBP -> USD x 1.27. Computed in
  // pence/cents (Medusa stores integer minor units).
  const fxFromGbp = { eur: 1.15, usd: 1.27 } as const;

  // Pricing lives in a separate module from product; the productService
  // doesn't expose `variants.prices` through its repo (the deep relation
  // throws inside mikro-orm: "Cannot read properties of undefined (reading
  // 'strategy')"). Use the remote-query graph instead; it follows the
  // module link product_variant -> price_set -> prices for us.
  const { data: graphProducts } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "handle",
      "variants.id",
      "variants.price_set.prices.amount",
      "variants.price_set.prices.currency_code",
    ],
  });

  type GraphVariant = {
    id: string;
    price_set?: {
      prices?: Array<{ amount: number; currency_code: string }>;
    } | null;
  };
  type GraphProduct = { id: string; handle: string; variants?: GraphVariant[] };

  const variantPatchByProduct = new Map<
    string,
    Array<{ id: string; prices: Array<{ amount: number; currency_code: string }> }>
  >();

  for (const product of graphProducts as GraphProduct[]) {
    for (const variant of product.variants ?? []) {
      const existingByCurrency = new Map(
        (variant.price_set?.prices ?? []).map((p) => [p.currency_code, p.amount])
      );
      const gbp = existingByCurrency.get("gbp");
      if (!gbp) continue; // can't mirror without a GBP baseline

      const newPrices: Array<{ amount: number; currency_code: string }> = [];
      for (const cur of ["eur", "usd"] as const) {
        if (existingByCurrency.has(cur)) continue;
        newPrices.push({
          amount: Math.round(gbp * fxFromGbp[cur]),
          currency_code: cur,
        });
      }
      if (newPrices.length === 0) continue;

      // updateProductsWorkflow expects the FULL desired prices array on the
      // variant (it replaces, not merges). Re-include the existing prices
      // so we don't drop GBP.
      const fullPrices = [
        ...Array.from(existingByCurrency.entries()).map(([currency_code, amount]) => ({
          amount,
          currency_code,
        })),
        ...newPrices,
      ];

      const arr = variantPatchByProduct.get(product.id) ?? [];
      arr.push({ id: variant.id, prices: fullPrices });
      variantPatchByProduct.set(product.id, arr);

      stats.pricesAdded += newPrices.length;
    }
  }

  if (variantPatchByProduct.size) {
    const productsPatch = Array.from(variantPatchByProduct.entries()).map(
      ([id, variants]) => ({ id, variants })
    );
    try {
      await updateProductsWorkflow(container).run({
        input: { products: productsPatch as Parameters<typeof updateProductsWorkflow>["arguments"] extends unknown ? any : any },
      } as any);
      logger.info(
        `Patched prices on ${productsPatch.length} product(s) (${stats.pricesAdded} new currency rows).`
      );
    } catch (err) {
      // Pricing API is the most fragile slice in v2: log + continue rather
      // than crashing the whole seed. Storefront still works without EUR/USD
      // prices; products just won't render in those regions.
      const msg = `updateProductsWorkflow(prices) failed: ${(err as Error).message}. Skipping price mirror; geo modal will still work but EUR/USD products may render with no price.`;
      logger.warn(msg);
      stats.errors.push(msg);
    }
  } else {
    logger.info("All variants already have EUR/USD prices: nothing to mirror.");
  }

  // ---------------------------------------------------------------------------
  // Report
  // ---------------------------------------------------------------------------
  logger.info("===== seed-sample summary =====");
  logger.info(JSON.stringify(stats, null, 2));
  logger.info("================================");
}
