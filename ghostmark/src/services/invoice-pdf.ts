import PDFDocument from "pdfkit"

function formatMoney(amountMinor: number, currencyCode?: string): string {
  const currency = (currencyCode || "USD").toUpperCase()
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format((amountMinor || 0) / 100)
  } catch {
    // Fallback if currency code is invalid
    return `${((amountMinor || 0) / 100).toFixed(2)} ${currency}`
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

export type InvoicePdfOptions = {
  issuerName?: string
  issuerEmail?: string
}

// Generates a simple, self-contained PDF invoice for an order.
// Intentionally minimal: no external assets, no hard-coded theme colors.
export async function generateInvoicePdf(
  order: any,
  options: InvoicePdfOptions = {}
): Promise<Buffer> {
  const currencyCode = order?.currency_code || order?.currency?.code || "USD"
  const displayId = safeText(order?.display_id || order?.id)

  const doc = new PDFDocument({
    size: "A4",
    margin: 48,
    info: {
      Title: `Invoice ${displayId}`,
      Author: options.issuerName || "GhostMark Studio",
    },
  })

  const pageWidth = doc.page.width
  const left = doc.page.margins.left
  const right = pageWidth - doc.page.margins.right

  // Header
  doc.fontSize(20).font("Helvetica-Bold").text(options.issuerName || "GhostMark Studio", left, 48)
  doc.fontSize(10).font("Helvetica").fillColor("black")

  const issuerEmail = options.issuerEmail || process.env.RESEND_FROM_EMAIL || ""
  if (issuerEmail) {
    doc.text(issuerEmail, left, 74)
  }

  doc.fontSize(18).font("Helvetica-Bold").text("INVOICE", right - 140, 48, {
    width: 140,
    align: "right",
  })

  doc.fontSize(10).font("Helvetica")
  const createdAt = order?.created_at ? new Date(order.created_at) : new Date()
  doc.text(`Invoice #: ${displayId}`, right - 220, 74, { width: 220, align: "right" })
  doc.text(`Date: ${createdAt.toLocaleDateString()}`, right - 220, 88, { width: 220, align: "right" })

  let y = 120

  // Bill to / Ship to
  const bill = order?.billing_address || {}
  const ship = order?.shipping_address || {}
  const customerEmail = order?.customer?.email || order?.email || ""

  doc.fontSize(11).font("Helvetica-Bold").text("Bill To", left, y)
  doc.fontSize(10).font("Helvetica").text(
    [
      safeText(bill?.company),
      [safeText(bill?.first_name), safeText(bill?.last_name)].filter(Boolean).join(" "),
      safeText(bill?.address_1),
      safeText(bill?.address_2),
      [safeText(bill?.city), safeText(bill?.province), safeText(bill?.postal_code)].filter(Boolean).join(", "),
      safeText(bill?.country_code ? String(bill.country_code).toUpperCase() : ""),
      customerEmail ? `Email: ${customerEmail}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    left,
    y + 16
  )

  const mid = left + (right - left) / 2
  doc.fontSize(11).font("Helvetica-Bold").text("Ship To", mid, y)
  doc.fontSize(10).font("Helvetica").text(
    [
      safeText(ship?.company),
      [safeText(ship?.first_name), safeText(ship?.last_name)].filter(Boolean).join(" "),
      safeText(ship?.address_1),
      safeText(ship?.address_2),
      [safeText(ship?.city), safeText(ship?.province), safeText(ship?.postal_code)].filter(Boolean).join(", "),
      safeText(ship?.country_code ? String(ship.country_code).toUpperCase() : ""),
    ]
      .filter(Boolean)
      .join("\n"),
    mid,
    y + 16
  )

  y += 130

  // Line items table header
  const colTitle = left
  const colQty = right - 180
  const colUnit = right - 120
  const colTotal = right - 0

  doc.moveTo(left, y).lineTo(right, y).stroke()
  y += 10
  doc.fontSize(10).font("Helvetica-Bold")
  doc.text("Item", colTitle, y, { width: (colQty - colTitle) - 10 })
  doc.text("Qty", colQty, y, { width: 40, align: "right" })
  doc.text("Unit", colUnit, y, { width: 60, align: "right" })
  doc.text("Total", colTotal - 80, y, { width: 80, align: "right" })
  y += 16
  doc.moveTo(left, y).lineTo(right, y).stroke()
  y += 10

  doc.fontSize(10).font("Helvetica")
  const items: any[] = Array.isArray(order?.items) ? order.items : []

  for (const item of items) {
    const title =
      item?.title ||
      item?.variant?.product?.title ||
      item?.variant?.title ||
      "Item"

    const qty = Number(item?.quantity || 0)
    const unit = Number(item?.unit_price || 0)
    const lineTotal = Number(item?.total ?? (unit * qty))

    const rowTop = y
    doc.text(safeText(title), colTitle, y, { width: (colQty - colTitle) - 10 })
    doc.text(String(qty), colQty, y, { width: 40, align: "right" })
    doc.text(formatMoney(unit, currencyCode), colUnit, y, { width: 60, align: "right" })
    doc.text(formatMoney(lineTotal, currencyCode), colTotal - 80, y, { width: 80, align: "right" })

    y = Math.max(y, doc.y) + 10

    // New page if needed
    if (y > doc.page.height - doc.page.margins.bottom - 120) {
      doc.addPage()
      y = 48
    }

    // Light row separator
    doc.moveTo(left, rowTop + 28).lineTo(right, rowTop + 28).strokeOpacity(0.2).stroke().strokeOpacity(1)
  }

  // Totals
  const subtotal = Number(order?.subtotal ?? order?.items_subtotal ?? 0)
  const shipping = Number(order?.shipping_total ?? 0)
  const tax = Number(order?.tax_total ?? 0)
  const discount = Number(order?.discount_total ?? 0)
  const total = Number(order?.total ?? 0)

  y += 10
  doc.moveTo(left, y).lineTo(right, y).stroke()
  y += 14

  const totalsLeft = right - 240
  const labelW = 140
  const valueW = 100

  const writeTotalRow = (label: string, value: string) => {
    doc.font("Helvetica").fontSize(10).text(label, totalsLeft, y, { width: labelW, align: "right" })
    doc.font("Helvetica-Bold").fontSize(10).text(value, totalsLeft + labelW, y, { width: valueW, align: "right" })
    y += 16
  }

  if (subtotal) writeTotalRow("Subtotal", formatMoney(subtotal, currencyCode))
  if (discount) writeTotalRow("Discount", `- ${formatMoney(discount, currencyCode)}`)
  if (shipping) writeTotalRow("Shipping", formatMoney(shipping, currencyCode))
  if (tax) writeTotalRow("Tax", formatMoney(tax, currencyCode))

  doc.moveTo(totalsLeft, y).lineTo(right, y).stroke()
  y += 6
  writeTotalRow("Total", formatMoney(total, currencyCode))

  // Footer
  const footerY = doc.page.height - doc.page.margins.bottom - 40
  doc.font("Helvetica").fontSize(9).fillColor("black")
  doc.text("Thank you for your business.", left, footerY, { width: right - left, align: "center" })

  return await pdfToBuffer(doc)
}
