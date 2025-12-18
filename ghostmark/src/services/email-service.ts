import nodemailer, { Transporter } from "nodemailer"

/**
 * Simple email service using SMTP credentials from environment variables.
 *
 * Required env vars (defined in ghostmark/.env):
 * - SMTP_HOST
 * - SMTP_PORT
 * - SMTP_SECURE ("true" | "false")
 * - SMTP_USER
 * - SMTP_PASSWORD
 * - SMTP_FROM_EMAIL (optional, falls back to SMTP_USER)
 */
export type SendEmailParams = {
  to: string | string[]
  subject: string
  text?: string
  html?: string
  from?: string
}

let cachedTransport: Transporter | null = null

function parseBool(val: string | undefined): boolean | undefined {
  if (val === undefined) return undefined
  const v = String(val).trim().toLowerCase()
  if (v === "true" || v === "1" || v === "yes") return true
  if (v === "false" || v === "0" || v === "no") return false
  return undefined
}

function getTransport(): Transporter {
  if (cachedTransport) return cachedTransport

  const host = process.env.SMTP_HOST?.replace(/^"|"$/g, "")
  const portStr = process.env.SMTP_PORT?.replace(/^"|"$/g, "")
  const secureEnv = process.env.SMTP_SECURE?.replace(/^"|"$/g, "")
  const user = process.env.SMTP_USER?.replace(/^"|"$/g, "")
  const pass = process.env.SMTP_PASSWORD?.replace(/^"|"$/g, "")

  if (!host || !portStr || !user || !pass) {
    throw new Error(
      "Missing SMTP configuration. Please set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD in environment."
    )
  }

  const port = Number(portStr)
  const secure = parseBool(secureEnv)

  cachedTransport = nodemailer.createTransport({
    host,
    port: Number.isFinite(port) ? port : 587,
    secure: secure ?? false,
    auth: { user, pass },
  })

  return cachedTransport
}

export async function sendEmail(params: SendEmailParams) {
  const { to, subject, text, html } = params
  let from = params.from || process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER

  if (!to || !subject) {
    throw new Error("Missing required fields: to, subject")
  }

  if (!text && !html) {
    throw new Error("Provide at least one of text or html content")
  }

  const transporter = getTransport()

  const info = await transporter.sendMail({
    from: from as string,
    to,
    subject,
    text,
    html,
  })

  return {
    messageId: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected,
    response: info.response,
  }
}

export default { sendEmail }
