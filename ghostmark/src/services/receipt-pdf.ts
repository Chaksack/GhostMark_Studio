import PDFDocument from "pdfkit"
import {
  type PdfLayout,
  type BrandingColors,
  type ResolvedBrandingColors,
  type ContactFooterBranding,
  defaultColors,
  formatMoney,
  safeText,
  pdfToBuffer,
  getLayout,
  drawDivider,
  tryLoadLogoBuffer,
  formatAddressLines,
  drawContactFooter,
} from "./pdf-utils"

export type ReceiptBranding = {
  issuerName?: string
  issuerEmail?: string
  website?: string
  phoneWhatsapp?: string
  instagram?: string
  logoPath?: string
  colors?: BrandingColors
}

type ResolvedReceiptBranding = {
  issuerName: string
  issuerEmail: string
  website: string
  phoneWhatsapp: string
  instagram: string
  logoPath: string
  colors: ResolvedBrandingColors
}

export type ReceiptPdfOptions = {
  branding?: ReceiptBranding
  reference?: string
  paymentType?: string
  serviceType?: string
  amountPaid?: number
}

function defaultReceiptBranding(overrides: ReceiptBranding = {}): ResolvedReceiptBranding {
  return {
    issuerName: overrides.issuerName || process.env.INVOICE_ISSUER_NAME || "GhostMark Studio",
    issuerEmail: overrides.issuerEmail || process.env.INVOICE_ISSUER_EMAIL || process.env.RESEND_FROM_EMAIL || "",
    website: overrides.website || process.env.RECEIPT_WEBSITE_URL || "",
    phoneWhatsapp: overrides.phoneWhatsapp || process.env.RECEIPT_PHONE_WHATSAPP || "",
    instagram: overrides.instagram || process.env.RECEIPT_INSTAGRAM_HANDLE || "",
    logoPath: overrides.logoPath || "",
    colors: defaultColors(overrides.colors),
  }
}

function defaultReference(order: any): string {
  const items: any[] = Array.isArray(order?.items) ? order.items : []
  const titles = items
    .map((item) => item?.title || item?.variant?.product?.title || item?.variant?.title)
    .filter(Boolean)
  if (!titles.length) return safeText(order?.display_id || order?.id || "Order")
  const summary = titles.slice(0, 2).join(", ")
  return titles.length > 2 ? `${summary} +${titles.length - 2} more` : summary
}

function formatReceiptDateTime(date: Date): string {
  const datePart = date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })
  const timePart = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })
  return `${datePart} • ${timePart}`
}

async function drawLogoBadge(
  doc: PDFKit.PDFDocument,
  layout: PdfLayout,
  args: { y: number; logoPath: string; colors: ResolvedBrandingColors; issuerName: string }
): Promise<number> {
  const radius = 34
  const centerX = layout.left + (layout.right - layout.left) / 2
  const topY = args.y + radius

  const logoBuf = await tryLoadLogoBuffer(args.logoPath)

  doc.save()
  doc.circle(centerX, topY, radius).lineWidth(1.5).strokeColor(args.colors.border).stroke()
  if (logoBuf) {
    doc.save()
    doc.circle(centerX, topY, radius - 3).clip()
    try {
      doc.image(logoBuf, centerX - radius, topY - radius, { width: radius * 2, height: radius * 2 })
    } catch {
      // fall through to initials below
    }
    doc.restore()
  } else {
    const initial = safeText(args.issuerName).trim().charAt(0).toUpperCase() || "G"
    doc
      .fontSize(28)
      .font("Helvetica-Bold")
      .fillColor(args.colors.primaryText)
      .text(initial, centerX - radius, topY - 14, { width: radius * 2, align: "center" })
  }
  doc.restore()

  return topY + radius + 14
}

function drawReferenceBox(
  doc: PDFKit.PDFDocument,
  layout: PdfLayout,
  args: { y: number; reference: string; colors: ResolvedBrandingColors }
): number {
  doc
    .fontSize(9)
    .font("Helvetica-Bold")
    .fillColor(args.colors.mutedText)
    .text("REFERENCE ID", layout.left, args.y, { width: layout.right - layout.left, align: "center" })

  const boxTop = args.y + 16
  const boxHeight = 44
  const boxWidth = Math.min(320, layout.right - layout.left)
  const boxLeft = layout.left + (layout.right - layout.left - boxWidth) / 2

  doc
    .save()
    .dash(4, { space: 3 })
    .roundedRect(boxLeft, boxTop, boxWidth, boxHeight, 8)
    .strokeColor(args.colors.strongBorder)
    .lineWidth(1)
    .stroke()
    .undash()
    .restore()

  doc
    .fontSize(14)
    .font("Helvetica-Bold")
    .fillColor(args.colors.primaryText)
    .text(args.reference, boxLeft + 12, boxTop + boxHeight / 2 - 8, {
      width: boxWidth - 24,
      align: "center",
    })

  return boxTop + boxHeight + 22
}

