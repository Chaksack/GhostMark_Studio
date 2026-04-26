import { ExecArgs } from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils";
import {
  createProductsWorkflow,
  createInventoryLevelsWorkflow,
} from "@medusajs/medusa/core-flows";

/**
 * Targeted seed: only inserts demo products + inventory levels against the
 * EXISTING default sales channel and stock location. Does NOT touch:
 *   - regions (UK / GBP already exists; the bundled seed would create EUR)
 *   - tax regions (would 23505 on `gb`)
 *   - shipping options / fulfillment sets / publishable api keys (already there)
 *   - store currency (bundled seed flips default to EUR, which breaks GBP UI)
 *
 * Idempotency: uses `handle` checks before inserting each product, so a re-run
 * is a no-op for products already created. Inventory levels are only created
 * for inventory items that don't already have a level at the target location.
 */
export default async function seedProductsOnly({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const salesChannelService = container.resolve(Modules.SALES_CHANNEL);
  const stockLocationService = container.resolve(Modules.STOCK_LOCATION);

  // 1. Resolve the default sales channel — refuse to run if there isn't one,
  //    so we never silently create orphaned products.
  const channels = await salesChannelService.listSalesChannels({}, { take: 1 });
  if (!channels.length) {
    throw new Error(
      "No sales channel found. Run the full `seed.ts` first or create one in the admin."
    );
  }
  const sc = channels[0];
  logger.info(`Using sales channel: ${sc.name} (${sc.id})`);

  // 2. Resolve the stock location for inventory levels (optional — skip levels
  //    if no location exists rather than crashing).
  const locations = await stockLocationService.listStockLocations({}, { take: 1 });
  const stockLocation = locations[0] ?? null;
  if (!stockLocation) {
    logger.warn("No stock location found — products will be seeded without inventory levels.");
  }

  // 3. Pull existing handles so the script is idempotent on re-run.
  const { data: existing } = await query.graph({
    entity: "product",
    fields: ["handle"],
  });
  const existingHandles = new Set(existing.map((p: { handle: string }) => p.handle));

  // 4. Define the catalogue. Prices are in *minor units* (pence) per Medusa
  //    convention since v2 — 3500 = £35.00. Currency is GBP to match the
  //    existing UK region.
  const catalogue = [
    {
      title: "Studio Tee — Cream",
      handle: "studio-tee-cream",
      description:
        "Heavyweight 280gsm organic cotton tee in undyed cream. Boxy fit, dropped shoulder.",
      options: [{ title: "Size", values: ["S", "M", "L", "XL"] }],
      basePrice: 3500,
    },
    {
      title: "Studio Tee — Charcoal",
      handle: "studio-tee-charcoal",
      description:
        "The same 280gsm organic cotton in pigment-dyed charcoal. Softens with every wash.",
      options: [{ title: "Size", values: ["S", "M", "L", "XL"] }],
      basePrice: 3500,
    },
    {
      title: "Atelier Hoodie",
      handle: "atelier-hoodie",
      description:
        "Brushed-back fleece pullover hoodie. Two-piece hood, kangaroo pocket, rib-knit cuffs.",
      options: [{ title: "Size", values: ["S", "M", "L", "XL"] }],
      basePrice: 8900,
    },
    {
      title: "Workshop Tote",
      handle: "workshop-tote",
      description:
        "16oz natural canvas tote with reinforced base and webbed handles. Screen-printed mark.",
      options: [{ title: "Size", values: ["One Size"] }],
      basePrice: 2200,
    },
    {
      title: "GhostMark Cap",
      handle: "ghostmark-cap",
      description:
        "Unstructured 6-panel cap in washed cotton twill. Brass slider closure.",
      options: [{ title: "Size", values: ["One Size"] }],
      basePrice: 2800,
    },
  ];

  const productsToCreate = catalogue
    .filter((p) => !existingHandles.has(p.handle))
    .map((p) => ({
      title: p.title,
      handle: p.handle,
      description: p.description,
      status: ProductStatus.PUBLISHED,
      options: p.options,
      variants: p.options[0].values.map((v) => ({
        title: v,
        sku: `${p.handle.toUpperCase().replace(/-/g, "_")}_${v.toUpperCase().replace(/\s+/g, "")}`,
        options: { [p.options[0].title]: v },
        prices: [{ amount: p.basePrice, currency_code: "gbp" }],
        manage_inventory: true,
      })),
      sales_channels: [{ id: sc.id }],
    }));

  if (productsToCreate.length === 0) {
    logger.info("All catalogue products already exist — skipping product creation.");
  } else {
    logger.info(`Creating ${productsToCreate.length} product(s): ${productsToCreate.map((p) => p.handle).join(", ")}`);
    await createProductsWorkflow(container).run({
      input: { products: productsToCreate },
    });
  }

  // 5. Stock the new variants so the storefront can add them to a cart.
  //    Use the inventory module service directly to discover existing levels —
  //    the remote-query graph relationship from inventory_item -> levels isn't
  //    registered as a single property in this Medusa version, so we filter by
  //    explicitly listing levels at the target location.
  if (stockLocation) {
    const inventoryService = container.resolve(Modules.INVENTORY);
    const allItems = await inventoryService.listInventoryItems({}, { take: 1000 });
    const existingLevels = await inventoryService.listInventoryLevels(
      { location_id: stockLocation.id },
      { take: 5000 }
    );
    const stockedItemIds = new Set(existingLevels.map((l) => l.inventory_item_id));

    const levelsToCreate = allItems
      .filter((it) => !stockedItemIds.has(it.id))
      .map((it) => ({
        inventory_item_id: it.id,
        location_id: stockLocation.id,
        stocked_quantity: 100,
      }));

    if (levelsToCreate.length) {
      await createInventoryLevelsWorkflow(container).run({
        input: { inventory_levels: levelsToCreate },
      });
      logger.info(`Created ${levelsToCreate.length} inventory level(s) at ${stockLocation.name}.`);
    } else {
      logger.info("All inventory items already stocked at the target location.");
    }
  }

  logger.info("Done.");
}
