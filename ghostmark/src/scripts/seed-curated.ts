/* ============================================================================
 * DO NOT RUN THIS SCRIPT. IT WOULD SEED 18 PRODUCTS AT 100x THEIR PRICE.
 * ============================================================================
 *
 * `:183` says "price in GBP minor units (pence)" and `:189` types the field
 * `basePriceGbp: number; // pence`. Every one of the 18 catalogue entries at
 * :202-:401 is therefore a MINOR-unit integer, and :575 writes it straight
 * into `prices[].amount`.
 *
 * THE CONVENTION FLIPPED ON 2026-08-30. migrate-price-units converted the
 * catalogue to MAJOR units. Measured live against the database that day:
 *
 *        basePriceGbp here      live gbp price      would seed as
 *        8900 (atelier-hoodie)  89                  GBP 8,900.00
 *        3200 (tech-pouch)      32                  GBP 3,200.00
 *        7500                   75                  GBP 7,500.00
 *
 * The eur/usd amounts at :576-:583 are FX-derived from the same field, so they
 * inherit the error rather than escaping it.
 *
 * Only the CREATE path is convention-bearing: `createProductsWorkflow` at :595
 * runs for handles that do not already exist, so this is dormant while all 18
 * are present and arms itself the moment any one of them is deleted, or on any
 * fresh environment. That is the whole hazard — it is not broken today, it is
 * one product deletion away from being broken.
 *
 * NOTE the field name is why a `grep "amount:\s*[0-9]{3,}"` sweep does NOT
 * find this file. The literals hide behind `basePriceGbp`. If you are auditing
 * for this class, grep the VALUES, not the key.
 *
 * Before running this again: convert the 18 literals to major units (divide by
 * 100), or delete the file. The hard gate below exists so that decision is
 * made deliberately rather than by someone running a plausibly-named seed.
 * ========================================================================== */

import { ExecArgs } from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils";
import {
  createProductsWorkflow,
  updateProductsWorkflow,
  batchLinkProductsToCategoryWorkflow,
  batchLinkProductsToCollectionWorkflow,
  createInventoryLevelsWorkflow,
} from "@medusajs/medusa/core-flows";

/**
 * Curated, consistent sample dataset for the GhostMark storefront.
 *
 * Goals (vs the previous seed which mixed unrelated photos / left categories empty):
 *   1. Every product's 4 images come from a SINGLE curated set
 *      (e.g. 4 cream-T-shirt photos, never tee + sweatshirt + bag mixed).
 *   2. Every nested category has at least 2 products.
 *   3. Naming follows: "{Material/Style} {ProductType} - {Variant detail}".
 *   4. Pricing ladder in GBP (mirrored to EUR x1.15, USD x1.27).
 *   5. Collections are coherent:
 *        DTF       = direct-to-film printable apparel
 *        hot-deals = bestseller / on-sale slice
 *
 * Idempotent:
 *   - Existing products (by handle) are *updated*, not recreated.
 *   - New products are only created if their handle does not exist.
 *   - Category & collection links are deduped against existing links.
 *   - Inventory levels are only created when missing.
 *   - Price mirroring (EUR/USD) only fills currencies that are absent.
 *
 * Reads use `query.graph` (the only path that reliably hydrates module links
 * like product->categories, product->variants->price_set->prices in v2.11.x).
 * Writes use `@medusajs/medusa/core-flows` workflows.
 */

