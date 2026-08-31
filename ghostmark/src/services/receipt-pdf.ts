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

// Coerce a Medusa v2 BigNumber-backed money field to a plain number.
//
// NO UNIT CONVERSION HAPPENS HERE. Medusa v2 money fields are already major
// units and `formatMoney` in pdf-utils is correct as written. This function
// only unwraps the representation (number | numeric string | { value }); it
// never scales. There is a separate, known defect in this store's historical
// order ledger, and it is deliberately not compensated for anywhere in this
// file, doing so would relocate the error onto every future order instead of
// removing it.
function toAmount(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  if (value && typeof value === "object") {
    const inner = (value as any).value
    if (inner !== undefined && inner !== value) return toAmount(inner)
  }
  return null
}

type ResolvedPayment = {
  // null means "we could not establish what was paid", which is materially
  // different from zero and must not be rendered as a number.
  amountPaid: number | null
  method: string | null
  source: string
}

// Work out what was ACTUALLY paid against this order, and how.
//
// The previous implementation was `const amountPaid = options.amountPaid ?? total`,
// with no caller in the codebase ever passing `options.amountPaid`. The
// consequence was that `outstanding` computed to zero unconditionally and every
// receipt this system has ever produced asserted the order was paid in full
// without once consulting a payment record. On the live data that is false for
// most orders: of eight payment collections, three are `not_paid` and four are
// `authorized` with `captured_amount = 0`, an authorisation is a hold, not a
// payment. Exactly one has actually been captured.
//
// A receipt is a financial assertion. It must never claim money changed hands
// on the strength of the invoice total, which is a statement about what is OWED.
//
// Resolution order, most to least authoritative:
//   1. An explicit `options.amountPaid` from the caller.
//   2. `order.payment_collections[].captured_amount`, captured, not authorised.
//   3. `order.payments[]` with a `captured_at` timestamp.
//   4. `order.summary.paid_total`.
// If none of those are present we return null and say so on the document.
// Exported so the payment-resolution rules can be exercised against real order
// shapes without generating a PDF or sending anything. This is the part of a
// receipt that makes a financial claim, so it is the part worth testing.
export function resolvePayment(order: any, options: ReceiptPdfOptions = {}): ResolvedPayment {
  const explicit = toAmount(options.amountPaid)
  if (explicit !== null) {
    return {
      amountPaid: explicit,
      method: options.paymentType || null,
      source: "caller",
    }
  }

  const collections: any[] = Array.isArray(order?.payment_collections)
    ? order.payment_collections
    : []

  const payments: any[] = [
    ...(Array.isArray(order?.payments) ? order.payments : []),
    ...collections.flatMap((c: any) =>
      Array.isArray(c?.payments) ? c.payments : []
    ),
  ]

  // Provider ids look like `pp_stripe_stripe`. Render something a customer
  // recognises rather than the internal id, and NEVER fall back to a guess.
  const describeProvider = (providerId: unknown): string | null => {
    const id = typeof providerId === "string" ? providerId.toLowerCase() : ""
    if (!id) return null
    if (id.includes("stripe")) return "Card (Stripe)"
    if (id.includes("paypal")) return "PayPal"
    if (id.includes("manual") || id.includes("system")) return "Manual / Offline"
    return safeText(providerId)
  }

  const capturedPayments = payments.filter((p) => p?.captured_at)
  const methodFromPayments = [
    ...new Set(
      (capturedPayments.length ? capturedPayments : payments)
        .map((p) => describeProvider(p?.provider_id))
        .filter(Boolean) as string[]
    ),
  ]
  const method = methodFromPayments.length
    ? methodFromPayments.join(", ")
    : safeText(order?.metadata?.invoice_payment_method) || null

  if (collections.length) {
    const captured = collections.reduce((sum: number, c: any) => {
      return sum + (toAmount(c?.captured_amount) ?? 0)
    }, 0)
    return { amountPaid: captured, method, source: "payment_collections" }
  }

  if (capturedPayments.length) {
    const captured = capturedPayments.reduce(
      (sum: number, p: any) => sum + (toAmount(p?.amount) ?? 0),
      0
    )
    return { amountPaid: captured, method, source: "payments" }
  }

  const summaryPaid =
    toAmount(order?.summary?.paid_total) ??
    toAmount(order?.summary?.totals?.paid_total) ??
    toAmount(order?.paid_total)
  if (summaryPaid !== null) {
    return { amountPaid: summaryPaid, method, source: "order.summary" }
  }

  return { amountPaid: null, method, source: "unavailable" }
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

  const total = toAmount(order?.total) ?? 0
  const payment = resolvePayment(order, options)
  const amountPaid = payment.amountPaid
  const outstanding =
    amountPaid === null ? null : Math.max(0, total - amountPaid)

  // What to print when we genuinely do not know. A receipt that says
  // "Not recorded" is a slightly awkward document; a receipt that says
  // "Amount Paid £34,000.00 / Outstanding £0.00" for an order where nothing was
  // ever captured is a false financial statement. The awkward one is correct.
  const UNKNOWN = "Not recorded"

  if (amountPaid === null) {
    // Loud, because the usual cause is fixable in one line: the order handed to
    // this function was fetched without its payment relations.
    //
    // ORDER_DOCUMENT_FIELDS (services/pdf-utils.ts) DOES request
    // `payment_collections.*` and `payment_collections.payments.*`, so the
    // receipt routes populate this correctly and reaching this branch through
    // them means either a genuinely payment-less order or a regression in that
    // field list. It is legitimately reachable: one live order has no payment
    // collection at all, and "Not recorded" is the honest rendering for it.
    //
    // A caller that builds its own field list can still land here, which is why
    // the message below names the two paths to add rather than assuming the
    // shared constant is at fault.
    // eslint-disable-next-line no-console
    console.warn(
      `[receipt-pdf] no payment information available for order ` +
        `${safeText(order?.id)}; the receipt will state "${UNKNOWN}" for Amount ` +
        `Paid and Outstanding rather than assume the order was paid in full. ` +
        `To populate these, fetch the order with "payment_collections.*" and ` +
        `"payment_collections.payments.*" in the query.graph field list.`
    )
  }

  const reference = options.reference || defaultReference(order)
  // NO "Bank Transfer" DEFAULT. Every payment on this store ran through Stripe,
  // and the hardcoded default meant every receipt named a payment rail the
  // customer never used. An unknown method is now stated as unknown.
  const paymentType = options.paymentType || payment.method || UNKNOWN
  const serviceType = options.serviceType || safeText(order?.metadata?.service_type) || "Print on Demand"
  const customerName =
    [order?.customer?.first_name, order?.customer?.last_name].filter(Boolean).join(" ") ||
    order?.email ||
    order?.customer?.email ||
    "–"
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

  y = drawKvRow(doc, layout, {
    y,
    label: "Amount Paid",
    value: amountPaid === null ? UNKNOWN : formatMoney(amountPaid, currencyCode),
    colors,
  })
  y = drawKvRow(doc, layout, { y, label: "Total", value: formatMoney(total, currencyCode), colors })
  y = drawKvRow(doc, layout, {
    y,
    label: "Outstanding Balance",
    value: outstanding === null ? UNKNOWN : formatMoney(outstanding, currencyCode),
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
