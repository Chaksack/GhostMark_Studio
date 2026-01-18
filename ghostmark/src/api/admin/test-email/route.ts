import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

interface TestEmailRequest {
  to: string
  template?: string
  test_data?: Record<string, any>
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const { to, template = "order-confirmation", test_data } = req.body as TestEmailRequest

    if (!to) {
      return res.status(400).json({
        message: "Missing required field: to (email address)"
      })
    }

    const notificationModuleService = req.scope.resolve(Modules.NOTIFICATION)

    // Sample test data for different templates
    const defaultTestData = {
      "order-confirmation": {
        order_display_id: "TEST-001",
        customer_first_name: "Test Customer",
        customer_email: to,
        order_total: "$125.50",
        total_quantity: 5,
        customer_type: "individual",
        items: [
          {
            title: "Custom T-Shirt",
            quantity: 3,
            unit_price: "$25.00"
          },
          {
            title: "Custom Hoodie", 
            quantity: 2,
            unit_price: "$35.00"
          }
        ]
      },
      "quote-request": {
        customer_first_name: "Test Customer",
        product_title: "Custom Apparel Bundle",
        quantity: 50,
        customer_type: "corporate",
        estimated_total: "$750.00"
      },
      "bulk-order-notification": {
        order_display_id: "BULK-001",
        customer_email: to,
        total_quantity: 100,
        order_total: "$1,250.00",
        customer_type: "corporate"
      }
    }

    const emailData = test_data || defaultTestData[template as keyof typeof defaultTestData] || {
      message: "This is a test email from GhostMark Studio notification system."
    }

    // Send test email
    await notificationModuleService.createNotifications({
      to: to,
      channel: "email",
      template: template,
      data: emailData,
    })

    return res.json({
      success: true,
      message: `Test email sent successfully to ${to}`,
      template: template,
      data: emailData
    })

  } catch (error: any) {
    console.error('Error sending test email:', error)
    return res.status(500).json({
      success: false,
      message: error?.message || "Failed to send test email",
      error: error?.stack
    })
  }
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    // Return available email templates and their sample data
    const templates = [
      {
        name: "order-confirmation",
        description: "Professional order confirmation email",
        sample_data: {
          order_display_id: "ORD-001",
          customer_first_name: "John",
          order_total: "$99.99",
          total_quantity: 3,
          customer_type: "individual"
        }
      },
      {
        name: "quote-request", 
        description: "Bulk order quote request confirmation",
        sample_data: {
          customer_first_name: "Jane",
          product_title: "Custom T-Shirts",
          quantity: 50,
          customer_type: "corporate",
          estimated_total: "$500.00"
        }
      },
      {
        name: "bulk-order-notification",
        description: "Admin alert for large orders",
        sample_data: {
          order_display_id: "BULK-001",
          customer_email: "test@example.com",
          total_quantity: 100,
          order_total: "$1,200.00",
          customer_type: "corporate"
        }
      }
    ]

    return res.json({
      success: true,
      message: "Available email templates",
      templates: templates,
      usage: {
        endpoint: "/admin/test-email",
        method: "POST",
        body: {
          to: "recipient@email.com",
          template: "order-confirmation", // optional
          test_data: {} // optional custom data
        }
      }
    })

  } catch (error: any) {
    console.error('Error getting email templates:', error)
    return res.status(500).json({
      success: false,
      message: error?.message || "Failed to get email templates"
    })
  }
}