// ---------------------------------------------------------------------------
// Curated photo sets (Unsplash photo IDs grouped by visual category).
// Picked so all 4 images in a product show the SAME item type.
// ---------------------------------------------------------------------------
const PHOTO_SETS = {
  "tshirt-cream": [
    "photo-1521572163474-6864f9cf17ab",
    "photo-1581655353564-df123a1eb820",
    "photo-1503342217505-b0a15ec3261c",
    "photo-1622445275576-721325763afe",
  ],
  "tshirt-charcoal": [
    "photo-1576566588028-4147f3842f27",
    "photo-1583743814966-8936f5b7be1a",
    "photo-1618354691373-d851c5c3a990",
    "photo-1606107557195-0e29a4b5b4aa",
  ],
  "hoodie-cream": [
    "photo-1556821840-3a63f95609a7",
    "photo-1620799140408-edc6dcb6d633",
    "photo-1576566588028-4147f3842f27",
    "photo-1591047139829-d91aecb6caea",
  ],
  // Split out of "hoodie-cream" on 2026-08-30, for the same reason
  // "sweatshirt-black" was split out of "hoodie-charcoal": Heavyweight
  // Sweatshirt - Cream was sharing the cream HOODIE's photographs, so a
  // crewneck was illustrated by a hooded pullover on every surface.
  //
  // This pair had NO dead URL hiding it. Every image rendered perfectly and
  // showed the wrong garment, which is why it survived longer than the charcoal
  // pair: a 404 gets reported, a plausible-but-wrong photo does not. On an
  // apparel site that is a returns problem, not a cosmetic one.
  // All four verified HTTP 200 before use.
  "sweatshirt-cream": [
    "photo-1621560464578-b399f0e9221f",
    "photo-1632682582909-2b3a2581eef7",
    "photo-1704915091057-cc443c8ef019",
    "photo-1627134137273-fa8bf6897f29",
  ],
  // NOTE: index 0 was "photo-1614495039944-6dad99a36e4f" until 2026-08-30, when
  // it began returning HTTP 404 from images.unsplash.com. Because seed-curated
  // copies images[0] into `thumbnail`, a dead id in slot 0 breaks the product
  // card everywhere, not just the gallery. Replacement verified 200 before use.
  "hoodie-charcoal": [
    "photo-1578470507807-3fc541d5f544",
    "photo-1618354691373-d851c5c3a990",
    "photo-1542272604-787c3835535d",
    "photo-1556821840-3a63f95609a7",
  ],
  // Split out of "hoodie-charcoal" on 2026-08-30. Heavyweight Sweatshirt -
  // Black previously shared the charcoal HOODIE's photographs, so a crewneck
  // sweatshirt was illustrated by a hooded pullover on every surface. The dead
  // id above was merely hiding it. The comment at the top of PHOTO_SETS
  // ("Picked so all 4 images in a product show the SAME item type") was being
  // violated by the sharing, not by the set. All four verified 200 before use.
  "sweatshirt-black": [
    "photo-1618354691551-44de113f0164",
    "photo-1499971442178-8c10fdf5f6ac",
    "photo-1656339504243-2df4c5ebf1c0",
    "photo-1576558345433-58e777a5e423",
  ],
  // ---------------------------------------------------------------------------
  // Split out on 2026-08-30. Four products were illustrated with photographs of
  // a DIFFERENT PRODUCT because they borrowed a neighbouring set:
  //     cable-organiser  <- "notebook"   studio-candle    <- "mug"
  //     linen-tea-towel  <- "tote"       tech-pouch       <- "tote"
  // No dead URL was involved. Every image rendered perfectly and showed the
  // wrong item, which is exactly why these outlived the 404s: a broken image
  // gets reported, a plausible-but-wrong one gets bought and returned.
  //
  // The sets they borrowed FROM are unchanged and still correct for their own
  // products (studio-notebook-a5/a6, the ceramic mugs, market-tote-oat,
  // workshop-tote). All 16 ids below verified HTTP 200 before use.
  // ---------------------------------------------------------------------------
  "cable-organiser": [
    "photo-1760348213270-7cd00b8c3405",
    "photo-1634839763563-97d93f8131c6",
    "photo-1634839763121-58fcfed2a94a",
    "photo-1525972231415-e52a7a56c905",
  ],
  candle: [
    "photo-1561212856-44e9bae482aa",
    "photo-1601922046210-41e129a3e64a",
    "photo-1528351655744-27cc30462816",
    "photo-1640095889747-2090ee12fa7d",
  ],
  "tea-towel": [
    "photo-1643150899069-a748f9216f99",
    "photo-1650917469541-7578d83c2903",
    "photo-1554042861-c5b9add98f2c",
    "photo-1617076678834-b804507ebf61",
  ],
  "tech-pouch": [
    "photo-1620093349352-3d6c6eec7fc4",
    "photo-1641700409025-015f1eb02a68",
    "photo-1613896640137-bb5b31496315",
    "photo-1703564202694-b102aa465666",
  ],
  tote: [
    "photo-1591561954557-26941169b49e",
    "photo-1572883454114-1cf0031ede2a",
    "photo-1597481499750-3e6b22637e12",
    "photo-1574365569389-a10d488ca3fb",
  ],
  cap: [
    "photo-1521369909029-2afed882baee",
    "photo-1556306535-0f09a537f0a3",
    "photo-1620207418302-439b387441b0",
    "photo-1572635196237-14b3f281503f",
  ],
  mug: [
    "photo-1514228742587-6b1558fcca3d",
    "photo-1572119865084-43c285814d63",
    "photo-1551892374-ecf8754cf8b0",
    "photo-1616241673111-508b4662c707",
  ],
  bottle: [
    "photo-1602143407151-7111542de6e8",
    "photo-1523275335684-37898b6baf30",
    "photo-1625708458528-802ec79b1ed8",
    "photo-1610725664285-7c57e6eeac3f",
  ],
  notebook: [
    "photo-1531346878377-a5be20888e57",
    "photo-1517842645767-c639042777db",
    "photo-1455390582262-044cdead277a",
    "photo-1532153975070-2e9ab71f1b14",
  ],
  sticker: [
    "photo-1611117775350-ac3950990985",
    "photo-1572177812156-58036aae439c",
    "photo-1518611012118-696072aa579a",
    "photo-1625768376503-68d2495d78c5",
  ],
} as const;

