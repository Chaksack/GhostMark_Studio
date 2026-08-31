import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createTicket } from "../../../../services/support-db"
import { sendEmail } from "../../../../services/email-service"
import { html, safeUrl } from "../../../../utils/html"
import { enforceRateLimit, getClientIp, RATE_LIMITS } from "../../../../utils/rate-limit"
import { isValidEmail, normalizeEmail, clampText } from "../../../../utils/validation"
import { resolveStorefrontBase } from "../../../../utils/public-url"

/**
 * POST /store/support/tickets
 * Body: { email?: string, subject: string, message: string }
 * Returns: { ok: true, caseId: string }
 *
 * -------------------------------------------------------------------------
 * THREAT MODEL FOR THIS ROUTE
 * -------------------------------------------------------------------------
 * This endpoint is reachable by anyone. It is a /store route, and Medusa
 * v2.11.3 registers /store with
 * `authenticate("customer", ["bearer","session"], { allowUnauthenticated: true })`
 * (node_modules/@medusajs/framework/dist/http/router.js:93-95). The only other
 * gate is the publishable API key middleware, and a publishable key ships
 * inside storefront JavaScript - it is a routing identifier, not a secret.
 *
 * The endpoint also sends email from our verified Resend domain. That
 * combination - unauthenticated, free, branded outbound email - is a phishing
 * cannon unless all three of the following hold. Each is implemented below:
 *
 *   1. CONTENT. Nothing the caller supplies is echoed into the email we send
 *      to the customer. See buildAcknowledgementEmail().
 *   2. ENCODING. Everything interpolated into HTML is escaped at the point of
 *      injection, via the `html` tagged template.
 *   3. VOLUME. Per-IP and per-recipient rate limits, applied before any work.
 */

/** Bounds on stored/echoed free text. See validation.ts on why these matter. */
const MAX_SUBJECT_LENGTH = 200
const MAX_MESSAGE_LENGTH = 5000

/**
 * Resolve the email address of the authenticated customer, if there is one.
 *
 * Returns null for guests. Never throws - a failure to resolve must degrade to
 * "treat as guest", not 500 the request.
 */
