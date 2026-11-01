// =============================================================================
// Keep customised lines when a cart changes region.
// Registered against POST /store/carts/:id in api/middlewares.ts.
// =============================================================================
//
// THE PROBLEM
// -----------
// When a cart's region changes, Medusa deletes every line with an explicit
// price, because the new region may have a different currency or tax setting
// (core-flows update-cart.js, step "should-delete-line-items"). Customised
// lines carry an explicit price (utils/print-pricing.ts), so a customer who
// switches region from the header would lose their customised item, artwork
// attached, with nothing on screen saying so.
//
// THE FIX
// -------
// Before the core route runs, note the customised lines. After it replies,
// add each one back through the same pricing as a fresh add, now in the new
// currency, and reply with the refreshed cart. A line that cannot be priced in
// the new currency (say, a merchant priced printing in GBP only) is listed in
// `customised_items_dropped` so the storefront can tell the customer, rather
// than vanishing.
//
// DEFENSIVE BY CONSTRUCTION
// -------------------------
// This sits in the response path of a region change. Nothing here may turn a
// successful update into an error: every failure falls back to the reply the
// core route built, plus the dropped list.
// =============================================================================

import { randomUUID } from "node:crypto"
import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { addToCartWorkflow } from "@medusajs/medusa/core-flows"
import { refetchCart } from "@medusajs/medusa/api/store/carts/helpers"

import { loadCartContext, quoteCustomisedLine, storeCartFields } from "./print-pricing"

type Snapshot = {
  customLineKey: string | null
  variant_id: string
  quantity: number
  title: string
  designDataJson: string
  previewImageUrl: string | null
}

export type DroppedCustomisedItem = { variant_id: string; title: string; reason: string }

export async function preserveCustomisedLinesOnRegionChange(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction,
): Promise<void> {
  const nextRegion = (req.body as any)?.region_id
  if (typeof nextRegion !== "string" || !nextRegion) return next()

  const cartId = req.params.id
  let keep: Snapshot[] = []
  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({
      entity: "cart",
      fields: ["region_id", "items.variant_id", "items.quantity", "items.title", "items.metadata", "items.is_custom_price"],
      filters: { id: cartId },
    })
    const cart = data?.[0]
    if (!cart || cart.region_id === nextRegion) return next()
    keep = (cart.items ?? [])
      .filter((i: any) => i?.is_custom_price && i?.metadata?.isCustomized && typeof i.metadata.designDataJson === "string")
      .map((i: any) => ({
        customLineKey: typeof i.metadata.customLineKey === "string" ? i.metadata.customLineKey : null,
        variant_id: i.variant_id,
        quantity: i.quantity,
        title: i.title,
        designDataJson: i.metadata.designDataJson,
        previewImageUrl: i.metadata.previewImageUrl ?? null,
      }))
  } catch {
    return next()
  }
  if (!keep.length) return next()

  const originalJson = res.json.bind(res)
  ;(res as unknown as { json: (body: unknown) => unknown }).json = (body: unknown) => {
    // Only a successful region change deleted anything. Medusa's error handler
    // also replies through res.json; re-adding then would duplicate lines that
    // were never removed.
    if (res.statusCode >= 400 || !(body as any)?.cart) return originalJson(body as never)

    void (async () => {
      const dropped: DroppedCustomisedItem[] = []
      try {
        const cart = await loadCartContext(req.scope, cartId)
        // Re-add only what is actually gone, matched on our own line key.
        const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
        const { data } = await query.graph({ entity: "cart", fields: ["items.metadata"], filters: { id: cartId } })
        const present = new Set(
          (data?.[0]?.items ?? []).map((i: any) => i?.metadata?.customLineKey).filter(Boolean),
        )
        for (const line of keep) {
          if (line.customLineKey && present.has(line.customLineKey)) continue
          try {
            const quote = await quoteCustomisedLine(req.scope, cart, line.variant_id, line.quantity, line.designDataJson)
            await addToCartWorkflow(req.scope).run({
              input: {
                cart_id: cartId,
                items: [{
                  variant_id: line.variant_id,
                  quantity: quote.quantity,
                  unit_price: quote.unit_price,
                  metadata: {
                    isCustomized: true,
                    designDataJson: line.designDataJson,
                    previewImageUrl: line.previewImageUrl,
                    printSurcharge: quote.surcharge,
                    customLineKey: randomUUID(),
                  },
                }],
              },
            })
          } catch (e) {
            dropped.push({ variant_id: line.variant_id, title: line.title, reason: (e as Error)?.message ?? "Could not re-price" })
          }
        }
        const fields = (req as any).queryConfig?.fields ?? storeCartFields
        const fresh = await refetchCart(cartId, req.scope, fields)
        return originalJson({ ...(body as object), cart: fresh, customised_items_dropped: dropped } as never)
      } catch {
        const all = keep.map((l) => ({ variant_id: l.variant_id, title: l.title, reason: "Could not be moved to the new region" }))
        return originalJson({ ...(body as object), customised_items_dropped: all } as never)
      }
    })()
    return res
  }

  next()
}
