import fs from "node:fs/promises"
import path from "node:path"

// Generic, doc-type-agnostic helpers shared by invoice-pdf.ts, receipt-pdf.ts,
// and dispatch-note-pdf.ts. Nothing here should reference invoice/receipt/dispatch
// concepts directly.

// Field list for query.graph({ entity: "order", fields: ORDER_DOCUMENT_FIELDS })
// used by invoice/receipt/dispatch-note routes.
//
// IMPORTANT: do not add "*" to this list. Medusa v2 computes order totals
// (total/subtotal/etc.) on demand from the order's `summary` relation only
// when the specific total field names appear in the requested field/select
// list (see @medusajs/order's `shouldIncludeTotals`); "*" expands to the
// Order model's stored columns only (which do NOT include total/subtotal —
// those are derived from `summary.totals`, not stored columns) and, when
// combined with explicit total field names in the same fields array,
// suppresses total resolution entirely instead of adding to it. Confirmed
// via `medusa exec` against a live order: `fields: ["*", "total", ...]`
// returns `total: undefined`, while the explicit list below returns the
// correct BigNumber total.
export const ORDER_DOCUMENT_FIELDS = [
  "id",
  "display_id",
  "status",
  "email",
  "currency_code",
  "created_at",
  "updated_at",
  "metadata",
  "customer_id",
  "region_id",
  "sales_channel_id",
  "total",
  "subtotal",
  "tax_total",
  "discount_total",
  "shipping_total",
  "item_total",
  "item_subtotal",
  "customer.*",
  "billing_address.*",
  "shipping_address.*",
  "items.*",
  "items.variant.product.title",
]

export type PdfLayout = {
  pageWidth: number
  left: number
  right: number
  mid: number
}

export type BrandingColors = {
  primaryText?: string
  mutedText?: string
  border?: string
  surface?: string
  strongBorder?: string
}

export type ResolvedBrandingColors = {
  primaryText: string
  mutedText: string
  border: string
  surface: string
  strongBorder: string
}

export function defaultColors(overrides: BrandingColors = {}): ResolvedBrandingColors {
  return {
    primaryText: overrides.primaryText || "#000000",
    mutedText: overrides.mutedText || "#525252",
    border: overrides.border || "#E5E5E5",
    surface: overrides.surface || "#FAFAFA",
    strongBorder: overrides.strongBorder || "#000000",
  }
}

export function currencyFractionDigits(currencyCode?: string): number {
  const currency = (currencyCode || "USD").toUpperCase()
  try {
    const digits = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).resolvedOptions().maximumFractionDigits
    return typeof digits === "number" ? digits : 2
  } catch {
    return 2
  }
}

// Only relevant for genuinely minor-unit (integer cents) money values, e.g.
// raw amounts from a payment provider webhook. NOT for Medusa v2 order/item
// money fields — those are already major-unit decimals; see formatMoney().
export function minorUnitFactor(currencyCode?: string): number {
  const digits = currencyFractionDigits(currencyCode)
  return Math.pow(10, digits)
}

// NOTE: `amount` here is already a decimal, major-unit currency value (e.g.
// 42.00 means £42.00) — this is how Medusa v2 represents order/line-item
// money fields (total, subtotal, unit_price, ...) via BigNumber, unlike
// Medusa v1's integer minor units. Do not multiply/divide by a currency
// factor here. Confirmed via `medusa exec` against a live order: an order
// whose admin UI shows "£4,200.00" returns `total` as the BigNumber 4200,
// not 420000.
export function formatMoney(amount: number, currencyCode?: string): string {
  const currency = (currencyCode || "USD").toUpperCase()
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(amount || 0)
  } catch {
    // Fallback if currency code is invalid
    const digits = currencyFractionDigits(currency)
    return `${(amount || 0).toFixed(digits)} ${currency}`
  }
}

export function safeText(value: any): string {
  if (value == null) return ""
  return String(value)
}

export function safeUpper(value: any): string {
  const s = safeText(value)
  return s ? s.toUpperCase() : ""
}

export async function pdfToBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return await new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    doc.on("data", (c: Buffer) => chunks.push(c))
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)
    doc.end()
  })
}

export function getLayout(doc: PDFKit.PDFDocument): PdfLayout {
  const pageWidth = doc.page.width
  const left = doc.page.margins.left
  const right = pageWidth - doc.page.margins.right
  return {
    pageWidth,
    left,
    right,
    mid: left + (right - left) / 2,
  }
}

export function drawDivider(
  doc: PDFKit.PDFDocument,
  layout: PdfLayout,
  y: number,
  color: string
): void {
  doc
    .save()
    .moveTo(layout.left, y)
    .lineTo(layout.right, y)
    .lineWidth(1)
    .strokeColor(color)
    .stroke()
    .restore()
}