async function resolveAuthenticatedCustomerEmail(
  req: AuthenticatedMedusaRequest
): Promise<string | null> {
  const actorId = req.auth_context?.actor_id
  if (!actorId || req.auth_context?.actor_type !== "customer") {
    return null
  }
  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as any
    const { data } = await query.graph({
      entity: "customer",
      fields: ["id", "email"],
      filters: { id: actorId },
    })
    const email = data?.[0]?.email
    return email ? normalizeEmail(email) : null
  } catch {
    return null
  }
}

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  try {
    // MedusaRequest already parses JSON into req.body; req.json() is not available
    const body = ((req as any).body ?? (typeof (req as any).json === 'function' ? await (req as any).json() : undefined)) as {
      email?: string
      subject?: string
      message?: string
    }

    const subject = clampText(String(body?.subject ?? "").trim(), MAX_SUBJECT_LENGTH)
    const message = clampText(String(body?.message ?? "").trim(), MAX_MESSAGE_LENGTH)

    /**
     * RECIPIENT RESOLUTION - the most important few lines in this file.
     *
     * If the caller is an authenticated customer we use the address on their
     * account and IGNORE body.email entirely. A logged-in customer cannot use
     * this endpoint to send mail to a third party, no matter what they post.
     *
     * A guest necessarily supplies their own address - that is what a contact
     * form is. The residual risk is contained by (a) sending that address
     * nothing but server-generated content, so the mail carries no attacker
     * message, and (b) the per-recipient rate limit below, so it cannot be
     * used to flood a victim.
     */
    const authenticatedEmail = await resolveAuthenticatedCustomerEmail(req)
    const isAuthenticated = Boolean(authenticatedEmail)
    const email = authenticatedEmail ?? normalizeEmail(body?.email)

    if (!email || !subject || !message) {
      return res.status(400).json({ ok: false, message: "email, subject and message are required" })
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ ok: false, message: "A valid email address is required" })
    }

    /**
     * Rate limit BEFORE creating the ticket or sending anything. Both buckets
     * must pass; see rate-limit.ts on why the per-recipient bucket is the one
     * that actually holds under a spoofed source IP.
     *
     * Authenticated customers are limited too. A compromised or throwaway
     * account is still an account.
     */
    const ip = getClientIp(req)
    const allowed = enforceRateLimit(res, [
      { name: "support_create_ip", key: ip, ...RATE_LIMITS.SUPPORT_TICKET_CREATE_IP },
      { name: "support_create_rcpt", key: email, ...RATE_LIMITS.SUPPORT_TICKET_CREATE_RECIPIENT },
      { name: "support_create_rcpt_day", key: email, ...RATE_LIMITS.SUPPORT_TICKET_CREATE_RECIPIENT_DAILY },
    ])
    if (!allowed) {
      return // 429 already sent
    }

    const { ticket, secret } = await createTicket({ email, subject, message })

    // ---- Notify the admin -------------------------------------------------
    // Recipient is a server-side constant, so this one may safely contain the
    // customer's text - the admin needs to read it. It is still ESCAPED,
    // because the admin's mail client renders HTML and a support ticket is
    // exactly where someone would try to plant a link aimed at staff.
    const adminEmail = process.env.SUPPORT_ADMIN_EMAIL || process.env.SMTP_FROM_EMAIL
    if (adminEmail) {
      try {
        await sendEmail({
          to: adminEmail,
          subject: `[Support] New ticket ${ticket.case_id}`,
          /**
           * `html` is passed explicitly and deliberately. email-service.ts, when
           * given only `text`, interpolates that text into an HTML body with a
           * bare `.replace(/\n/g,'<br/>')` and no escaping - so a text-only send
           * is itself an HTML injection sink. Supplying pre-escaped HTML here
           * bypasses that path entirely.
           */
          html: html`
            <p><strong>New support ticket</strong></p>
            <p>Case ID: ${ticket.case_id}<br/>
               From: ${ticket.email}<br/>
               Authenticated: ${isAuthenticated ? "yes" : "no (guest)"}<br/>
               Source IP: ${ip}</p>
            <p>Subject: ${subject}</p>
            <p>Message:</p>
            <pre style="white-space:pre-wrap;font-family:inherit;">${message}</pre>
          `.toString(),
          text: `New support ticket\nCase ID: ${ticket.case_id}\nFrom: ${ticket.email}\nAuthenticated: ${isAuthenticated ? "yes" : "no (guest)"}\nSubject: ${subject}\n\nMessage:\n${message}`,
        })
      } catch {}
    }

    // ---- Acknowledge the customer ----------------------------------------
    try {
      await sendEmail({
        to: ticket.email,
        subject: `We received your request - Case ${ticket.case_id}`,
        html: buildAcknowledgementEmail(ticket.case_id, secret, ticket.email),
        text: buildAcknowledgementText(ticket.case_id, secret, ticket.email),
        tags: [
          { name: "category", value: "support" },
          { name: "event", value: "ticket_created" },
        ],
        headers: {
          "X-Support-Case": String(ticket.case_id),
        },
      })
    } catch {}

    /**
     * RESPONSE.
     *
     * The secret is NOT returned. Previously both caseId and secret came back
     * in this response body, which meant:
     *
     *   - the secret was delivered to whoever made the REQUEST rather than to
     *     whoever controls the mailbox, so it proved nothing about ownership;
     *   - the endpoint was an unlimited, unauthenticated oracle for the
     *     process-wide Math.random stream that minted it (see support-db.ts).
     *
     * The second problem is gone now that secrets come from a CSPRNG, but the
     * first is a design flaw independent of the generator. The secret reaches
     * the customer by email, which is precisely what makes it evidence that
     * they own the address.
     *
     * The case ID is safe to return: it is CSPRNG-derived and useless without
     * the secret.
     */
    return res.json({ ok: true, caseId: ticket.case_id })
  } catch (e: any) {
    /**
     * Do not reflect the internal error message. It can carry driver text,
     * SQL fragments or connection details. Log it server-side instead.
     */
    console.error("[support] Failed to create ticket:", e)
    return res.status(500).json({ ok: false, message: "Failed to create ticket" })
  }
}

