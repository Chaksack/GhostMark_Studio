import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { isPushConfigured, sendPushToAdmins } from "../../../../services/push-service"

// Sends a test notification to every subscribed admin browser so staff can
// confirm alerts work without waiting for a real order.
export async function POST(_req: MedusaRequest, res: MedusaResponse) {
  if (!isPushConfigured()) {
    return res.status(400).json({ message: "VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY are not configured" })
  }
  const result = await sendPushToAdmins({
    title: "GhostMark test notification",
    body: "Order alerts are working on this device.",
    url: "/app/orders",
    tag: "push-test",
  })
  return res.json({ success: true, ...result })
}
