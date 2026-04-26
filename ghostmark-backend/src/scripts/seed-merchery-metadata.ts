// =============================================================================
// seed-merchery-metadata — populate the merchery-pattern metadata contract on
// every customizable product so the data-driven DesignEditor on the storefront
// can render print locations, technique tabs, and quantity ladders without any
// hard-coded fallbacks.
//
// Contract (see frontend agent spec):
//   product.metadata = {
//     is_customizable: boolean
//     print_locations?: PrintLocation[]
//     techniques?:      Technique[]
//     quantity_tiers?:  QuantityTier[]
//     moq?: number
//     lead_time_days?: { min: number; max: number }
//     // legacy fallback keys preserved on apparel
//     mockup_front?: string
//     mockup_back?:  string
//   }
//
// Stage coords are 600x800. Print areas are tuned per location family below.
//
// Idempotency: re-running this script over the same products is safe — the
// metadata patch is a structural REPLACE of the merchery keys (so tier counts
// don't grow) but is shallow-merged into any existing metadata so unrelated
// keys (e.g. mockup_front, anything else seeded earlier) survive untouched.
//
// Usage:
//   pnpm exec medusa exec ./src/scripts/seed-merchery-metadata.ts
// =============================================================================
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

// -----------------------------------------------------------------------------
// Types — must match the storefront contract exactly.
// -----------------------------------------------------------------------------
interface PrintArea { x: number; y: number; width: number; height: number }
interface PrintLocation {
  key: string
  label: string
  mockup_url?: string
  area?: PrintArea
}
interface Technique {
  key: string
  label: string
  surcharge?: number
}
interface QuantityTier {
  quantity: number
  unit_amount: number
}

// -----------------------------------------------------------------------------
// Reusable print-area presets (stage = 600x800).
// -----------------------------------------------------------------------------
const AREA = {
  apparelFront:   { x: 150, y: 200, width: 300, height: 400 },
  apparelBack:    { x: 100, y: 150, width: 400, height: 500 },
  capFront:       { x: 200, y: 250, width: 200, height: 200 },
  capSide:        { x: 50,  y: 350, width: 200, height: 100 },
  capBack:        { x: 200, y: 250, width: 200, height: 150 },
  mugBack:        { x: 100, y: 200, width: 400, height: 300 },
  bottleBack:     { x: 200, y: 200, width: 200, height: 400 },
  toteCenter:     { x: 150, y: 200, width: 300, height: 400 },
  notebookCover:  { x: 100, y: 100, width: 400, height: 600 },
  smallCorner:    { x: 350, y: 550, width: 150, height: 150 },
  jarLabel:       { x: 150, y: 250, width: 300, height: 300 },
  pouchFront:     { x: 150, y: 250, width: 300, height: 300 },
} as const

// -----------------------------------------------------------------------------
// Family templates — the per-product map below picks one and the script then
// hydrates `mockup_url` from each product's image list at runtime.
// -----------------------------------------------------------------------------
type Family = {
  locations: Array<Omit<PrintLocation, "mockup_url">>
  techniques: Technique[]
  // tiers: each [quantity, discount] -> unit_amount = round(base * (1 - d))
  tierLadder: Array<[number, number]>
  moq: number
  lead?: { min: number; max: number }
  // how many images to map onto the locations (front/back/etc).
  imageSlots: number
  // for apparel: keep legacy mockup_front / mockup_back keys.
  legacyApparelMockups?: boolean
}

