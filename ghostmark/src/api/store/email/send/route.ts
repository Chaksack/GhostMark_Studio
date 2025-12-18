import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { sendEmail } from "../../../../services/email-service"

/**
 * POST /store/email/send
 * Body: { to: string | string[], subject: string, text?: string, html?: string }
 * Sends an email using SMTP credentials from environment variables.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const body = (await req.json()) as {
      to?: string | string[]
      subject?: string
      text?: string
      html?: string
      from?: string
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
    })

    return res.json({ ok: true, result })
  } catch (e: any) {
    const message = e?.message || "Failed to send email"
    return res.status(500).json({ ok: false, message })
  }
}
