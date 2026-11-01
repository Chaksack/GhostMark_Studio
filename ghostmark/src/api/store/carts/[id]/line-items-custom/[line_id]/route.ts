// =============================================================================
// POST /store/carts/:id/line-items-custom/:line_id   body: { quantity }
//
// Change the quantity of a customised line, re-pricing it.
//
// Why this exists: a customised line carries an explicit unit price, and
// Medusa keeps an explicit price unchanged when the quantity changes
// (core-flows update-line-item-in-cart.js keeps `is_custom_price`). Through the
// stock route, a customer could add 1,000 at the 1,000-unit tier and then drop
// to 1 while keeping that tier's unit price. The stock route now refuses
// customised lines (workflows/hooks/customised-line-guards.ts); this route
// re-tiers the base price for the new quantity and keeps the print fee the
// customer was quoted.
// =============================================================================

import { MedusaStoreRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateLineItemInCartWorkflow } from "@medusajs/medusa/core-flows"
import { refetchCart } from "@medusajs/medusa/api/store/carts/helpers"

import {
  CustomisationError,
  loadCartContext,
  requoteCustomisedLine,
  storeCartFields,
  toMedusaError,
} from "../../../../../../utils/print-pricing"

export async function POST(req: MedusaStoreRequest<{ quantity?: unknown }>, res: MedusaResponse) {
  const { id: cartId, line_id: lineId } = req.params
  try {
    const cart = await loadCartContext(req.scope, cartId)

    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({
      entity: "cart",
      fields: ["items.id", "items.variant_id", "items.metadata"],
      filters: { id: cartId },
    })
    const line = (data?.[0]?.items ?? []).find((i: any) => i?.id === lineId)
    if (!line) throw new CustomisationError(`Line item ${lineId} is not in this cart.`, 404)

    if (!line.variant_id) throw new CustomisationError("This line has no variant.", 422)
    const quote = await requoteCustomisedLine(
      req.scope,
      cart,
      { variant_id: line.variant_id, metadata: (line.metadata ?? null) as Record<string, any> | null },
      (req.body ?? {}).quantity,
    )

    await updateLineItemInCartWorkflow(req.scope).run({
      input: {
        cart_id: cartId,
        item_id: lineId,
        update: {
          quantity: quote.quantity,
          unit_price: quote.unit_price,
          metadata: { ...(line.metadata ?? {}), printSurcharge: quote.surcharge },
        },
      },
    })

    const fresh = await refetchCart(cartId, req.scope, storeCartFields)
    return res.status(200).json({ cart: fresh })
  } catch (e) {
    throw toMedusaError(e)
  }
}