export function isNearPageBottom(doc: PDFKit.PDFDocument, y: number, reserve = 120): boolean {
  return y > doc.page.height - doc.page.margins.bottom - reserve
}

export function resolveDefaultLogoPath(): string | undefined {
  const envPath = process.env.INVOICE_LOGO_PATH
  if (envPath) return envPath

  // Local mono-repo default: use storefront logo if present.
  // In prod/Docker, set INVOICE_LOGO_PATH to a mounted asset.
  try {
    const candidate = path.resolve(process.cwd(), "../ghostmark-storefront/public/ghostmark-logo.png")
    return candidate
  } catch {
    return undefined
  }
}

export async function tryLoadLogoBuffer(logoPath?: string): Promise<Buffer | null> {
  const p = logoPath || resolveDefaultLogoPath()
  if (!p) return null
  try {
    return await fs.readFile(p)
  } catch {
    return null
  }
}

export function formatAddressLines(args: {
  address: any
  customerEmail?: string
  includeEmailAndPhone?: boolean
}): string {
  const address = args.address || {}
  const customerEmail = safeText(args.customerEmail)

  return [
    safeText(address?.company),
    [safeText(address?.first_name), safeText(address?.last_name)].filter(Boolean).join(" "),
    safeText(address?.address_1),
    safeText(address?.address_2),
    [safeText(address?.city), safeText(address?.province), safeText(address?.postal_code)]
      .filter(Boolean)
      .join(", "),
    safeUpper(address?.country_code),
    args.includeEmailAndPhone && customerEmail ? `Email: ${customerEmail}` : "",
    args.includeEmailAndPhone && safeText(address?.phone)
      ? `Phone: ${safeText(address.phone)}`
      : "",
  ]
    .filter(Boolean)
    .join("\n")
}

export type ContactFooterBranding = {
  issuerName: string
  issuerEmail: string
  website?: string
  phoneWhatsapp?: string
  instagram?: string
}

// Shared footer table used by receipts and dispatch notes:
// bold-caps labels on the left, right-aligned values, one row per contact field.
export function drawContactFooter(
  doc: PDFKit.PDFDocument,
  layout: PdfLayout,
  args: {
    y: number
    branding: ContactFooterBranding
    colors: ResolvedBrandingColors
    thankYou?: string
    thankYouPosition?: "before" | "after"
  }
): number {
  let y = args.y

  const writeThankYou = () => {
    doc
      .fontSize(9)
      .font("Helvetica")
      .fillColor(args.colors.mutedText)
      .text(args.thankYou as string, layout.left, y, { width: layout.right - layout.left, align: "center" })
    y = doc.y + 14
  }

  if (args.thankYou && (args.thankYouPosition ?? "after") === "before") {
    writeThankYou()
  }

  doc
    .fontSize(16)
    .font("Helvetica-Bold")
    .fillColor(args.colors.primaryText)
    .text(args.branding.issuerName, layout.left, y, { width: layout.right - layout.left, align: "center" })
  y = doc.y + 8

  drawDivider(doc, layout, y, args.colors.strongBorder)
  y += 14

  const rows: Array<[string, string]> = []
  if (args.branding.issuerEmail) rows.push(["EMAIL", args.branding.issuerEmail])
  if (args.branding.website) rows.push(["WEBSITE", args.branding.website])
  if (args.branding.phoneWhatsapp) rows.push(["PHONE/WHATSAPP", args.branding.phoneWhatsapp])
  if (args.branding.instagram) rows.push(["INSTAGRAM", args.branding.instagram])

  const labelW = 140
  for (const [label, value] of rows) {
    doc
      .fontSize(9)
      .font("Helvetica-Bold")
      .fillColor(args.colors.mutedText)
      .text(label, layout.left, y, { width: labelW })
    doc
      .fontSize(10)
      .font("Helvetica")
      .fillColor(args.colors.primaryText)
      .text(value, layout.left + labelW, y, { width: layout.right - layout.left - labelW, align: "right" })
    y = Math.max(y, doc.y) + 8
  }

  if (args.thankYou && (args.thankYouPosition ?? "after") === "after") {
    y += 6
    writeThankYou()
  }

  return y
}

export default {
  currencyFractionDigits,
  minorUnitFactor,
  formatMoney,
  safeText,
  safeUpper,
  pdfToBuffer,
  getLayout,
  drawDivider,
  isNearPageBottom,
  resolveDefaultLogoPath,
  tryLoadLogoBuffer,
  formatAddressLines,
  defaultColors,
  drawContactFooter,
}
