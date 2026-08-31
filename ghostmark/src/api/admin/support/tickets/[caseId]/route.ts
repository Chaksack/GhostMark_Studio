import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getTicketByCaseId, updateTicketStatus, toPublicTicket } from "../../../../../services/support-db"
import { sendEmail } from "../../../../../services/email-service"
import { renderEmailLayout, resolveBaseUrl } from "../../../../../services/email-template"
import { escapeHtml, escapeHtmlAttr, escapeHtmlMultiline } from "../../../../../utils/html"

/**
 * GET /admin/support/tickets/:caseId
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const caseId = (req.params as any).caseId as string
    const data = await getTicketByCaseId(caseId)
    if (!data) return res.status(404).json({ ok: false, message: "Ticket not found" })
    /**
     * toPublicTicket, not the raw row. getTicketByCaseId returns the internal
     * SupportTicket, which carries secret_hash and the legacy plaintext
     * secret_code. Neither has any business in an HTTP response, and the admin
     * dashboard does not read them (verified: no reference to `secret` in
     * src/admin/routes/support/**).
     */
    return res.json({ ok: true, ticket: toPublicTicket(data.ticket), messages: data.messages })
  } catch (e: any) {
    console.error("[support] Failed to get ticket:", e)
    return res.status(500).json({ ok: false, message: "Failed to get ticket" })
  }
}

/**
 * PATCH /admin/support/tickets/:caseId
 * Body: { status: 'open' | 'closed' }
 * Updates the ticket status and returns updated ticket.
 */
export async function PATCH(req: MedusaRequest, res: MedusaResponse) {
  try {
    const caseId = String((req.params as any).caseId || "").trim()
    // MedusaRequest: use req.body; fallback to req.json if available
    const body = ((req as any).body ?? (typeof (req as any).json === 'function' ? await (req as any).json() : undefined)) as {
      status?: 'open' | 'closed' | string
    }
    const status = (body?.status || '').toString().trim().toLowerCase() as 'open' | 'closed'
    if (!caseId || !status) {
      return res.status(400).json({ ok: false, message: "caseId and status are required" })
    }
    if (status !== 'open' && status !== 'closed') {
      return res.status(400).json({ ok: false, message: "Invalid status. Use 'open' or 'closed'" })
    }
    // Capture state before update to detect transition
    const before = await getTicketByCaseId(caseId)

    const updated = await updateTicketStatus(caseId, status)
    if (!updated) return res.status(404).json({ ok: false, message: "Ticket not found" })

    // If transitioning to closed, email transcript to customer
    try {
      if (before?.ticket && before.ticket.status !== 'closed' && status === 'closed') {
        const transcriptHtml = buildTranscriptHtml(before.messages || [])

        const normalizedBase = resolveBaseUrl()
        const caseUrl = `${normalizedBase}/support/${encodeURIComponent(caseId)}`

        const html = renderEmailLayout({
          title: `Case ${escapeHtml(caseId)} closed`,
          subtitle: "We’ve included the full conversation transcript",
          bodyHtml: `
            <p style="margin:0 0 12px;color:#374151;">Your GhostMark Studio support case <strong style=\"color:#000\">${escapeHtml(
              caseId
            )}</strong> has been closed.</p>
            <p style="margin:0 0 16px;color:#4b5563;">Transcript:</p>
            ${transcriptHtml}
            <p style="margin:16px 0 0;color:#4b5563;">View your case page:</p>
            <p style="margin:0 0 16px;"><a href="${escapeHtmlAttr(caseUrl)}" style="color:#000;text-decoration:underline;">${escapeHtml(
              caseUrl
            )}</a></p>
          `,
          cta: { label: "Open your case", href: caseUrl },
        })

        await sendEmail({
          to: before.ticket.email,
          subject: `Case ${caseId} closed: transcript inside`,
          html,
        })
      }
    } catch (err) {
      // Soft-fail: logging only
      // eslint-disable-next-line no-console
      console.error("[support] Failed to send closure transcript: ", err)
    }
    return res.json({ ok: true, ticket: updated })
  } catch (e: any) {
    return res.status(500).json({ ok: false, message: e?.message || "Failed to update ticket" })
  }
}

function buildTranscriptHtml(messages: Array<{ sender: 'customer'|'admin'; message: string; created_at: string }>): string {
  if (!Array.isArray(messages) || messages.length === 0) {
    return `<div style="border:2px solid #000;border-radius:8px;padding:12px;background:#fff;color:#6b7280;">No messages in this conversation.</div>`
  }
  return messages
    .map((m) => {
      const when = m.created_at ? new Date(m.created_at).toLocaleString() : ''
      const who = m.sender === 'admin' ? 'GhostMark Support' : 'You'
      return `
        <div style="border:2px solid #000;border-radius:8px;padding:12px 14px;background:#fff;margin:0 0 12px;">
          <div style="font-size:12px;color:#374151;margin:0 0 6px;">${escapeHtml(who)} • ${escapeHtml(when)}</div>
          <div style="color:#111827;white-space:pre-wrap;line-height:1.6;">${escapeHtmlMultiline(
            m.message
          )}</div>
        </div>
      `
    })
    .join("")
}

/*
 * The three local escapers that used to live here (escapeHtml, escapeAttr,
 * escapeInlinePreserveNewlines) have been retired in favour of the shared,
 * unit-tested implementations in src/utils/html.ts.
 *
 * They were correct, but they were one of several copies scattered across the
 * API routes, and duplicated escapers drift: this copy did not escape the
 * backtick, another route had no escaper at all. One implementation, one place
 * to fix, one place to test.
 */