type PhotoSet = keyof typeof PHOTO_SETS;

const toImageUrls = (set: PhotoSet) =>
  PHOTO_SETS[set].map((id) => `https://images.unsplash.com/${id}?w=900&q=80`);

// ---------------------------------------------------------------------------
// New product catalogue (added to fill empty categories).
// Each entry: handle is unique; price in GBP minor units (pence).
// ---------------------------------------------------------------------------
type NewProduct = {
  handle: string;
  title: string;
  description: string;
  basePriceGbp: number; // pence
  options: Array<{ title: string; values: string[] }>;
  photoSet: PhotoSet;
  categories: string[]; // category handles
};

const NEW_CATALOGUE: NewProduct[] = [
  // --- Sweatshirts (parent: apparel / sub: apparel-sweatshirts) ---
  {
    handle: "heavyweight-sweatshirt-cream",
    title: "Heavyweight Sweatshirt - Cream",
    description:
      "400gsm brushed-back loopback cotton crewneck in undyed cream. Made in Europe. Built for years.",
    basePriceGbp: 7500,
    options: [{ title: "Size", values: ["S", "M", "L", "XL"] }],
    photoSet: "sweatshirt-cream",
    categories: ["apparel", "apparel-sweatshirts"],
  },
  {
    handle: "heavyweight-sweatshirt-black",
    title: "Heavyweight Sweatshirt - Black",
    description:
      "400gsm brushed-back loopback cotton crewneck in deep pigment black. Made in Europe. Built for years.",
    basePriceGbp: 7500,
    options: [{ title: "Size", values: ["S", "M", "L", "XL"] }],
    photoSet: "sweatshirt-black",
    categories: ["apparel", "apparel-sweatshirts"],
  },

  // --- Mugs (parent: drinkware / sub: drinkware-mugs) ---
  {
    handle: "ceramic-mug-cream",
    title: "Ceramic Mug - Cream",
    description:
      "Hand-thrown stoneware mug in matte cream glaze. 350ml. Dishwasher and microwave safe.",
    basePriceGbp: 1800,
    options: [{ title: "Size", values: ["350ml"] }],
    photoSet: "mug",
    categories: ["drinkware", "drinkware-mugs"],
  },
  {
    handle: "ceramic-mug-sage",
    title: "Ceramic Mug - Sage",
    description:
      "Hand-thrown stoneware mug in soft sage glaze. 350ml. Dishwasher and microwave safe.",
    basePriceGbp: 1800,
    options: [{ title: "Size", values: ["350ml"] }],
    photoSet: "mug",
    categories: ["drinkware", "drinkware-mugs"],
  },

  // --- Bottles (parent: drinkware / sub: drinkware-bottles) ---
  {
    handle: "steel-bottle-500",
    title: "Steel Bottle - 500ml",
    description:
      "Double-walled vacuum-insulated stainless steel bottle. Keeps cold for 24h. BPA-free.",
    basePriceGbp: 2800,
    options: [{ title: "Size", values: ["500ml"] }],
    photoSet: "bottle",
    categories: ["drinkware", "drinkware-bottles"],
  },
  {
    handle: "steel-bottle-750",
    title: "Steel Bottle - 750ml",
    description:
      "Double-walled vacuum-insulated stainless steel bottle. Keeps cold for 24h. BPA-free.",
    basePriceGbp: 3200,
    options: [{ title: "Size", values: ["750ml"] }],
    photoSet: "bottle",
    categories: ["drinkware", "drinkware-bottles"],
  },

  // --- Tumblers (parent: drinkware / sub: drinkware-tumblers) ---
  {
    handle: "insulated-tumbler-cream",
    title: "Insulated Tumbler - Cream",
    description:
      "Triple-insulated stainless tumbler with sip-through lid. 470ml. Powder-coated cream finish.",
    basePriceGbp: 2400,
    options: [{ title: "Size", values: ["470ml"] }],
    photoSet: "bottle",
    categories: ["drinkware", "drinkware-tumblers"],
  },
  {
    handle: "insulated-tumbler-black",
    title: "Insulated Tumbler - Black",
    description:
      "Triple-insulated stainless tumbler with sip-through lid. 470ml. Powder-coated matte black finish.",
    basePriceGbp: 2400,
    options: [{ title: "Size", values: ["470ml"] }],
    photoSet: "bottle",
    categories: ["drinkware", "drinkware-tumblers"],
  },

  // --- Stickers (parent: accessories / sub: accessories-stickers) ---
  {
    handle: "studio-sticker-pack",
    title: "Studio Sticker Pack",
    description:
      "Set of 8 die-cut weatherproof vinyl stickers. UV-coated. Drawn in-house.",
    basePriceGbp: 800,
    options: [{ title: "Size", values: ["Pack of 8"] }],
    photoSet: "sticker",
    categories: ["accessories", "accessories-stickers"],
  },
  {
    handle: "logo-sticker-sheet",
    title: "Logo Sticker Sheet",
    description:
      "12-piece sheet of mixed-format mark stickers. Matte vinyl, kiss-cut for easy peel.",
    basePriceGbp: 600,
    options: [{ title: "Size", values: ["Sheet of 12"] }],
    photoSet: "sticker",
    categories: ["accessories", "accessories-stickers"],
  },

  // --- Notebooks (parent: accessories / sub: accessories-notebooks) ---
  {
    handle: "studio-notebook-a5",
    title: "Studio Notebook - A5",
    description:
      "Thread-bound A5 notebook, 192 dotted pages on 100gsm cream paper. Linen cover.",
    basePriceGbp: 1400,
    options: [{ title: "Size", values: ["A5"] }],
    photoSet: "notebook",
    categories: ["accessories", "accessories-notebooks"],
  },
  {
    handle: "studio-notebook-a6",
    title: "Studio Notebook - A6",
    description:
      "Pocket A6 notebook, 128 dotted pages on 100gsm cream paper. Linen cover.",
    basePriceGbp: 1200,
    options: [{ title: "Size", values: ["A6"] }],
    photoSet: "notebook",
    categories: ["accessories", "accessories-notebooks"],
  },

  // --- Tech (parent: lifestyle / sub: lifestyle-tech) ---
  {
    handle: "cable-organiser",
    title: "Cable Organiser",
    description:
      "Compact leather-and-elastic cable wrap. Holds charger, cables and a dongle. Fits any pocket.",
    basePriceGbp: 1800,
    options: [{ title: "Size", values: ["Standard"] }],
    photoSet: "cable-organiser",
    categories: ["lifestyle", "lifestyle-tech"],
  },
  {
    handle: "tech-pouch",
    title: "Tech Pouch",
    description:
      "Zippered canvas pouch for chargers, drives and adapters. Two internal sleeves. Built to fit a 13in laptop charger.",
    basePriceGbp: 3200,
    options: [{ title: "Size", values: ["Standard"] }],
    photoSet: "tech-pouch",
    categories: ["lifestyle", "lifestyle-tech"],
  },

  // --- Home (parent: lifestyle / sub: lifestyle-home) ---
  {
    handle: "studio-candle",
    title: "Studio Candle",
    description:
      "Soy-wax candle in cream ceramic vessel. 220g, 50h burn. Notes of cedar, vetiver, dry tobacco.",
    basePriceGbp: 2800,
    options: [{ title: "Size", values: ["220g"] }],
    photoSet: "candle",
    categories: ["lifestyle", "lifestyle-home"],
  },
  {
    handle: "linen-tea-towel",
    title: "Linen Tea Towel",
    description:
      "Stonewashed linen tea towel in oat. 50x70cm. Pre-shrunk; gets softer with each wash.",
    basePriceGbp: 1800,
    options: [{ title: "Size", values: ["50x70cm"] }],
    photoSet: "tea-towel",
    categories: ["lifestyle", "lifestyle-home"],
  },

  // --- Filler products so every sub-category has >=2 ---
  // Hoodies: pair the (cream) Atelier Hoodie with a charcoal counterpart.
  {
    handle: "atelier-hoodie-charcoal",
    title: "Atelier Hoodie - Charcoal",
    description:
      "Brushed-back fleece pullover hoodie in pigment-dyed charcoal. Two-piece hood, kangaroo pocket, rib-knit cuffs. Made in Europe. Built for years.",
    basePriceGbp: 8900,
    options: [{ title: "Size", values: ["S", "M", "L", "XL"] }],
    photoSet: "hoodie-charcoal",
    categories: ["apparel", "apparel-hoodies"],
  },
  // Caps: pair the natural GhostMark Cap with a black 5-panel.
  {
    handle: "panel-cap-black",
    title: "Panel Cap - Black",
    description:
      "Unstructured 5-panel cap in washed cotton twill. Curved peak, brass slider closure.",
    basePriceGbp: 2800,
    options: [{ title: "Size", values: ["One Size"] }],
    photoSet: "cap",
    categories: ["apparel", "apparel-caps"],
  },
  // Totes: pair the canvas Workshop Tote with an oat market tote.
  {
    handle: "market-tote-oat",
    title: "Market Tote - Oat",
    description:
      "12oz washed canvas market tote with internal sleeve and webbed handles. Dye-printed mark.",
    basePriceGbp: 2400,
    options: [{ title: "Size", values: ["One Size"] }],
    photoSet: "tote",
    categories: ["accessories", "accessories-totes"],
  },
];

