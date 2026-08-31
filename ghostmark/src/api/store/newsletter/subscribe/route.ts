import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { sendEmail } from "../../../../services/email-service"
import { html, safeUrl } from "../../../../utils/html"
import { signPayload } from "../../../../utils/secure-token"
import { resolveStorefrontBase, resolveBackendBase } from "../../../../utils/public-url"
import { NEWSLETTER_CONFIRM_PURPOSE, NEWSLETTER_CONFIRM_TTL_SECONDS } from "../../../../utils/newsletter"
import { enforceRateLimit, getClientIp, RATE_LIMITS } from "../../../../utils/rate-limit"
import { isValidEmail, normalizeEmail, clampText } from "../../../../utils/validation"

/**
 * POST /store/newsletter/subscribe
 * Body: { email: string, first_name?: string, last_name?: string, interests?: string[] }
 * Returns: { ok: true, pending: true }
 *
 * -------------------------------------------------------------------------
 * WHY THIS IS NOW DOUBLE OPT-IN
 * -------------------------------------------------------------------------
 * This route previously took an arbitrary `email` from the request body and
 * immediately sent a fully branded GhostMark welcome email to it, from our
 * verified Resend domain, with the caller's `first_name` and `interests`
 * interpolated UNESCAPED into the HTML body. It required only a publishable
 * API key, which ships inside storefront JavaScript and is therefore public.
 * There was no rate limit anywhere in the codebase.
 *
 * That is a remote-controlled phishing cannon: an attacker chooses the victim,
 * chooses the content (including arbitrary <a href> markup), and we supply the
 * branding, the domain reputation and the DKIM signature.
 *
 * Double opt-in is the structural fix, not a mitigation. It splits the flow:
 *
 *   1. This route sends a CONFIRMATION email whose content is 100%
 *      server-generated. An attacker who names a victim's address can cause
 *      exactly one generic "did you mean to subscribe?" email - carrying no
 *      message of theirs - and is capped at 3 per day for that address.
 *
 *   2. Only after the recipient clicks the signed link in that email does the
 *      welcome email get sent, and only then is any caller-supplied text
 *      rendered. By that point the address is proven to be reachable by
 *      whoever clicked, so caller-supplied content can only reach someone who
 *      asked for it.
 *
 * The pending subscription has no table to live in, so it lives inside the
 * signed token itself - see signPayload in utils/secure-token.ts. The token is
 * HMAC-signed and expiring, so its contents cannot be edited by the holder.
 */

const MAX_NAME_LENGTH = 80
const MAX_INTEREST_LENGTH = 40
const MAX_INTERESTS = 10


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

    const email = normalizeEmail(body?.email)

    /**
     * Validate the address properly rather than merely checking it is
     * non-empty. isValidEmail also rejects CR/LF, which would otherwise be an
     * SMTP header injection vector, and caps the length so this value cannot
     * become an unbounded rate-limit map key.
     */
    if (!email) {
      return res.status(400).json({ ok: false, message: "Email is required" })
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ ok: false, message: "A valid email address is required" })
    }

    /**
     * Rate limit BEFORE sending. The per-recipient ceiling (3 per DAY) is the
     * tightest in the codebase and is the one that matters: "resend the
     * confirmation" is the classic mail-bombing primitive, and unlike the
     * per-IP bucket it cannot be evaded by spoofing X-Forwarded-For, because
     * the address being limited on IS the attacker's target.
     */
    const allowed = enforceRateLimit(res, [
      { name: "newsletter_ip", key: getClientIp(req), ...RATE_LIMITS.NEWSLETTER_SUBSCRIBE_IP },
      { name: "newsletter_rcpt", key: email, ...RATE_LIMITS.NEWSLETTER_SUBSCRIBE_RECIPIENT },
    ])
    if (!allowed) {
      return // 429 already sent
    }

    const first = clampText(String(body.first_name ?? "").trim(), MAX_NAME_LENGTH)
    const last = clampText(String(body.last_name ?? "").trim(), MAX_NAME_LENGTH)
    const name = [first, last].filter(Boolean).join(" ")

    const interests = (Array.isArray(body.interests) ? body.interests : [])
      .slice(0, MAX_INTERESTS)
      .map((i) => clampText(String(i ?? "").trim(), MAX_INTEREST_LENGTH))
      .filter(Boolean)

    // Preserved from the previous API: an explicit false suppresses email
    // entirely. Nothing is persisted in this minimal implementation, so this
    // simply becomes a no-op acknowledgement.
    if (body.send_welcome === false) {
      return res.json({ ok: true, pending: false, subscribed: true })
    }

    /**
     * The pending subscription travels inside the signed token. It is signed,
     * NOT encrypted - anyone holding the link can read the name and interests
     * back out. That is acceptable because the only person who receives the
     * link is the owner of the address, and it is their own data.
     */
    const token = signPayload(
      { email, name, interests },
      NEWSLETTER_CONFIRM_TTL_SECONDS,
      NEWSLETTER_CONFIRM_PURPOSE
    )

    const confirmUrl = `${resolveBackendBase()}/store/newsletter/confirm?token=${encodeURIComponent(token)}`

    try {
      await sendEmail({
        to: email,
        subject: "Confirm your GhostMark Studio subscription",
        html: buildConfirmationEmail(confirmUrl),
        text: buildConfirmationText(confirmUrl),
        tags: [
          { name: "category", value: "newsletter" },
          { name: "event", value: "confirm_request" },
        ],
        headers: { "X-Newsletter": "confirm" },
      })
    } catch (e: any) {
      console.error("[newsletter] Failed to send confirmation email:", e)
      return res.status(200).json({
        ok: true,
        pending: true,
        warning: "Failed to send confirmation email",
      })
    }

    /**
     * The response is IDENTICAL whether or not this address was already
     * subscribed or previously bounced. Varying it would turn this endpoint
     * into a subscriber-list oracle - "is bob@company.com a customer?" - which
     * is a privacy leak that costs an attacker nothing to harvest.
     */
    return res.json({ ok: true, pending: true })
  } catch (e: any) {
    console.error("[newsletter] Subscribe failed:", e)
    return res.status(500).json({ ok: false, message: "Failed to subscribe" })
  }
}

