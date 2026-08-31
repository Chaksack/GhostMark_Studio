import { Resend } from 'resend'
import { renderEmailLayout, htmlToText } from './email-template'
import { escapeHtmlMultiline } from '../utils/html'

/**
 * Email service using Resend API.
 *
 * Required env vars (defined in ghostmark/.env):
 * - RESEND_API_KEY
 * - RESEND_FROM_EMAIL (optional, defaults to 'onboarding@resend.dev')
 */
export type SendEmailParams = {
  to: string | string[]
  subject: string
  text?: string
  html?: string
  from?: string
  cc?: string | string[]
  bcc?: string | string[]
  replyTo?: string
  attachments?: Array<{
    filename: string
    path?: string
    content?: Buffer
    contentType?: string
  }>
  tags?: Array<{
    name: string
    value: string
  }>
  headers?: Record<string, string>
}

let cachedResend: Resend | null = null

function getResend(): Resend {
  if (cachedResend) return cachedResend

  const apiKey = process.env.RESEND_API_KEY?.replace(/^"|"$/g, "")

  if (!apiKey) {
    throw new Error(
      "Missing Resend API key. Please set RESEND_API_KEY in environment."
    )
  }

  cachedResend = new Resend(apiKey)
  return cachedResend
}

export async function sendEmail(params: SendEmailParams) {
  const { to, subject } = params
  let { text, html } = params
  const { cc, bcc, replyTo, attachments, tags, headers } = params
  let from = params.from || process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'

  if (!to || !subject) {
    throw new Error("Missing required fields: to, subject")
  }

  // If neither provided, throw
  if (!text && !html) {
    throw new Error("Provide at least one of text or html content")
  }

  // Ensure a unified HTML layout (black/white theme) for all emails.
  // Only wrap if not already a full HTML document.
  const isFullDocument =
    !!html && (/^\s*<!DOCTYPE html>/i.test(html) || /<html[\s>]/i.test(html))

  if (!isFullDocument) {
    /**
     * SECURITY: `text` is HTML-ESCAPED before being interpolated here.
     *
     * This line previously read:
     *
     *   `<p ...>${(text || '').replace(/\n/g, '<br/>')}</p>`
     *
     * with no escaping, which made EVERY text-only send in the codebase an
     * HTML injection sink. Callers reasonably assume that passing `text`
     * means "plain text" and that it will be treated as such - but this
     * function silently promotes it to markup, so any caller interpolating
     * user input into a text body was injecting into HTML without knowing it.
     *
     * The support routes did exactly that, feeding unescaped customer-supplied
     * ticket subjects and message bodies into emails aimed at the ADMIN's
     * mailbox. An attacker could plant an <a href> to their own domain in a
     * message that arrives from our own verified sending domain, addressed to
     * staff.
     *
     * escapeHtmlMultiline escapes first and converts newlines to <br/>
     * afterwards, so a literal "<br/>" typed by a user renders as visible text
     * rather than becoming a tag.
     *
     * A caller that genuinely needs markup passes `html` instead. That is the
     * explicit, auditable way to say "this string is trusted HTML"; it should
     * not be reachable by accident through the plain-text parameter.
     */
    const bodyHtml = html
      ? html
      : `<p style="margin:0 0 16px;">${escapeHtmlMultiline(text || '')}</p>`
    html = renderEmailLayout({ title: subject, bodyHtml, cta: null })
  }

  // Ensure text fallback exists
  if (!text && html) {
    text = htmlToText(html)
  }

  const resend = getResend()

  // Sanitize and strictly construct payload for Resend API to avoid
  // "Invalid request: Unrecognized fields: 'type'" errors if caller
  // accidentally passes extra properties.
  const safeTags = Array.isArray(tags)
    ? tags
        .filter((t) => t && typeof t.name === "string" && typeof t.value === "string")
        .map(({ name, value }) => ({ name, value }))
    : undefined

  const safeHeaders = headers && typeof headers === "object" && !Array.isArray(headers)
    ? Object.entries(headers).reduce<Record<string, string>>((acc, [k, v]) => {
        if (k.toLowerCase() === "type") return acc // drop any rogue 'type' header
        if (typeof v === "string") acc[k] = v
        return acc
      }, {})
    : undefined

  const safeAttachments = Array.isArray(attachments)
    ? attachments.map((a) => {
        const out: any = {}
        if (typeof a.filename === "string") out.filename = a.filename
        if (a.content instanceof Buffer) out.content = a.content
        if (typeof a.path === "string") out.path = a.path
        if (typeof a.contentType === "string") out.contentType = a.contentType
        return out
      })
    : undefined

  const payload: any = {
    from: from as string,
    to,
    subject,
    text,
    html,
  }
  if (cc) payload.cc = cc
  if (bcc) payload.bcc = bcc
  if (replyTo) payload.replyTo = replyTo
  if (safeAttachments && safeAttachments.length) payload.attachments = safeAttachments
  if (safeTags && safeTags.length) payload.tags = safeTags
  if (safeHeaders && Object.keys(safeHeaders).length) payload.headers = safeHeaders

  // Defensive: ensure no stray 'type' field slipped in
  if ("type" in payload) delete payload.type

  const { data, error } = await resend.emails.send(payload)

  if (error) {
    throw new Error(`Resend error: ${error.name} - ${error.message}`)
  }

  return {
    messageId: data!.id,
    id: data!.id,
  }
}

export default { sendEmail }