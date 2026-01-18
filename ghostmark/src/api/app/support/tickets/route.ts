import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

/**
 * GET /app/support/tickets
 * Redirect to /app so the Admin SPA can boot and handle client-side routing.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    return res.redirect(307, "/app")
  } catch (e) {
    return res.redirect(302, "/app")
  }
}
