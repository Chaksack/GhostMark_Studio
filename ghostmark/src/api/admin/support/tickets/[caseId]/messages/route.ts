import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { addMessage, getTicketByCaseId } from "../../../../../../services/support-db"
import { sendEmail } from "../../../../../../services/email-service"

/**
 * POST /admin/support/tickets/:caseId/messages
 * Body: { message: string }
 * Adds an admin reply and emails the customer.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const caseId = (req.params as any).caseId as string
    const body = (await req.json()) as { message?: string }
    if (!caseId || !body?.message) {
      return res.status(400).json({ ok: false, message: "caseId and message are required" })
    }
    const data = await getTicketByCaseId(caseId)
    if (!data) return res.status(404).json({ ok: false, message: "Ticket not found" })

    await addMessage(caseId, 'admin', body.message)

    // Notify customer
    try {
      await sendEmail({
        to: data.ticket.email,
        subject: `Update on your case ${caseId}`,
        text: `Hello,\n\nWe replied to your case ${caseId}:\n\n${body.message}\n\nYou can view and respond to this message on our site using your case ID and secret.`,
      })
    } catch {}

    return res.json({ ok: true })
  } catch (e: any) {
    return res.status(500).json({ ok: false, message: e?.message || "Failed to add message" })
  }
}
