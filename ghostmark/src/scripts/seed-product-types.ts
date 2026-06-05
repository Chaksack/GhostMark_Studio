// =============================================================================
// seed-product-types — assign the binary `pod` | `apparel` taxonomy onto every
// product via Medusa's first-class `product.type` relation.
//
// Why this exists
// ---------------
// The storefront branches on `product.type.value` to decide what flow to render
// for each product:
//
//   - 'pod'      -> Print-on-Demand. Plain apparel that the customer chooses,
//                   then uploads / composes a design onto via the Konva
//                   customizer. MOQ tier pricing applies (see quantity_tiers
//                   metadata). Cart entries carry a design_url.
//
//   - 'apparel'  -> D2C "Studio Canon" line. Sold AS-IS with GhostMark's own
//                   design. Single-unit pricing. Standard cart, no customizer.
//
// `product.type.value` is the source-of-truth taxonomy. The legacy
// `metadata.commerce_mode` field (shop|studio|pod) — written by
// seed-commerce-mode.ts — remains in place for the chip / IA layer, but
// type.value is what gates the *flow*. Mapping:
//
//      commerce_mode='shop'    -> type.value='apparel'
//      commerce_mode='studio'  -> type.value='pod'    (B2B custom-base blanks)
//      commerce_mode='pod'     -> type.value='pod'    (single-unit POD SKUs)
//
// Idempotency
// -----------
//   - Types are upserted on `value` (Medusa's natural unique key). Re-running
//     the script never duplicates types.
//   - Each product is checked against the desired `type_id` before issuing an
//     UPDATE. If already correct, it is skipped (no DB churn, no event noise).
//   - Type assignments derive from the manifest in seed-commerce-mode.ts so
//     there is one source of truth for both axes.
//
// Dry run
// -------
//   pnpm exec medusa exec ./src/scripts/seed-product-types.ts -- --dry-run
//   (or set env var DRY_RUN=1)
//
// Apply
// -----
//   pnpm exec medusa exec ./src/scripts/seed-product-types.ts
// =============================================================================
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

// -----------------------------------------------------------------------------
// Type catalogue. `value` is the canonical filter key on the Store API
// (`type.value`); also used as the URL slug in chip / PLP filters.
// -----------------------------------------------------------------------------
type TypeValue = "pod" | "apparel"

const TYPES: Array<{
  value: TypeValue
  metadata: Record<string, unknown>
}> = [
  {
    value: "apparel",
    metadata: {
      label: "Apparel (Studio Canon)",
      flow: "d2c",
      // Storefront hint: render the standard PDP / single-unit cart path.
      pdp_template: "apparel",
    },
  },
  {
    value: "pod",
    metadata: {
      label: "Print on Demand",
      flow: "customizer",
      // Storefront hint: render the Konva customizer + MOQ tier picker.
      pdp_template: "pod",
    },
  },
]

// -----------------------------------------------------------------------------
// Per-handle assignments. Mirrors the SPECS manifest in seed-commerce-mode.ts
// with the 3-mode -> 2-type collapse:
//
//   shop   -> apparel  (own-brand D2C, sold as-is)
//   studio -> pod      (B2B custom-base blanks; uses customizer flow)
//   pod    -> pod      (single-unit POD SKUs)
//
// Keep this list in sync with the live catalogue. An unmapped handle gets
// logged as a warning and is left untouched (NOT defaulted) — defaulting to
// `apparel` would silently hide POD-eligible SKUs from the customizer.
// -----------------------------------------------------------------------------
const ASSIGNMENTS: Record<string, TypeValue> = {
  // ---- Studio Canon (own-brand flagship D2C) -> apparel --------------------
  "studio-tee-cream": "apparel",
  "studio-tee-charcoal": "apparel",
  "atelier-hoodie": "apparel",
  "atelier-hoodie-charcoal": "apparel",
  "ghostmark-cap": "apparel",
  "workshop-tote": "apparel",

  // ---- Shop (own-brand D2C, non-Canon) -> apparel --------------------------
  "heavyweight-sweatshirt-cream": "apparel",
  "heavyweight-sweatshirt-black": "apparel",
  "panel-cap-black": "apparel",
  "market-tote-oat": "apparel",
  "ceramic-mug-cream": "apparel",
  "ceramic-mug-sage": "apparel",
  "steel-bottle-500": "apparel",
  "steel-bottle-750": "apparel",
  "insulated-tumbler-cream": "apparel",
  "insulated-tumbler-black": "apparel",
  "studio-notebook-a5": "apparel",
  "studio-notebook-a6": "apparel",
  "studio-candle": "apparel",
  "linen-tea-towel": "apparel",

  // ---- Studio (B2B custom-base blanks) -> pod ------------------------------
  "cable-organiser": "pod",
  "tech-pouch": "pod",

  // ---- POD (single-unit print-on-demand) -> pod ----------------------------
  "studio-sticker-pack": "pod",
  "logo-sticker-sheet": "pod",
}

