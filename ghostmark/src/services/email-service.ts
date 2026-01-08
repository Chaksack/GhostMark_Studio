import { Resend } from 'resend'

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
  const { to, subject, text, html, cc, bcc, replyTo, attachments, tags, headers } = params
  let from = params.from || process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'

  if (!to || !subject) {
    throw new Error("Missing required fields: to, subject")
  }

  if (!text && !html) {
    throw new Error("Provide at least one of text or html content")
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