import {
  AbstractNotificationProviderService,
  MedusaError,
} from "@medusajs/framework/utils"
import { Logger } from "@medusajs/framework/types"
import { Resend } from 'resend'

type InjectedDependencies = {
  logger: Logger
}

type ResendOptions = {
  channels: string[]
  api_key?: string
  from_email?: string
  from_name?: string
}

class ResendNotificationProviderService extends AbstractNotificationProviderService {
  static identifier = "resend"
  
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

      let emailContent = {
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

      const from = `${this.options_.from_name || 'GhostMark Studio'} <${this.options_.from_email || process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'}>`

      const { data: result, error } = await this.resend.emails.send({
        from,
        to: to,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
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
      
      this.logger_.info(`Resend notification sent successfully to ${to}`, {
        messageId: result!.id,
        template: template || 'custom'
      })

      return { id: result!.id }
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

  private getTemplateContent(template: string, data: Record<string, any>) {
    const templates: Record<string, any> = {
      'order-confirmation': {
        subject: 'Order Confirmation - {{order_display_id}} | GhostMark Studio',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
            <div style="background: #1f2937; padding: 40px 20px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">Order Confirmed</h1>
              <p style="color: #d1d5db; margin: 10px 0 0; font-size: 16px;">Thank you for choosing GhostMark Studio</p>
            </div>
            
            <div style="padding: 40px 20px;">
              <p style="font-size: 18px; color: #374151; margin: 0 0 20px;">Hi {{customer_first_name}},</p>
              
              <p style="font-size: 16px; color: #6b7280; line-height: 1.6; margin: 0 0 30px;">
                Great news! Your order <strong style="color: #1f2937;">{{order_display_id}}</strong> has been confirmed and is now being processed.
              </p>

              <div style="background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 30px; margin: 30px 0;">
                <h3 style="color: #374151; margin: 0 0 20px; font-size: 18px; font-weight: 600;">Order Summary</h3>
                <p><strong>Order ID:</strong> {{order_display_id}}</p>
                <p><strong>Customer Type:</strong> {{customer_type}}</p>
                <p><strong>Quantity:</strong> {{total_quantity}} units</p>
                <p><strong>Total:</strong> {{order_total}}</p>
              </div>

              <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 20px; margin: 30px 0;">
                <h4 style="color: #047857; margin: 0 0 10px; font-size: 16px;">What happens next?</h4>
                <p style="color: #059669; margin: 0; font-size: 14px; line-height: 1.5;">
                  • Your order will be processed within 1-2 business days<br>
                  • You'll receive design proofs (for POD orders)<br>
                  • We'll send shipping confirmation once your order is dispatched
                </p>
              </div>
            </div>
            
            <div style="background: #f9fafb; padding: 30px 20px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; margin: 0; font-size: 14px;">Best regards,<br><strong style="color: #1f2937;">The GhostMark Studio Team</strong></p>
            </div>
          </div>
        `
      },
      'quote-request': {
        subject: 'Quote Request Received - {{quantity}} Units | GhostMark Studio',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
            <div style="background: #3b82f6; padding: 40px 20px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">Quote Request Received</h1>
              <p style="color: #dbeafe; margin: 10px 0 0; font-size: 16px;">We'll get back to you within 24 hours</p>
            </div>
            
            <div style="padding: 40px 20px;">
              <p style="font-size: 18px; color: #374151; margin: 0 0 20px;">Hi {{customer_first_name}},</p>
              
              <p style="font-size: 16px; color: #6b7280; line-height: 1.6; margin: 0 0 30px;">
                Thank you for your bulk order inquiry. We've received your quote request and our team is preparing a custom proposal for you.
              </p>

              <div style="background: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 30px; margin: 30px 0;">
                <h3 style="color: #92400e; margin: 0 0 20px; font-size: 18px; font-weight: 600;">Quote Details</h3>
                <p><strong>Product:</strong> {{product_title}}</p>
                <p><strong>Quantity:</strong> {{quantity}} units</p>
                <p><strong>Customer Type:</strong> {{customer_type}}</p>
                <p><strong>Estimated Total:</strong> {{estimated_total}}</p>
              </div>
            </div>
          </div>
        `
      }
    }

    const template_content = templates[template] || templates['order-confirmation']
    return {
      subject: template_content.subject,
      html: template_content.html,
      text: undefined
    }
  }
}

export default ResendNotificationProviderService