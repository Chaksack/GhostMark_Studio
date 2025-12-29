import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { sendEmail } from "../../../../services/email-service"

/**
 * POST /store/email/send
 * Body: { to: string | string[], subject: string, text?: string, html?: string, cc?: string | string[], bcc?: string | string[], replyTo?: string, tags?: Array<{name: string, value: string}>, headers?: Record<string, string> }
 * Sends an email using Resend API.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const body = (await req.json()) as {
      to?: string | string[]
      subject?: string
      text?: string
      html?: string
      from?: string
      cc?: string | string[]
      bcc?: string | string[]
      replyTo?: string
      tags?: Array<{name: string, value: string}>
      headers?: Record<string, string>
    }

    if (!body?.to || !body?.subject) {
      return res.status(400).json({
        message: "Missing required fields: to, subject",
      })
    }
    if (!body.text && !body.html) {
      return res.status(400).json({
        message: "Provide at least text or html content",
      })
    }

    const result = await sendEmail({
      to: body.to,
      subject: body.subject!,
      text: body.text,
      html: body.html,
      from: body.from,
      cc: body.cc,
      bcc: body.bcc,
      replyTo: body.replyTo,
      tags: body.tags,
      headers: body.headers,
    })

    return res.json({ ok: true, result })
  } catch (e: any) {
    const message = e?.message || "Failed to send email"
    return res.status(500).json({ ok: false, message })
  }
}
