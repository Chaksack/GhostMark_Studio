import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

interface BulkPricingRequest {
  productId: string
  variantId: string
  quantity: number
  designAreas?: string[]
  printMethods?: string[]
  customization?: {
    colors: number
    layers: number
    expressDelivery?: boolean
  }
  customerType?: 'individual' | 'corporate'
}

interface PricingTier {
  minQuantity: number
  maxQuantity?: number
  pricePerUnit: number
  setupFee: number
  discount?: {
    type: 'percentage' | 'fixed'
    amount: number
  }
}

interface BulkPricingResponse {
  productId: string
  variantId: string
  quantity: number
  pricing: {
    unitPrice: number
    setupFee: number
    subtotal: number
    discounts: {
      quantity: number
      corporate?: number
      bulk?: number
      total: number
    }
    expressDelivery?: number
    tax?: number
    total: number
    savings: number
  }
  availableTiers: PricingTier[]
  nextTierDiscount?: {
    quantity: number
    savings: number
  }
}

// Mock pricing tiers similar to clothes2order.com
const getStandardPricingTiers = (): PricingTier[] => [
  {
    minQuantity: 1,
    maxQuantity: 9,
    pricePerUnit: 12.99,
    setupFee: 25.00,
  },
  {
    minQuantity: 10,
    maxQuantity: 24,
    pricePerUnit: 11.49,
    setupFee: 20.00,
    discount: { type: 'percentage', amount: 12 }
  },
  {
    minQuantity: 25,
    maxQuantity: 49,
    pricePerUnit: 9.99,
    setupFee: 15.00,
    discount: { type: 'percentage', amount: 23 }
  },
  {
    minQuantity: 50,
    maxQuantity: 99,
    pricePerUnit: 8.49,
    setupFee: 10.00,
    discount: { type: 'percentage', amount: 35 }
  },
  {
    minQuantity: 100,
    maxQuantity: 249,
    pricePerUnit: 7.49,
    setupFee: 5.00,
    discount: { type: 'percentage', amount: 42 }
  },
  {
    minQuantity: 250,
    maxQuantity: 499,
    pricePerUnit: 6.99,
    setupFee: 0.00,
    discount: { type: 'percentage', amount: 46 }
  },
  {
    minQuantity: 500,
    pricePerUnit: 5.99,
    setupFee: 0.00,
    discount: { type: 'percentage', amount: 54 }
  }
]

const calculateBulkPricing = (request: BulkPricingRequest): BulkPricingResponse => {
  const tiers = getStandardPricingTiers()
  const applicableTier = tiers
    .reverse()
    .find(tier => request.quantity >= tier.minQuantity) || tiers[0]

  const baseUnitPrice = applicableTier.pricePerUnit
  const setupFee = applicableTier.setupFee
  
  // Additional costs for customization
  let customizationCost = 0
  if (request.customization) {
    const { colors = 1, layers = 1 } = request.customization
    customizationCost = (colors - 1) * 0.50 + (layers - 1) * 1.25
  }

  const unitPrice = baseUnitPrice + customizationCost
  const subtotal = (unitPrice * request.quantity) + setupFee

  // Calculate discounts
  const quantityDiscount = applicableTier.discount?.amount || 0
  const corporateDiscount = request.customerType === 'corporate' ? 5 : 0
  const bulkDiscount = request.quantity >= 100 ? 3 : 0
  const totalDiscountPercentage = quantityDiscount + corporateDiscount + bulkDiscount

  const discountAmount = (subtotal * totalDiscountPercentage) / 100
  const expressDeliveryFee = request.customization?.expressDelivery ? 25.00 : 0
  
  const total = subtotal - discountAmount + expressDeliveryFee
  const baseTotal = (12.99 * request.quantity) + 25.00 // Standard pricing
  const savings = Math.max(0, baseTotal - total)

  // Find next tier for upselling
  const nextTier = tiers.find(tier => 
    tier.minQuantity > request.quantity && 
    (!tier.maxQuantity || request.quantity < tier.maxQuantity)
  )

  return {
    productId: request.productId,
    variantId: request.variantId,
    quantity: request.quantity,
    pricing: {
      unitPrice,
      setupFee,
      subtotal,
      discounts: {
        quantity: quantityDiscount,
        corporate: corporateDiscount || undefined,
        bulk: bulkDiscount || undefined,
        total: totalDiscountPercentage
      },
      expressDelivery: expressDeliveryFee || undefined,
      total,
      savings
    },
    availableTiers: tiers.reverse(),
    nextTierDiscount: nextTier ? {
      quantity: nextTier.minQuantity,
      savings: ((12.99 * nextTier.minQuantity) + 25.00) - 
               ((nextTier.pricePerUnit * nextTier.minQuantity) + nextTier.setupFee)
    } : undefined
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const requestData = req.body as BulkPricingRequest

    if (!requestData.productId || !requestData.variantId || !requestData.quantity) {
      return res.status(400).json({
        message: "Missing required fields: productId, variantId, quantity"
      })
    }

    if (requestData.quantity < 1) {
      return res.status(400).json({
        message: "Quantity must be at least 1"
      })
    }

    const bulkPricing = calculateBulkPricing(requestData)

    return res.json({
      success: true,
      data: bulkPricing,
      message: "Bulk pricing calculated successfully"
    })

  } catch (error: any) {
    console.error('Error calculating bulk pricing:', error)
    return res.status(500).json({
      message: error?.message || "Failed to calculate bulk pricing"
    })
  }
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const { productId, variantId, quantity = 1 } = req.query

    if (!productId || !variantId) {
      return res.status(400).json({
        message: "Missing required query parameters: productId, variantId"
      })
    }

    const requestData: BulkPricingRequest = {
      productId: productId as string,
      variantId: variantId as string,
      quantity: parseInt(quantity as string),
      customerType: req.query.customerType as 'individual' | 'corporate' || 'individual'
    }

    const bulkPricing = calculateBulkPricing(requestData)

    return res.json({
      success: true,
      data: bulkPricing,
      availableTiers: getStandardPricingTiers()
    })

  } catch (error: any) {
    console.error('Error fetching bulk pricing:', error)
    return res.status(500).json({
      message: error?.message || "Failed to fetch bulk pricing"
    })
  }
}