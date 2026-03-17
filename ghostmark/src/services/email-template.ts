// Centralized HTML email layout for GhostMark Studio
// Theme: Black & White, with site logo as title mark.

export function resolveBaseUrl(): string {
  const cand =
    process.env.EMAIL_PUBLIC_BASE_URL ||
    process.env.ADMIN_PUBLIC_URL ||
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.STORE_URL ||
    process.env.MEDUSA_ADMIN_URL ||
    process.env.MEDUSA_BACKEND_URL ||
    ""
  const normalized = String(cand).replace(/\/$/, "")
  if (normalized) return normalized
  // Production-safe default: use the live admin domain so /static assets resolve correctly
  return process.env.NODE_ENV === "production"
    ? "https://admin.ghostmarkstudio.com"
    : "http://localhost:9000"
}

export function resolveLogoUrl(): string {
  // icon.png is stored under static/admin/icon.png in this repo.
  // It will be served at /static/admin/icon.png relative to the backend.
  // Users may override with EMAIL_LOGO_URL.
  const explicit = process.env.EMAIL_LOGO_URL
  if (explicit) return explicit
  const base = resolveBaseUrl()
  return `${base}/static/admin/icon.png`
}

// Very small HTML-to-text pass for plain-text fallbacks
export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<(?:br|BR)\s*\/?>(?:\n)?/g, "\n")
    .replace(/<\/(?:p|div|h1|h2|h3|h4|h5|h6)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{2,}/g, "\n\n")
    .replace(/\s{2,}/g, " ")
    .trim()
}

export function renderEmailLayout(opts: {
  title?: string
  subtitle?: string
  bodyHtml: string
  cta?: { label: string; href: string } | null
}): string {
  const { title = "GhostMark Studio", subtitle, bodyHtml, cta = null } = opts
  const logoUrl = resolveLogoUrl()

  // Strict inline styles for maximum client compatibility; B/W palette only
  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f5f5f5;">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;">
      <div style="background:#000000;padding:32px 20px;text-align:center;">
        <img src="${logoUrl}" alt="GhostMark Studio" width="80" height="80" style="display:block;margin:0 auto 16px;border-radius:8px;" />
        <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:700;letter-spacing:-0.01em;">${escapeHtml(
          title
        )}</h1>
        ${subtitle ? `<p style="color:#d1d5db;margin:8px 0 0;font-size:14px;">${escapeHtml(subtitle)}</p>` : ""}
      </div>
      <div style="padding:28px 20px;color:#111827;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        ${bodyHtml}
        ${cta ? `<div style="text-align:center;margin:32px 0 8px;">
          <a href="${escapeAttr(cta.href)}" style="background:#000000;color:#ffffff;padding:12px 28px;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;display:inline-block;">${escapeHtml(
            cta.label
          )}</a>
        </div>` : ""}
      </div>
      <div style="background:#f8fafc;padding:20px;text-align:center;border-top:1px solid #e5e7eb;">
        <p style="color:#6b7280;margin:0 0 6px;font-size:12px;">Best regards,</p>
        <p style="color:#000000;margin:0;font-size:14px;font-weight:600;">The GhostMark Studio Team</p>
      </div>
    </div>
  </body>
  </html>`
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function escapeAttr(s: string): string {
  return escapeHtml(s)
}

export default {
  renderEmailLayout,
  resolveLogoUrl,
  htmlToText,
}
