// =============================================================================
// fix-product-shipping-profiles: backfill the default shipping_profile_id
// on every product that lacks one.
//
// Why this exists
// ---------------
// Medusa v2's storefront /store/shipping-options endpoint filters returned
// options to those linked to the same shipping profile(s) as the items in
// the cart. Products without a shipping_profile_id are effectively
// "shippable by no one": `listShippingOptions` returns `[]`, the checkout
// surfaces no rates, and `cart.complete()` rejects with 400:
//   "No shipping method selected but the cart contains items that require
//    shipping."
//
// `seed.ts` correctly assigns `shipping_profile_id` on every product it
// creates, but the catalogue has since been extended by several scripts
// (`seed-curated.ts`, `seed-gift-card.ts`, `seed-pod-no-locations.ts`,
// admin-created products) that did NOT set it. This script links them all
// to the default profile so the UK checkout can resolve shipping options.
//
// Idempotency
// -----------
// Only products without a current `shipping_profile_id` are touched.
// Re-runs after a successful apply are a no-op.
//
// Dry run
// -------
//   pnpm exec medusa exec ./src/scripts/fix-product-shipping-profiles.ts -- --dry-run
//
// Apply
// -----
//   pnpm exec medusa exec ./src/scripts/fix-product-shipping-profiles.ts
// =============================================================================
import { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"

export default async function fixProductShippingProfiles({
  args,
  container,
}: ExecArgs) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const fulfillment = container.resolve(Modules.FULFILLMENT)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  const dryRun =
    process.env.DRY_RUN === "1" ||
    (Array.isArray(args) && args.includes("--dry-run"))

  if (dryRun) {
    logger.info("[fix-product-shipping-profiles] DRY-RUN: no writes.")
  }

  // 1) Resolve the default shipping profile. seed.ts creates one with
  //    type='default'; if it isn't there yet this script can't proceed.
  const profiles = await fulfillment.listShippingProfiles({ type: "default" })
  if (!profiles.length) {
    logger.warn(
      "[fix-product-shipping-profiles] no default shipping profile found. " +
        "Run seed.ts first.",
    )
    return
  }
  const defaultProfileId = profiles[0].id
  logger.info(
    `[fix-product-shipping-profiles] default profile: ${profiles[0].name} (${defaultProfileId})`,
  )

  // 2) Pull every product with the linked shipping_profile relation surfaced.
  //    `shipping_profile` is the module-link to the Fulfillment module's
  //    ShippingProfile entity; an unlinked product surfaces it as null.
  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "title", "shipping_profile.id"],
  })

  const orphans = products.filter(
    (p: any) => !p.shipping_profile?.id,
  )

  if (!orphans.length) {
    logger.info(
      `[fix-product-shipping-profiles] all ${products.length} products already have a shipping profile.`,
    )
    return
  }

  logger.info(
    `[fix-product-shipping-profiles] ${orphans.length}/${products.length} products missing a profile.`,
  )

  if (dryRun) {
    for (const p of orphans) {
      logger.info(
        `[fix-product-shipping-profiles] DRY-RUN would link ${p.handle} (${p.id}) -> ${defaultProfileId}`,
      )
    }
    return
  }

  // 3) updateProductsWorkflow accepts a `selector` + `update` shape. We pass
  //    the orphan ids and the default shipping_profile_id; the workflow
  //    handles the link-table upsert internally.
  await updateProductsWorkflow(container).run({
    input: {
      selector: { id: orphans.map((p: any) => p.id) },
      update: { shipping_profile_id: defaultProfileId },
    },
  })

  for (const p of orphans) {
    logger.info(
      `[fix-product-shipping-profiles] linked ${p.handle} (${p.id}) -> ${defaultProfileId}`,
    )
  }

  logger.info("[fix-product-shipping-profiles] done.")
}
