import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

interface CustomLineItemRequest {
  variant_id: string
  quantity: number
  customer_type?: 'individual' | 'corporate'
  customization?: {
    design_areas?: string[]
    print_methods?: string[]
    colors?: number
    layers?: number
    express_delivery?: boolean
    artwork_files?: Array<{
      url: string
      type: string
      design_area: string
    }>
  }
  bulk_pricing?: {
    unit_price: number
    setup_fee: number
    total_discount: number
    tier_discount: number
  }
  metadata?: Record<string, any>
}

interface EnhancedLineItem {
  variant_id: string
  quantity: number
  unit_price: number
  title: string
  subtitle?: string
  thumbnail?: string
  customization: {
    type: 'pod' | 'standard'
    design_areas: string[]
    print_methods: string[]
    colors: number
    layers: number
    express_delivery: boolean
    setup_fee: number
    customization_fee: number
  }
  pricing: {
    base_price: number
    customization_price: number
    setup_fee: number
    express_delivery_fee: number
    bulk_discount: number
    total_unit_price: number
  }
  metadata: Record<string, any>
}

// Mock cart storage (in production, this would integrate with Medusa cart service)
const mockCarts: Record<string, any> = {}

const calculateCustomLineItemPricing = (request: CustomLineItemRequest) => {
  const basePrice = 12.99 // Mock base price
  const customizationFee = (request.customization?.colors || 1) * 0.75 + 
                          (request.customization?.layers || 1) * 1.25
  const setupFee = request.bulk_pricing?.setup_fee || 5.00
  const expressDeliveryFee = request.customization?.express_delivery ? 25.00 : 0
  const bulkDiscount = request.bulk_pricing?.total_discount || 0

  const subtotal = (basePrice + customizationFee) * request.quantity
  const discountAmount = (subtotal * bulkDiscount) / 100
  const totalPrice = subtotal - discountAmount + setupFee + expressDeliveryFee

  return {
    base_price: basePrice,
    customization_price: customizationFee,
    setup_fee: setupFee,
    express_delivery_fee: expressDeliveryFee,
    bulk_discount: discountAmount,
    total_unit_price: totalPrice / request.quantity
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const { id: cartId } = req.params
    const requestData = req.body as CustomLineItemRequest

    if (!cartId) {
      return res.status(400).json({ message: "Cart ID is required" })
    }

    if (!requestData.variant_id || !requestData.quantity) {
      return res.status(400).json({
        message: "Missing required fields: variant_id, quantity"
      })
    }

    // Initialize cart if doesn't exist
    if (!mockCarts[cartId]) {
      mockCarts[cartId] = {
        id: cartId,
        items: [],
        customer_type: 'individual',
        region: 'us',
        currency: 'usd',
        totals: {
          subtotal: 0,
          tax: 0,
          total: 0
        }
      }
    }

    const cart = mockCarts[cartId]
    
    // Calculate pricing
    const pricing = calculateCustomLineItemPricing(requestData)

    // Create enhanced line item
    const lineItem: EnhancedLineItem = {
      variant_id: requestData.variant_id,
      quantity: requestData.quantity,
      unit_price: pricing.total_unit_price,
      title: `Custom Product - ${requestData.customization?.print_methods?.join(', ') || 'Standard'}`,
      subtitle: `${requestData.quantity} units`,
      customization: {
        type: 'pod',
        design_areas: requestData.customization?.design_areas || ['front'],
        print_methods: requestData.customization?.print_methods || ['dtg'],
        colors: requestData.customization?.colors || 1,
        layers: requestData.customization?.layers || 1,
        express_delivery: requestData.customization?.express_delivery || false,
        setup_fee: pricing.setup_fee,
        customization_fee: pricing.customization_price
      },
      pricing,
      metadata: {
        customer_type: requestData.customer_type || 'individual',
        bulk_tier: requestData.quantity >= 100 ? 'enterprise' : 
                  requestData.quantity >= 50 ? 'bulk' :
                  requestData.quantity >= 25 ? 'volume' : 'standard',
        created_at: new Date().toISOString(),
        ...requestData.metadata
      }
    }

    // Add to cart
    cart.items.push(lineItem)
    cart.customer_type = requestData.customer_type || cart.customer_type

    // Recalculate cart totals
    const subtotal = cart.items.reduce((sum: number, item: EnhancedLineItem) => 
      sum + (item.unit_price * item.quantity), 0)
    const tax = subtotal * 0.08 // 8% tax
    const total = subtotal + tax

    cart.totals = {
      subtotal: Math.round(subtotal * 100) / 100,
      tax: Math.round(tax * 100) / 100,
      total: Math.round(total * 100) / 100
    }

    // Response format similar to Medusa's cart structure
    return res.status(201).json({
      cart: {
        ...cart,
        total: cart.totals.total,
        subtotal: cart.totals.subtotal,
        tax_total: cart.totals.tax,
        item_count: cart.items.length,
        items: cart.items.map((item: EnhancedLineItem) => ({
          id: `item_${Date.now()}_${Math.random()}`,
          title: item.title,
          subtitle: item.subtitle,
          thumbnail: item.thumbnail,
          variant: {
            id: item.variant_id,
            title: item.title
          },
          quantity: item.quantity,
          unit_price: Math.round(item.unit_price * 100), // Medusa uses cents
          total: Math.round(item.unit_price * item.quantity * 100),
          metadata: {
            ...item.metadata,
            customization: item.customization,
            pricing_breakdown: item.pricing
          }
        }))
      }
    })

  } catch (error: any) {
    console.error('Error adding custom line item:', error)
    return res.status(500).json({
      message: error?.message || "Failed to add custom item to cart"
    })
  }
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const { id: cartId } = req.params

    if (!cartId) {
      return res.status(400).json({ message: "Cart ID is required" })
    }

    const cart = mockCarts[cartId]
    
    if (!cart) {
      return res.status(404).json({ message: "Cart not found" })
    }

    return res.json({
      cart: {
        ...cart,
        items: cart.items.map((item: EnhancedLineItem) => ({
          id: `item_${item.variant_id}`,
          title: item.title,
          subtitle: item.subtitle,
          variant: { id: item.variant_id },
          quantity: item.quantity,
          unit_price: Math.round(item.unit_price * 100),
          total: Math.round(item.unit_price * item.quantity * 100),
          metadata: {
            ...item.metadata,
            customization: item.customization,
            pricing_breakdown: item.pricing
          }
        }))
      }
    })

  } catch (error: any) {
    console.error('Error fetching cart:', error)
    return res.status(500).json({
      message: error?.message || "Failed to fetch cart"
    })
  }
}