/**
 * Build the customer acknowledgement email.
 *
 * EVERY VALUE INTERPOLATED HERE IS SERVER-GENERATED. The caller's subject and
 * message are deliberately NOT echoed back, which is a stronger guarantee than
 * escaping alone can give:
 *
 *   Escaping stops markup injection - the attacker cannot get an <a href> into
 *   the mail. It does NOT stop the text itself from being a lure, because mail
 *   clients autolink bare URLs in plain text. `Account suspended, verify at
 *   https://evil.test` survives escaping intact and renders as a live link in
 *   most clients.
 *
 * Since the recipient of this mail may be an address the caller does not own,
 * the only safe amount of caller-controlled prose in it is none. The subject
 * is dropped from the acknowledgement; the customer just typed it, and it is
 * still delivered in full to the admin and stored on the ticket.
 *
 * The `html` template escapes interpolations anyway - defence in depth, and it
 * keeps the file correct if someone later adds a field here.
 */
function buildAcknowledgementEmail(caseId: string, secret: string, email: string): string {
  const publicBase = resolveStorefrontBase()
  const logoUrl = `${publicBase}/icon.png`

  /**
   * The credentials go in the URL FRAGMENT, not the query string.
   *
   * A fragment is never sent to a server, never appears in access logs, and
   * never leaks through the Referer header to third-party resources on the
   * landing page. A `?secret=` would be written into the storefront's logs and
   * into any analytics or CDN in front of it.
   *
   * The storefront page reads the fragment client-side and presents the secret
   * to the API. No consumer exists yet, so this sets the contract before one
   * is built rather than after.
   */
  const supportUrl = `${publicBase}/support/${encodeURIComponent(caseId)}#email=${encodeURIComponent(email)}&secret=${encodeURIComponent(secret)}`

  return html`
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Support receipt - Case ${caseId}</title>
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
                      <img alt="GhostMark Studio" src="${safeUrl(logoUrl)}" width="28" height="28" style="border-radius:6px;" />
                      <div class="brand">GhostMark Studio</div>
                    </div>
                    <div class="hero">
                      <h1 class="h1">We received your request</h1>
                      <p class="p">Thanks for reaching out. Your support ticket has been created and our team will get back to you shortly.</p>
                      <div class="card">
                        <p class="p" style="margin:0 0 6px;">Case ID: <span class="k">${caseId}</span></p>
                        <p class="p" style="margin:0;">Secret code: <span class="k">${secret}</span></p>
                      </div>
                      <a class="cta" href="${safeUrl(supportUrl)}" target="_blank" rel="noopener">View your ticket</a>
                      <p class="p muted" style="margin-top:14px;">Keep your case ID and secret safe. You will need them to view and reply to your ticket. This link expires in 30 days.</p>
                      <p class="p muted" style="margin-top:6px;">If you did not contact GhostMark Studio, you can ignore this email. No account was changed.</p>
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

function buildAcknowledgementText(caseId: string, secret: string, email: string): string {
  const publicBase = resolveStorefrontBase()
  const supportUrl = `${publicBase}/support/${encodeURIComponent(caseId)}#email=${encodeURIComponent(email)}&secret=${encodeURIComponent(secret)}`
  return `Thanks for contacting GhostMark Studio.

Your case is created.
Case ID: ${caseId}
Secret: ${secret}

View your ticket: ${supportUrl}

Keep your case ID and secret for your records. This link expires in 30 days.
If you did not contact GhostMark Studio, you can ignore this email.`
}
