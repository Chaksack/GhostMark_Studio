import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getTicketByCaseId } from "../../../../../services/support-db"

/**
 * GET /store/support/tickets/:caseId?email=...&secret=...
 * Returns ticket and messages if email+secret match.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const { params, query } = req
    const caseId = (params as any).caseId as string
    const email = (query as any).email as string | undefined
    const secret = (query as any).secret as string | undefined
    if (!caseId || !email || !secret) {
      return res.status(400).json({ ok: false, message: "caseId, email and secret are required" })
    }
    const data = await getTicketByCaseId(caseId)
    if (!data) return res.status(404).json({ ok: false, message: "Ticket not found" })
    if (data.ticket.email.toLowerCase() !== email.toLowerCase() || data.ticket.secret_code !== secret) {
      return res.status(403).json({ ok: false, message: "Invalid credentials" })
    }
    return res.json({ ok: true, ticket: { caseId: data.ticket.case_id, subject: data.ticket.subject, status: data.ticket.status, created_at: data.ticket.created_at }, messages: data.messages })
  } catch (e: any) {
    return res.status(500).json({ ok: false, message: e?.message || "Failed to get ticket" })
  }
}