function drawKvRow(
  doc: PDFKit.PDFDocument,
  layout: PdfLayout,
  args: {
    y: number
    label: string
    value: string
    colors: ResolvedBrandingColors
    emphasize?: boolean
  }
): number {
  const size = args.emphasize ? 16 : 11
  doc
    .fontSize(size)
    .font("Helvetica")
    .fillColor(args.colors.mutedText)
    .text(args.label, layout.left, args.y, { width: (layout.right - layout.left) / 2 })
  doc
    .fontSize(size)
    .font("Helvetica-Bold")
    .fillColor(args.colors.primaryText)
    .text(args.value, layout.mid, args.y, { width: layout.right - layout.mid, align: "right" })

  return Math.max(doc.y, args.y + size + 6) + (args.emphasize ? 8 : 4)
}

// Generates a branded PDF receipt for a paid order/draft order.
export async function generateReceiptPdf(order: any, options: ReceiptPdfOptions = {}): Promise<Buffer> {
  const currencyCode = order?.currency_code || order?.currency?.code || "USD"
  const branding = defaultReceiptBranding(options.branding)
  const colors = branding.colors

  const total = Number(order?.total ?? 0)
  const amountPaid = options.amountPaid ?? total
  const outstanding = Math.max(0, total - amountPaid)

  const reference = options.reference || defaultReference(order)
  const paymentType = options.paymentType || safeText(order?.metadata?.invoice_payment_method) || "Bank Transfer"
  const serviceType = options.serviceType || safeText(order?.metadata?.service_type) || "Print on Demand"
  const customerName =
    [order?.customer?.first_name, order?.customer?.last_name].filter(Boolean).join(" ") ||
    order?.email ||
    order?.customer?.email ||
    "—"
  const addressLine =
    formatAddressLines({ address: order?.shipping_address }).replaceAll("\n", ", ") || "-"

  const doc = new PDFDocument({
    size: "A4",
    margin: 48,
    info: {
      Title: `Receipt ${safeText(order?.display_id || order?.id)}`,
      Author: branding.issuerName,
    },
  })

  const layout = getLayout(doc)
  const createdAt = order?.created_at ? new Date(order.created_at) : new Date()

  let y = 42
  y = await drawLogoBadge(doc, layout, { y, logoPath: branding.logoPath, colors, issuerName: branding.issuerName })

  doc
    .fontSize(10)
    .font("Courier")
    .fillColor(colors.mutedText)
    .text(formatReceiptDateTime(createdAt), layout.left, y, { width: layout.right - layout.left, align: "center" })
  y = doc.y + 20

  y = drawReferenceBox(doc, layout, { y, reference, colors })

  y = drawKvRow(doc, layout, { y, label: "Payment Type", value: paymentType, colors })
  drawDivider(doc, layout, y, colors.border)
  y += 12

  y = drawKvRow(doc, layout, { y, label: "Customer Name", value: safeText(customerName), colors })
  y = drawKvRow(doc, layout, { y, label: "Service Type", value: serviceType, colors })
  y = drawKvRow(doc, layout, { y, label: "Address", value: addressLine, colors })
  drawDivider(doc, layout, y, colors.border)
  y += 12

  y = drawKvRow(doc, layout, { y, label: "Amount Paid", value: formatMoney(amountPaid, currencyCode), colors })
  y = drawKvRow(doc, layout, { y, label: "Total", value: formatMoney(total, currencyCode), colors })
  y = drawKvRow(doc, layout, {
    y,
    label: "Outstanding Balance",
    value: formatMoney(outstanding, currencyCode),
    colors,
    emphasize: true,
  })
  drawDivider(doc, layout, y, colors.border)
  y += 26

  drawContactFooter(doc, layout, {
    y,
    branding: branding as ContactFooterBranding,
    colors,
    thankYou: `Thanks for purchasing from ${branding.issuerName}. Drop by again, you're always welcome here!`,
    thankYouPosition: "before",
  })

  return await pdfToBuffer(doc)
}
