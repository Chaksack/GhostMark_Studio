import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { sendEmail } from "../../../../services/email-service"
import { html, safeUrl } from "../../../../utils/html"
import { verifyPayload } from "../../../../utils/secure-token"
import { enforceRateLimit, getClientIp, RATE_LIMITS } from "../../../../utils/rate-limit"
import { isValidEmail } from "../../../../utils/validation"
import { NEWSLETTER_CONFIRM_PURPOSE } from "../../../../utils/newsletter"
import { resolveStorefrontBase } from "../../../../utils/public-url"

/**
 * GET /store/newsletter/confirm?token=...
 *
 * Second half of the newsletter double opt-in. The link in the confirmation
 * email points here. Only after this runs does the welcome email go out, and
 * only here is any caller-supplied text (name, interests) ever rendered.
 *
 * -------------------------------------------------------------------------
 * WHY IT IS SAFE TO RENDER CALLER-SUPPLIED TEXT AT THIS POINT
 * -------------------------------------------------------------------------
 * The name and interests were supplied by whoever called /subscribe, who may
 * not own the address. But the welcome email goes ONLY to the address that
 * received the confirmation link, and reaching this handler requires holding a
 * token that was delivered to that address and nowhere else. So the worst an
 * attacker achieves is rendering their own text into an email sent to a
 * mailbox they control - which is to say, phishing themselves.
 *
 * The text is escaped at the sink regardless, via the `html` tagged template.
 * The argument above explains why a failure of escaping would not be
 * catastrophic here; it is not a licence to skip it.
 *
 * -------------------------------------------------------------------------
 * WHY GET IS ACCEPTABLE FOR A STATE-CHANGING LINK
 * -------------------------------------------------------------------------
 * Email links are GET, and corporate link scanners and mail clients prefetch
 * them, which can auto-confirm a subscription. That is worth stating plainly
 * because it usually IS a bug - but it does not break the security property
 * double opt-in exists to provide.
 *
 * That property is: "the welcome email is only ever sent to an address that
 * received the confirmation email." A scanner that prefetches the link is,
 * by definition, running inside the recipient's own mail infrastructure. It
 * can only confirm an address whose mail it already receives. An attacker who
 * does not control the mailbox never sees the token and so can never reach
 * this handler.
 *
 * The cost of a prefetch is therefore an unwanted subscription for a real
 * owner - an annoyance, fixed by unsubscribing - and not a bypass. If that
 * annoyance becomes a problem, the fix is an interstitial page with a POST
 * button, not a change to the token.
 */

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const publicBase = resolveStorefrontBase()

  try {
    const token = String((req.query as any)?.token ?? "").trim()

    /**
     * Rate limit the confirm endpoint too. Without it this is a free oracle
     * for grinding at the HMAC, and an unbounded source of welcome-email
     * sends if a token were ever to leak.
     */
    const allowed = enforceRateLimit(res, [
      { name: "newsletter_confirm_ip", key: getClientIp(req), ...RATE_LIMITS.NEWSLETTER_SUBSCRIBE_IP },
    ])
    if (!allowed) {
      return // 429 already sent
    }

    if (!token) {
      return sendResultPage(res, 400, "Invalid link", "This confirmation link is missing its token.", publicBase)
    }

    const result = verifyPayload<{
      email: string
      name?: string
      interests?: string[]
    }>(token, NEWSLETTER_CONFIRM_PURPOSE)

    if (!result.valid) {
      /**
       * 'expired' is distinguished from every other failure because a real
       * person needs to know to sign up again. Every other reason - bad
       * signature, malformed, wrong purpose - collapses into one generic
       * message: telling a grinder WHICH part of their forgery failed is free
       * feedback for the next attempt.
       */
      if (result.reason === "expired") {
        return sendResultPage(
          res, 400, "Link expired",
          "This confirmation link has expired. Please subscribe again to receive a new one.",
          publicBase
        )
      }
      console.warn("[newsletter] Rejected confirmation token:", result.reason)
      return sendResultPage(
        res, 400, "Invalid link",
        "This confirmation link is not valid. Please subscribe again.",
        publicBase
      )
    }

    const email = String(result.payload.email ?? "").trim().toLowerCase()

    // Re-validate the address even though it is inside a signed payload.
    // The signature proves WE minted it, not that it was correct when we did.
    if (!isValidEmail(email)) {
      return sendResultPage(res, 400, "Invalid link", "This confirmation link is not valid.", publicBase)
    }

    const name = String(result.payload.name ?? "").trim()
    const interests = Array.isArray(result.payload.interests)
      ? result.payload.interests.map((i) => String(i ?? "").trim()).filter(Boolean)
      : []

    /**
     * A fuller implementation persists the confirmed subscriber here. This
     * minimal one does not have a subscribers table, matching the behaviour of
     * the route before this change - it never persisted anything either.
     *
     * NOTE FOR WHOEVER ADDS PERSISTENCE: make the write idempotent on email.
     * This handler is reachable more than once with the same valid token (the
     * token is stateless and stays valid for its full 24 hours), so a naive
     * INSERT will duplicate rows on a double click or a scanner prefetch.
     */

    try {
      await sendEmail({
        to: email,
        subject: "Welcome to GhostMark Studio",
        html: buildWelcomeEmail(name, interests, publicBase),
        text: buildWelcomeText(name, interests),
        tags: [
          { name: "category", value: "newsletter" },
          { name: "event", value: "subscribe_confirmed" },
        ],
        headers: { "X-Newsletter": "welcome" },
      })
    } catch (e: any) {
      console.error("[newsletter] Failed to send welcome email:", e)
      // The confirmation itself succeeded; do not tell the user it failed.
    }

    return sendResultPage(
      res, 200, "You are subscribed",
      "Thanks for confirming. You will hear from GhostMark Studio soon.",
      publicBase
    )
  } catch (e: any) {
    console.error("[newsletter] Confirmation failed:", e)
    return sendResultPage(res, 500, "Something went wrong", "Please try subscribing again.", publicBase)
  }
}

