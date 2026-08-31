import { SubscriberArgs, type SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import { ORDER_DOCUMENT_FIELDS } from "../services/pdf-utils"

// Customer-facing order number: `GMS-<ULID>` derived from Medusa's internal
// `order.id`. We use the ULID rather than `display_id` because the integer
// leaks order velocity and isn't unique enough to quote in support tickets.
//
// CRITICAL: this format MUST stay in sync with the storefront helper in
// `storefront/app/pages/checkout.vue` (`formatOrderNumber`). Both surfaces
// have to render the same string or the customer sees a mismatch between
// the email and the confirmation page. If you change the format here,
// change it there in the same commit.
const formatOrderNumber = (internalId: string): string => {
  if (internalId.startsWith("GMS-")) return internalId
  return `GMS-${internalId.replace(/^order_/, "")}`
}

// Order confirmation email subscriber
export default async function orderConfirmationHandler({
  event: { data },
  container,
}: SubscriberArgs<{
  id: string
}>) {
  const notificationModuleService = container.resolve(Modules.NOTIFICATION)
  const query = container.resolve("query")

  try {
    // Fetch order details with customer information.
    //
    // The field list must NOT contain "*". Medusa v2 does not store order
    // totals as columns (`select total from "order"` errors: no such column);
    // they are derived from the order's summary, and the order module only
    // derives them when the specific total field names appear in the requested
    // field list. Worse, mixing "*" into that list SUPPRESSES total resolution
    // rather than adding to it, so `["*", "total"]` still returns
    // `total: undefined`, adding "total" alongside the old "*" would have
    // looked like a fix and changed nothing.
    //
    // That is exactly how order confirmations came to quote "$NaN" (and, once
    // the formatter stopped emitting NaN, a literal "{{order_total}}"): the
    // subscriber asked for "*", got no total, and formatted undefined.
    //
    // ORDER_DOCUMENT_FIELDS is the explicit list the invoice/receipt/dispatch
    // routes already use, and it carries the full explanation of this quirk at
    // its definition. Sharing it is deliberate: the constraint is a property of
    // the order query layer, not of PDFs, and this codebase has already been
    // bitten by copying money/format logic into five places instead of one.
    // The extra entries below are this subscriber's own needs layered on top;
    // duplicates within a field list are harmless.
    const { data: [order] } = await query.graph({
      entity: "order",
      fields: [
        ...ORDER_DOCUMENT_FIELDS,
        "total",
        "currency_code",
        "customer.email",
        "customer.first_name",
        "customer.last_name",
        "items.*",
        "items.metadata",
        "items.variant.product.title",
      ],
      filters: {
        id: data.id,
      },
    })

    if (!order || !order.customer?.email) {
      console.log('Order or customer email not found, skipping notification')
      return
    }

    // Calculate total quantity for bulk detection
    const totalQuantity = order.items?.reduce((sum: number, item: any) => sum + item.quantity, 0) || 0
    const customerType = order.metadata?.customer_type || 'individual'

    // GMS-<ULID> formatted order number, shared format with the storefront
    // confirmation page. Used as the `order_display_id` template placeholder
    // in both the customer confirmation and the bulk-order admin alert.
    const displayId = formatOrderNumber(order.id)

    // Persist the order_number on the order itself so the admin (and any
    // future support search) can resolve a customer's quoted "GMS-…" back
    // to the underlying order. Without this, the email shows
    // GMS-01KTD…802N but admin only knows display_id #4, support has no
    // way to match them up, producing the "logistic hell" reported by ops.
    //
    // Pattern mirrored from `gift-card-code.ts` (also fires on order.placed
    // and patches metadata via `Modules.ORDER.updateOrders`). Metadata
    // updates emit `order.updated`, NOT `order.placed`, so this does not
    // re-enter the present subscriber.
    //
    // Idempotency: skip the write if the value is already correct. Re-runs
    // (e.g. order.updated for unrelated reasons triggering this handler if
    // wiring widens) become a no-op.
    if ((order as any).metadata?.order_number !== displayId) {
      try {
        const orderModule = container.resolve(Modules.ORDER)
        await orderModule.updateOrders(order.id, {
          metadata: {
            ...((order as any).metadata ?? {}),
            order_number: displayId,
          },
        })
      } catch (e) {
        // Best-effort. The email still goes out, but log loudly because
        // support won't be able to look this order up by its GMS number
        // until something else writes the metadata.
        console.warn(
          `[order-notifications] failed to persist order_number for ${order.id}:`,
          e,
        )
      }
    }

    // URL prefix for storefront-served upload assets (preview thumbnails
    // and original design files). Set STOREFRONT_PUBLIC_URL in production;
    // dev defaults to localhost:3000 which is what the Nuxt storefront
    // boots on per the rest of this codebase.
    const storefrontOrigin = (
      process.env.STOREFRONT_PUBLIC_URL || 'http://localhost:3000'
    ).replace(/\/$/, '')
    const absolutizeUpload = (url: string | null | undefined): string | null => {
      if (!url) return null
      if (/^(?:https?:)?\/\//.test(url)) return url
      if (url.startsWith('/')) return `${storefrontOrigin}${url}`
      return url
    }

    // Per-item designs for the email template. POD items will carry
    // `metadata.isCustomized = true` and a `designDataJson` payload that
    // includes `originalUrl` per print location. Non-POD items get an
    // empty `designs: []` so the template branches don't have to null-check.
    const buildDesigns = (item: any): Array<{
      location: string
      original_url: string | null
      original_filename: string | null
    }> => {
      if (!item?.metadata?.isCustomized) return []
      let parsed: any = null
      try {
        parsed = item.metadata.designDataJson
          ? JSON.parse(item.metadata.designDataJson)
          : null
      } catch {
        parsed = null
      }
      const designs = (parsed?.designs ?? {}) as Record<string, any>
      return Object.entries(designs)
        .filter(([, slot]) => slot)
        .map(([location, slot]) => ({
          location,
          original_url: absolutizeUpload(slot?.originalUrl ?? null),
          original_filename: slot?.originalFilename ?? null,
        }))
    }

    // Per-item line for the customer email. POD items get a thumbnail
    // and a "Designs received" block; plain items just show qty + price.
    const escapeHtml = (s: string): string =>
      s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')

    type EnrichedItem = ReturnType<typeof enrichItem>
    const enrichItem = (item: any) => {
      const title = item?.variant?.product?.title || item?.title || 'Product'
      const qty = item?.quantity ?? 1
      const isCustomized = item?.metadata?.isCustomized === true
      return {
        title,
        quantity: qty,
        unit_price: formatCurrency(item?.unit_price, order.currency_code),
        is_customized: isCustomized,
        preview_image_url: absolutizeUpload(item?.metadata?.previewImageUrl),
        designs: buildDesigns(item),
      }
    }

    const enriched: EnrichedItem[] = (order.items ?? []).map(enrichItem)

    // Renders the per-item rows shown inside the Order Summary card. POD
    // items get a thumbnail + a "designs received" sub-block listing
    // each print location's original-file download link. Non-POD items
    // get a clean qty/price row. The simple `{{key}}` interpolator
    // in resend-notification/service.ts can't iterate, so we
    // pre-render the whole block here.
    const itemsSummaryHtml = enriched.length
      ? enriched
          .map((it) => {
            const previewImg = it.preview_image_url
              ? `<img src="${escapeHtml(it.preview_image_url)}" alt="" style="display:block;width:64px;height:64px;border-radius:6px;object-fit:cover;border:1px solid #e5e7eb;" />`
              : ''
            const designsRows = it.is_customized && it.designs.length
              ? `
                <div style="margin-top:10px;padding-top:10px;border-top:1px solid #e5e7eb;">
                  <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#000000;">Designs received</p>
                  ${it.designs
                    .map(
                      (d) => `
                    <p style="margin:2px 0;font-size:12px;color:#4b5563;">
                      <span style="font-weight:600;color:#000000;">${escapeHtml(
                        d.location.charAt(0).toUpperCase() + d.location.slice(1),
                      )}:</span>
                      ${
                        d.original_url
                          ? `<a href="${escapeHtml(d.original_url)}" style="color:#000000;text-decoration:underline;">${escapeHtml(d.original_filename || 'original file')}</a>`
                          : `<span style="color:#92400e;">awaiting upload, we'll email you to follow up</span>`
                      }
                    </p>`,
                    )
                    .join('')}
                </div>`
              : ''
            return `
              <div style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid #f3f4f6;">
                ${previewImg ? `<div style="flex:0 0 64px;">${previewImg}</div>` : ''}
                <div style="flex:1;min-width:0;">
                  <p style="margin:0;font-size:14px;font-weight:600;color:#000000;">${escapeHtml(it.title)}</p>
                  <p style="margin:2px 0 0;font-size:13px;color:#4b5563;">Qty: ${it.quantity} · ${escapeHtml(it.unit_price)}</p>
                  ${designsRows}
                </div>
              </div>`
          })
          .join('')
      : ''

    // The order total is the one figure in this email the customer will check
    // against their bank. If the query contract ever regresses again (someone
    // reintroduces "*" into the field list above, or ORDER_DOCUMENT_FIELDS
    // drops "total"), the formatter returns '' and the customer receives a
    // confirmation with a blank total. That is quieter than "{{order_total}}"
    // but it is still wrong, so make it loud on our side.
    const orderTotal = formatCurrency((order as any).total, order.currency_code)
    if (!orderTotal) {
      console.error(
        `[order-notifications] could not resolve a total for order ${order.id}; ` +
          `the confirmation email will show a blank total. Check that the ` +
          `query.graph field list still requests "total" WITHOUT "*".`,
      )
    }

    // Prepare email data
    const emailData = {
      order_display_id: displayId,
      customer_first_name: order.customer.first_name || 'Customer',
      customer_email: order.customer.email,
      order_total: orderTotal,
      total_quantity: totalQuantity,
      customer_type: customerType,
      // String pre-rendered above, the {{items_summary_html}}
      // placeholder in the template gets replaced verbatim.
      items_summary_html: itemsSummaryHtml,
      // Structured items still passed alongside so future templates
      // (e.g. plaintext fallback, ops alert) can iterate on the data.
      items: enriched,
    }

    // Send customer confirmation email.
    //
    // IDEMPOTENCY. This subscriber is registered for BOTH `order.placed` and
    // `order.updated`, so every admin edit to an order re-enters here and used
    // to re-send the confirmation. `idempotency_key` is a first-class unique
    // column on the notification model and `createNotifications` de-duplicates
    // on it, re-sending only when the stored attempt has status FAILURE,
    // which is precisely the behaviour we want for event-bus retries.
    //
    // The key is scoped to the order, not to the event, so `order.placed` and
    // any number of subsequent `order.updated` events collapse to one email.
    await notificationModuleService.createNotifications({
      to: order.customer.email,
      channel: "email",
      template: "order-confirmation",
      data: emailData,
      idempotency_key: `order-confirmation:${order.id}`,
    })

    // Send bulk order alert for large orders (25+ units or corporate)
    if (totalQuantity >= 25 || customerType === 'corporate') {
      // Send to admin/sales team.
      //
      // The `GMAIL_USER_EMAIL` fallback is gone. ADMIN_EMAIL is not set in this
      // deployment, so that fallback silently routed internal bulk-order alerts
      // to a leftover personal Gmail address from a previous mail integration,
      // an address nobody chose as the ops inbox and which may not even belong
      // to the team any more. Sending business data to a stale address is worse
      // than not sending it, so this now no-ops loudly instead.
      const adminEmail = process.env.ADMIN_EMAIL
      if (adminEmail) {
        await notificationModuleService.createNotifications({
          to: adminEmail,
          channel: "email",
          template: "bulk-order-notification",
          data: emailData,
          idempotency_key: `bulk-order-alert:${order.id}`,
        })
      } else {
        console.warn(
          `[order-notifications] order ${displayId} qualifies for a bulk-order ` +
            `alert (${totalQuantity} units, type=${customerType}) but ADMIN_EMAIL ` +
            `is not set, so no internal alert was sent. Set ADMIN_EMAIL to enable it.`,
        )
      }
    }

    console.log(`Order confirmation emails sent for order ${displayId}`)

  } catch (error) {
    console.error('Failed to send order confirmation email:', error)
  }
}

// Utility functions
// Money rendering for outbound email.
//
// This was previously `Intl.NumberFormat('en-US', { currency: 'USD' })` over
// `amount / 100`, which was wrong three times over:
//   - Medusa v2 stores prices in MAJOR units (a price of 10.00 is stored as
//     10, not 1000), so the /100 shrank every figure by 100x.
//   - The currency was hardcoded to USD while this store transacts in GBP,
//     so a £4,200 order emailed as "$42.00", wrong symbol AND wrong scale.
//   - The locale was hardcoded to en-US, disagreeing with every storefront
//     surface (en-GB).
// The currency now comes from the order that is actually being emailed
// about; `DEFAULT_CURRENCY` is only reached on the quote-request path, which
// has no order attached.
const EMAIL_LOCALE = 'en-GB'
const DEFAULT_CURRENCY = 'GBP'

// Medusa v2 money fields are BigNumber-backed. `query.graph` normally
// serialises them to plain JS numbers, but depending on the call path they can
// arrive as a numeric string or as a `{ value }` wrapper. Coerce all three
// rather than treating the non-number shapes as missing, a shape mismatch
// used to be indistinguishable from "no total at all", and both rendered blank.
function toAmount(amount: unknown): number | null {
  if (typeof amount === 'number') return Number.isFinite(amount) ? amount : null
  if (typeof amount === 'string' && amount.trim() !== '') {
    const n = Number(amount)
    return Number.isFinite(n) ? n : null
  }
  if (amount && typeof amount === 'object') {
    const inner = (amount as any).value ?? (amount as any).numeric
    if (inner !== undefined && inner !== amount) return toAmount(inner)
  }
  return null
}

function formatCurrency(amount: unknown, currencyCode?: string | null): string {
  const code = (currencyCode || DEFAULT_CURRENCY).toUpperCase()
  const value = toAmount(amount)
  if (value === null) {
    // Never interpolate "NaN" or "undefined" into a customer-facing email.
    return ''
  }
  try {
    return new Intl.NumberFormat(EMAIL_LOCALE, {
      style: 'currency',
      currency: code,
    }).format(value)
  } catch {
    return `${value.toFixed(2)} ${code}`
  }
}

// Both events stay subscribed. `order.updated` is what catches an order whose
// customer or totals are only settled after placement, and it is now safe to
// keep because the send above carries an `idempotency_key` scoped to the order:
// the notification module de-duplicates on that key and only re-sends when the
// previous attempt is recorded as FAILURE. Before that key existed, every admin
// edit re-sent the customer their confirmation.
//
// Contrast with gift-card-code.ts, which is `order.placed` only. That handler
// mints a bearer instrument, so an idempotency key on the outbound email would
// not have been enough, the side effect it must not repeat is the minting, not
// the mail.
export const config: SubscriberConfig = {
  event: [
    "order.placed",
    "order.updated"
  ],
}
