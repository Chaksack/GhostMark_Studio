import PDFDocument from "pdfkit"
import fs from "node:fs/promises"
import path from "node:path"

type InvoiceBranding = {
  issuerName?: string
  issuerEmail?: string
  logoPath?: string
  colors?: {
    primaryText?: string
    mutedText?: string
    border?: string
    surface?: string
    strongBorder?: string
  }
}

type ResolvedInvoiceColors = {
  primaryText: string
  mutedText: string
  border: string
  surface: string
  strongBorder: string
}

type ResolvedInvoiceBranding = {
  issuerName: string
  issuerEmail: string
  logoPath: string
  colors: ResolvedInvoiceColors
}

function currencyFractionDigits(currencyCode?: string): number {
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

function minorUnitFactor(currencyCode?: string): number {
  const digits = currencyFractionDigits(currencyCode)
  return Math.pow(10, digits)
}

function formatMoney(amountMinor: number, currencyCode?: string): string {
  const currency = (currencyCode || "USD").toUpperCase()
  const factor = minorUnitFactor(currency)
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format((amountMinor || 0) / factor)
  } catch {
    // Fallback if currency code is invalid
    const digits = currencyFractionDigits(currency)
    return `${((amountMinor || 0) / factor).toFixed(digits)} ${currency}`
  }
}

function safeText(value: any): string {
  if (value == null) return ""
  return String(value)
}

async function pdfToBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return await new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    doc.on("data", (c: Buffer) => chunks.push(c))
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)
    doc.end()
  })
}

type PdfLayout = {
  pageWidth: number
  left: number
  right: number
  mid: number
}

export type InvoicePdfOptions = {
  branding?: InvoiceBranding
  paymentMethod?: string
}

function safeUpper(value: any): string {
  const s = safeText(value)
  return s ? s.toUpperCase() : ""
}