/**
 * Minimal branded result page.
 *
 * Every interpolation goes through the `html` tagged template, and the only
 * values reaching it are the fixed strings passed by this file's own call
 * sites. Neither the token nor anything derived from it is echoed - reflecting
 * an attacker-supplied token into an HTML page is how a confirmation endpoint
 * becomes a reflected-XSS vector.
 */
function sendResultPage(
  res: MedusaResponse,
  status: number,
  heading: string,
  detail: string,
  publicBase: string
) {
  const page = html`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${heading} - GhostMark Studio</title>
    <style>
      :root { color-scheme: light dark; }
      body { margin:0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; background:#f6f7f9; color:#111827; }
      .wrap { max-width:560px; margin:0 auto; padding:48px 24px; }
      .card { background:#fff; border:1px solid #e5e7eb; border-radius:16px; padding:32px; text-align:center; }
      h1 { margin:0 0 12px; font-size:22px; }
      p { margin:0 0 20px; color:#4b5563; line-height:1.6; }
      a.cta { display:inline-block; background:#111; color:#fff; text-decoration:none; padding:12px 20px; border-radius:10px; font-weight:600; }
      @media (prefers-color-scheme: dark) {
        body { background:#0b0c0e; color:#f8fafc; }
        .card { background:#0f1115; border-color:#1f242b; }
        p { color:#cbd5e1; }
        a.cta { background:#f8fafc; color:#0b0c0e; }
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <h1>${heading}</h1>
        <p>${detail}</p>
        <a class="cta" href="${safeUrl(publicBase)}">Visit the store</a>
      </div>
    </div>
  </body>
</html>`.toString()

  res.setHeader("Content-Type", "text/html; charset=utf-8")
  // This page reflects nothing caller-supplied, but the headers are cheap and
  // they bound the damage of any future edit that forgets that.
  res.setHeader("X-Content-Type-Options", "nosniff")
  res.setHeader("Referrer-Policy", "no-referrer")
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
  )
  return res.status(status).send(page)
}

/**
 * Welcome email. Name and interests appear here, escaped at the sink.
 * See the header comment on why rendering them is safe at this stage.
 */
function buildWelcomeEmail(name: string, interests: string[], publicBase: string): string {
  const logoUrl = `${publicBase}/icon.png`
  const interestsList = interests.join(", ")

  return html`
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Welcome to GhostMark Studio</title>
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
                      <h1 class="h1">Thanks for subscribing${name ? ", " + name : ""}</h1>
                      <p class="p">You are now on the list to hear from GhostMark Studio: product drops, workshops, and printing tips straight to your inbox.</p>
                      ${interestsList ? html`<p class="p" style="margin-top:4px;">Your interests: <strong style="color:#0f172a;">${interestsList}</strong></p>` : ""}
                      <a class="cta" href="${safeUrl(publicBase)}" target="_blank" rel="noopener">Visit the store</a>
                      <div class="divider"></div>
                      <p class="p muted">You are receiving this because you confirmed your subscription. You can unsubscribe at any time using the link in our emails.</p>
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

function buildWelcomeText(name: string, interests: string[]): string {
  const interestsList = interests.join(", ")
  return `Thanks for subscribing${name ? ", " + name : ""}.

You are now on the list to hear from GhostMark Studio.${interestsList ? `\n\nYour interests: ${interestsList}` : ""}

You are receiving this because you confirmed your subscription.`
}
