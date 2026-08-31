/* ============================================================================
 * DO NOT RUN THIS SCRIPT. IT WOULD MULTIPLY EVERY GIFT CARD PRICE BY 100.
 * ============================================================================
 *
 * This script converts gift card prices INTO minor units (25 -> 2500). That was
 * correct when it was written, because the catalogue stored minor units then.
 *
 * THE CONVENTION FLIPPED ON 2026-08-30. migrate-price-units converted the
 * catalogue to MAJOR units. Verified live against the database that day:
 *
 *     Studio Gift Card, gbp:  25 / 50 / 100 / 250      <- correct, MAJOR
 *
 * The `intended` value computed below is `fxFromGbpMinor(denomination * 100)`,
 * i.e. 2500 for a GBP 25 card. The skip-if-already-correct guard compares the
 * current 25 against that 2500, finds no match, and REWRITES. Running this
 * today would create the exact defect it was written to fix.
 *
 * This is worse than a stale comment. A stale comment misleads a reader who can
 * push back; stale executable intent just runs. The code is internally
 * consistent and only the world moved, so no typecheck, test, or review of this
 * file in isolation would catch it.
 *
 * Before running this again, rewrite its arithmetic for major units or delete
 * the file. The hard gate below exists so that decision is made deliberately
 * rather than by someone running a plausibly-named script.
 *
 * SWEEP COMPLETE (2026-08-30). Every script in this directory was checked for
 * the same inversion. The class, all now gated on the same env var:
 *
 *     fix-gift-card-prices.ts   this file          2500 for GBP 25
 *     enrich-hoodie.ts          :111               8900 for GBP 89, and it
 *                                                  DELETES all 32 variants first
 *     seed-curated.ts           :202-401           18 basePriceGbp literals
 *     seed-gift-card.ts         :85-88             2500 / 5000 / 10000 / 25000
 *     seed-pod-no-locations.ts  :108-110           1500 / 2000 / 1800
 *     seed-shipping-gbp.ts      :67-69             1000 for GBP 10 postage
 *     seed.ts                   :89-101, :976      prices are FINE (major), but
 *                                                  it drops GBP from the store
 *                                                  currency set and injects
 *                                                  1,000,000 stock units
 *
 * CLEARED, convention-agnostic, deliberately NOT gated:
 *     seed-sample.ts            derives eur/usd from the live gbp price by FX,
 *                               so it inherits whatever scale is already there
 *     seed-merchery-metadata.ts :354 was already corrected for major units
 *
 * A grep for `amount:\s*[0-9]{3,}` does NOT find seed-curated.ts, because its
 * literals hide behind a field named `basePriceGbp`. Grep the VALUES.
 * ========================================================================== */

