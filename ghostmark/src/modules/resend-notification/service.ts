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
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.STORE_URL || 'https://localhost:8000'
    const logoUrl = `${baseUrl}/icon.png`
    
    const templates: Record<string, any> = {
      'order-confirmation': {
        subject: 'Order Confirmation - {{order_display_id}} | GhostMark Studio',
        html: `
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Order Confirmation</title>
          </head>
          <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif; background-color: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb;">
              <!-- Header with Logo -->
              <div style="background: #000000; padding: 40px 20px; text-align: center;">
                <img src="${logoUrl}" alt="GhostMark Studio" width="80" height="80" style="display: block; margin: 0 auto 20px; border-radius: 8px;" />
                <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600; letter-spacing: -0.025em;">Order Confirmed</h1>
                <p style="color: #d1d5db; margin: 10px 0 0; font-size: 16px;">Thank you for choosing GhostMark Studio</p>
              </div>
              
              <!-- Main Content -->
              <div style="padding: 40px 20px;">
                <p style="font-size: 18px; color: #000000; margin: 0 0 20px; font-weight: 600;">Hi {{customer_first_name}},</p>
                
                <p style="font-size: 16px; color: #4a5568; line-height: 1.6; margin: 0 0 30px;">
                  Great news! Your order <strong style="color: #000000;">{{order_display_id}}</strong> has been confirmed and is now being processed.
                </p>

                <!-- Order Summary Box -->
                <div style="background: #ffffff; border: 2px solid #000000; border-radius: 8px; padding: 30px; margin: 30px 0;">
                  <h3 style="color: #000000; margin: 0 0 20px; font-size: 18px; font-weight: 700;">Order Summary</h3>
                  <div style="border-bottom: 1px solid #e5e7eb; padding-bottom: 15px; margin-bottom: 15px;">
                    <p style="margin: 5px 0; color: #4a5568; font-size: 14px;"><span style="font-weight: 600; color: #000000;">Order ID:</span> {{order_display_id}}</p>
                    <p style="margin: 5px 0; color: #4a5568; font-size: 14px;"><span style="font-weight: 600; color: #000000;">Customer Type:</span> {{customer_type}}</p>
                    <p style="margin: 5px 0; color: #4a5568; font-size: 14px;"><span style="font-weight: 600; color: #000000;">Quantity:</span> {{total_quantity}} units</p>
                  </div>
                  <p style="margin: 0; font-size: 18px; font-weight: 700; color: #000000;">Total: {{order_total}}</p>
                </div>

                <!-- Next Steps Box -->
                <div style="background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 30px 0;">
                  <h4 style="color: #000000; margin: 0 0 15px; font-size: 16px; font-weight: 600;">What happens next?</h4>
                  <ul style="color: #4a5568; margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.6;">
                    <li style="margin-bottom: 8px;">Your order will be processed within 1-2 business days</li>
                    <li style="margin-bottom: 8px;">You'll receive design proofs (for POD orders)</li>
                    <li style="margin-bottom: 0;">We'll send shipping confirmation once your order is dispatched</li>
                  </ul>
                </div>

                <!-- CTA Button -->
                <div style="text-align: center; margin: 40px 0;">
                  <a href="${baseUrl}/account/orders" style="background: #000000; color: #ffffff; padding: 12px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block; transition: background-color 0.3s;">Track Your Order</a>
                </div>
              </div>
              
              <!-- Footer -->
              <div style="background: #f8fafc; padding: 30px 20px; text-align: center; border-top: 1px solid #e5e7eb;">
                <p style="color: #4a5568; margin: 0 0 10px; font-size: 14px;">Best regards,</p>
                <p style="color: #000000; margin: 0; font-size: 16px; font-weight: 600;">The GhostMark Studio Team</p>
                <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                  <p style="color: #9ca3af; margin: 0; font-size: 12px;">
                    GhostMark Studio | Custom Print Solutions<br>
                    <a href="${baseUrl}" style="color: #000000; text-decoration: none;">Visit our website</a> | 
                    <a href="${baseUrl}/help-center" style="color: #000000; text-decoration: none;">Need help?</a>
                  </p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `
      },
      'quote-request': {
        subject: 'Quote Request Received - {{quantity}} Units | GhostMark Studio',
        html: `
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Quote Request Received</title>
          </head>
          <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif; background-color: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb;">
              <!-- Header with Logo -->
              <div style="background: #000000; padding: 40px 20px; text-align: center;">
                <img src="${logoUrl}" alt="GhostMark Studio" width="80" height="80" style="display: block; margin: 0 auto 20px; border-radius: 8px;" />
                <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600; letter-spacing: -0.025em;">Quote Request Received</h1>
                <p style="color: #d1d5db; margin: 10px 0 0; font-size: 16px;">We'll prepare your custom proposal within 24 hours</p>
              </div>
              
              <!-- Main Content -->
              <div style="padding: 40px 20px;">
                <p style="font-size: 18px; color: #000000; margin: 0 0 20px; font-weight: 600;">Hi {{customer_first_name}},</p>
                
                <p style="font-size: 16px; color: #4a5568; line-height: 1.6; margin: 0 0 30px;">
                  Thank you for your bulk order inquiry! We've received your quote request and our team is preparing a custom proposal with competitive pricing for your order.
                </p>

                <!-- Quote Details Box -->
                <div style="background: #ffffff; border: 2px solid #000000; border-radius: 8px; padding: 30px; margin: 30px 0;">
                  <h3 style="color: #000000; margin: 0 0 20px; font-size: 18px; font-weight: 700;">Quote Request Details</h3>
                  <div style="border-bottom: 1px solid #e5e7eb; padding-bottom: 15px; margin-bottom: 15px;">
                    <p style="margin: 8px 0; color: #4a5568; font-size: 14px;"><span style="font-weight: 600; color: #000000;">Product:</span> {{product_title}}</p>
                    <p style="margin: 8px 0; color: #4a5568; font-size: 14px;"><span style="font-weight: 600; color: #000000;">Requested Quantity:</span> {{quantity}} units</p>
                    <p style="margin: 8px 0; color: #4a5568; font-size: 14px;"><span style="font-weight: 600; color: #000000;">Customer Type:</span> {{customer_type}}</p>
                  </div>
                  <p style="margin: 0; font-size: 18px; font-weight: 700; color: #000000;">Estimated Total: {{estimated_total}}</p>
                </div>

                <!-- Next Steps Box -->
                <div style="background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 30px 0;">
                  <h4 style="color: #000000; margin: 0 0 15px; font-size: 16px; font-weight: 600;">What happens next?</h4>
                  <ul style="color: #4a5568; margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.6;">
                    <li style="margin-bottom: 8px;">Our team will review your requirements and prepare a custom quote</li>
                    <li style="margin-bottom: 8px;">You'll receive a detailed proposal with pricing within 24 hours</li>
                    <li style="margin-bottom: 8px;">We'll include bulk discount pricing and shipping options</li>
                    <li style="margin-bottom: 0;">Our team may contact you for any clarifications needed</li>
                  </ul>
                </div>

                <!-- Contact Information -->
                <div style="background: #ffffff; border: 1px solid #000000; border-radius: 8px; padding: 20px; margin: 30px 0; text-align: center;">
                  <h4 style="color: #000000; margin: 0 0 15px; font-size: 16px; font-weight: 600;">Have Questions?</h4>
                  <p style="color: #4a5568; margin: 0 0 15px; font-size: 14px;">Our bulk sales team is here to help with your order</p>
                  <a href="mailto:quotes@ghostmarkstudio.com" style="color: #000000; text-decoration: underline; font-weight: 600;">quotes@ghostmarkstudio.com</a>
                </div>
              </div>
              
              <!-- Footer -->
              <div style="background: #f8fafc; padding: 30px 20px; text-align: center; border-top: 1px solid #e5e7eb;">
                <p style="color: #4a5568; margin: 0 0 10px; font-size: 14px;">Best regards,</p>
                <p style="color: #000000; margin: 0; font-size: 16px; font-weight: 600;">The GhostMark Studio Sales Team</p>
                <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                  <p style="color: #9ca3af; margin: 0; font-size: 12px;">
                    GhostMark Studio | Custom Print Solutions<br>
                    <a href="${baseUrl}" style="color: #000000; text-decoration: none;">Visit our website</a> | 
                    <a href="${baseUrl}/help-center" style="color: #000000; text-decoration: none;">Need help?</a>
                  </p>
                </div>
              </div>
            </div>
          </body>
          </html>
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