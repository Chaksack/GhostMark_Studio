import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { addMessage, getTicketByCaseId } from "../../../../../../services/support-db"
import { sendEmail } from "../../../../../../services/email-service"
import { renderEmailLayout } from "../../../../../../services/email-template"

/**
 * POST /admin/support/tickets/:caseId/messages
 * Body: { message: string }
 * Adds an admin reply and emails the customer.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const caseId = (req.params as any).caseId as string
    // Use req.body for MedusaRequest compatibility; fallback to req.json() if present
    const body = ((req as any).body ?? (typeof (req as any).json === 'function' ? await (req as any).json() : undefined)) as {
      message?: string
    }
    if (!caseId || !body?.message) {
      return res.status(400).json({ ok: false, message: "caseId and message are required" })
    }
    const data = await getTicketByCaseId(caseId)
    if (!data) return res.status(404).json({ ok: false, message: "Ticket not found" })

    await addMessage(caseId, 'admin', body.message)

    // Notify customer with a quick link/CTA to open their case
    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_BASE_URL ||
        process.env.STORE_URL ||
        process.env.EMAIL_PUBLIC_BASE_URL ||
        process.env.ADMIN_PUBLIC_URL ||
        process.env.BACKEND_URL ||
        process.env.MEDUSA_ADMIN_URL ||
        process.env.MEDUSA_BACKEND_URL ||
        "http://localhost:9000"

      const normalizedBase = String(baseUrl).replace(/\/$/, "")
      const caseUrl = `${normalizedBase}/support/${encodeURIComponent(caseId)}`

      const bodyHtml = `
        <p style="margin:0 0 12px;">Hello,</p>
        <p style="margin:0 0 16px;">We replied to your case <strong>${caseId}</strong>:</p>
        <div style="border:2px solid #000;border-radius:8px;padding:12px 14px;background:#fff;margin:0 0 16px;">
          <p style="margin:0;white-space:pre-wrap;color:#111827;">${escapeHtmlInline(
            body.message
          ).replace(/\n/g, "<br/>")}</p>
        </div>
        <p style="margin:0 0 12px;color:#4b5563;">You can open and reply to your case using the link below:</p>
        <p style="margin:0 0 16px;"><a href="${caseUrl}" style="color:#000;text-decoration:underline;">${caseUrl}</a></p>
      `

      const html = renderEmailLayout({
        title: `Update on your case ${caseId}`,
        bodyHtml,
        cta: { label: "Open your case", href: caseUrl },
      })

      await sendEmail({
        to: data.ticket.email,
        subject: `Update on your case ${caseId}`,
        html,
      })
    } catch {}

    return res.json({ ok: true })
  } catch (e: any) {
    return res.status(500).json({ ok: false, message: e?.message || "Failed to add message" })
  }
}

// Minimal inline HTML escaper for message content
function escapeHtmlInline(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