const FAMILY = {
  // ---------------------------- APPAREL --------------------------------------
  apparelTee: {
    locations: [
      { key: "front", label: "Front (chest)", area: AREA.apparelFront },
      { key: "back",  label: "Back (full)",   area: AREA.apparelBack },
    ],
    techniques: [
      { key: "screen-print",  label: "Screen printing",     surcharge: 0 },
      { key: "transfer",      label: "Full colour transfer", surcharge: 150 },
      { key: "embroidery",    label: "Embroidery (small)",   surcharge: 300 },
    ],
    tierLadder: [
      [25, 0],   [50, 0.07], [100, 0.15], [200, 0.22],
      [300, 0.28], [500, 0.34], [1000, 0.40],
    ],
    moq: 25,
    lead: { min: 10, max: 15 },
    imageSlots: 2,
    legacyApparelMockups: true,
  } satisfies Family,

  apparelHeavyweight: {
    locations: [
      { key: "front", label: "Front (chest)", area: AREA.apparelFront },
      { key: "back",  label: "Back (full)",   area: AREA.apparelBack },
    ],
    techniques: [
      { key: "embroidery",     label: "Embroidery",            surcharge: 250 },
      { key: "screen-print",   label: "Screen printing",       surcharge: 0 },
      { key: "transfer",       label: "Full colour transfer",  surcharge: 200 },
      { key: "screen-transfer",label: "Screen transfer",       surcharge: 150 },
    ],
    tierLadder: [
      [15, 0],   [25, 0.05], [50, 0.12], [100, 0.20],
      [200, 0.25], [300, 0.30], [400, 0.33],
    ],
    moq: 15,
    lead: { min: 10, max: 20 },
    imageSlots: 2,
    legacyApparelMockups: true,
  } satisfies Family,

  // ---------------------------- HEADWEAR -------------------------------------
  cap: {
    locations: [
      { key: "front", label: "Front (3D embroidery)", area: AREA.capFront },
      { key: "side",  label: "Side (left)",           area: AREA.capSide },
      { key: "back",  label: "Back (closure strap)",  area: AREA.capBack },
    ],
    techniques: [
      { key: "embroidery-3d",   label: "Embroidery (3D)",   surcharge: 350 },
      { key: "embroidery-flat", label: "Embroidery (flat)", surcharge: 200 },
      { key: "patch-woven",     label: "Patch (woven)",     surcharge: 250 },
      { key: "patch-leather",   label: "Patch (leather)",   surcharge: 400 },
      { key: "heat-transfer",   label: "Heat transfer",     surcharge: 100 },
    ],
    tierLadder: [
      [20, 0], [50, 0.08], [100, 0.16], [200, 0.22], [300, 0.28], [400, 0.32],
    ],
    moq: 20,
    lead: { min: 10, max: 15 },
    imageSlots: 3,
  } satisfies Family,

  // ---------------------------- DRINKWARE ------------------------------------
  mug: {
    locations: [{ key: "back", label: "Back", area: AREA.mugBack }],
    techniques: [
      { key: "pad-print",       label: "Pad printing",                  surcharge: 0 },
      { key: "laser-engraving", label: "Laser engraving (single-color)", surcharge: 200 },
    ],
    tierLadder: [
      [25, 0], [50, 0.10], [100, 0.18], [200, 0.25], [500, 0.32],
    ],
    moq: 25,
    lead: { min: 10, max: 15 },
    imageSlots: 1,
  } satisfies Family,

  bottle: {
    locations: [{ key: "back", label: "Back", area: AREA.bottleBack }],
    techniques: [
      { key: "laser-engraving", label: "Laser engraving", surcharge: 250 },
      { key: "pad-print",       label: "Pad printing",    surcharge: 0 },
    ],
    tierLadder: [
      [25, 0], [50, 0.08], [100, 0.15], [250, 0.22], [500, 0.30],
    ],
    moq: 25,
    lead: { min: 12, max: 18 },
    imageSlots: 1,
  } satisfies Family,

  // ---------------------------- BAGS -----------------------------------------
  tote: {
    locations: [
      { key: "center-front", label: "Center front", area: AREA.toteCenter },
      { key: "center-back",  label: "Center back",  area: AREA.toteCenter },
    ],
    techniques: [
      { key: "screen-print",  label: "Screen printing", surcharge: 0 },
      { key: "heat-transfer", label: "Heat transfer",   surcharge: 100 },
      { key: "embroidery",    label: "Embroidery",      surcharge: 300 },
    ],
    tierLadder: [
      [15, 0], [50, 0.10], [100, 0.18], [500, 0.30],
    ],
    moq: 15,
    lead: { min: 6, max: 15 },
    imageSlots: 2,
  } satisfies Family,

  // ---------------------------- ACCESSORIES ----------------------------------
  notebook: {
    locations: [
      { key: "front-cover", label: "Front cover", area: AREA.notebookCover },
      { key: "back-cover",  label: "Back cover",  area: AREA.notebookCover },
    ],
    techniques: [
      { key: "deboss",       label: "Debossing",      surcharge: 200 },
      { key: "foil-stamp",   label: "Foil stamping",  surcharge: 250 },
      { key: "screen-print", label: "Screen printing", surcharge: 0 },
    ],
    tierLadder: [
      [25, 0], [50, 0.08], [100, 0.15], [250, 0.22],
    ],
    moq: 25,
    lead: { min: 10, max: 18 },
    imageSlots: 2,
  } satisfies Family,

  pouch: {
    locations: [{ key: "front", label: "Front", area: AREA.pouchFront }],
    techniques: [
      { key: "screen-print", label: "Screen printing", surcharge: 0 },
      { key: "embroidery",   label: "Embroidery",      surcharge: 250 },
    ],
    tierLadder: [
      [25, 0], [50, 0.08], [100, 0.15], [250, 0.22],
    ],
    moq: 25,
    lead: { min: 10, max: 15 },
    imageSlots: 1,
  } satisfies Family,

  candle: {
    locations: [{ key: "jar", label: "Jar label", area: AREA.jarLabel }],
    techniques: [
      { key: "screen-print", label: "Screen printing",    surcharge: 0 },
      { key: "custom-label", label: "Custom label print", surcharge: 100 },
    ],
    tierLadder: [
      [25, 0], [50, 0.08], [100, 0.15], [250, 0.22],
    ],
    moq: 25,
    lead: { min: 10, max: 18 },
    imageSlots: 1,
  } satisfies Family,

  teaTowel: {
    locations: [{ key: "corner", label: "Corner", area: AREA.smallCorner }],
    techniques: [
      { key: "screen-print", label: "Screen printing", surcharge: 0 },
      { key: "embroidery",   label: "Embroidery",      surcharge: 200 },
    ],
    tierLadder: [
      [25, 0], [50, 0.08], [100, 0.15], [250, 0.22],
    ],
    moq: 25,
    lead: { min: 10, max: 15 },
    imageSlots: 1,
  } satisfies Family,
} as const

