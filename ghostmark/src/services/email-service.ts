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

  const { data, error } = await resend.emails.send({
    from: from as string,
    to,
    subject,
    text,
    html,
    cc,
    bcc,
    replyTo,
    attachments,
    tags,
    headers,
  })

  if (error) {
    throw new Error(`Resend error: ${error.name} - ${error.message}`)
  }

  return {
    messageId: data!.id,
    id: data!.id,
  }
}

export default { sendEmail }