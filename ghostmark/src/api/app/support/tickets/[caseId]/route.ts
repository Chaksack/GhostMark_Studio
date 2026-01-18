import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

/**
 * GET /app/support/tickets/:caseId
 * Redirect deep links to /app so the Admin SPA can initialize.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    return res.redirect(307, "/app")
  } catch (e) {
    return res.redirect(302, "/app")
  }
}
