import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { listTickets } from "../../../../services/support-db"

/**
 * GET /admin/support/tickets?limit=&offset=
 *
 * Returns SupportTicketPublic rows - no secret material.
 *
 * This route previously returned `SELECT *` rows verbatim, which meant every
 * customer's email address AND their plaintext support secret came back in one
 * unpaginated-by-default listing. Combined with secrets that never expired,
 * one leaked admin API key produced permanent access to every existing case
 * that SURVIVED revoking the key - rotating the credential did not undo the
 * compromise.
 *
 * Two changes fixed it, both in support-db.ts: secrets are now stored as a
 * sha256 hash so there is no plaintext to leak, and listTickets() selects an
 * explicit column allowlist so a future sensitive column is excluded by
 * default rather than published the moment it is added.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    /**
     * parseInt returns NaN for absent or non-numeric input. listTickets()
     * clamps NaN, negatives and oversized values itself - the clamping lives
     * there deliberately, so every caller inherits it rather than each route
     * having to remember.
     */
    const limit = parseInt(String((req.query as any).limit ?? '50'), 10)
    const offset = parseInt(String((req.query as any).offset ?? '0'), 10)
    const tickets = await listTickets(limit, offset)
    return res.json({ ok: true, tickets })
  } catch (e: any) {
    console.error("[support] Failed to list tickets:", e)
    return res.status(500).json({ ok: false, message: "Failed to list tickets" })
  }
}