function resolveDefaultLogoPath(): string | undefined {
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

async function tryLoadLogoBuffer(logoPath?: string): Promise<Buffer | null> {
  const p = logoPath || resolveDefaultLogoPath()
  if (!p) return null
  try {
    return await fs.readFile(p)
  } catch {
    return null
  }
}

function defaultBranding(overrides: InvoiceBranding = {}): ResolvedInvoiceBranding {
  return {
    issuerName: overrides.issuerName || process.env.INVOICE_ISSUER_NAME || "GhostMark Studio",
    issuerEmail: overrides.issuerEmail || process.env.INVOICE_ISSUER_EMAIL || process.env.RESEND_FROM_EMAIL || "",
    logoPath: overrides.logoPath || resolveDefaultLogoPath() || "",
    colors: {
      primaryText: overrides.colors?.primaryText || "#000000",
      mutedText: overrides.colors?.mutedText || "#525252",
      border: overrides.colors?.border || "#E5E5E5",
      surface: overrides.colors?.surface || "#FAFAFA",
      strongBorder: overrides.colors?.strongBorder || "#000000",
    },
  }
}

function getLayout(doc: PDFKit.PDFDocument): PdfLayout {
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

function drawDivider(
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

async function drawHeader(
  doc: PDFKit.PDFDocument,
  layout: PdfLayout,
  args: {
    displayId: string
    issuerName: string
    issuerEmail: string
    logoPath: string
    colors: ResolvedInvoiceColors
    createdAt: Date
    paymentMethod: string
  }
): Promise<number> {
  const headerTop = 42
  const logoBuf = await tryLoadLogoBuffer(args.logoPath)

  let headerLeftX = layout.left
  if (logoBuf) {
    try {
      doc.image(logoBuf, layout.left, headerTop, { width: 140 })
      headerLeftX = layout.left + 155
    } catch {
      headerLeftX = layout.left
    }
  }

  doc
    .fontSize(18)
    .font("Helvetica-Bold")
    .fillColor(args.colors.primaryText)
    .text(args.issuerName, headerLeftX, headerTop + 6)

  doc.fontSize(10).font("Helvetica").fillColor(args.colors.mutedText)
  if (args.issuerEmail) {
    doc.text(args.issuerEmail, headerLeftX, headerTop + 30)
  }

  doc
    .fontSize(20)
    .font("Helvetica-Bold")
    .fillColor(args.colors.primaryText)
    .text("INVOICE", layout.right - 200, headerTop, {
      width: 140,
      align: "right",
    })

  doc.fontSize(10).font("Helvetica")
  doc.fillColor(args.colors.mutedText)
  doc.text(`Invoice #: ${args.displayId}`, layout.right - 220, headerTop + 32, {
    width: 220,
    align: "right",
  })
  doc.text(`Date: ${args.createdAt.toLocaleDateString()}`, layout.right - 220, headerTop + 46, {
    width: 220,
    align: "right",
  })
  if (args.paymentMethod) {
    doc.text(`Payment: ${args.paymentMethod}`, layout.right - 220, headerTop + 60, {
      width: 220,
      align: "right",
    })
  }

  const dividerY = headerTop + 82
  drawDivider(doc, layout, dividerY, args.colors.strongBorder)
  return dividerY
}

function formatAddressLines(args: {
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

function drawAddresses(
  doc: PDFKit.PDFDocument,
  layout: PdfLayout,
  args: {
    y: number
    bill: any
    ship: any
    customerEmail: string
    colors: ResolvedInvoiceColors
  }
): number {
  doc.fontSize(11).font("Helvetica-Bold").fillColor(args.colors.primaryText).text("Bill To", layout.left, args.y)
  doc
    .fontSize(10)
    .font("Helvetica")
    .fillColor(args.colors.primaryText)
    .text(
      formatAddressLines({
        address: args.bill,
        customerEmail: args.customerEmail,
        includeEmailAndPhone: true,
      }),
      layout.left,
      args.y + 16
    )

  doc.fontSize(11).font("Helvetica-Bold").fillColor(args.colors.primaryText).text("Ship To", layout.mid, args.y)
  doc
    .fontSize(10)
    .font("Helvetica")
    .fillColor(args.colors.primaryText)
    .text(
      formatAddressLines({
        address: args.ship,
        includeEmailAndPhone: false,
      }),
      layout.mid,
      args.y + 16
    )

  return args.y + 130
}

function drawLineItemsHeader(
  doc: PDFKit.PDFDocument,
  layout: PdfLayout,
  y: number,
  colors: ResolvedInvoiceColors
): number {
  doc
    .save()
    .rect(layout.left, y, layout.right - layout.left, 26)
    .fillColor(colors.surface)
    .fill()
    .restore()
  doc.save().moveTo(layout.left, y).lineTo(layout.right, y).strokeColor(colors.border).stroke().restore()

  let nextY = y + 7
  const colTitle = layout.left
  const colQty = layout.right - 180
  const colUnit = layout.right - 120
  const colTotal = layout.right - 0

  doc.fontSize(10).font("Helvetica-Bold").fillColor(colors.primaryText)
  doc.text("Item", colTitle, nextY, { width: colQty - colTitle - 10 })
  doc.text("Qty", colQty, nextY, { width: 40, align: "right" })
  doc.text("Unit", colUnit, nextY, { width: 60, align: "right" })
  doc.text("Total", colTotal - 80, nextY, { width: 80, align: "right" })

  nextY += 18
  doc.save().moveTo(layout.left, nextY).lineTo(layout.right, nextY).strokeColor(colors.border).stroke().restore()
  return nextY + 10
}

function isNearPageBottom(doc: PDFKit.PDFDocument, y: number): boolean {
  return y > doc.page.height - doc.page.margins.bottom - 120
}

function drawLineItems(
  doc: PDFKit.PDFDocument,
  layout: PdfLayout,
  args: {
    y: number
    items: any[]
    currencyCode: string
    colors: ResolvedInvoiceColors
  }
): number {
  const colTitle = layout.left
  const colQty = layout.right - 180
  const colUnit = layout.right - 120
  const colTotal = layout.right - 0

  doc.fontSize(10).font("Helvetica").fillColor(args.colors.primaryText)
  let y = args.y

  for (const item of args.items) {
    const title = item?.title || item?.variant?.product?.title || item?.variant?.title || "Item"
    const qty = Number(item?.quantity || 0)
    const unit = Number(item?.unit_price || 0)
    const lineTotal = Number(item?.total ?? unit * qty)

    const rowTop = y
    doc.text(safeText(title), colTitle, y, { width: colQty - colTitle - 10 })
    doc.text(String(qty), colQty, y, { width: 40, align: "right" })
    doc.text(formatMoney(unit, args.currencyCode), colUnit, y, { width: 60, align: "right" })
    doc.text(formatMoney(lineTotal, args.currencyCode), colTotal - 80, y, { width: 80, align: "right" })

    y = Math.max(y, doc.y) + 10

    if (isNearPageBottom(doc, y)) {
      doc.addPage()
      y = 48
    }

    doc
      .save()
      .moveTo(layout.left, rowTop + 28)
      .lineTo(layout.right, rowTop + 28)
      .strokeColor(args.colors.border)
      .stroke()
      .restore()
  }

  return y
}

function drawTotals(
  doc: PDFKit.PDFDocument,
  layout: PdfLayout,
  args: {
    y: number
    currencyCode: string
    colors: ResolvedInvoiceColors
    subtotal: number
    shipping: number
    tax: number
    discount: number
    total: number
  }
): number {
  let y = args.y + 10
  doc.save().moveTo(layout.left, y).lineTo(layout.right, y).strokeColor(args.colors.border).stroke().restore()
  y += 14

  const totalsLeft = layout.right - 240
  const labelW = 140
  const valueW = 100

  const writeTotalRow = (label: string, value: string) => {
    doc
      .font("Helvetica")
      .fillColor(args.colors.mutedText)
      .fontSize(10)
      .text(label, totalsLeft, y, { width: labelW, align: "right" })
    doc
      .font("Helvetica-Bold")
      .fillColor(args.colors.primaryText)
      .fontSize(10)
      .text(value, totalsLeft + labelW, y, { width: valueW, align: "right" })
    y += 16
  }

  if (args.subtotal) writeTotalRow("Subtotal", formatMoney(args.subtotal, args.currencyCode))
  if (args.discount) writeTotalRow("Discount", `- ${formatMoney(args.discount, args.currencyCode)}`)
  if (args.shipping) writeTotalRow("Shipping", formatMoney(args.shipping, args.currencyCode))
  if (args.tax) writeTotalRow("Tax", formatMoney(args.tax, args.currencyCode))

  doc.save().moveTo(totalsLeft, y).lineTo(layout.right, y).strokeColor(args.colors.border).stroke().restore()
  y += 6
  writeTotalRow("Total", formatMoney(args.total, args.currencyCode))
  return y
}

function drawFooter(
  doc: PDFKit.PDFDocument,
  layout: PdfLayout,
  colors: ResolvedInvoiceColors
): void {
  const footerY = doc.page.height - doc.page.margins.bottom - 40
  doc.font("Helvetica").fontSize(9).fillColor(colors.mutedText)
  doc.text("Thank you for your business.", layout.left, footerY, {
    width: layout.right - layout.left,
    align: "center",
  })
}

// Generates a branded PDF invoice for an order/draft order.
// Uses storefront-inspired monochrome styling and an optional logo.
export async function generateInvoicePdf(
  order: any,
  options: InvoicePdfOptions = {}
): Promise<Buffer> {
  const currencyCode = order?.currency_code || order?.currency?.code || "USD"
  const displayId = safeText(order?.display_id || order?.id)

  const branding = defaultBranding(options.branding)
  const colors = branding.colors
  const paymentMethod =
    options.paymentMethod ||
    safeText(order?.metadata?.invoice_payment_method || order?.metadata?.payment_method)

  const doc = new PDFDocument({
    size: "A4",
    margin: 48,
    info: {
      Title: `Invoice ${displayId}`,
      Author: branding.issuerName,
    },
  })

  const layout = getLayout(doc)
  const createdAt = order?.created_at ? new Date(order.created_at) : new Date()

  const dividerY = await drawHeader(doc, layout, {
    displayId,
    issuerName: branding.issuerName,
    issuerEmail: branding.issuerEmail,
    logoPath: branding.logoPath,
    colors,
    createdAt,
    paymentMethod,
  })

  let y = dividerY + 22

  const bill = order?.billing_address || {}
  const ship = order?.shipping_address || {}
  const customerEmail = order?.customer?.email || order?.email || ""
  y = drawAddresses(doc, layout, { y, bill, ship, customerEmail, colors })

  y = drawLineItemsHeader(doc, layout, y, colors)
  const items: any[] = Array.isArray(order?.items) ? order.items : []
  y = drawLineItems(doc, layout, { y, items, currencyCode, colors })

  const subtotal = Number(order?.subtotal ?? order?.items_subtotal ?? 0)
  const shipping = Number(order?.shipping_total ?? 0)
  const tax = Number(order?.tax_total ?? 0)
  const discount = Number(order?.discount_total ?? 0)
  const total = Number(order?.total ?? 0)

  drawTotals(doc, layout, {
    y,
    currencyCode,
    colors,
    subtotal,
    shipping,
    tax,
    discount,
    total,
  })

  drawFooter(doc, layout, colors)

  return await pdfToBuffer(doc)
}
