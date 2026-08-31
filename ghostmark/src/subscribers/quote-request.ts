import { SubscriberArgs, type SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"

// Quote request email subscriber.
//
// WHY THIS FILE EXISTS. This handler used to live at the bottom of
// order-notifications.ts as `export async function quoteRequestHandler`, with
// its config as `export const quoteConfig`. Neither was ever registered.
// Medusa's subscriber loader (framework/dist/subscribers/subscriber-loader.js,
// `onFileLoaded`) reads exactly two things from a subscriber module:
// `fileExports.default` and `fileExports.config`. Every other named export is
// discarded without comment. So `quote.requested` had no subscriber at all and
// no customer has ever received a quote acknowledgement.
//
// One subscriber per file, default export plus `config`, is the only shape the
// loader accepts. Hence the split.

const EMAIL_LOCALE = "en-GB"
const DEFAULT_CURRENCY = "GBP"

function formatCurrency(amount: number, currencyCode?: string | null): string {
  const code = (currencyCode || DEFAULT_CURRENCY).toUpperCase()
  if (typeof amount !== "number" || !Number.isFinite(amount)) return ""
  try {
    return new Intl.NumberFormat(EMAIL_LOCALE, {
      style: "currency",
      currency: code,
    }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${code}`
  }
}

// Rough quote estimate for the `quote.requested` email.
//
// Constants are MAJOR units, matching Medusa v2 and `formatCurrency` above.
// These are placeholder figures for a "simplified" estimate and are not read
// from the catalogue.
function calculateBulkEstimate(quantity: number): number {
  const basePrice = 12.99 // £12.99 per unit
  const setupFee = 5.0 // £5.00 flat

  let discount = 0
  if (quantity >= 100) discount = 0.25
  else if (quantity >= 50) discount = 0.2
  else if (quantity >= 25) discount = 0.15
  else if (quantity >= 10) discount = 0.1

  const subtotal = basePrice * quantity
  const discountAmount = subtotal * discount

  return subtotal - discountAmount + setupFee
}

export default async function quoteRequestHandler({
  event: { data },
  container,
}: SubscriberArgs<{
  productId: string
  variantId: string
  quantity: number
  customerEmail: string
  customerType?: string
}>) {
  const notificationModuleService = container.resolve(Modules.NOTIFICATION)
  const query = container.resolve("query")

  try {
    const {
      data: [product],
    } = await query.graph({
      entity: "product",
      fields: ["id", "title", "handle"],
      filters: { id: data.productId },
    })

    const estimatedPrice = calculateBulkEstimate(data.quantity)

    const emailData = {
      customer_first_name: data.customerEmail.split("@")[0],
      product_title: product?.title || "Custom Product",
      quantity: data.quantity,
      customer_type: data.customerType || "individual",
      estimated_total: formatCurrency(estimatedPrice),
    }

    await notificationModuleService.createNotifications({
      to: data.customerEmail,
      channel: "email",
      template: "quote-request",
      // A quote request is identified by who asked, for what, and how many.
      // Repeated identical submissions (double-click, retry) collapse to one
      // acknowledgement; a genuinely different quantity is a different key.
      idempotency_key: `quote-request:${data.customerEmail}:${data.productId}:${data.quantity}`,
      data: emailData,
    })

    console.log(`Quote request confirmation sent for product ${data.productId}`)
  } catch (error) {
    console.error("Failed to send quote request email:", error)
  }
}

export const config: SubscriberConfig = {
  event: "quote.requested",
}