// ---------------------------------------------------------------------------
// Image overhaul map for the 5 EXISTING products.
// ---------------------------------------------------------------------------
const EXISTING_IMAGE_OVERHAUL: Record<string, PhotoSet> = {
  "studio-tee-cream": "tshirt-cream",
  "studio-tee-charcoal": "tshirt-charcoal",
  "atelier-hoodie": "hoodie-cream",
  "workshop-tote": "tote",
  "ghostmark-cap": "cap",
};

// ---------------------------------------------------------------------------
// Collection composition.
// ---------------------------------------------------------------------------
// NOTE: in Medusa v2 a product can only belong to a single collection
// (collection_id is a one-to-many FK on the product, not a link table).
// Each handle below appears in EXACTLY ONE collection to avoid the
// re-link ping-pong that would silently move a product between
// collections on every seed run.
const COLLECTION_COMPOSITION: Record<string, string[]> = {
  // DTF = direct-to-film printable apparel showcase
  dtf: [
    "atelier-hoodie",
    "heavyweight-sweatshirt-cream",
    "heavyweight-sweatshirt-black",
    "studio-tee-cream",
  ],
  // hot-deals = bestseller / on-sale tile
  // (studio-tee-cream lives in DTF; hot-deals leans on the charcoal tee
  // plus tote, cap and stickers which form a coherent "pick-up" lineup.)
  "hot-deals": [
    "studio-tee-charcoal",
    "workshop-tote",
    "ghostmark-cap",
    "studio-sticker-pack",
  ],
};

