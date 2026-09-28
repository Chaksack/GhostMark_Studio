import { SubscriberArgs, type SubscriberConfig } from "@medusajs/framework"
import { formatMoney, ORDER_DOCUMENT_FIELDS } from "../services/pdf-utils"
import { isPushConfigured, sendPushToAdmins } from "../services/push-service"

// Web Push (VAPID) alert to subscribed admin/staff browsers when a customer
// places an order. Kept separate from order-notifications.ts (customer email)
// so a push failure can never affect email delivery, and vice versa.
// Only `order.placed` — `order.updated` would fire on every edit.
export default async function orderPushHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  if (!isPushConfigured()) return

  try {
    const query = container.resolve("query")
    const { data: [order] } = await query.graph({
      entity: "order",
      fields: ORDER_DOCUMENT_FIELDS,
      filters: { id: data.id },
    })
    if (!order) return

    const o = order as any
    const itemCount = Array.isArray(o.items)
      ? o.items.reduce((sum: number, i: any) => sum + Number(i?.quantity || 0), 0)
      : 0
    const name =
      [o.shipping_address?.first_name, o.shipping_address?.last_name].filter(Boolean).join(" ") ||
      o.email ||
      ""

    const body = [
      formatMoney(Number(o.total ?? 0), o.currency_code),
      `${itemCount} item${itemCount === 1 ? "" : "s"}`,
      name,
    ]
      .filter(Boolean)
      .join(" · ")

    await sendPushToAdmins({
      title: `New order #${o.display_id ?? o.id}`,
      body,
      url: `/app/orders/${o.id}`,
      tag: `order-${o.id}`,
    })
  } catch (err) {
    console.error(`[order-push] failed for order ${data?.id}:`, err)
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
