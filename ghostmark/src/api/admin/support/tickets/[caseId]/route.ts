import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getTicketByCaseId } from "../../../../../services/support-db"

/**
 * GET /admin/support/tickets/:caseId
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const caseId = (req.params as any).caseId as string
    const data = await getTicketByCaseId(caseId)
    if (!data) return res.status(404).json({ ok: false, message: "Ticket not found" })
    return res.json({ ok: true, ticket: data.ticket, messages: data.messages })
  } catch (e: any) {
    return res.status(500).json({ ok: false, message: e?.message || "Failed to get ticket" })
  }
}
