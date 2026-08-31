import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { verifyTicketAccess } from "../../../../../services/support-db"
import { enforceRateLimit, getClientIp, RATE_LIMITS } from "../../../../../utils/rate-limit"

/**
 * GET /store/support/tickets/:caseId?email=...&secret=...
 * Returns ticket and messages if email+secret match.
 *
 * This is an unauthenticated credential-checking endpoint, so it is the
 * natural place to brute-force a case secret. Three things guard it:
 *
 *   1. The secret is now 30^16 (~2^78) of CSPRNG output rather than ~41 bits
 *      of Math.random - see support-db.ts.
 *   2. Comparison is constant-time and centralised in verifyTicketAccess(),
 *      replacing the `!==` string compare that leaked a matching prefix
 *      through response timing.
 *   3. Per-IP and per-case rate limits, below.
 *
 * NOTE ON THE SECRET IN THE QUERY STRING: accepting it here is retained for
 * compatibility, but query strings land in access logs, proxy logs and browser
 * history. The emailed link now carries the credentials in the URL FRAGMENT so
 * they never reach a server log by default; a future revision should move this
 * to a POST body or an Authorization header and drop the query form.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const { params, query } = req
    const caseId = String((params as any).caseId || "").trim()
    const email = ((query as any).email as string | undefined)?.toString().trim()
    const secret = ((query as any).secret as string | undefined)?.toString().trim()

    if (!caseId || !email || !secret) {
      return res.status(400).json({ ok: false, message: "caseId, email and secret are required" })
    }

    // Rate limit before touching the database, so a flood costs us nothing.
    const allowed = enforceRateLimit(res, [
      { name: "support_read_ip", key: getClientIp(req), ...RATE_LIMITS.SUPPORT_TICKET_READ_IP },
      { name: "support_read_case", key: caseId.toLowerCase(), ...RATE_LIMITS.SUPPORT_TICKET_READ_CASE },
    ])
    if (!allowed) {
      return // 429 already sent
    }

    const access = await verifyTicketAccess(caseId, email, secret)

    if (!access.ok) {
      /**
       * UNIFORM RESPONSE for 'not_found' and 'invalid'.
       *
       * The previous code returned 404 for an unknown case and 403 for a bad
       * secret. That difference is an enumeration oracle: an attacker learns
       * which case IDs exist without ever holding a valid secret, which turns
       * "guess a case ID" and "guess its secret" from one hard problem into
       * two easier sequential ones.
       *
       * 'expired' IS distinguished. It reveals nothing an attacker can use
       * (they already had to present the correct email and secret to get it),
       * and a legitimate customer needs to know their link aged out rather
       * than being told their correct credentials are wrong.
       */
      if (access.reason === 'expired') {
        return res.status(403).json({
          ok: false,
          code: "expired",
          message: "This support link has expired. Please contact us to reopen your case.",
        })
      }
      return res.status(404).json({ ok: false, message: "Ticket not found or credentials invalid" })
    }

    return res.json({
      ok: true,
      ticket: {
        caseId: access.ticket.case_id,
        subject: access.ticket.subject,
        status: access.ticket.status,
        created_at: access.ticket.created_at,
      },
      messages: access.messages,
    })
  } catch (e: any) {
    // Never reflect the internal error text to an unauthenticated caller.
    console.error("[support] Failed to get ticket:", e)
    return res.status(500).json({ ok: false, message: "Failed to get ticket" })
  }
}
