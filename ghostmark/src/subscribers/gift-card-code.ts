import { SubscriberArgs, type SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"

type OrderItem = {
  id: string
  quantity: number
  variant?: {
    id: string
    product?: {
      id: string
      title?: string
      is_giftcard?: boolean
      type?: { value?: string | null } | null
    } | null
  } | null
}

// Generate a reasonably unique, human-friendly code
function generateCode(prefix = "GC-") {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // skip easily-confused chars
  let s = ""
  for (let i = 0; i < 8; i++) {
    s += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return `${prefix}${s}`
}

export default async function giftCardCodeGenerator({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const query = container.resolve("query")
  // Determine region scoping preference
  const scopeAllRegions = (process.env.GIFT_CARD_SCOPE_ALL_REGIONS || "true").toLowerCase() === "true"

  // Optional modules – not all projects may include Promotions module
  let promotionModule: any = null
  try {
    promotionModule = container.resolve(Modules.PROMOTION)
  } catch {
    // Module not present – we will skip creation but still log intent
  }

  // Load the order with relations we need
  const { data: [order] } = await query.graph({
    entity: "order",
    fields: [
      "*",
      "region_id",
      "currency_code",
      "items.*",
      "items.variant.id",
      "items.variant.product.id",
      "items.variant.product.title",
      "items.variant.product.is_giftcard",
      "items.variant.product.type.value",
    ],
    filters: { id: data.id },
  })

  if (!order) return

  const items: OrderItem[] = order.items || []
  const hasGiftCard = items.some((it) => {
    const p = it?.variant?.product
    const byFlag = (p as any)?.is_giftcard === true
    const byType = (p as any)?.type?.value?.toLowerCase?.() === "gift-card"
    return byFlag || byType
  })

  if (!hasGiftCard) {
    return
  }

  // Determine policies
  const usageLimit = parseInt(process.env.GIFT_CARD_USAGE_LIMIT || "1", 10) || 1
  const canBeCombined = (process.env.GIFT_CARD_CAN_BE_COMBINED || "false").toLowerCase() === "true"
  const codePrefix = process.env.GIFT_CARD_CODE_PREFIX || "GC-"
  const code = generateCode(codePrefix)

  // Resolve region scope: either all active regions or just the order's region
  let regionIds: string[] | undefined = undefined
  try {
    if (scopeAllRegions) {
      const { data: regions } = await query.graph({
        entity: "region",
        fields: ["id"],
        filters: {},
      })
      regionIds = (regions || []).map((r: any) => r.id).filter(Boolean)
    } else if ((order as any)?.region_id) {
      regionIds = [(order as any).region_id]
    }
  } catch {
    // Fallback to order region if query fails
    regionIds = (order as any)?.region_id ? [(order as any).region_id] : undefined
  }

  // Create a promotion/campaign with a single unique code
  if (promotionModule && typeof promotionModule.createPromotions === "function") {
    try {
      // Basic fixed-amount promotion equivalent to the gift card value is
      // not trivially resolvable here because the order may contain multiple
      // amounts. Most setups treat gift-card codes as store credit (fixed value)
      // or single-use discount covering up to the gift amount.
      //
      // Since specific discount value logic is backend-specific, we create a
      // generic code that can be configured in your rules engine. Projects that
      // use Medusa v2 Promotions typically create a Promotion with a Campaign
      // and a single Code. Here we create a generic Promotion with code only,
      // leaving value/rules to an external policy or admin adjustment.

      const combinable = canBeCombined ? ["all"] : []

      await promotionModule.createPromotions({
        promotions: [
          {
            // Human label for admins
            title: `Gift Card for Order ${(order as any).display_id || order.id}`,
            // For simplicity, mark it enabled immediately
            is_disabled: false,
            // Optional: scope to region(s)
            regions: regionIds,
            // Combinability config
            application_method: {
              allocation: "total",
              target_type: "order",
              type: "fixed",
              // amount can be configured later by admin or extended logic
              // If you have exact amount, set minor units here, e.g. 2500 for $25
              value: undefined as unknown as number,
              // combinability policy
              apply_to_quantity: false,
              max_quantity: null,
              buy_rules_min_quantity: 0,
              buy_rules_max_quantity: null,
              target_rules: [],
              buy_rules: [],
              // Some distributions use this prop to convey combinability
              // If unsupported, it will be ignored gracefully
              combinable: combinable,
            },
            // Single code with usage limit
            campaign: {
              name: `Gift Card Campaign ${(order as any).display_id || order.id}`,
              budget: {
                // Single use unless overridden
                limit: usageLimit,
              },
              codes: [
                {
                  code,
                  usage_limit: usageLimit,
                },
              ],
            },
          },
        ],
      })
    } catch (e) {
      console.warn("Failed to create promotion for gift card order:", e)
    }
  } else {
    console.log(
      "Promotions module not available. Skipping gift card code creation. Generated placeholder code:",
      code
    )
  }

  // Persist the code to order metadata for reference
  try {
    const orderModule = container.resolve(Modules.ORDER)
    const existing = (order as any)?.metadata?.gift_card_codes || []
    const updatedCodes = Array.isArray(existing) ? [...existing, code] : [code]
    await orderModule.updateOrders({
      selector: { id: order.id },
      update: { metadata: { ...(order as any).metadata, gift_card_codes: updatedCodes } },
    })
  } catch (e) {
    console.warn("Failed to persist gift card code on order metadata:", e)
  }
}

export const config: SubscriberConfig = {
  event: [
    // Trigger after order placement/updates – adjust as needed (e.g., payment.captured)
    "order.placed",
    "order.updated",
  ],
}
