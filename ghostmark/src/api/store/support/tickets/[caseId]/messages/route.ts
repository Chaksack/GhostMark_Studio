import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { addMessage, verifyTicketAccess } from "../../../../../../services/support-db"
import { sendEmail } from "../../../../../../services/email-service"
import { html } from "../../../../../../utils/html"
import { enforceRateLimit, getClientIp, RATE_LIMITS } from "../../../../../../utils/rate-limit"
import { clampText } from "../../../../../../utils/validation"

/**
 * POST /store/support/tickets/:caseId/messages
 * Body: { email: string, secret: string, message: string }
 *
 * Unauthenticated, credential-gated, and it sends email to the admin - so it
 * carries the same three concerns as ticket creation: constant-time credential
 * checking, escaping at the sink, and a rate limit.
 */

const MAX_MESSAGE_LENGTH = 5000

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
    const message = clampText((body?.message || "").toString().trim(), MAX_MESSAGE_LENGTH)

    if (!caseId || !email || !secret || !message) {
      return res.status(400).json({ ok: false, message: "caseId, email, secret and message are required" })
    }

    const allowed = enforceRateLimit(res, [
      { name: "support_msg_ip", key: getClientIp(req), ...RATE_LIMITS.SUPPORT_MESSAGE_IP },
      { name: "support_msg_case", key: caseId.toLowerCase(), ...RATE_LIMITS.SUPPORT_MESSAGE_CASE },
    ])
    if (!allowed) {
      return // 429 already sent
    }

    const access = await verifyTicketAccess(caseId, email, secret)
    if (!access.ok) {
      if (access.reason === 'expired') {
        return res.status(403).json({
          ok: false,
          code: "expired",
          message: "This support link has expired. Please contact us to reopen your case.",
        })
      }
      // Same uniform response as the read route - see the comment there on why
      // 404-vs-403 was an enumeration oracle.
      return res.status(404).json({ ok: false, message: "Ticket not found or credentials invalid" })
    }

    await addMessage(caseId, 'customer', message)

    // Notify the admin. Fixed server-side recipient, so the customer's text may
    // appear - but ESCAPED, because it lands in a staff mailbox that renders
    // HTML and this is an obvious place to aim a link at staff.
    const adminEmail = process.env.SUPPORT_ADMIN_EMAIL || process.env.SMTP_FROM_EMAIL
    if (adminEmail) {
      try {
        await sendEmail({
          to: adminEmail,
          subject: `[Support] Customer replied on ${access.ticket.case_id}`,
          /**
           * Explicit `html` rather than text-only: email-service.ts interpolates
           * a text-only body into HTML without escaping, so passing only `text`
           * would reintroduce the injection this escaping is here to prevent.
           */
          html: html`
            <p>Customer <strong>${access.ticket.email}</strong> replied on case <strong>${access.ticket.case_id}</strong>:</p>
            <pre style="white-space:pre-wrap;font-family:inherit;">${message}</pre>
          `.toString(),
          text: `Customer ${access.ticket.email} replied on case ${access.ticket.case_id}:\n\n${message}`,
        })
      } catch {}
    }

    return res.json({ ok: true })
  } catch (e: any) {
    console.error("[support] Failed to add message:", e)
    return res.status(500).json({ ok: false, message: "Failed to add message" })
  }
}
