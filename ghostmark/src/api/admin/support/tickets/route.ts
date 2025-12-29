import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { listTickets } from "../../../../services/support-db"

/**
 * GET /admin/support/tickets?limit=&offset=
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const limit = parseInt(String((req.query as any).limit ?? '50'))
    const offset = parseInt(String((req.query as any).offset ?? '0'))
    const tickets = await listTickets(limit, offset)
    return res.json({ ok: true, tickets })
  } catch (e: any) {
    return res.status(500).json({ ok: false, message: e?.message || "Failed to list tickets" })
  }
}