// =============================================================================
// fix-gift-card-prices: re-run-safe patcher that rewrites the Studio Gift
// Card variant prices into Medusa's MINOR-units convention.
//
// Why this exists
// ---------------
// `seed-gift-card.ts` originally wrote `amount: 25` for the £25 denomination.
// The rest of this catalogue (and the storefront price formatter) treats
// `calculated_amount` as MINOR units (pence / cents), confirmed empirically
// against workshop-tote (£22.00 -> `calculated_amount: 2200`). The result was
// that adding the £25 gift card to a cart charged £0.25.
//
// `seed-gift-card.ts` is idempotent (it short-circuits if the product
// already exists), so simply fixing the constants there does not heal the
// already-seeded data. This script is the corrective patch.
//
// What it does
// ------------
//   1. Look up product `handle: studio-gift-card` (with its variants and
//      money-amount price rows) via the remote-query graph.
//   2. For each variant, derive the intended GBP face value from
//      `variant.metadata.denomination_gbp` (major units, written by the seed).
//   3. Build a target { gbp, usd, eur } trio in MINOR units using the same
//      FX heuristics as the seed (gbp*100, usd ~= gbp*128, eur ~= gbp*120).
//   4. For each existing price row, if `amount === intended` skip; otherwise
//      issue an updateProductVariants call that replaces the variant's
//      `prices` array with the corrected set.
//
// Idempotency
// -----------
//   - Heuristic skip: any variant whose first GBP price row is already
//     `>= 100 * denomination_gbp - tolerance` (i.e. clearly minor units and
//     matches the face value) is left untouched. Re-runs after a successful
//     apply are a no-op.
//   - Variants without `metadata.denomination_gbp` are skipped with a warn.
//
// Dry run
// -------
//   pnpm exec medusa exec ./src/scripts/fix-gift-card-prices.ts -- --dry-run
//   (or set env var DRY_RUN=1)
//
// Apply
// -----
//   pnpm exec medusa exec ./src/scripts/fix-gift-card-prices.ts
// =============================================================================
import { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import { updateProductVariantsWorkflow } from "@medusajs/medusa/core-flows"

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------
const HANDLE = "studio-gift-card"

// FX heuristics: mirror seed-gift-card.ts. Inputs are minor GBP; outputs are
// minor USD / EUR. Kept inline so this script has no dependency on the seed
// file's constants (which may drift independently).
const fxFromGbpMinor = (gbpMinor: number) => ({
  gbp: gbpMinor,
  usd: Math.round(gbpMinor * 1.28), // £25 -> 2500 -> $32.00 -> 3200
  eur: Math.round(gbpMinor * 1.2), // £25 -> 2500 -> €30.00 -> 3000
})

// A variant's GBP row is considered "already in minor units and correct" if
// the amount is within tolerance of the expected minor value. Tolerance gives
// us room for legitimate FX-only re-pricings without re-treating them as the
// original bug.
const TOLERANCE_MINOR = 50 // ±£0.50

type Stats = {
  variantsScanned: number
  variantsPatched: number
  variantsAlreadyCorrect: number
  variantsSkipped: number
  errors: string[]
}

type PriceRow = {
  id: string
  amount: number
  currency_code: string
}

type VariantNode = {
  id: string
  sku: string | null
  title: string | null
  metadata: Record<string, unknown> | null
  prices: PriceRow[] | null
}

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------
export default async function fixGiftCardPrices({ args, container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  // Hard gate. See the DO NOT RUN banner at the top of this file: this script's
  // arithmetic targets a unit convention the catalogue no longer uses, so
  // running it would multiply every gift card price by 100.
  if (process.env.I_HAVE_FIXED_THE_UNIT_CONVENTION !== "yes") {
    // Throws rather than returns. A `return` here exits 0, so any CI wrapper or
    // shell `&&` chain checking the exit status would read this refusal as a
    // successful run. Upgraded 2026-08-30 when the rest of the class was gated.
    const msg =
      "[fix-gift-card-prices] REFUSING TO RUN. This script converts gift card " +
      "prices to MINOR units, but the catalogue moved to MAJOR units on " +
      "2026-08-30. Running it would multiply every gift card price by 100. " +
      "Fix the arithmetic (or delete this file) before re-enabling."
    logger.error(msg)
    throw new Error(msg)
  }
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const productService = container.resolve(Modules.PRODUCT)

  const dryRun =
    process.env.DRY_RUN === "1" ||
    (Array.isArray(args) && args.includes("--dry-run"))

  if (dryRun) {
    logger.info("[fix-gift-card-prices] DRY-RUN mode: no writes will happen.")
  }

  const stats: Stats = {
    variantsScanned: 0,
    variantsPatched: 0,
    variantsAlreadyCorrect: 0,
    variantsSkipped: 0,
    errors: [],
  }

  // ---------------------------------------------------------------------------
  // 1) Locate the product and pull its variants + price rows in one trip.
  //    The remote-query graph is the only reliable way to walk
  //    variant.prices[] in v2 (productService.listProducts({}, { relations })
  //    on this Medusa version does not include the money-amount rows).
  // ---------------------------------------------------------------------------
  const { data: products } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "handle",
      "variants.id",
      "variants.sku",
      "variants.title",
      "variants.metadata",
      "variants.prices.id",
      "variants.prices.amount",
      "variants.prices.currency_code",
    ],
    filters: { handle: HANDLE },
  })

  if (!products || products.length === 0) {
    logger.warn(
      `[fix-gift-card-prices] product not found: handle=${HANDLE}. Run seed-gift-card.ts first. Exiting.`,
    )
    return
  }

  const product = products[0] as unknown as {
    id: string
    variants?: VariantNode[]
  }
  const variants = product.variants ?? []
  logger.info(
    `[fix-gift-card-prices] found ${HANDLE} (${product.id}) with ${variants.length} variants.`,
  )

  // ---------------------------------------------------------------------------
  // 2) Per-variant: derive intended minor-unit prices, compare, patch.
  // ---------------------------------------------------------------------------
  type Patch = {
    id: string
    sku: string | null
    prices: Array<{ id?: string; amount: number; currency_code: string }>
  }
  const patches: Patch[] = []

  for (const variant of variants) {
    stats.variantsScanned++

    const denominationGbpMajor = Number(
      (variant.metadata ?? {})["denomination_gbp"],
    )
    if (!Number.isFinite(denominationGbpMajor) || denominationGbpMajor <= 0) {
      stats.variantsSkipped++
      logger.warn(
        `[fix-gift-card-prices] variant ${variant.sku ?? variant.id} has no usable ` +
          `metadata.denomination_gbp; skipping (cannot determine intended price).`,
      )
      continue
    }

    const intended = fxFromGbpMinor(denominationGbpMajor * 100)

    const currentByCurrency = new Map<string, PriceRow>()
    for (const row of variant.prices ?? []) {
      currentByCurrency.set(row.currency_code.toLowerCase(), row)
    }

    const currentGbp = currentByCurrency.get("gbp")
    if (
      currentGbp &&
      Math.abs(currentGbp.amount - intended.gbp) <= TOLERANCE_MINOR
    ) {
      stats.variantsAlreadyCorrect++
      logger.info(
        `[fix-gift-card-prices] ${variant.sku ?? variant.id}: GBP already ${currentGbp.amount} ` +
          `(within ±${TOLERANCE_MINOR} of intended ${intended.gbp}). No patch needed.`,
      )
      continue
    }

    // Build the replacement prices array. We replace by currency_code; when
    // a row already exists we pass its id so Medusa updates in place rather
    // than orphaning the old row + creating a new one.
    const targets: Array<{ currency: "gbp" | "usd" | "eur"; amount: number }> =
      [
        { currency: "gbp", amount: intended.gbp },
        { currency: "usd", amount: intended.usd },
        { currency: "eur", amount: intended.eur },
      ]

    const replacementPrices = targets.map((t) => {
      const existing = currentByCurrency.get(t.currency)
      return existing
        ? { id: existing.id, currency_code: t.currency, amount: t.amount }
        : { currency_code: t.currency, amount: t.amount }
    })

    patches.push({
      id: variant.id,
      sku: variant.sku,
      prices: replacementPrices,
    })

    logger.info(
      `[fix-gift-card-prices] ${variant.sku ?? variant.id}: ` +
        `gbp ${currentGbp?.amount ?? "(none)"} -> ${intended.gbp}, ` +
        `usd ${currentByCurrency.get("usd")?.amount ?? "(none)"} -> ${intended.usd}, ` +
        `eur ${currentByCurrency.get("eur")?.amount ?? "(none)"} -> ${intended.eur}`,
    )
  }

  // ---------------------------------------------------------------------------
  // 3) Apply (or describe, in dry-run).
  // ---------------------------------------------------------------------------
  if (patches.length === 0) {
    logger.info(
      `[fix-gift-card-prices] no patches needed. scanned=${stats.variantsScanned} ` +
        `correct=${stats.variantsAlreadyCorrect} skipped=${stats.variantsSkipped}`,
    )
    return
  }

  if (dryRun) {
    logger.info(
      `[fix-gift-card-prices] DRY-RUN would patch ${patches.length} variant(s): ` +
        patches.map((p) => p.sku ?? p.id).join(", "),
    )
    return
  }

  try {
    // updateProductVariantsWorkflow accepts { product_variants: [...] } where
    // each entry's `prices` array is upserted (existing rows updated by id,
    // new currencies created). This fires all subscribers (search indexer,
    // price-list refresh, etc.) and is the supported v2 path.
    await updateProductVariantsWorkflow(container).run({
      input: {
        product_variants: patches.map((p) => ({
          id: p.id,
          prices: p.prices,
        })),
      },
    })
    stats.variantsPatched = patches.length
  } catch (err) {
    const msg = `updateProductVariantsWorkflow failed: ${(err as Error).message}`
    logger.error(`[fix-gift-card-prices] ${msg}`)
    stats.errors.push(msg)
    // Fall through to the report so the operator sees partial state.
  }

  // ---------------------------------------------------------------------------
  // 4) Final report
  // ---------------------------------------------------------------------------
  // Touch productService just to keep the import wired for future expansion
  // (e.g. also flipping is_giftcard or status); also surfaces a misconfig
  // immediately if PRODUCT module isn't registered.
  void productService

  logger.info("\n=== fix-gift-card-prices report ===")
  logger.info(
    `Variants: scanned=${stats.variantsScanned} patched=${stats.variantsPatched} ` +
      `already-correct=${stats.variantsAlreadyCorrect} skipped=${stats.variantsSkipped}`,
  )
  if (stats.errors.length) {
    logger.error(`Errors (${stats.errors.length}):`)
    stats.errors.forEach((e) => logger.error(`  - ${e}`))
  }
  logger.info("====================================\n")
}