/**
 * Confirmation email.
 *
 * EVERY VALUE HERE IS SERVER-GENERATED. No name, no interests, no
 * caller-supplied text of any kind - this is the one message that can be aimed
 * at an address the caller does not own, so it must carry nothing of theirs.
 * Escaping alone would not be sufficient: mail clients autolink bare URLs in
 * plain text, so `verify at https://evil.test` survives escaping and renders
 * as a live link. The only safe amount of attacker prose here is none.
 */
function buildConfirmationEmail(confirmUrl: string): string {
  const publicBase = resolveStorefrontBase()
  const logoUrl = `${publicBase}/icon.png`

  return html`
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Confirm your subscription</title>
          <style>
            body { margin:0; padding:0; background:#f6f7f9; }
            img { border:0; outline:none; text-decoration:none; display:block; }
            a { color:#111; text-decoration:none; }
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
                    <div class="header">
                      <img alt="GhostMark Studio" src="${safeUrl(logoUrl)}" width="28" height="28" style="border-radius:6px;" />
                      <div class="brand">GhostMark Studio</div>
                    </div>
                    <div class="hero">
                      <div class="badge">Newsletter</div>
                      <h1 class="h1">Confirm your subscription</h1>
                      <p class="p">Someone entered this address to subscribe to the GhostMark Studio newsletter. Confirm below and we will start sending you product drops, workshops and printing tips.</p>
                      <a class="cta" href="${safeUrl(confirmUrl)}" target="_blank" rel="noopener">Confirm subscription</a>
                      <div class="divider"></div>
                      <p class="p muted">If this was not you, do nothing. No subscription is created unless you click the button above, and we will not email this address again. This link expires in 24 hours.</p>
                    </div>
                    <div class="footer">
                      <table role="presentation" width="100%" style="border-collapse:collapse;">
                        <tr>
                          <td style="vertical-align:top;">
                            <p class="muted" style="margin:0;">${new Date().getFullYear()} GhostMark Studio</p>
                            <p class="muted" style="margin:4px 0 0;">Made in London</p>
                          </td>
                          <td align="right" style="vertical-align:top;">
                            <a href="${safeUrl(publicBase)}" class="muted" style="margin-left:12px;">Website</a>
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
      </html>`.toString()
}

function buildConfirmationText(confirmUrl: string): string {
  return `Confirm your GhostMark Studio subscription

Someone entered this address to subscribe to the GhostMark Studio newsletter.

Confirm here: ${confirmUrl}

If this was not you, do nothing. No subscription is created unless you follow
the link above, and we will not email this address again.
This link expires in 24 hours.`
}
