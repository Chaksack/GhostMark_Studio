import { SubscriberArgs, type SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"

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
    // Fetch order details with customer information
    const { data: [order] } = await query.graph({
      entity: "order",
      fields: [
        "*",
        "customer.email",
        "customer.first_name", 
        "customer.last_name",
        "items.*",
        "items.variant.product.title"
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

    // GMS-<ULID> formatted order number — shared format with the storefront
    // confirmation page. Used as the `order_display_id` template placeholder
    // in both the customer confirmation and the bulk-order admin alert.
    const displayId = formatOrderNumber(order.id)

    // Persist the order_number on the order itself so the admin (and any
    // future support search) can resolve a customer's quoted "GMS-…" back
    // to the underlying order. Without this, the email shows
    // GMS-01KTD…802N but admin only knows display_id #4 — support has no
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
        // Best-effort. The email still goes out — but log loudly because
        // support won't be able to look this order up by its GMS number
        // until something else writes the metadata.
        console.warn(
          `[order-notifications] failed to persist order_number for ${order.id}:`,
          e,
        )
      }
    }

    // Prepare email data
    const emailData = {
      order_display_id: displayId,
      customer_first_name: order.customer.first_name || 'Customer',
      customer_email: order.customer.email,
      order_total: formatCurrency(order.total),
      total_quantity: totalQuantity,
      customer_type: customerType,
      items: order.items?.map((item: any) => ({
        title: item.variant?.product?.title || 'Product',
        quantity: item.quantity,
        unit_price: formatCurrency(item.unit_price)
      }))
    }

    // Send customer confirmation email
    await notificationModuleService.createNotifications({
      to: order.customer.email,
      channel: "email",
      template: "order-confirmation",
      data: emailData,
    })

    // Send bulk order alert for large orders (25+ units or corporate)
    if (totalQuantity >= 25 || customerType === 'corporate') {
      // Send to admin/sales team
      const adminEmail = process.env.ADMIN_EMAIL || process.env.GMAIL_USER_EMAIL
      if (adminEmail) {
        await notificationModuleService.createNotifications({
          to: adminEmail,
          channel: "email",
          template: "bulk-order-notification",
          data: emailData,
        })
      }
    }

    console.log(`Order confirmation emails sent for order ${displayId}`)

  } catch (error) {
    console.error('Failed to send order confirmation email:', error)
  }
}

// Quote request email subscriber
export async function quoteRequestHandler({
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
    // Fetch product details
    const { data: [product] } = await query.graph({
      entity: "product",
      fields: ["*"],
      filters: {
        id: data.productId,
      },
    })

    // Estimate pricing (simplified)
    const estimatedPrice = calculateBulkEstimate(data.quantity)

    const emailData = {
      customer_first_name: data.customerEmail.split('@')[0], // Simple name extraction
      product_title: product?.title || 'Custom Product',
      quantity: data.quantity,
      customer_type: data.customerType || 'individual',
      estimated_total: formatCurrency(estimatedPrice),
    }

    // Send quote confirmation to customer
    await notificationModuleService.createNotifications({
      to: data.customerEmail,
      channel: "email",
      template: "quote-request",
      data: emailData,
    })

    console.log(`Quote request confirmation sent to ${data.customerEmail}`)

  } catch (error) {
    console.error('Failed to send quote request email:', error)
  }
}

// Utility functions
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount / 100) // Assuming amount is in cents
}

function calculateBulkEstimate(quantity: number): number {
  // Simple bulk pricing estimation
  const basePrice = 1299 // $12.99 in cents
  const setupFee = 500   // $5.00 in cents
  
  let discount = 0
  if (quantity >= 100) discount = 0.25
  else if (quantity >= 50) discount = 0.20
  else if (quantity >= 25) discount = 0.15
  else if (quantity >= 10) discount = 0.10

  const subtotal = basePrice * quantity
  const discountAmount = subtotal * discount
  
  return subtotal - discountAmount + setupFee
}

export const config: SubscriberConfig = {
  event: [
    "order.placed",
    "order.updated"
  ],
}

// Export quote request configuration separately
export const quoteConfig: SubscriberConfig = {
  event: "quote.requested"
}