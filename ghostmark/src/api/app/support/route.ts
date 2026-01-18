import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

/**
 * GET /app/support
 * Some environments don't serve the Admin SPA with history fallback on deep links
 * like /app/support, resulting in a 404. This tiny handler redirects to /app,
 * where the SPA loads and the sidebar link can be used to reach Support.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    return res.redirect(307, "/app")
  } catch (e) {
    return res.redirect(302, "/app")
  }
}
