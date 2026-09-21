import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getVapidPublicKey } from "../../../../services/push-service"

// Returns the VAPID public key the admin UI needs for pushManager.subscribe().
export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  const publicKey = getVapidPublicKey()
  return res.json({ configured: Boolean(publicKey), publicKey })
}
