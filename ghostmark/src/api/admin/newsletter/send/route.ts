import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { sendEmail } from "../../../../services/email-service"

/**
 * POST /admin/newsletter/send
 * Body: { to: string | string[], subject: string, text?: string, html?: string, cc?: string | string[], bcc?: string | string[], replyTo?: string }
 * Sends a newsletter email to the provided recipients using Resend.
 *
 * Note: For a production setup, add proper auth checks (e.g., verify an admin token).
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const body = (await req.json()) as {
      to?: string | string[]
      subject?: string
      text?: string
      html?: string
      cc?: string | string[]
      bcc?: string | string[]
      replyTo?: string
    }

    if (!body?.to || !body?.subject) {
      return res.status(400).json({ ok: false, message: "Missing required fields: to, subject" })
    }
    if (!body.text && !body.html) {
      return res.status(400).json({ ok: false, message: "Provide at least text or html content" })
    }

    const result = await sendEmail({
      to: body.to,
      subject: body.subject!,
      text: body.text,
      html: body.html,
      cc: body.cc,
      bcc: body.bcc,
      replyTo: body.replyTo,
      tags: [
        { name: "category", value: "newsletter" },
        { name: "scope", value: "admin-send" },
      ],
      headers: { "X-Newsletter": "admin-send" },
    })

    return res.json({ ok: true, result })
  } catch (e: any) {
    const message = e?.message || "Failed to send newsletter"
    return res.status(500).json({ ok: false, message })
  }
}