// -----------------------------------------------------------------------------
// Per-product manifest. Order is reporting order.
// -----------------------------------------------------------------------------
type ProductSpec =
  | { handle: string; family: keyof typeof FAMILY }
  | { handle: string; nonCustomizable: true }

const PRODUCTS: ProductSpec[] = [
  // Apparel
  { handle: "studio-tee-cream",            family: "apparelTee" },
  { handle: "studio-tee-charcoal",         family: "apparelTee" },
  { handle: "atelier-hoodie",              family: "apparelHeavyweight" },
  { handle: "atelier-hoodie-charcoal",     family: "apparelHeavyweight" },
  { handle: "heavyweight-sweatshirt-cream",family: "apparelHeavyweight" },
  { handle: "heavyweight-sweatshirt-black",family: "apparelHeavyweight" },
  // Headwear
  { handle: "ghostmark-cap",               family: "cap" },
  { handle: "panel-cap-black",             family: "cap" },
  // Drinkware
  { handle: "ceramic-mug-cream",           family: "mug" },
  { handle: "ceramic-mug-sage",            family: "mug" },
  { handle: "steel-bottle-500",            family: "bottle" },
  { handle: "steel-bottle-750",            family: "bottle" },
  { handle: "insulated-tumbler-cream",     family: "bottle" },
  { handle: "insulated-tumbler-black",     family: "bottle" },
  // Bags
  { handle: "workshop-tote",               family: "tote" },
  { handle: "market-tote-oat",             family: "tote" },
  // Accessories
  { handle: "studio-notebook-a5",          family: "notebook" },
  { handle: "studio-notebook-a6",          family: "notebook" },
  { handle: "cable-organiser",             family: "pouch" },
  { handle: "tech-pouch",                  family: "pouch" },
  { handle: "studio-candle",               family: "candle" },
  { handle: "linen-tea-towel",             family: "teaTowel" },
  // Not customizable (stickers ARE the design)
  { handle: "studio-sticker-pack",         nonCustomizable: true },
  { handle: "logo-sticker-sheet",          nonCustomizable: true },
]

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------
function buildLocations(
  template: Family["locations"],
  images: Array<{ url: string }>,
  thumbnail?: string | null,
): PrintLocation[] {
  return template.map((loc, i) => {
    const url = images[i]?.url ?? images[0]?.url ?? thumbnail ?? undefined
    return { ...loc, mockup_url: url }
  })
}

