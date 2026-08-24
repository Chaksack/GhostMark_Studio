import PDFDocument from "pdfkit"
import {
  type PdfLayout,
  type BrandingColors,
  type ResolvedBrandingColors,
  type ContactFooterBranding,
  defaultColors,
  safeText,
  pdfToBuffer,
  getLayout,
  drawDivider,
  isNearPageBottom,
  tryLoadLogoBuffer,
  formatAddressLines,
  drawContactFooter,
} from "./pdf-utils"

export type DispatchNoteBranding = {
  issuerName?: string
  issuerEmail?: string
  website?: string
  phoneWhatsapp?: string
  instagram?: string
  logoPath?: string
  colors?: BrandingColors
}

type ResolvedDispatchNoteBranding = {
  issuerName: string
  issuerEmail: string
  website: string
  phoneWhatsapp: string
  instagram: string
  logoPath: string
  colors: ResolvedBrandingColors
}

export type DispatchNotePdfOptions = {
  branding?: DispatchNoteBranding
  dispatchNoteNumber?: string
  dispatchDate?: Date
  volumeLtrs?: number | string
  weightKg?: number | string
}

// Deterministic, collision-free dispatch note number derived from the order's
// own monotonic display_id and the dispatch month. Not a true sequential
// per-month counter (this repo has no counter/DB infra to back one) — see
// implementation plan for the trade-off. Format mirrors GMSDP{YYYYMM}-{seq}.
export function computeDispatchNoteNumber(order: any, dispatchDate: Date = new Date()): string {
  const yyyymm = `${dispatchDate.getFullYear()}${String(dispatchDate.getMonth() + 1).padStart(2, "0")}`
  const seq = String(order?.display_id ?? "0").padStart(2, "0")
  return `GMSDP${yyyymm}-${seq}`
}