type Stats = {
  typesCreated: number
  typesExisting: number
  productsUpdated: number
  productsAlreadyCorrect: number
  productsUnmapped: string[]
  productsMissing: string[]
}

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------
export default async function seedProductTypes({ args, container }: ExecArgs) {
  const productService = container.resolve(Modules.PRODUCT)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  const dryRun =
    process.env.DRY_RUN === "1" ||
    (Array.isArray(args) && args.includes("--dry-run"))

  if (dryRun) {
    logger.info("[seed-product-types] DRY-RUN mode — no writes will happen.")
  }

  const stats: Stats = {
    typesCreated: 0,
    typesExisting: 0,
    productsUpdated: 0,
    productsAlreadyCorrect: 0,
    productsUnmapped: [],
    productsMissing: [],
  }

  // ---------------------------------------------------------------------------
  // 1) Upsert the type catalogue. We list-then-create rather than blindly
  //    upsert so we can report which were already present (cheaper than relying
  //    on upsert semantics that may still bump updated_at).
  // ---------------------------------------------------------------------------
  const existingTypes = await productService.listProductTypes(
    { value: TYPES.map((t) => t.value) },
    { take: 100 },
  )
  const byValue = new Map<string, { id: string; value: string }>(
    existingTypes.map((t) => [t.value, { id: t.id, value: t.value }]),
  )

  for (const t of TYPES) {
    if (byValue.has(t.value)) {
      stats.typesExisting++
      logger.info(`[seed-product-types] type exists: ${t.value} (${byValue.get(t.value)!.id})`)
      continue
    }
    if (dryRun) {
      logger.info(`[seed-product-types] DRY-RUN would create type: ${t.value}`)
      // Stand in with a placeholder id so the rest of the run can simulate.
      byValue.set(t.value, { id: `dryrun_${t.value}`, value: t.value })
      stats.typesCreated++
      continue
    }
    const [created] = await productService.createProductTypes([
      { value: t.value, metadata: t.metadata },
    ])
    byValue.set(t.value, { id: created.id, value: created.value })
    stats.typesCreated++
    logger.info(`[seed-product-types] created type: ${t.value} (${created.id})`)
  }

  // ---------------------------------------------------------------------------
  // 2) Walk every product in the catalogue and assign / verify type_id.
  //    Pull only the fields we need; type_id lives directly on the product.
  // ---------------------------------------------------------------------------
  const products = await productService.listProducts(
    {},
    { take: 500, select: ["id", "handle", "type_id"] },
  )

  const liveHandles = new Set(products.map((p) => p.handle))

  // Surface manifest entries that don't match any live product — likely a
  // handle drift since seed-commerce-mode was last updated.
  for (const handle of Object.keys(ASSIGNMENTS)) {
    if (!liveHandles.has(handle)) {
      stats.productsMissing.push(handle)
    }
  }

  for (const product of products) {
    const desired = ASSIGNMENTS[product.handle]
    if (!desired) {
      stats.productsUnmapped.push(product.handle)
      continue
    }
    const desiredTypeId = byValue.get(desired)?.id
    if (!desiredTypeId) {
      // Should be unreachable — TYPES covers every value in ASSIGNMENTS.
      logger.error(
        `[seed-product-types] no type record for value='${desired}' (handle=${product.handle})`,
      )
      continue
    }

    if (product.type_id === desiredTypeId) {
      stats.productsAlreadyCorrect++
      continue
    }

    if (dryRun) {
      logger.info(
        `[seed-product-types] DRY-RUN would set ${product.handle}.type_id ` +
          `${product.type_id ?? "(null)"} -> ${desiredTypeId} (${desired})`,
      )
      stats.productsUpdated++
      continue
    }

    await productService.updateProducts(product.id, { type_id: desiredTypeId })
    stats.productsUpdated++
    logger.info(
      `[seed-product-types] ${product.handle}: type=${desired} (${desiredTypeId})`,
    )
  }

  // ---------------------------------------------------------------------------
  // 3) Final report
  // ---------------------------------------------------------------------------
  logger.info("\n=== seed-product-types report ===")
  logger.info(
    `Types: created=${stats.typesCreated} existing=${stats.typesExisting}`,
  )
  logger.info(
    `Products: updated=${stats.productsUpdated} already-correct=${stats.productsAlreadyCorrect}`,
  )
  if (stats.productsUnmapped.length) {
    logger.warn(
      `Unmapped live products (${stats.productsUnmapped.length}) — left untouched: ` +
        stats.productsUnmapped.join(", "),
    )
  }
  if (stats.productsMissing.length) {
    logger.warn(
      `Manifest handles not present in DB (${stats.productsMissing.length}): ` +
        stats.productsMissing.join(", "),
    )
  }
  logger.info("==================================\n")
}
