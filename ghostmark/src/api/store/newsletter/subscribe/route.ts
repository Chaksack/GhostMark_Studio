import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { sendEmail } from "../../../../services/email-service"

/**
 * POST /store/newsletter/subscribe
 * Body: { email: string, first_name?: string, last_name?: string, interests?: string[], send_welcome?: boolean }
 * Saves a newsletter subscription intent (no DB persistence in this minimal implementation)
 * and optionally sends a welcome/confirmation email using Resend.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    // In Medusa/Express handlers, the parsed body is available on req.body.
    // Using req.json() (Next.js API-style) will throw "req.json is not a function".
    const rawBody = (req as any)?.body
    const body = (typeof rawBody === "string"
      ? (() => { try { return JSON.parse(rawBody) } catch { return {} } })()
      : rawBody || {}) as {
      email?: string
      first_name?: string
      last_name?: string
      interests?: string[]
      send_welcome?: boolean
    }

    const email = (body?.email || "").trim().toLowerCase()
    if (!email) {
      return res.status(400).json({ ok: false, message: "Email is required" })
    }

    const first = (body.first_name || "").trim()
    const last = (body.last_name || "").trim()
    const name = [first, last].filter(Boolean).join(" ")

    // In a fuller solution, you'd persist the subscriber to your database here.
    // For now, we just optionally send a welcome email through Resend.
    const shouldSend = body.send_welcome !== false // default true

    let welcome: any = null
    if (shouldSend) {
      const subject = `Welcome${name ? ", " + name : ""}!`
      const interestsList = (body.interests || []).join(", ")

      // Resolve a public base URL for assets (logo). Fallback to localhost storefront.
      const publicBase = (
        process.env.STOREFRONT_PUBLIC_URL ||
        process.env.NEXT_PUBLIC_STOREFRONT_URL ||
        process.env.NEXT_PUBLIC_SITE_URL ||
        process.env.SITE_URL ||
        process.env.FRONTEND_URL ||
        "http://localhost:8000"
      ).replace(/\/$/, "")
      const logoUrl = `${publicBase}/icon.png`

      const html = `
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Welcome to GhostMark Studio</title>
          <style>
            /* General resets */
            body { margin:0; padding:0; background:#f6f7f9; }
            img { border:0; outline:none; text-decoration:none; display:block; }
            a { color:#111; text-decoration:none; }
            /* Container */
            .wrapper { width:100%; background:#f6f7f9; padding:24px 0; }
            .container { max-width:640px; margin:0 auto; background:#ffffff; border-radius:16px; box-shadow:0 6px 28px rgba(16,24,40,0.06); overflow:hidden; }
            .header { padding:20px 28px; border-bottom:1px solid #eef0f3; display:flex; align-items:center; gap:12px; }
            .brand { font:600 16px/1.2 -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color:#111; }
            .hero { padding:28px; }
            .h1 { margin:0 0 8px; font:700 24px/1.25 -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color:#111; }
            .p { margin:0 0 14px; font:400 14px/1.6 -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color:#334155; }
            .badge { display:inline-block; padding:6px 10px; background:#111; color:#fff; border-radius:999px; font:600 12px/1 -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; letter-spacing:0.2px; }
            .cta { display:inline-block; margin-top:8px; background:#111; color:#fff; padding:12px 18px; border-radius:10px; font:600 14px/1 -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; }
            .divider { height:1px; background:#eef0f3; margin:20px 0; }
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
            }
          </style>
        </head>
        <body>
          <div class="wrapper">
            <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" style="border-collapse:collapse;">
              <tr>
                <td align="center">
                  <div class="container">
                    <!-- Header -->
                    <div class="header">
                      <img alt="GhostMark Studio" src="${logoUrl}" width="28" height="28" style="border-radius:6px;" />
                      <div class="brand">GhostMark Studio</div>
                    </div>

                    <!-- Body -->
                    <div class="hero">
                      <div class="badge">Newsletter</div>
                      <h1 class="h1">Thanks for subscribing${name ? ", " + name : ""} 👋</h1>
                      <p class="p">You’re now on the list to hear from GhostMark Studio — product drops, workshops, and printing tips straight to your inbox.</p>
                      ${interestsList ? `<p class="p" style="margin-top:4px;">Your interests: <strong style="color:#0f172a;">${interestsList}</strong></p>` : ""}
                      <p class="p">As a welcome, here’s a little nudge to start exploring. We’re glad you’re here.</p>
                      <a class="cta" href="${publicBase}" target="_blank" rel="noopener">Visit the store</a>

                      <div class="divider"></div>
                      <p class="p muted">If this wasn’t you, you can ignore this message. You can unsubscribe at any time using the link in our emails.</p>
                    </div>

                    <!-- Footer -->
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
      </html>
      `

      try {
        welcome = await sendEmail({
          to: email,
          subject,
          html,
          text: `Thanks for subscribing${name ? ", " + name : ""}. Interests: ${interestsList || "n/a"}.`,
          tags: [
            { name: "category", value: "newsletter" },
            { name: "event", value: "subscribe" },
          ],
          headers: {
            "X-Newsletter": "subscribe",
          },
        })
      } catch (e: any) {
        // If sending welcome fails, we still return ok with a warning
        return res.status(200).json({ ok: true, subscribed: true, warning: e?.message || "Failed to send welcome email" })
      }
    }

    return res.json({ ok: true, subscribed: true, welcome })
  } catch (e: any) {
    const message = e?.message || "Failed to subscribe"
    return res.status(500).json({ ok: false, message })
  }
}
