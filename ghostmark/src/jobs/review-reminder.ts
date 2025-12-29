import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { signReviewToken } from "../services/review-token"

/**
 * Scheduled job: send review reminder emails 2 days after order placement.
 * Links include a signed token that expires in 7 days.
 */
export default async function reviewReminderJob(container: MedusaContainer) {
  const notificationModuleService = container.resolve(Modules.NOTIFICATION)
  const query = container.resolve("query") as any

  const defaultCountry = process.env.DEFAULT_COUNTRY_CODE || "us"
  const baseUrl =
    process.env.REVIEW_LINK_BASE_URL ||
    process.env.STOREFRONT_URL ||
    process.env.STOREFRONT_BASE_URL ||
    "http://localhost:8000"

  // Determine the target day (2 days ago) in UTC
  const now = new Date()
  const target = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)
  const start = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate(), 0, 0, 0))
  const end = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate(), 23, 59, 59, 999))

  // Fetch orders created on the target day
  // Note: filter operators may vary by setup. Using $gte/$lt common style.
  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "*",
      "customer.email",
      "items.*",
      "items.variant.product.id",
      "items.variant.product.title",
      "items.variant.product.type.value",
      "items.variant.product.type.title",
      "items.variant.product.type.name",
      "items.variant.product.type.handle",
    ],
    filters: {
      created_at: { $gte: start.toISOString(), $lt: end.toISOString() },
      // Only orders with customers
      "customer.email": { $ne: null },
    },
  })

  if (!Array.isArray(orders) || !orders.length) return

  for (const order of orders) {
    const customerEmail: string | undefined = order?.customer?.email
    if (!customerEmail) continue

    const items: any[] = order.items || []
    for (const item of items) {
      const product = item?.variant?.product
      if (!product) continue
      // Determine if POD product from product.type
      const t = product?.type
      const rawType = (t?.value || t?.title || t?.name || t?.handle || "").toString().toLowerCase()
      const isPOD = rawType.includes("pod") || rawType === "pod"
      if (!isPOD) continue

      const productId: string | undefined = product.id
      if (!productId) continue

      // Token expires in 7 days
      const exp = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60
      const token = signReviewToken({ orderId: order.id, productId, email: customerEmail, exp })

      const url = `${baseUrl.replace(/\/$/, "")}/${defaultCountry}/reviews/submit?productId=${encodeURIComponent(
        productId
      )}&email=${encodeURIComponent(customerEmail)}&rating=5&token=${encodeURIComponent(token)}`

      const data = {
        customer_email: customerEmail,
        order_display_id: order.display_id || order.id,
        product_title: product.title || "Product",
        review_link: url,
        expires_in_days: 7,
      }

      await notificationModuleService.createNotifications({
        to: customerEmail,
        channel: "email",
        template: "review-reminder",
        data,
      })
    }
  }
}

// Run daily at 08:00 UTC
export const config = {
  name: "send-review-reminders",
  schedule: "0 8 * * *",
}
