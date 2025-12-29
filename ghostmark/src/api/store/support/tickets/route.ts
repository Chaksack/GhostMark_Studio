import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { createTicket } from "../../../../services/support-db"
import { sendEmail } from "../../../../services/email-service"

/**
 * POST /store/support/tickets
 * Body: { email: string, subject: string, message: string }
 * Returns: { ok: true, caseId: string, secret: string }
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const body = (await req.json()) as {
      email?: string
      subject?: string
      message?: string
    }

    if (!body?.email || !body?.subject || !body?.message) {
      return res.status(400).json({ ok: false, message: "email, subject and message are required" })
    }

    const { ticket, secret } = await createTicket({
      email: body.email,
      subject: body.subject,
      message: body.message,
    })

    // Notify admin
    const adminEmail = process.env.SUPPORT_ADMIN_EMAIL || process.env.SMTP_FROM_EMAIL
    if (adminEmail) {
      try {
        await sendEmail({
          to: adminEmail,
          subject: `[Support] New ticket ${ticket.case_id}: ${ticket.subject}`,
          text: `New support ticket\nCase ID: ${ticket.case_id}\nFrom: ${ticket.email}\nSubject: ${ticket.subject}\n\nMessage:\n${body.message}`,
        })
      } catch {}
    }

    // Acknowledge customer
    try {
      await sendEmail({
        to: ticket.email,
        subject: `We received your request - Case ${ticket.case_id}`,
        text: `Thanks for contacting GhostMark Studio.\n\nYour case ID is ${ticket.case_id}. Keep this for your records.\nSecret code: ${secret}\n\nWe will get back to you shortly. You can view and reply to your case on our site using your email, case ID and secret.`,
      })
    } catch {}

    return res.json({ ok: true, caseId: ticket.case_id, secret })
  } catch (e: any) {
    return res.status(500).json({ ok: false, message: e?.message || "Failed to create ticket" })
  }
}
