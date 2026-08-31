// =============================================================================
// fix-category-typo: re-run-safe display-name fixer for the "Kids & baby
// clothing" product category.
//
// Why this exists
// ---------------
// Live Medusa has a category seeded with the name "Kids & bay clothing"
// (missing the 'b'). The handle is correct (`kids-baby-clothing`), so the
// URL works, but the storefront chip / nav / category page renders the
// typo. Changing the handle would break inbound URLs and any cached PLP
// links, so we update ONLY the display `name`.
//
// What it does
// ------------
//   1. Look up the category by `handle: kids-baby-clothing` via the
//      remote-query graph (productService.listProductCategories({}) returns
//      nothing on this Medusa version; same caveat as seed-sample.ts).
//   2. If `name === "Kids & baby clothing"` already: report and exit.
//   3. Otherwise: run updateProductCategoriesWorkflow with selector by id.
//
// Idempotency
// -----------
//   - Compares against the expected name and short-circuits when correct.
//   - Handle is never modified.
//
// Dry run
// -------
//   pnpm exec medusa exec ./src/scripts/fix-category-typo.ts -- --dry-run
//   (or set env var DRY_RUN=1)
//
// Apply
// -----
//   pnpm exec medusa exec ./src/scripts/fix-category-typo.ts
// =============================================================================
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateProductCategoriesWorkflow } from "@medusajs/medusa/core-flows"

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------
const HANDLE = "kids-baby-clothing"
const EXPECTED_NAME = "Kids & baby clothing"

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------
export default async function fixCategoryTypo({ args, container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const dryRun =
    process.env.DRY_RUN === "1" ||
    (Array.isArray(args) && args.includes("--dry-run"))

  if (dryRun) {
    logger.info("[fix-category-typo] DRY-RUN mode: no writes will happen.")
  }

  // ---------------------------------------------------------------------------
  // 1) Look up the category. Remote-query graph honours empty + handle filters
  //    correctly; the product module's listProductCategories({}) silently
  //    returns nothing on this Medusa version.
  // ---------------------------------------------------------------------------
  const { data: categories } = await query.graph({
    entity: "product_category",
    fields: ["id", "handle", "name"],
    filters: { handle: HANDLE },
  })

  if (!categories || categories.length === 0) {
    logger.warn(
      `[fix-category-typo] no category with handle='${HANDLE}'. Nothing to do.`,
    )
    return
  }

  const category = categories[0] as { id: string; handle: string; name: string }

  if (category.name === EXPECTED_NAME) {
    logger.info(
      `[fix-category-typo] already correct: ${category.id} (${category.handle}) ` +
        `name='${category.name}'. No update issued.`,
    )
    return
  }

  logger.info(
    `[fix-category-typo] will rename ${category.id} (${category.handle}): ` +
      `'${category.name}' -> '${EXPECTED_NAME}'`,
  )

  if (dryRun) {
    logger.info("[fix-category-typo] DRY-RUN: skipping write.")
    return
  }

  // ---------------------------------------------------------------------------
  // 2) Apply via the workflow so subscribers (search indexer, etc.) fire.
  //    Handle is intentionally NOT modified; that would break inbound URLs.
  // ---------------------------------------------------------------------------
  try {
    const { result } = await updateProductCategoriesWorkflow(container).run({
      input: {
        selector: { id: category.id },
        update: { name: EXPECTED_NAME },
      },
    })
    const updated = Array.isArray(result) ? result[0] : result
    logger.info(
      `[fix-category-typo] updated: id=${(updated as any)?.id ?? category.id} ` +
        `name='${EXPECTED_NAME}' handle='${category.handle}' (unchanged).`,
    )
  } catch (err) {
    logger.error(
      `[fix-category-typo] updateProductCategoriesWorkflow failed: ${(err as Error).message}`,
    )
    throw err
  }
}
