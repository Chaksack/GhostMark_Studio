import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { addMessage, getTicketByCaseId } from "../../../../../../services/support-db"
import { sendEmail } from "../../../../../../services/email-service"

/**
 * POST /store/support/tickets/:caseId/messages
 * Body: { email: string, secret: string, message: string }
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const caseId = String((req.params as any).caseId || "").trim()
    // MedusaRequest carries parsed JSON in req.body; use it instead of req.json()
    const body = ((req as any).body ?? (typeof (req as any).json === 'function' ? await (req as any).json() : undefined)) as {
      email?: string
      secret?: string
      message?: string
    }
    const email = (body?.email || "").toString().trim()
    const secret = (body?.secret || "").toString().trim()
    const message = (body?.message || "").toString()
    if (!caseId || !email || !secret || !message) {
      return res.status(400).json({ ok: false, message: "caseId, email, secret and message are required" })
    }
    const data = await getTicketByCaseId(caseId)
    if (!data) return res.status(404).json({ ok: false, message: "Ticket not found" })
    if (data.ticket.email.toLowerCase() !== email.toLowerCase() || data.ticket.secret_code !== secret) {
      return res.status(403).json({ ok: false, message: "Invalid credentials" })
    }
    await addMessage(caseId, 'customer', message)

    // Notify admin
    const adminEmail = process.env.SUPPORT_ADMIN_EMAIL || process.env.SMTP_FROM_EMAIL
    if (adminEmail) {
      try {
        await sendEmail({
          to: adminEmail,
          subject: `[Support] Customer replied on ${caseId}`,
          text: `Customer ${data.ticket.email} replied on case ${caseId}:\n\n${body.message}`,
        })
      } catch {}
    }

    return res.json({ ok: true })
  } catch (e: any) {
    return res.status(500).json({ ok: false, message: e?.message || "Failed to add message" })
  }
}
