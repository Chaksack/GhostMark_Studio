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
    // MedusaRequest already parses JSON into req.body; req.json() is not available
    const body = ((req as any).body ?? (typeof (req as any).json === 'function' ? await (req as any).json() : undefined)) as {
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

    // Acknowledge customer (styled HTML + plain text fallback)
    try {
      // Resolve public storefront base URL to build a deep link
      const publicBase = (
        process.env.STOREFRONT_PUBLIC_URL ||
        process.env.NEXT_PUBLIC_STOREFRONT_URL ||
        process.env.NEXT_PUBLIC_SITE_URL ||
        process.env.SITE_URL ||
        process.env.FRONTEND_URL ||
        "http://localhost:8000"
      ).replace(/\/$/, "")

      // Build a link to view the ticket thread; include email + secret to prefill
      const supportUrl = `${publicBase}/support/${ticket.case_id}?email=${encodeURIComponent(
        ticket.email
      )}&secret=${encodeURIComponent(secret)}`

      const logoUrl = `${publicBase}/icon.png`

      const html = `
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Support receipt • Case ${ticket.case_id}</title>
          <style>
            body { margin:0; padding:0; background:#f6f7f9; }
            img { border:0; outline:none; text-decoration:none; display:block; }
            a { color:#111; text-decoration:none; }
            .wrapper { width:100%; background:#f6f7f9; padding:24px 0; }
            .container { max-width:640px; margin:0 auto; background:#ffffff; border-radius:16px; box-shadow:0 6px 28px rgba(16,24,40,0.06); overflow:hidden; }
            .header { padding:20px 28px; border-bottom:1px solid #eef0f3; display:flex; align-items:center; gap:12px; }
            .brand { font:600 16px/1.2 -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color:#111; }
            .hero { padding:28px; }
            .h1 { margin:0 0 8px; font:700 22px/1.25 -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color:#111; }
            .p { margin:0 0 14px; font:400 14px/1.6 -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color:#334155; }
            .k { font-weight:600; color:#0f172a; }
            .cta { display:inline-block; margin-top:10px; background:#111; color:#fff; padding:12px 18px; border-radius:10px; font:600 14px/1 -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; }
            .card { margin-top:14px; border:1px solid #eef0f3; border-radius:12px; padding:12px 14px; background:#fafbfc; }
            .muted { color:#64748b; font-size:12px; }
            .footer { padding:20px 28px; background:#fafbfc; border-top:1px solid #eef0f3; }
            @media (prefers-color-scheme: dark) {
              body { background:#0b0c0e; }
              .wrapper { background:#0b0c0e; }
              .container { background:#0f1115; box-shadow:0 6px 28px rgba(0,0,0,0.35); }
              .header { border-color:#1f242b; }
              .brand, .h1 { color:#f8fafc; }
              .p { color:#cbd5e1; }
              .muted { color:#94a3b8; }
              .footer { background:#0f1115; border-color:#1f242b; }
              .card { background:#0b0c0e; border-color:#1f242b; }
            }
          </style>
        </head>
        <body>
          <div class="wrapper">
            <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" style="border-collapse:collapse;">
              <tr>
                <td align="center">
                  <div class="container">
                    <div class="header">
                      <img alt="GhostMark Studio" src="${logoUrl}" width="28" height="28" style="border-radius:6px;" />
                      <div class="brand">GhostMark Studio</div>
                    </div>
                    <div class="hero">
                      <h1 class="h1">We received your request</h1>
                      <p class="p">Thanks for reaching out. Your support ticket has been created and our team will get back to you shortly.</p>
                      <div class="card">
                        <p class="p" style="margin:0 0 6px;">Case ID: <span class="k">${ticket.case_id}</span></p>
                        <p class="p" style="margin:0 0 6px;">Secret code: <span class="k">${secret}</span></p>
                        <p class="p" style="margin:0;">Subject: <span class="k">${ticket.subject}</span></p>
                      </div>
                      <a class="cta" href="${supportUrl}" target="_blank" rel="noopener">View your ticket</a>
                      <p class="p muted" style="margin-top:14px;">Keep your case ID and secret safe. You’ll need them to view and reply to your ticket.</p>
                    </div>
                    <div class="footer">
                      <table role="presentation" width="100%" style="border-collapse:collapse;">
                        <tr>
                          <td style="vertical-align:top;">
                            <p class="muted" style="margin:0;">© ${new Date().getFullYear()} GhostMark Studio</p>
                            <p class="muted" style="margin:4px 0 0;">Made in London</p>
                          </td>
                          <td align="right" style="vertical-align:top;">
                            <a href="${publicBase}" class="muted" style="margin-left:12px;">Website</a>
                          </td>
                        </tr>
                      </table>
                    </div>
                  </div>
                </td>
              </tr>
            </table>
          </div>
        </body>
      </html>`

      const text = `Thanks for contacting GhostMark Studio.

Your case is created.
Case ID: ${ticket.case_id}
Secret: ${secret}
Subject: ${ticket.subject}

View your ticket: ${supportUrl}

Keep your case ID and secret for your records.`

      await sendEmail({
        to: ticket.email,
        subject: `We received your request - Case ${ticket.case_id}`,
        html,
        text,
        tags: [
          { name: "category", value: "support" },
          { name: "event", value: "ticket_created" },
        ],
        headers: {
          "X-Support-Case": String(ticket.case_id),
        },
      })
    } catch {}

    return res.json({ ok: true, caseId: ticket.case_id, secret })
  } catch (e: any) {
    return res.status(500).json({ ok: false, message: e?.message || "Failed to create ticket" })
  }
}
