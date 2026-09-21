import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { deleteSubscription, saveSubscription } from "../../../../services/push-db"

type SubscribeBody = {
  endpoint?: string
  keys?: { p256dh?: string; auth?: string }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const body = (req.body || {}) as SubscribeBody
    const endpoint = body.endpoint
    const p256dh = body.keys?.p256dh
    const auth = body.keys?.auth

    if (!endpoint || !p256dh || !auth) {
      return res.status(400).json({ message: "endpoint, keys.p256dh and keys.auth are required" })
    }
    if (!/^https:\/\//i.test(endpoint)) {
      return res.status(400).json({ message: "endpoint must be an https URL" })
    }

    await saveSubscription({
      endpoint,
      p256dh,
      auth,
      userId: (req as any).auth_context?.actor_id ?? null,
      userAgent: String(req.headers["user-agent"] || "").slice(0, 300) || null,
    })

    return res.status(201).json({ success: true })
  } catch (error: any) {
    console.error("Error saving push subscription:", error)
    return res.status(500).json({ success: false, message: error?.message || "Failed to save subscription" })
  }
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  try {
    const endpoint = ((req.body || {}) as SubscribeBody).endpoint
    if (!endpoint) {
      return res.status(400).json({ message: "endpoint is required" })
    }
    await deleteSubscription(endpoint)
    return res.json({ success: true })
  } catch (error: any) {
    console.error("Error removing push subscription:", error)
    return res.status(500).json({ success: false, message: error?.message || "Failed to remove subscription" })
  }
}