function buildTiers(
  ladder: Family["tierLadder"],
  baseUnitAmount: number,
): QuantityTier[] {
  return ladder.map(([quantity, discount]) => ({
    quantity,
    unit_amount: Math.round(baseUnitAmount * (1 - discount)),
  }))
}

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------
export default async function seedMercheryMetadata({ container }: ExecArgs) {
  const productService = container.resolve(Modules.PRODUCT)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  // Pull the price-set graph for every product up front so we can map
  // handle -> first-variant GBP base in O(1) without N+1 graph calls.
  const { data: priceGraph } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "handle",
      "variants.id",
      "variants.price_set.prices.amount",
      "variants.price_set.prices.currency_code",
    ],
  })

  type GVariant = {
    id: string
    price_set?: {
      prices?: Array<{ amount: number; currency_code: string }>
    } | null
  }
  type GProduct = { id: string; handle: string; variants?: GVariant[] }

  const baseGbpByHandle = new Map<string, number | null>()
  for (const gp of priceGraph as GProduct[]) {
    const v = gp.variants?.[0]
    const gbp = v?.price_set?.prices?.find((p) => p.currency_code === "gbp")
    baseGbpByHandle.set(gp.handle, gbp?.amount ?? null)
  }

  type RowReport = {
    handle: string
    is_customizable: boolean | "—"
    locations: number
    techniques: number
    tiers: number
    moq: number | "—"
    lead: string
    status: "updated" | "skipped" | "missing"
    note?: string
  }
  const report: RowReport[] = []

  for (const spec of PRODUCTS) {
    const products = await productService.listProducts(
      { handle: [spec.handle] },
      { relations: ["images"] },
    )
    if (!products.length) {
      logger.warn(`[seed-merchery] missing product handle=${spec.handle}`)
      report.push({
        handle: spec.handle, is_customizable: "—", locations: 0, techniques: 0,
        tiers: 0, moq: "—", lead: "—", status: "missing",
        note: "product not found",
      })
      continue
    }
    const p = products[0]
    const existing = (p.metadata ?? {}) as Record<string, unknown>

    // -------- Non-customizable branch ---------------------------------------
    if ("nonCustomizable" in spec && spec.nonCustomizable) {
      await productService.updateProducts(p.id, {
        metadata: { ...existing, is_customizable: false },
      })
      report.push({
        handle: spec.handle, is_customizable: false, locations: 0,
        techniques: 0, tiers: 0, moq: "—", lead: "—",
        status: "updated", note: "marked non-customizable",
      })
      continue
    }

    const fam = FAMILY[spec.family as keyof typeof FAMILY]

    // -------- Hydrate locations from images ---------------------------------
    const images = (p.images ?? []) as Array<{ url: string }>
    const thumbnail = (p as { thumbnail?: string | null }).thumbnail ?? null
    const print_locations = buildLocations(fam.locations, images, thumbnail)

    // -------- Resolve base GBP price ---------------------------------------
    const baseGbp = baseGbpByHandle.get(spec.handle)
    if (baseGbp == null) {
      logger.warn(
        `[seed-merchery] ${spec.handle} has no GBP price; writing structural ` +
        `metadata with quantity_tiers=[] (frontend will fall back).`,
      )
    }
    const quantity_tiers = baseGbp != null
      ? buildTiers(fam.tierLadder, baseGbp)
      : []

    // -------- Build merchery payload ---------------------------------------
    const merchery: Record<string, unknown> = {
      is_customizable: true,
      print_locations,
      techniques: fam.techniques,
      quantity_tiers,
      moq: fam.moq,
    }
    if (fam.lead) merchery.lead_time_days = fam.lead

    // Preserve legacy fallback keys for apparel.
    if (fam.legacyApparelMockups) {
      const front = images[0]?.url ?? thumbnail ?? undefined
      const back  = images[1]?.url ?? front
      if (front) merchery.mockup_front = front
      if (back)  merchery.mockup_back  = back
    }

    // Shallow-merge: existing metadata wins NOTHING here (we want fresh shape
    // every run), but unrelated keys outside this contract are preserved.
    await productService.updateProducts(p.id, {
      metadata: { ...existing, ...merchery },
    })

    report.push({
      handle: spec.handle,
      is_customizable: true,
      locations: print_locations.length,
      techniques: fam.techniques.length,
      tiers: quantity_tiers.length,
      moq: fam.moq,
      lead: fam.lead ? `${fam.lead.min}-${fam.lead.max}d` : "—",
      status: "updated",
      note: baseGbp == null ? "no GBP base price" : undefined,
    })
  }

  // ---------------------------------------------------------------------------
  // Final report
  // ---------------------------------------------------------------------------
  logger.info("\n=== seed-merchery-metadata report ===")
  const header = "handle".padEnd(34) +
    "cust".padEnd(7) + "loc".padEnd(5) + "tech".padEnd(6) +
    "tiers".padEnd(7) + "moq".padEnd(6) + "lead".padEnd(8) + "status"
  logger.info(header)
  logger.info("-".repeat(header.length + 8))
  for (const r of report) {
    const line =
      r.handle.padEnd(34) +
      String(r.is_customizable).padEnd(7) +
      String(r.locations).padEnd(5) +
      String(r.techniques).padEnd(6) +
      String(r.tiers).padEnd(7) +
      String(r.moq).padEnd(6) +
      r.lead.padEnd(8) +
      r.status +
      (r.note ? ` (${r.note})` : "")
    logger.info(line)
  }

  const updated = report.filter((r) => r.status === "updated").length
  const missing = report.filter((r) => r.status === "missing").length
  logger.info(`\nDone. updated=${updated} missing=${missing} total=${report.length}`)
}
