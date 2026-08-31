import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolveBaseUrl } from "../../../services/email-template"
import { html, safeUrl } from "../../../utils/html"

/**
 * Public endpoint for customers to open a support case link from emails.
 *
 * GET /support/:caseId
 *
 * We return a simple branded HTML confirmation page so the link never 404s.
 *
 * -------------------------------------------------------------------------
 * NOTE ON THIS ROUTE'S EXPOSURE
 * -------------------------------------------------------------------------
 * This lives under a custom `/support` prefix, not `/store` or `/admin`.
 * Medusa's ApiLoader only attaches CORS, the publishable-key check and the
 * authenticate middleware to the `/admin`, `/store` and `/auth` namespaces
 * (node_modules/@medusajs/framework/dist/http/router.js:80-97). A custom
 * prefix gets NONE of them, so this handler is completely unauthenticated and
 * reachable by anyone with no key at all. It is intentionally a public landing
 * page, but that means everything it renders is attacker-reachable input.
 *
 * -------------------------------------------------------------------------
 * WHY THE OLD SANITISER WAS REPLACED
 * -------------------------------------------------------------------------
 * This route previously did:
 *
 *   const safeCaseId = caseId.replace(/[<>"']/g, "")
 *
 * and then interpolated `safeCaseId` into the page. That is a BLACKLIST
 * APPLIED AT THE SOURCE, and it was safe only by luck - both reflection sites
 * happened to be HTML text contexts on the day it was written.
 *
 * It is the wrong shape of fix for three reasons:
 *
 *   - It is coupled to today's sinks. Move that same "sanitised" value into a
 *     URL, a JS string, an unquoted attribute or a CSS block and it is unsafe
 *     again, with nothing to warn you.
 *   - It silently mangles legitimate data. A case ID is machine-generated, but
 *     the same pattern gets copied to fields that are not.
 *   - It leaves `&` unescaped, so the output is not even correct HTML.
 *
 * The replacement encodes AT THE SINK: the value is kept verbatim and the
 * `html` tagged template escapes it at the exact point of injection. Every
 * interpolation in the template below is escaped by default, so a future edit
 * that adds another field cannot reintroduce the hole by forgetting a call.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const caseId = String((req.params as any)?.caseId || "").trim()

    /**
     * Length cap. The case ID is only ever reflected as display text, but an
     * unbounded path segment means an unbounded response body, which is a free
     * amplification primitive for whoever is calling.
     */
    const displayCaseId = caseId.slice(0, 64)

    const normalizedBase = resolveBaseUrl()
    const logoUrl = `${normalizedBase}/static/admin/icon.png`

    // No blacklist, no pre-stripping. The `html` template escapes every
    // interpolation where it is injected.
    const page = html`<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Support Case ${displayCaseId} - GhostMark Studio</title>
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
              <img src="${safeUrl(logoUrl)}" alt="GhostMark Studio" />
              <h1>Support Case</h1>
            </div>
            <div class="body">
              <p class="case">Case ID: ${displayCaseId}</p>
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
    </html>`.toString()

    res.setHeader("Content-Type", "text/html; charset=utf-8")

    /**
     * Defence in depth on a page that reflects a path segment.
     *
     * - nosniff stops a client from re-interpreting the response as another
     *   type if the Content-Type is ever wrong.
     * - The CSP allows no scripts at all, so even a total failure of the
     *   escaping above cannot execute one. `style-src 'unsafe-inline'` is
     *   required by the inline <style> block; there is no inline script to
     *   permit, and none should ever be added here.
     * - frame-ancestors 'none' prevents this page being framed for clickjacking.
     * - no-referrer keeps the case ID out of the Referer header on outbound
     *   clicks - the URL itself identifies a support case.
     */
    res.setHeader("X-Content-Type-Options", "nosniff")
    res.setHeader("Referrer-Policy", "no-referrer")
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'none'; img-src 'self' https:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
    )

    return res.status(200).send(page)
  } catch (e) {
    console.error("[support] Failed to render case page:", e)
    return res.status(200).send("Support case opened. Please reply to the email you received.")
  }
}
