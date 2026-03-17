import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolveBaseUrl } from "../../../services/email-template"

/**
 * Public endpoint for customers to open a support case link from emails.
 *
 * GET /support/:caseId
 *
 * We return a simple branded HTML confirmation page so the link never 404s.
 * In the future, this can be extended into a full customer portal.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const caseId = String((req.params as any)?.caseId || "").trim()

    const normalizedBase = resolveBaseUrl()
    const logoUrl = `${normalizedBase}/static/admin/icon.png`

    const safeCaseId = caseId.replace(/[<>"']/g, "")

    const html = `<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Support Case ${safeCaseId} • GhostMark Studio</title>
        <style>
          :root { color-scheme: light dark; }
          body { margin:0; font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; background:#f5f5f5; color:#111827; }
          .wrap { max-width: 720px; margin: 0 auto; padding: 24px; }
          .card { background:#ffffff; border:1px solid #e5e7eb; border-radius:12px; overflow:hidden; }
          .header { background:#000; padding:24px; text-align:center; }
          .header img { width:72px; height:72px; display:block; margin:0 auto 12px; border-radius:8px; }
          .header h1 { color:#fff; margin:0; font-size:22px; }
          .body { padding:24px; }
          .case { font-size:14px; color:#111; font-weight:700; }
          .muted { color:#6b7280; }
          .cta { display:inline-block; background:#000; color:#fff; text-decoration:none; padding:12px 18px; border-radius:8px; font-weight:600; }
          .box { border:2px solid #000; border-radius:8px; padding:14px; background:#fff; }
          a { color:#000; }
        </style>
      </head>
      <body>
        <div class="wrap">
          <div class="card">
            <div class="header">
              <img src="${logoUrl}" alt="GhostMark Studio" />
              <h1>Support Case</h1>
            </div>
            <div class="body">
              <p class="case">Case ID: ${safeCaseId}</p>
              <p class="muted">Thanks for contacting GhostMark Studio. Your case is open and our team will get back to you shortly.</p>
              <div style="height:12px"></div>
              <div class="box">
                <p style="margin:0 0 8px">How to reply or add more details:</p>
                <ul style="margin:0; padding-left:18px; color:#111">
                  <li>Reply directly to the email you received about this case, or</li>
                  <li>Email us at <a href="mailto:info@ghostmarkstudio.com">info@ghostmarkstudio.com</a> and include your Case ID.</li>
                </ul>
              </div>
              <div style="height:16px"></div>
              <p class="muted">You can safely keep this page for your records.</p>
            </div>
          </div>
        </div>
      </body>
    </html>`

    res.setHeader("Content-Type", "text/html; charset=utf-8")
    return res.status(200).send(html)
  } catch (e) {
    return res.status(200).send("Support case opened. Please reply to the email you received.")
  }
}
