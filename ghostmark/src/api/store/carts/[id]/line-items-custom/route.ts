// =============================================================================
// POST /store/carts/:id/line-items-custom
//
// Add a customised line: a product with the customer's artwork printed on it.
// The ONLY way a line carrying artwork can enter a cart (the stock
// /line-items route refuses one, see workflows/hooks/customised-line-guards.ts).
//
//   body: {
//     variant_id: string,
//     quantity:   number,
//     metadata: { designDataJson: string, previewImageUrl?: string | null }
//   }
//
// The price is decided HERE, never by the caller: tier price at this quantity
// plus the fee of every print location carrying artwork. See
// utils/print-pricing.ts for the rule and where the fees live.
//
// This path previously held an unused mock that kept an in-memory "cart",
// priced everything at a hard-coded 12.99 and accepted a caller-supplied unit
// price. Nothing called it; it is replaced rather than left as a decoy.
// =============================================================================

import { randomUUID } from "node:crypto"
import { MedusaStoreRequest, MedusaResponse } from "@medusajs/framework/http"
import { addToCartWorkflow } from "@medusajs/medusa/core-flows"
import { refetchCart } from "@medusajs/medusa/api/store/carts/helpers"

import {
  CustomisationError,
  isUploadPath,
  loadCartContext,
  quoteCustomisedLine,
  storeCartFields,
  toMedusaError,
} from "../../../../../utils/print-pricing"

type Body = {
  variant_id?: unknown
  quantity?: unknown
  metadata?: { designDataJson?: unknown; previewImageUrl?: unknown } | null
}

export async function POST(req: MedusaStoreRequest<Body>, res: MedusaResponse) {
  const cartId = req.params.id
  const body = (req.body ?? {}) as Body

  try {
    if (typeof body.variant_id !== "string" || !body.variant_id) {
      throw new CustomisationError("variant_id is required.", 400)
    }
    const preview = body.metadata?.previewImageUrl ?? null
    if (preview !== null && !isUploadPath(preview)) {
      throw new CustomisationError("previewImageUrl must be an uploaded file path.", 400)
    }

    const cart = await loadCartContext(req.scope, cartId)
    const quote = await quoteCustomisedLine(
      req.scope,
      cart,
      body.variant_id,
      body.quantity,
      body.metadata?.designDataJson,
    )

    await addToCartWorkflow(req.scope).run({
      input: {
        cart_id: cartId,
        items: [
          {
            variant_id: body.variant_id,
            quantity: quote.quantity,
            unit_price: quote.unit_price,
            metadata: {
              isCustomized: true,
              designDataJson: body.metadata!.designDataJson as string,
              previewImageUrl: preview,
              printSurcharge: quote.surcharge,
              // Two customised lines of the same variant must never merge:
              // Medusa merges on variant + deep-equal metadata, and a merge
              // would sum the quantities while keeping a unit price that was
              // tiered for only one of them.
              customLineKey: randomUUID(),
            },
          },
        ],
      },
    })

    const fresh = await refetchCart(cartId, req.scope, storeCartFields)
    return res.status(200).json({ cart: fresh })
  } catch (e) {
    throw toMedusaError(e)
  }
}
