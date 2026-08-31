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

      // Interpolate variables in content.
      //
      // The text/plain part is interpolated too. `getTemplateContent` derives
      // it via `htmlToText(html)` from the UN-interpolated template, so it
      // arrives here still carrying raw `{{...}}` tokens. Every templated email
      // this store has ever sent shipped those literally in its plain-text MIME
      // part, which is what a text-only client, a screen reader and most spam
      // filters actually read.
      emailContent.subject = this.interpolateTemplate(emailContent.subject, data, "text")
      emailContent.html = this.interpolateTemplate(emailContent.html, data, "html")
      if (emailContent.text) {
        emailContent.text = this.interpolateTemplate(emailContent.text, data, "text")
      }

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

  // Replaces every `{{key}}` token in an email string with the corresponding
  // value from `data`.
  //
  // The previous implementation was `data[key] || match`, which returned the
  // RAW PLACEHOLDER whenever the value was falsy. Every falsy-but-legitimate
  // value hit that path: an empty string, the number 0, and `false`. The
  // observable consequence was that order-confirmation emails shipped the
  // literal text "{{order_total}}" to real customers, because the subscriber's
  // currency formatter returns '' when it is handed a non-finite amount, and
  // '' is falsy.
  //
  // Three rules now:
  //   1. A key that is present but empty/zero/false renders its value. `0` is
  //      a real quantity and `''` is a real (if uninformative) string; neither
  //      is a reason to show template syntax to a customer.
  //   2. A key that is absent, null or undefined renders as an EMPTY STRING.
  //      A blank field is a cosmetic defect; a visible `{{order_total}}` is a
  //      credibility one, and it is the customer who pays for it.
  //   3. Unfilled placeholders are logged, once per send, with the key names.
  //      This is the part that keeps rule 2 from hiding bugs: the operator
  //      still finds out, the customer just isn't the one who tells them.
  //
  // The replacer stays a FUNCTION rather than a string on purpose. A string
  // replacement would interpret `$&`, `$'` and `$\`` inside interpolated
  // values, which is an injection vector for anything derived from customer
  // input (product titles, names).
  //
  // Values are HTML-escaped by default. They are substituted into email HTML,
  // including into `href="..."` attributes, and most of them are derived from
  // catalogue or customer data. The exception is keys ending in `_html`, which
  // are pre-rendered markup the caller built deliberately: `items_summary_html`
  // in order-notifications.ts is the existing one, and it already escapes its
  // own interpolated fragments at source. That naming convention is the whole
  // opt-out, so a new raw-HTML placeholder must be named `*_html` to work.
  //
  // `mode` picks the escaping context. The subject line is a plain-text header,
  // not markup, so escaping there would emit a literal "&amp;" to the inbox.
  private interpolateTemplate(
    template: string,
    data: Record<string, any>,
    mode: "html" | "text" = "html"
  ): string {
    const unfilled: string[] = []

    const escapeHtmlValue = (s: string): string =>
      s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")

    const result = template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
      const present =
        data != null && Object.prototype.hasOwnProperty.call(data, key)
      const value = present ? data[key] : undefined

      if (!present || value === null || value === undefined) {
        unfilled.push(key)
        return ""
      }

      const raw = String(value)
      if (mode === "text" || key.endsWith("_html")) {
        return raw
      }
      return escapeHtmlValue(raw)
    })

    if (unfilled.length) {
      this.logger_.warn(
        `[resend] email template had unfilled placeholders, rendered blank: ${[
          ...new Set(unfilled),
        ].join(", ")}`
      )
    }

    return result
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

    if (template === 'invite-created') {
      // Admin staff invite. Fired by ghostmark/src/subscribers/
      // invite-notifications.ts on the `invite.created` event. The
      // subscriber supplies:
      //   invite_email:      the address being invited
      //   accept_url:        full /app/invite?token=… link
      //   expires_in_days:   integer; Medusa default is 7
      const subject = "You're invited to GhostMark Studio admin"
      const bodyHtml = `
        <p style="font-size:16px;color:#111827;margin:0 0 16px;font-weight:600;">Hi {{invite_email}},</p>
        <p style="font-size:14px;color:#4b5563;line-height:1.6;margin:0 0 20px;">
          You've been invited to join the GhostMark Studio admin team. Click the button below to accept your invitation and set up your account. The link is unique to you. Please don't share it.
        </p>
        <div style="background:#ffffff;border:2px solid #000000;border-radius:8px;padding:20px;margin:24px 0;">
          <h3 style="color:#000000;margin:0 0 12px;font-size:16px;font-weight:700;">What happens next</h3>
          <p style="margin:6px 0;color:#4b5563;font-size:13px;">1. Click <strong style="color:#000000;">Accept invitation</strong> below.</p>
          <p style="margin:6px 0;color:#4b5563;font-size:13px;">2. Enter your name and choose a password.</p>
          <p style="margin:6px 0;color:#4b5563;font-size:13px;">3. You'll be signed in and ready to go.</p>
          <p style="margin:10px 0 0;color:#92400e;font-size:13px;">This link expires in <strong>{{expires_in_days}} days</strong>.</p>
        </div>
        <p style="font-size:12px;color:#6b7280;line-height:1.5;margin:18px 0 0;">
          If the button doesn't work, copy and paste this URL into your browser:
          <br />
          <a href="{{accept_url}}" style="color:#000000;text-decoration:underline;word-break:break-all;">{{accept_url}}</a>
        </p>
        <p style="font-size:12px;color:#6b7280;line-height:1.5;margin:18px 0 0;">
          Didn't expect this email? You can safely ignore it. The invitation will expire on its own.
        </p>
      `
      const html = renderEmailLayout({
        title: 'Welcome to GhostMark Studio',
        subtitle: 'You have been invited to the admin team',
        bodyHtml,
        cta: { label: 'Accept invitation', href: '{{accept_url}}' },
      })
      return {
        subject,
        html,
        text: htmlToText(html),
      }
    }

    if (template === 'bulk-order-notification') {
      // INTERNAL ops alert, not customer-facing. Fired by
      // order-notifications.ts for orders of 25+ units or corporate customers,
      // to ADMIN_EMAIL. Receives the same payload as the customer
      // confirmation. Like `review-reminder`, this template did not exist and
      // was falling through to the generic body, so the alert carried none of
      // the information it exists to convey.
      const subject = 'Bulk order received - {{order_display_id}} ({{total_quantity}} units)'
      const bodyHtml = `
        <p style="font-size:14px;color:#4b5563;line-height:1.6;margin:0 0 20px;">
          A bulk or corporate order has come in and may need manual follow-up.
        </p>
        <div style="background:#ffffff;border:2px solid #000000;border-radius:8px;padding:20px;margin:24px 0;">
          <p style="margin:6px 0;color:#4b5563;font-size:13px;"><span style="font-weight:600;color:#000000;">Order:</span> {{order_display_id}}</p>
          <p style="margin:6px 0;color:#4b5563;font-size:13px;"><span style="font-weight:600;color:#000000;">Customer:</span> {{customer_first_name}} ({{customer_email}})</p>
          <p style="margin:6px 0;color:#4b5563;font-size:13px;"><span style="font-weight:600;color:#000000;">Customer Type:</span> {{customer_type}}</p>
          <p style="margin:6px 0;color:#4b5563;font-size:13px;"><span style="font-weight:600;color:#000000;">Quantity:</span> {{total_quantity}} units</p>
          <p style="margin:6px 0;color:#4b5563;font-size:13px;"><span style="font-weight:600;color:#000000;">Total:</span> {{order_total}}</p>
          <div style="margin:14px 0 0;">{{items_summary_html}}</div>
        </div>
      `
      const html = renderEmailLayout({
        title: 'Bulk Order Received',
        subtitle: 'Internal notification',
        bodyHtml,
        cta: null,
      })
      return { subject, html, text: htmlToText(html) }
    }

    if (template === 'gift-card-code') {
      // Gift card delivery. Fired by ghostmark/src/subscribers/gift-card-code.ts
      // once the redeemable promotion has actually been created. The subscriber
      // supplies:
      //   gift_card_code    - the redeemable code itself
      //   gift_card_value   - pre-formatted currency string
      //   order_display_id  - GMS-<ULID>
      //   customer_first_name
      //
      // Do not send this template speculatively. It is the only artefact the
      // customer receives in exchange for their money, so it must not go out
      // until the code behind it is redeemable.
      const subject = 'Your GhostMark Studio Gift Card'
      const bodyHtml = `
        <p style="font-size:16px;color:#111827;margin:0 0 16px;font-weight:600;">Hi {{customer_first_name}},</p>
        <p style="font-size:14px;color:#4b5563;line-height:1.6;margin:0 0 20px;">
          Thank you for your purchase. Your gift card is ready to use, and the code below is all you need at checkout.
        </p>
        <div style="background:#ffffff;border:2px solid #000000;border-radius:8px;padding:24px;margin:24px 0;text-align:center;">
          <p style="margin:0 0 10px;color:#4b5563;font-size:13px;text-transform:uppercase;letter-spacing:0.08em;">Your gift card code</p>
          <p style="margin:0;font-family:'Courier New',Courier,monospace;font-size:26px;font-weight:700;color:#000000;letter-spacing:0.12em;">{{gift_card_code}}</p>
          <p style="margin:14px 0 0;font-size:16px;font-weight:700;color:#000000;">Value: {{gift_card_value}}</p>
        </div>
        <p style="font-size:13px;color:#4b5563;line-height:1.6;margin:0 0 8px;">
          Enter the code in the discount field at checkout. Treat it like cash: anyone who has the code can spend it, so only share it with the person you bought it for.
        </p>
        <p style="font-size:13px;color:#4b5563;line-height:1.6;margin:0;">
          Purchased on order {{order_display_id}}.
        </p>
      `
      const html = renderEmailLayout({
        title: 'Your Gift Card',
        subtitle: 'Ready to spend',
        bodyHtml,
        cta: { label: 'Start Shopping', href: baseUrl },
      })
      return { subject, html, text: htmlToText(html) }
    }

    if (template === 'review-reminder') {
      // Fired by ghostmark/src/jobs/review-reminder.ts, two days after an order
      // is placed, for POD line items only. Supplies:
      //   customer_email, order_display_id, product_title, review_link,
      //   expires_in_days
      //
      // This template did not exist before. The job has been shipping since it
      // was written, and every send fell through to the generic fallback at the
      // bottom of this method, so customers received a blank
      // "This is a notification from GhostMark Studio." with no product named
      // and, crucially, no review link at all.
      const subject = 'How did we do? Review your {{product_title}}'
      const bodyHtml = `
        <p style="font-size:16px;color:#111827;margin:0 0 16px;font-weight:600;">Hi there,</p>
        <p style="font-size:14px;color:#4b5563;line-height:1.6;margin:0 0 20px;">
          Your order {{order_display_id}} should have reached you by now. If you have a moment, we would genuinely like to know how <strong style="color:#000000;">{{product_title}}</strong> turned out.
        </p>
        <div style="background:#ffffff;border:2px solid #000000;border-radius:8px;padding:20px;margin:24px 0;">
          <p style="margin:0 0 6px;color:#4b5563;font-size:13px;"><span style="font-weight:600;color:#000000;">Product:</span> {{product_title}}</p>
          <p style="margin:6px 0 0;color:#4b5563;font-size:13px;"><span style="font-weight:600;color:#000000;">Order:</span> {{order_display_id}}</p>
        </div>
        <p style="font-size:13px;color:#4b5563;line-height:1.6;margin:0;">
          Your review link expires in {{expires_in_days}} days.
        </p>
      `
      const html = renderEmailLayout({
        title: 'How did we do?',
        subtitle: 'Your feedback shapes what we print next',
        bodyHtml,
        cta: { label: 'Leave a Review', href: '{{review_link}}' },
      })
      return { subject, html, text: htmlToText(html) }
    }

    // Fallback generic template in the unified layout.
    //
    // Reaching this branch with a NAMED template is always a bug: it means a
    // caller asked for a template that does not exist here, and the customer
    // gets a content-free email instead. Silence is how `review-reminder`
    // shipped broken for its entire life, so a named miss is now logged.
    // An undefined `template` is legitimate - that is the ad-hoc `content`
    // path used by the invoice/receipt/dispatch-note send routes.
    if (template) {
      this.logger_.warn(
        `[resend] no template named "${template}" is defined; falling back to the generic notification body. The recipient will receive an email with no content.`
      )
    }

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