// FX rates from GBP (minor unit math, rounded to nearest minor unit).
const FX_FROM_GBP = { eur: 1.15, usd: 1.27 } as const;

export default async function seedCurated({ container }: ExecArgs) {
  // Hard gate. See the DO NOT RUN banner at the top of this file.
  // Throws rather than returns: a `return` exits 0 and any CI wrapper
  // checking the exit status would read the refusal as a successful run.
  if (process.env.I_HAVE_FIXED_THE_UNIT_CONVENTION !== "yes") {
    const msg =
      "[seed-curated] REFUSING TO RUN. Its 18 basePriceGbp literals (:202-401) " + "are MINOR units (8900 = GBP 89.00), but the catalogue moved to MAJOR units " + "on 2026-08-30. Seeding any missing product would price it 100x high. " + "Convert the literals to major units (or delete this file) before re-enabling.";
    console.error(msg);
    throw new Error(msg);
  }
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const productService = container.resolve(Modules.PRODUCT);
  const salesChannelService = container.resolve(Modules.SALES_CHANNEL);
  const stockLocationService = container.resolve(Modules.STOCK_LOCATION);

  const stats = {
    productsCreated: 0,
    productsSkipped: 0,
    imagesOverwritten: 0,
    categoryLinksMade: 0,
    collectionLinksMade: 0,
    inventoryLevelsCreated: 0,
    pricesMirrored: 0,
    errors: [] as string[],
  };

  // --- Resolve sales channel + stock location -------------------------------
  const channels = await salesChannelService.listSalesChannels({}, { take: 1 });
  if (!channels.length) {
    throw new Error(
      "No sales channel found. Run the base seed first or create one in admin."
    );
  }
  const sc = channels[0];
  logger.info(`Using sales channel: ${sc.name} (${sc.id})`);

  const locations = await stockLocationService.listStockLocations(
    {},
    { take: 1 }
  );
  const stockLocation = locations[0] ?? null;
  if (!stockLocation) {
    logger.warn(
      "No stock location found - new products will not get inventory levels."
    );
  }

  // --- Resolve categories ---------------------------------------------------
  const { data: existingCategories } = await query.graph({
    entity: "product_category",
    fields: ["id", "handle"],
  });
  const categoryHandleToId = new Map<string, string>(
    (existingCategories as Array<{ id: string; handle: string }>).map((c) => [
      c.handle,
      c.id,
    ])
  );

  // --- Pull existing product handles (for idempotency) ---------------------
  const { data: existingGraphProducts } = await query.graph({
    entity: "product",
    fields: ["id", "handle"],
  });
  const existingHandleToId = new Map<string, string>(
    (existingGraphProducts as Array<{ id: string; handle: string }>).map((p) => [
      p.handle,
      p.id,
    ])
  );

  // ---------------------------------------------------------------------------
  // PART A: Overhaul images on the 5 existing products.
  // ---------------------------------------------------------------------------
  const imagePatches: Array<{
    id: string;
    thumbnail: string;
    images: Array<{ url: string }>;
  }> = [];

  for (const [pHandle, photoSet] of Object.entries(EXISTING_IMAGE_OVERHAUL)) {
    const productId = existingHandleToId.get(pHandle);
    if (!productId) {
      logger.warn(`Existing product not found, skipping image overhaul: ${pHandle}`);
      continue;
    }
    const urls = toImageUrls(photoSet);
    imagePatches.push({
      id: productId,
      thumbnail: urls[0],
      images: urls.map((url) => ({ url })),
    });
  }

  if (imagePatches.length) {
    try {
      await updateProductsWorkflow(container).run({
        input: { products: imagePatches as any },
      } as any);
      stats.imagesOverwritten = imagePatches.length;
      logger.info(
        `Overhauled images on ${imagePatches.length} existing product(s).`
      );
    } catch (err) {
      const msg = `updateProductsWorkflow(image-overhaul) failed: ${(err as Error).message}`;
      logger.error(msg);
      stats.errors.push(msg);
    }
  }

  // ---------------------------------------------------------------------------
  // PART B: Create missing products.
  // ---------------------------------------------------------------------------
  const productsToCreate = NEW_CATALOGUE.filter(
    (p) => !existingHandleToId.has(p.handle)
  ).map((p) => {
    const urls = toImageUrls(p.photoSet);
    const optTitle = p.options[0].title;
    return {
      title: p.title,
      handle: p.handle,
      description: p.description,
      status: ProductStatus.PUBLISHED,
      thumbnail: urls[0],
      images: urls.map((url) => ({ url })),
      options: p.options,
      variants: p.options[0].values.map((v) => ({
        title: v,
        sku: `${p.handle.toUpperCase().replace(/-/g, "_")}_${v
          .toUpperCase()
          .replace(/\s+/g, "")
          .replace(/[^A-Z0-9]/g, "")}`,
        options: { [optTitle]: v },
        prices: [
          { amount: p.basePriceGbp, currency_code: "gbp" },
          {
            amount: Math.round(p.basePriceGbp * FX_FROM_GBP.eur),
            currency_code: "eur",
          },
          {
            amount: Math.round(p.basePriceGbp * FX_FROM_GBP.usd),
            currency_code: "usd",
          },
        ],
        manage_inventory: true,
      })),
      sales_channels: [{ id: sc.id }],
    };
  });

  stats.productsSkipped = NEW_CATALOGUE.length - productsToCreate.length;

  if (productsToCreate.length) {
    try {
      const { result } = await createProductsWorkflow(container).run({
        input: { products: productsToCreate as any },
      } as any);
      const created = result as Array<{ id: string; handle: string }>;
      for (const p of created) {
        existingHandleToId.set(p.handle, p.id);
        stats.productsCreated++;
      }
      logger.info(
        `Created ${created.length} new product(s): ${created
          .map((p) => p.handle)
          .join(", ")}`
      );
    } catch (err) {
      const msg = `createProductsWorkflow failed: ${(err as Error).message}`;
      logger.error(msg);
      stats.errors.push(msg);
    }
  } else {
    logger.info("All curated products already exist - no creation needed.");
  }

  // ---------------------------------------------------------------------------
  // PART B.2: Stock new variants at the default location.
  // ---------------------------------------------------------------------------
  if (stockLocation) {
    try {
      const inventoryService = container.resolve(Modules.INVENTORY);
      const allItems = await inventoryService.listInventoryItems(
        {},
        { take: 5000 }
      );
      const existingLevels = await inventoryService.listInventoryLevels(
        { location_id: stockLocation.id },
        { take: 10000 }
      );
      const stockedItemIds = new Set(
        existingLevels.map((l) => l.inventory_item_id)
      );
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
        stats.inventoryLevelsCreated = levelsToCreate.length;
        logger.info(
          `Created ${levelsToCreate.length} inventory level(s) at ${stockLocation.name}.`
        );
      } else {
        logger.info("All inventory items already stocked.");
      }
    } catch (err) {
      const msg = `inventory level seeding failed: ${(err as Error).message}`;
      logger.warn(msg);
      stats.errors.push(msg);
    }
  }

  // ---------------------------------------------------------------------------
  // PART B.3: Link new products to their categories.
  // ---------------------------------------------------------------------------
  // Build the full category map: existing 5 + new 16.
  const fullCategoryMap: Record<string, string[]> = {
    "studio-tee-cream": ["apparel", "apparel-tshirts"],
    "studio-tee-charcoal": ["apparel", "apparel-tshirts"],
    "atelier-hoodie": ["apparel", "apparel-hoodies"],
    "workshop-tote": ["accessories", "accessories-totes"],
    "ghostmark-cap": ["apparel", "apparel-caps"],
  };
  for (const p of NEW_CATALOGUE) fullCategoryMap[p.handle] = p.categories;

  // Re-resolve products with their categories so we don't double-link.
  const allProductHandles = Object.keys(fullCategoryMap);
  const productsWithCategories = await productService.listProducts(
    { handle: allProductHandles },
    { relations: ["categories"] }
  );
  const productByHandleWithCats = new Map(
    productsWithCategories.map((p) => [p.handle, p])
  );

  // categoryId -> product IDs to add
  const categoryAdds = new Map<string, string[]>();
  for (const [pHandle, catHandles] of Object.entries(fullCategoryMap)) {
    const product = productByHandleWithCats.get(pHandle);
    if (!product) {
      logger.warn(`Product not found for category link: ${pHandle}`);
      continue;
    }
    const existingCatIds = new Set((product.categories ?? []).map((c) => c.id));
    for (const catHandle of catHandles) {
      const catId = categoryHandleToId.get(catHandle);
      if (!catId) {
        logger.warn(`Category not found: ${catHandle}`);
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
      logger.info(
        `Linked ${productIds.length} product(s) to category ${catId}`
      );
    } catch (err) {
      const msg = `batchLinkProductsToCategoryWorkflow(${catId}) failed: ${(err as Error).message}`;
      logger.error(msg);
      stats.errors.push(msg);
    }
  }

  // ---------------------------------------------------------------------------
  // PART C: Recurate collections.
  // ---------------------------------------------------------------------------
  // Read collection IDs and (separately) walk products->collection_id so the
  // dedupe set is sourced from the same FK that batchLinkProductsToCollection
  // writes. Reading `product_collection.products.id` lags behind a recent
  // link write in v2.11.x, which previously caused the same product to be
  // re-linked on every run.
  const { data: collections } = await query.graph({
    entity: "product_collection",
    fields: ["id", "handle"],
  });
  const { data: graphProductsForCollections } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "collection_id"],
  });
  const collectionMembers = new Map<string, Set<string>>();
  for (const p of graphProductsForCollections as Array<{
    id: string;
    collection_id: string | null;
  }>) {
    if (!p.collection_id) continue;
    const set = collectionMembers.get(p.collection_id) ?? new Set<string>();
    set.add(p.id);
    collectionMembers.set(p.collection_id, set);
  }
  const collectionByHandle = new Map<
    string,
    { id: string; productIds: Set<string> }
  >(
    (collections as Array<{ id: string; handle: string }>).map((c) => [
      c.handle,
      { id: c.id, productIds: collectionMembers.get(c.id) ?? new Set() },
    ])
  );

  for (const [colHandle, pHandles] of Object.entries(COLLECTION_COMPOSITION)) {
    const col = collectionByHandle.get(colHandle);
    if (!col) {
      logger.warn(`Collection not found: ${colHandle}`);
      continue;
    }
    const idsToAdd: string[] = [];
    for (const ph of pHandles) {
      const productId = existingHandleToId.get(ph);
      if (!productId) {
        logger.warn(`Product not found for collection ${colHandle}: ${ph}`);
        continue;
      }
      if (col.productIds.has(productId)) continue;
      idsToAdd.push(productId);
    }
    if (!idsToAdd.length) continue;
    try {
      await batchLinkProductsToCollectionWorkflow(container).run({
        input: { id: col.id, add: idsToAdd },
      });
      stats.collectionLinksMade += idsToAdd.length;
      logger.info(
        `Linked ${idsToAdd.length} product(s) to collection ${colHandle}`
      );
    } catch (err) {
      const msg = `batchLinkProductsToCollectionWorkflow(${colHandle}) failed: ${(err as Error).message}`;
      logger.error(msg);
      stats.errors.push(msg);
    }
  }

  // ---------------------------------------------------------------------------
  // PART D: Mirror GBP -> EUR/USD on any variant missing those currencies.
  // (Catches the original 5 products which were seeded GBP-only.)
  // ---------------------------------------------------------------------------
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
  type GraphProduct = {
    id: string;
    handle: string;
    variants?: GraphVariant[];
  };

  const variantPatchByProduct = new Map<
    string,
    Array<{
      id: string;
      prices: Array<{ amount: number; currency_code: string }>;
    }>
  >();

  for (const product of graphProducts as GraphProduct[]) {
    for (const variant of product.variants ?? []) {
      const existingByCurrency = new Map(
        (variant.price_set?.prices ?? []).map((p) => [p.currency_code, p.amount])
      );
      const gbp = existingByCurrency.get("gbp");
      if (!gbp) continue;

      const newPrices: Array<{ amount: number; currency_code: string }> = [];
      for (const cur of ["eur", "usd"] as const) {
        if (existingByCurrency.has(cur)) continue;
        newPrices.push({
          amount: Math.round(gbp * FX_FROM_GBP[cur]),
          currency_code: cur,
        });
      }
      if (!newPrices.length) continue;

      // updateProductsWorkflow REPLACES the prices array; re-include existing.
      const fullPrices = [
        ...Array.from(existingByCurrency.entries()).map(
          ([currency_code, amount]) => ({ amount, currency_code })
        ),
        ...newPrices,
      ];

      const arr = variantPatchByProduct.get(product.id) ?? [];
      arr.push({ id: variant.id, prices: fullPrices });
      variantPatchByProduct.set(product.id, arr);
      stats.pricesMirrored += newPrices.length;
    }
  }

  if (variantPatchByProduct.size) {
    const productsPatch = Array.from(variantPatchByProduct.entries()).map(
      ([id, variants]) => ({ id, variants })
    );
    try {
      await updateProductsWorkflow(container).run({
        input: { products: productsPatch as any },
      } as any);
      logger.info(
        `Mirrored prices on ${productsPatch.length} product(s) (${stats.pricesMirrored} new currency rows).`
      );
    } catch (err) {
      const msg = `updateProductsWorkflow(price-mirror) failed: ${(err as Error).message}. Continuing.`;
      logger.warn(msg);
      stats.errors.push(msg);
    }
  } else {
    logger.info("All variants already priced in EUR/USD - nothing to mirror.");
  }

  // ---------------------------------------------------------------------------
  // Report
  // ---------------------------------------------------------------------------
  logger.info("===== seed-curated summary =====");
  logger.info(JSON.stringify(stats, null, 2));
  logger.info("================================");
}
