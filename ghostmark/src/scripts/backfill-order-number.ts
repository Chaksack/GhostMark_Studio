// =============================================================================
// backfill-order-number — set `metadata.order_number = GMS-<ULID>` on every
// pre-existing order that lacks it.
//
// Why this exists
// ---------------
// The `order.placed` subscriber in `src/subscribers/order-notifications.ts`
// persists the customer-facing GMS-ULID identifier onto each new order's
// metadata so support can resolve a customer's quoted "GMS-…" back to the
// admin record. Orders placed before that subscriber landed have no such
// metadata, so support would have to know the rule by heart and reverse it
// ad-hoc.
//
// This script applies the same transformation in bulk:
//   order.id "order_01KTD49…802N"  ->  metadata.order_number "GMS-01KTD49…802N"
//
// Idempotency
// -----------
// Orders whose metadata.order_number already matches the derived value are
// skipped. Re-runs after a successful apply are a no-op.
//
// Dry run
// -------
//   pnpm exec medusa exec ./src/scripts/backfill-order-number.ts -- --dry-run
//
// Apply
// -----
//   pnpm exec medusa exec ./src/scripts/backfill-order-number.ts
// =============================================================================
import { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"

// Mirror of `formatOrderNumber()` in
//   - src/subscribers/order-notifications.ts (backend)
//   - src/admin/widgets/order-number-widget.tsx (admin UI)
//   - storefront/app/pages/checkout.vue (storefront)
// If you change the format in any of those, change it here too — otherwise
// the backfill writes a stale value and support sees a mismatch.
const formatOrderNumber = (internalId: string): string => {
  if (internalId.startsWith("GMS-")) return internalId
  return `GMS-${internalId.replace(/^order_/, "")}`
}

export default async function backfillOrderNumber({
  args,
  container,
}: ExecArgs) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const orderModule = container.resolve(Modules.ORDER)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  const dryRun =
    process.env.DRY_RUN === "1" ||
    (Array.isArray(args) && args.includes("--dry-run"))

  if (dryRun) {
    logger.info("[backfill-order-number] DRY-RUN — no writes.")
  }

  const { data: orders } = await query.graph({
    entity: "order",
    fields: ["id", "display_id", "metadata"],
  })

  let updated = 0
  let skipped = 0

  for (const order of orders) {
    const desired = formatOrderNumber(order.id)
    const current = (order.metadata as any)?.order_number ?? null

    if (current === desired) {
      skipped++
      continue
    }

    if (dryRun) {
      logger.info(
        `[backfill-order-number] DRY-RUN would set ${order.id} (#${order.display_id}) -> ${desired} (was: ${current ?? "—"})`,
      )
      updated++
      continue
    }

    try {
      await orderModule.updateOrders(order.id, {
        metadata: {
          ...((order.metadata as any) ?? {}),
          order_number: desired,
        },
      })
      updated++
      logger.info(
        `[backfill-order-number] ${order.id} (#${order.display_id}) -> ${desired}`,
      )
    } catch (e) {
      logger.error(
        `[backfill-order-number] failed for ${order.id}: ${(e as Error).message}`,
      )
    }
  }

  logger.info(
    `[backfill-order-number] done. updated=${updated} skipped=${skipped} total=${orders.length}`,
  )
}
