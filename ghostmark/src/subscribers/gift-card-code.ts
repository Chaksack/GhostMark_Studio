import { SubscriberArgs, type SubscriberConfig } from "@medusajs/framework"
import {
  ApplicationMethodAllocation,
  ApplicationMethodTargetType,
  ApplicationMethodType,
  CampaignBudgetType,
  Modules,
  PromotionStatus,
  PromotionType,
} from "@medusajs/framework/utils"
import { randomCode } from "../utils/secure-token"

type OrderItem = {
  id: string
  quantity: number
  unit_price?: unknown
  total?: unknown
  is_giftcard?: boolean
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

// Length of the redeemable portion of a gift card code.
//
// The alphabet is `HUMAN_SAFE_ALPHABET` from src/utils/secure-token.ts: 30
// Crockford-style characters with I, L, O, U, 0 and 1 removed, because this
// code is read aloud, typed off a printed card and transcribed by hand. At 30
// symbols, 12 characters is 30^12 ~= 2^58.9 of entropy.
//
// The generator that produces it is crypto.randomBytes with rejection
// sampling. It replaced a `Math.random()` loop, which is not a CSPRNG: V8's
// xorshift128+ state is recoverable from a handful of outputs, so anyone who
// bought one gift card could have derived the codes issued around it. A gift
// card is a BEARER INSTRUMENT (whoever holds the code spends the money) so
// predictability here is indistinguishable from giving stock away.
const GIFT_CARD_CODE_LENGTH = 12

// Sum the value of the gift-card line items on this order.
//
// NOTE ON UNITS: this passes the order's own line-item amounts straight through
// to the promotion, with no scaling. Medusa v2 represents money in MAJOR units
// and the promotion module's `application_method.value` is in the same units as
// the order totals, so identity is the correct transform. This deliberately
// does NOT compensate for the known legacy-ledger defect where six historical
// orders hold minor-unit values in a major-unit column; that is a data problem
// with its own decision attached, and "fixing" it here would silently make
// every gift card sold from today 100x too small.
function giftCardValue(items: OrderItem[]): number {
  const toNumber = (v: unknown): number => {
    if (typeof v === "number") return Number.isFinite(v) ? v : 0
    if (typeof v === "string" && v.trim() !== "") {
      const n = Number(v)
      return Number.isFinite(n) ? n : 0
    }
    if (v && typeof v === "object") {
      const inner = (v as any).value
      if (inner !== undefined && inner !== v) return toNumber(inner)
    }
    return 0
  }

  return items.reduce((sum, item) => {
    const lineTotal = toNumber(item.total)
    if (lineTotal > 0) return sum + lineTotal
    return sum + toNumber(item.unit_price) * (item.quantity ?? 1)
  }, 0)
}

function isGiftCardItem(item: OrderItem): boolean {
  if ((item as any)?.is_giftcard === true) return true
  const p = item?.variant?.product
  if ((p as any)?.is_giftcard === true) return true
  return (p as any)?.type?.value?.toLowerCase?.() === "gift-card"
}

export default async function giftCardCodeGenerator({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const query = container.resolve("query")
  // Never let logging be the thing that breaks gift card issuance.
  let logger: any
  try {
    logger = container.resolve("logger")
  } catch {
    logger = console
  }

  const scopeAllRegions =
    (process.env.GIFT_CARD_SCOPE_ALL_REGIONS || "true").toLowerCase() === "true"

  // Load the order with the relations we need.
  //
  // The field list is explicit and contains no "*": Medusa v2 derives order and
  // line-item totals from the order summary only when the total field names are
  // named, and mixing "*" in suppresses that derivation rather than adding to
  // it. Asking for "*" here is how the gift card value would come back
  // undefined. See the note on ORDER_DOCUMENT_FIELDS in services/pdf-utils.ts.
  const {
    data: [order],
  } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "email",
      "region_id",
      "currency_code",
      "metadata",
      "total",
      "customer.email",
      "customer.first_name",
      "items.id",
      "items.quantity",
      "items.unit_price",
      "items.total",
      "items.is_giftcard",
      "items.variant.id",
      "items.variant.product.id",
      "items.variant.product.title",
      "items.variant.product.is_giftcard",
      "items.variant.product.type.value",
    ],
    filters: { id: data.id },
  })

  if (!order) return

  const items: OrderItem[] = Array.isArray((order as any).items)
    ? (((order as any).items as any[]).filter(Boolean) as OrderItem[])
    : []

  const giftCardItems = items.filter(isGiftCardItem)
  if (!giftCardItems.length) {
    return
  }

  // IDEMPOTENCY GUARD.
  //
  // This matters more here than anywhere else in the codebase. Gift card codes
  // are money, and this handler mints them. If it can run twice for one order
  // it is a money printer, and the failure mode is silent: nobody notices extra
  // valid codes existing until they are redeemed.
  //
  // Two defences, deliberately belt-and-braces:
  //   1. `config.event` below is `order.placed` ONLY. The previous version also
  //      subscribed to `order.updated`, and this file writes to order metadata,
  //      so every admin edit (and plausibly its own metadata write) re-entered
  //      it and minted another code. It survived only because promotion creation
  //      threw every time. Fixing creation without fixing the wiring would have
  //      turned a broken feature into an unbounded liability.
  //   2. This check, so that even a replayed `order.placed` (event bus retry,
  //      manual re-emit, a future subscriber that widens the wiring again) is a
  //      no-op rather than a second gift card.
  const existingCodes = (order as any)?.metadata?.gift_card_codes
  if (Array.isArray(existingCodes) && existingCodes.length) {
    logger?.info?.(
      `[gift-card] order ${order.id} already has a gift card code; skipping.`
    )
    return
  }

  const promotionModule: any = container.resolve(Modules.PROMOTION)
  const orderModule: any = container.resolve(Modules.ORDER)
  const notificationModuleService: any = container.resolve(Modules.NOTIFICATION)

  const usageLimit = parseInt(process.env.GIFT_CARD_USAGE_LIMIT || "1", 10) || 1
  const codePrefix = process.env.GIFT_CARD_CODE_PREFIX || "GC-"
  const code = `${codePrefix}${randomCode(GIFT_CARD_CODE_LENGTH)}`

  const value = giftCardValue(giftCardItems)
  const currencyCode = (order as any).currency_code || "gbp"
  const label = (order as any).display_id || order.id

  if (!(value > 0)) {
    // A zero-value gift card is not a thing we can sell. Refuse loudly rather
    // than issuing a code that redeems for nothing.
    throw new Error(
      `[gift-card] order ${order.id} contains a gift card line item but its ` +
        `value resolved to ${value}. Refusing to issue a code worth nothing. ` +
        `Check that the query above still requests items.total WITHOUT "*".`
    )
  }

  // Region scoping. `regions` is NOT a field on a promotion in Medusa v2, the
  // previous version passed one and it was simply dropped. Scoping is expressed
  // as a promotion rule. When scoping to all regions we omit the rule entirely,
  // which is semantically identical to listing every region and has less to go
  // wrong.
  let rules: Array<{ attribute: string; operator: string; values: string[] }> = []
  if (!scopeAllRegions && (order as any)?.region_id) {
    rules = [
      {
        attribute: "region_id",
        operator: "in",
        values: [(order as any).region_id],
      },
    ]
  }

  // Create the redeemable promotion.
  //
  // The previous payload could not have worked, and the errors were swallowed
  // into a console.warn so nobody found out. Verified against the INSTALLED
  // @medusajs/promotion 2.11.3 source rather than against documentation:
  //
  //   * It called `createPromotions({ promotions: [...] })`. The module does
  //     `Array.isArray(data) ? data : [data]`, so the wrapper object was itself
  //     treated as one promotion and the real payload was ignored wholesale.
  //   * `code` is a top-level NOT NULL column on the Promotion model
  //     (models/promotion.js) and is the key the module maps application
  //     methods and campaigns by. The old code buried it in `campaign.codes[]`,
  //     which is not a field at all. This (not the campaign budget) is the
  //     FIRST failure: a NOT NULL violation at `promotionService_.create`,
  //     before any campaign or application-method validation is reached.
  //   * `type` is a NOT NULL enum column and was absent entirely.
  //   * `application_method.allocation` was "total", which is not a member of
  //     ApplicationMethodAllocation (each | across | once), so
  //     validateApplicationMethodAttributes would have thrown next.
  //   * `application_method.value` was literally `undefined`.
  //   * `campaign.budget.type` is a NOT NULL enum (CampaignBudget model) and
  //     was absent, real, but third in line, not first.
  //   * `campaign.campaign_identifier` is NOT NULL and unique, and was absent.
  //   * `title`, `regions` and `is_disabled` are not promotion fields.
  //
  // Budget type is USAGE rather than SPEND on purpose: SPEND additionally
  // requires campaign.budget.currency_code to equal
  // application_method.currency_code or createPromotions_ throws, and a
  // single-use gift card is naturally expressed as a usage count.
  let created: any
  try {
    created = await promotionModule.createPromotions([
      {
        code,
        type: PromotionType.STANDARD,
        // Without this the model defaults to DRAFT and the code will not apply
        // at checkout, a silent "the code doesn't work" support ticket.
        status: PromotionStatus.ACTIVE,
        is_automatic: false,
        ...(rules.length ? { rules } : {}),
        application_method: {
          type: ApplicationMethodType.FIXED,
          target_type: ApplicationMethodTargetType.ORDER,
          // ACROSS, not ONCE: the module explicitly rejects allocation "once"
          // with target_type "order". ACROSS also must not carry max_quantity,
          // so it is omitted rather than set to null.
          allocation: ApplicationMethodAllocation.ACROSS,
          value,
          currency_code: currencyCode,
        },
        campaign: {
          name: `Gift Card ${label}`,
          campaign_identifier: `gift-card-${code}`,
          budget: {
            type: CampaignBudgetType.USAGE,
            limit: usageLimit,
          },
        },
      },
    ])
  } catch (e) {
    // DO NOT SWALLOW. The previous console.warn here is the reason a customer
    // paid for a gift card and received nothing: the promotion never existed,
    // the code was written to order metadata anyway, and no email was ever
    // sent. Throwing propagates to the event bus, which records the subscriber
    // as failed and makes it visible/retryable instead of losing it.
    //
    // The code is not logged. It is a bearer instrument and logs are not a
    // place to leave one.
    logger?.error?.(
      `[gift-card] FAILED to create the gift card promotion for order ` +
        `${order.id} (${label}). The customer has PAID and has NOT received a ` +
        `redeemable code. This needs manual issuance.`,
      e
    )
    throw e
  }

  const promotion = Array.isArray(created) ? created[0] : created

  // Persist a reference on the order so support can tie a quoted code back to
  // the order it came from. Best effort: the promotion already exists and is
  // redeemable at this point, so a metadata failure must not stop the email.
  try {
    await orderModule.updateOrders(order.id, {
      metadata: {
        ...((order as any).metadata ?? {}),
        gift_card_codes: [code],
        gift_card_promotion_ids: [promotion?.id].filter(Boolean),
      },
    })
  } catch (e) {
    logger?.warn?.(
      `[gift-card] issued a gift card for order ${order.id} but could not ` +
        `record it on the order metadata. The promotion exists and is ` +
        `redeemable; support lookup by order will not find it.`,
      e
    )
  }

  // Deliver it. This is the entire point of the feature and it was missing:
  // the old file generated a code, stored it, and told nobody.
  const recipient =
    (order as any)?.customer?.email || (order as any)?.email || null

  if (!recipient) {
    throw new Error(
      `[gift-card] issued gift card promotion ${promotion?.id} for order ` +
        `${order.id} but the order has no email address to deliver it to. ` +
        `The code exists and must be delivered manually.`
    )
  }

  await notificationModuleService.createNotifications({
    to: recipient,
    channel: "email",
    template: "gift-card-code",
    // Scoped to the order: a retry after a transient Resend failure re-sends,
    // a replay after a success does not.
    idempotency_key: `gift-card-code:${order.id}`,
    data: {
      gift_card_code: code,
      gift_card_value: formatCurrency(value, currencyCode),
      order_display_id: (order as any)?.metadata?.order_number || `GMS-${String(order.id).replace(/^order_/, "")}`,
      customer_first_name: (order as any)?.customer?.first_name || "there",
    },
  })

  logger?.info?.(
    `[gift-card] issued and emailed a gift card for order ${order.id} ` +
      `(promotion ${promotion?.id}).`
  )
}

function formatCurrency(amount: number, currencyCode?: string | null): string {
  const code = (currencyCode || "GBP").toUpperCase()
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: code,
    }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${code}`
  }
}

export const config: SubscriberConfig = {
  // `order.placed` ONLY. See the idempotency guard above: this handler mints
  // bearer instruments and also writes order metadata, so subscribing to
  // `order.updated` made it re-entrant on its own side effect.
  event: "order.placed",
}
