import {
  AbstractNotificationProviderService,
  MedusaError,
} from "@medusajs/framework/utils"
import { Logger } from "@medusajs/framework/types"
import { Resend } from 'resend'
import { renderEmailLayout, htmlToText } from '../../services/email-template'

type InjectedDependencies = {
  logger: Logger
}

type ResendOptions = {
  channels: string[]
  api_key?: string
  from_email?: string
  from_name?: string
}

type ResendAttachment = {
  filename: string
  content: string | Buffer
  contentType?: string
  content_type?: string
  type?: string
}

class ResendNotificationProviderService extends AbstractNotificationProviderService {
  static readonly identifier = "resend"
  
  static validateOptions(options: ResendOptions) {
    if (!options.api_key) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Option `api_key` is required in the Resend provider's options."
      )
    }
  }
  
  protected logger_: Logger
  protected options_: ResendOptions
  private resend: Resend

  constructor(
    { logger }: InjectedDependencies,
    options: ResendOptions
  ) {
    super()
    this.logger_ = logger
    this.options_ = options
    this.initializeResend()
  }

  private initializeResend() {
    try {
      const apiKey = this.options_.api_key || process.env.RESEND_API_KEY?.replace(/['"]/g, '')
      
      if (!apiKey) {
        throw new Error('Resend API key is required')
      }

      this.resend = new Resend(apiKey)
      this.logger_.info('Resend notification provider initialized successfully')
    } catch (error) {
      this.logger_.error('Failed to initialize Resend notification provider', error)
      throw error
    }
  }

  async send(notification: any): Promise<{ id: string }> {
    try {
      const { to, channel, template, data = {}, content } = notification

      // Skip non-email channels
      if (channel !== "email") {
        return { id: "skipped-non-email" }
      }

      let emailContent: { subject: string; html: string; text: string } = {
        subject: "Notification from GhostMark Studio",
        html: "<p>Default notification</p>",
        text: "Default notification"
      }

      // Use direct content if provided
      if (content?.html || content?.subject) {
        emailContent = {
          subject: content.subject || emailContent.subject,
          html: content.html || emailContent.html,
          text: content.text || emailContent.text
        }
      } else if (template) {
        // Use template-based content
        emailContent = this.getTemplateContent(template, data)
      }

      // Interpolate variables in content
      emailContent.subject = this.interpolateTemplate(emailContent.subject, data)
      emailContent.html = this.interpolateTemplate(emailContent.html, data)

      const attachments: ResendAttachment[] = Array.isArray(content?.attachments)
        ? content.attachments
        : []

      // Ensure layout: if html is not a full document, wrap it using the unified
      // black/white email layout with the site logo. This guarantees consistent UI
      // for all emails, including ad-hoc content without a named template.
      const looksLikeFullHtml = /<!DOCTYPE html>/i.test(emailContent.html) || /<html[\s>]/i.test(emailContent.html)
      if (!looksLikeFullHtml) {
        const wrapped = renderEmailLayout({
          title: emailContent.subject || 'GhostMark Studio',
          bodyHtml: emailContent.html || '<p></p>',
          cta: null,
        })
        emailContent.html = wrapped
        // Ensure text fallback
        emailContent.text = emailContent.text || htmlToText(wrapped)
      } else if (!emailContent.text && emailContent.html) {
        emailContent.text = htmlToText(emailContent.html)
      }

      const from = `${this.options_.from_name || 'GhostMark Studio'} <${this.options_.from_email || process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'}>`

      const { data: result, error } = await this.resend.emails.send({
        from,
        to: to,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
        ...(attachments.length
          ? {
              attachments: attachments
                .filter((a) => a && typeof a.filename === "string" && a.filename && (a as any).content)
                .map((a) => ({
                  filename: a.filename,
                  content: a.content,
                  contentType: a.contentType || a.content_type || a.type,
                })),
            }
          : {}),
        tags: [
          { name: 'provider', value: 'resend' },
          { name: 'template', value: template || 'custom' },
        ],
        headers: {
          'Reply-To': this.options_.from_email || process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
          'X-Mailer': 'GhostMark Studio Notification System',
        }
      })

      if (error) {
        throw new Error(`Resend error: ${error.name} - ${error.message}`)
      }
      
      this.logger_.info(
        `Resend notification sent successfully to ${to} (messageId=${result?.id}, template=${template || "custom"})`
      )

      const messageId = result?.id
      if (!messageId) {
        throw new Error("Resend error: missing message id")
      }

      return { id: messageId }
    } catch (error) {
      this.logger_.error('Failed to send Resend notification', error)
      throw error
    }
  }

  private interpolateTemplate(template: string, data: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] || match
    })
  }

  private getTemplateContent(
    template: string,
    data: Record<string, any>
  ): { subject: string; html: string; text: string } {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.STORE_URL || 'https://localhost:8000'

    if (template === 'order-confirmation') {
      const subject = 'Order Confirmation - {{order_display_id}} | GhostMark Studio'
      const bodyHtml = `
        <p style="font-size:16px;color:#111827;margin:0 0 16px;font-weight:600;">Hi {{customer_first_name}},</p>
        <p style="font-size:14px;color:#4b5563;line-height:1.6;margin:0 0 20px;">
          Great news! Your order <strong style="color:#000000;">{{order_display_id}}</strong> has been confirmed and is now being processed.
        </p>
        <div style="background:#ffffff;border:2px solid #000000;border-radius:8px;padding:20px;margin:24px 0;">
          <h3 style="color:#000000;margin:0 0 12px;font-size:16px;font-weight:700;">Order Summary</h3>
          <p style="margin:6px 0;color:#4b5563;font-size:13px;"><span style="font-weight:600;color:#000000;">Order ID:</span> {{order_display_id}}</p>
          <p style="margin:6px 0;color:#4b5563;font-size:13px;"><span style="font-weight:600;color:#000000;">Customer Type:</span> {{customer_type}}</p>
          <p style="margin:6px 0;color:#4b5563;font-size:13px;"><span style="font-weight:600;color:#000000;">Quantity:</span> {{total_quantity}} units</p>
          <!-- Per-item rows: pre-rendered HTML built in order-notifications.ts.
               POD line items embed a preview thumbnail + per-location design
               download links so the customer can re-reach their artwork. -->
          <div style="margin:14px 0 0;">{{items_summary_html}}</div>
          <p style="margin:14px 0 0;font-size:16px;font-weight:700;color:#000000;">Total: {{order_total}}</p>
        </div>
      `
      const html = renderEmailLayout({
        title: 'Order Confirmed',
        subtitle: 'Thank you for choosing GhostMark Studio',
        bodyHtml,
        cta: { label: 'Track Your Order', href: `${baseUrl}/account/orders` },
      })
      return {
        subject,
        html,
        text: htmlToText(html),
      }
    }

    if (template === 'quote-request') {
      const subject = 'Quote Request Received - {{quantity}} Units | GhostMark Studio'
      const bodyHtml = `
        <p style="font-size:16px;color:#111827;margin:0 0 16px;font-weight:600;">Hi {{customer_first_name}},</p>
        <p style="font-size:14px;color:#4b5563;line-height:1.6;margin:0 0 20px;">
          Thank you for your bulk order inquiry! We've received your quote request and our team is preparing a custom proposal with competitive pricing for your order.
        </p>
        <div style="background:#ffffff;border:2px solid #000000;border-radius:8px;padding:20px;margin:24px 0;">
          <h3 style="color:#000000;margin:0 0 12px;font-size:16px;font-weight:700;">Quote Request Details</h3>
          <p style="margin:6px 0;color:#4b5563;font-size:13px;"><span style="font-weight:600;color:#000000;">Product:</span> {{product_title}}</p>
          <p style="margin:6px 0;color:#4b5563;font-size:13px;"><span style="font-weight:600;color:#000000;">Requested Quantity:</span> {{quantity}} units</p>
          <p style="margin:6px 0;color:#4b5563;font-size:13px;"><span style="font-weight:600;color:#000000;">Customer Type:</span> {{customer_type}}</p>
          <p style="margin:10px 0 0;font-size:16px;font-weight:700;color:#000000;">Estimated Total: {{estimated_total}}</p>
        </div>
        <div style="text-align:center;margin:16px 0 0;">
          <p style="color:#4b5563;margin:0 0 10px;font-size:13px;">Have Questions?</p>
          <a href="mailto:quotes@ghostmarkstudio.com" style="color:#000000;text-decoration:underline;font-weight:600;">quotes@ghostmarkstudio.com</a>
        </div>
      `
      const html = renderEmailLayout({
        title: 'Quote Request Received',
        subtitle: "We'll prepare your custom proposal within 24 hours",
        bodyHtml,
        cta: null,
      })
      return {
        subject,
        html,
        text: htmlToText(html),
      }
    }

    // Fallback generic template in the unified layout
    const genericSubject = 'Notification from GhostMark Studio'
    const genericHtml = renderEmailLayout({
      title: 'Notification',
      bodyHtml: `<p style="margin:0;">This is a notification from GhostMark Studio.</p>`,
      cta: null,
    })
    return {
      subject: genericSubject,
      html: genericHtml,
      text: htmlToText(genericHtml),
    }
  }
}

export default ResendNotificationProviderService