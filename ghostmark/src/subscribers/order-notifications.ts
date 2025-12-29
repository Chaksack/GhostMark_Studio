import { SubscriberArgs, type SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"

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

    // Prepare email data
    const emailData = {
      order_display_id: order.display_id || order.id,
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

    console.log(`Order confirmation emails sent for order ${order.display_id}`)

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