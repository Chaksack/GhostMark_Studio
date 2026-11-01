// =============================================================================
// Customised lines may only be written by our own routes.
// =============================================================================
//
// A customised line (metadata.isCustomized) is priced by
// api/store/carts/[id]/line-items-custom, which passes an explicit server-side
// `unit_price`. The stock Store routes never can: their validators do not
// accept `unit_price` from a caller. So "a write touching a customised line
// with no unit_price" is exactly "a write that came through a stock route",
// and both are refused:
//
//   add    POST /store/carts/:id/line-items with metadata.isCustomized
//          -> would add artwork at the plain price, skipping the print fee.
//
//   update POST /store/carts/:id/line-items/:line_id on a customised line
//          -> quantity: keeps a unit price tiered for a different quantity
//             (add 1,000 at the 1,000 tier, drop to 1, keep the tier).
//          -> metadata: rewrites the design after it was priced (pay for the
//             front, then add a back).
//
// Deleting a customised line through the stock route stays allowed.
// =============================================================================

import { MedusaError } from "@medusajs/framework/utils"
import { addToCartWorkflow, updateLineItemInCartWorkflow } from "@medusajs/medusa/core-flows"

const isCustomised = (metadata: unknown): boolean => {
  if (!metadata || typeof metadata !== "object") return false
  const flag = (metadata as Record<string, unknown>).isCustomized
  return flag === true || flag === "true"
}

const hasPrice = (v: unknown): boolean => v !== undefined && v !== null

addToCartWorkflow.hooks.validate(({ input }) => {
  for (const item of (input as any).items ?? []) {
    if (isCustomised(item?.metadata) && !hasPrice(item?.unit_price)) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Customised items must be added through /store/carts/:id/line-items-custom.",
      )
    }
  }
})

updateLineItemInCartWorkflow.hooks.validate(({ input, cart }) => {
  const item = ((cart as any)?.items ?? []).find((i: any) => i?.id === (input as any).item_id)
  const update = (input as any).update ?? {}
  const touchesCustomised = isCustomised(item?.metadata) || isCustomised(update.metadata)
  if (touchesCustomised && !hasPrice(update.unit_price)) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Customised items must be changed through /store/carts/:id/line-items-custom/:line_id.",
    )
  }
})