function defaultDispatchBranding(overrides: DispatchNoteBranding = {}): ResolvedDispatchNoteBranding {
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

async function drawDispatchHeader(
  doc: PDFKit.PDFDocument,
  layout: PdfLayout,
  args: {
    dispatchNoteNumber: string
    issuerName: string
    issuerEmail: string
    logoPath: string
    colors: ResolvedBrandingColors
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
    .text("DISPATCH NOTE", layout.right - 260, headerTop, {
      width: 260,
      align: "right",
    })

  doc.fontSize(10).font("Helvetica").fillColor(args.colors.mutedText)
  doc.text(`#${args.dispatchNoteNumber}`, layout.right - 220, headerTop + 32, {
    width: 220,
    align: "right",
  })

  const dividerY = headerTop + 82
  drawDivider(doc, layout, dividerY, args.colors.strongBorder)
  return dividerY
}

function drawDeliveryAndDispatchInfo(
  doc: PDFKit.PDFDocument,
  layout: PdfLayout,
  args: {
    y: number
    order: any
    dispatchNoteNumber: string
    dispatchDate: Date
    volumeLtrs: number | string
    weightKg: number | string
    colors: ResolvedBrandingColors
  }
): number {
  const { order, colors } = args
  const ship = order?.shipping_address || {}
  const email = order?.customer?.email || order?.email || "-"
  const mobile = safeText(ship?.phone) || "-"
  const orderRef = safeText(order?.display_id || order?.id)
  const orderDate = order?.created_at ? new Date(order.created_at).toLocaleDateString() : "-"
  const itemCount = Array.isArray(order?.items)
    ? order.items.reduce((sum: number, item: any) => sum + Number(item?.quantity || 0), 0)
    : 0

  doc.fontSize(11).font("Helvetica-Bold").fillColor(colors.primaryText).text("Delivery to", layout.left, args.y)
  doc
    .fontSize(10)
    .font("Helvetica")
    .fillColor(colors.primaryText)
    .text(formatAddressLines({ address: ship }) || "-", layout.left, args.y + 16)
  doc.text(`Email: ${email}`, layout.left, doc.y + 6)
  doc.text(`Mobile: ${mobile}`, layout.left, doc.y + 2)

  const rightRows: Array<[string, string]> = [
    ["No. items", String(itemCount)],
    ["Dispatch date", args.dispatchDate.toLocaleDateString()],
    ["Order ref", orderRef],
    ["Order date", orderDate],
    ["Volume (ltrs)", String(args.volumeLtrs)],
    ["Weight (kg)", String(args.weightKg)],
  ]

  doc.fontSize(11).font("Helvetica-Bold").fillColor(colors.primaryText).text("Dispatch note:", layout.mid, args.y)
  let ry = args.y + 18
  const labelW = 110
  for (const [label, value] of rightRows) {
    doc
      .fontSize(9)
      .font("Helvetica-Bold")
      .fillColor(colors.mutedText)
      .text(label.toUpperCase(), layout.mid, ry, { width: labelW })
    doc
      .fontSize(10)
      .font("Helvetica")
      .fillColor(colors.primaryText)
      .text(value, layout.mid + labelW, ry, { width: layout.right - layout.mid - labelW, align: "right" })
    ry = Math.max(ry, doc.y) + 6
  }

  return Math.max(doc.y, ry) + 16
}

function drawDispatchItemsHeader(
  doc: PDFKit.PDFDocument,
  layout: PdfLayout,
  y: number,
  colors: ResolvedBrandingColors
): number {
  doc
    .save()
    .rect(layout.left, y, layout.right - layout.left, 26)
    .fillColor(colors.surface)
    .fill()
    .restore()
  doc.save().moveTo(layout.left, y).lineTo(layout.right, y).strokeColor(colors.border).stroke().restore()

  let nextY = y + 7
  const colNo = layout.left
  const colItem = layout.left + 50
  const colQty = layout.right - 60

  doc.fontSize(10).font("Helvetica-Bold").fillColor(colors.primaryText)
  doc.text("No.", colNo, nextY, { width: 40 })
  doc.text("Item", colItem, nextY, { width: colQty - colItem - 10 })
  doc.text("Qty", colQty, nextY, { width: 60, align: "right" })

  nextY += 18
  doc.save().moveTo(layout.left, nextY).lineTo(layout.right, nextY).strokeColor(colors.border).stroke().restore()
  return nextY + 10
}

function drawDispatchItems(
  doc: PDFKit.PDFDocument,
  layout: PdfLayout,
  args: { y: number; items: any[]; colors: ResolvedBrandingColors }
): number {
  const colNo = layout.left
  const colItem = layout.left + 50
  const colQty = layout.right - 60

  doc.fontSize(10).font("Helvetica").fillColor(args.colors.primaryText)
  let y = args.y

  args.items.forEach((item, index) => {
    const title = item?.title || item?.variant?.product?.title || item?.variant?.title || "Item"
    const variantTitle = item?.variant?.title && item.variant.title !== title ? ` (${item.variant.title})` : ""
    const qty = Number(item?.quantity || 0)

    const rowTop = y
    doc.text(String(index + 1).padStart(2, "0"), colNo, y, { width: 40 })
    doc.text(`${safeText(title)}${variantTitle}`, colItem, y, { width: colQty - colItem - 10 })
    doc.text(String(qty), colQty, y, { width: 60, align: "right" })

    y = Math.max(y, doc.y) + 10

    if (isNearPageBottom(doc, y)) {
      doc.addPage()
      y = 48
    }

    doc
      .save()
      .moveTo(layout.left, rowTop + 20)
      .lineTo(layout.right, rowTop + 20)
      .strokeColor(args.colors.border)
      .stroke()
      .restore()
  })

  return y
}

// Generates a branded PDF dispatch note (packing slip) for fulfilment.
export async function generateDispatchNotePdf(
  order: any,
  options: DispatchNotePdfOptions = {}
): Promise<Buffer> {
  const branding = defaultDispatchBranding(options.branding)
  const colors = branding.colors
  const dispatchDate = options.dispatchDate || new Date()
  const dispatchNoteNumber = options.dispatchNoteNumber || computeDispatchNoteNumber(order, dispatchDate)
  const volumeLtrs = options.volumeLtrs ?? 0
  const weightKg = options.weightKg ?? 0

  const doc = new PDFDocument({
    size: "A4",
    margin: 48,
    info: {
      Title: `Dispatch Note ${dispatchNoteNumber}`,
      Author: branding.issuerName,
    },
  })

  const layout = getLayout(doc)

  const dividerY = await drawDispatchHeader(doc, layout, {
    dispatchNoteNumber,
    issuerName: branding.issuerName,
    issuerEmail: branding.issuerEmail,
    logoPath: branding.logoPath,
    colors,
  })

  let y = dividerY + 22

  y = drawDeliveryAndDispatchInfo(doc, layout, {
    y,
    order,
    dispatchNoteNumber,
    dispatchDate,
    volumeLtrs,
    weightKg,
    colors,
  })

  doc
    .fontSize(9)
    .font("Helvetica")
    .fillColor(colors.mutedText)
    .text(
      "Please note that the supply of all goods is subject to our Terms and Conditions as already agreed, a copy of which is available on request.",
      layout.left,
      y,
      { width: layout.right - layout.left }
    )
  y = doc.y + 16

  y = drawDispatchItemsHeader(doc, layout, y, colors)
  const items: any[] = Array.isArray(order?.items) ? order.items : []
  y = drawDispatchItems(doc, layout, { y, items, colors })

  y += 16
  doc.fontSize(9).font("Helvetica-Bold").fillColor(colors.primaryText).text("REMEMBER", layout.left, y)
  doc
    .fontSize(9)
    .font("Helvetica")
    .fillColor(colors.mutedText)
    .text("Please check this delivery carefully", layout.left, doc.y + 2)

  const footerY = doc.page.height - doc.page.margins.bottom - 130
  drawContactFooter(doc, layout, {
    y: Math.max(doc.y + 30, footerY),
    branding: branding as ContactFooterBranding,
    colors,
    thankYou: "This is a computer generated dispatch note. No signature is necessary. Thank you!",
    thankYouPosition: "after",
  })

  return await pdfToBuffer(doc)
}
