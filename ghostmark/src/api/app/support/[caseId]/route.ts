import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

/**
 * GET /app/support/:caseId
 * Redirect deep-linked admin support routes back to /app so the Admin SPA
 * can initialize and handle client-side routing. This prevents 404s when
 * users refresh or paste a deep link.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    return res.redirect(307, "/app")
  } catch (e) {
    return res.redirect(302, "/app")
  }
}
