import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { generateReceiptPdf } from "../../../../../services/receipt-pdf"
import { ORDER_DOCUMENT_FIELDS } from "../../../../../services/pdf-utils"

type SendReceiptBody = {
  to?: string
  reference?: string
  paymentType?: string
  serviceType?: string
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const orderId = (req.params as any)?.orderId

    if (!orderId) {
      return res.status(400).json({ message: "Missing orderId" })
    }

    const body = (req.body || {}) as SendReceiptBody

    const query = req.scope.resolve("query") as any

    const { data } = await query.graph({
      entity: "order",
      fields: ORDER_DOCUMENT_FIELDS,
      filters: { id: orderId },
    })

    const order = Array.isArray(data) ? data[0] : null

    if (!order) {
      return res.status(404).json({ message: "Order not found" })
    }

    const customerEmail = body.to || order?.customer?.email || order?.email

    if (!customerEmail) {
      return res.status(400).json({ message: "Order has no customer email" })
    }

    const pdf = await generateReceiptPdf(order, {
      reference: body.reference,
      paymentType: body.paymentType,
      serviceType: body.serviceType,
    })

    const displayId = String((order as any).display_id || order.id)
    const filename = `receipt-${displayId}.pdf`

    const notificationModuleService = req.scope.resolve(Modules.NOTIFICATION) as any

    const subject = `Receipt ${displayId} | ${process.env.INVOICE_ISSUER_NAME || "GhostMark Studio"}`
    const html = `
      <p style="margin:0 0 12px;">Hi,</p>
      <p style="margin:0 0 12px;">Attached is your receipt for order <strong>${displayId}</strong>.</p>
      <p style="margin:0;">Thank you for your business.</p>
    `

    await notificationModuleService.createNotifications({
      to: customerEmail,
      channel: "email",
      template: undefined,
      data: {
        order_display_id: displayId,
      },
      content: {
        subject,
        html,
        attachments: [
          {
            filename,
            content: pdf.toString("base64"),
            contentType: "application/pdf",
          },
        ],
      },
    })

    return res.json({
      success: true,
      to: customerEmail,
      order_id: order.id,
      receipt_display_id: displayId,
    })
  } catch (error: any) {
    console.error("Error sending receipt:", error)
    return res.status(500).json({
      success: false,
      message: error?.message || "Failed to send receipt",
    })
  }
}
