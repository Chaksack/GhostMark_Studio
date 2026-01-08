import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { DesignPricingService } from "../../../services/design-pricing-service"

interface QuoteFile {
  type: 'default' | 'front' | 'back' | 'left_sleeve' | 'right_sleeve' | 'neck' | 'pocket'
  url: string
  areaId?: string
  metadata?: {
    dpi?: number
    qualityScore?: number
    isPrintReady?: boolean
    suggestedUse?: string
    width?: number
    height?: number
    fileSize?: number
    format?: string
  }
}

interface QuoteProduct {
  itemReferenceId: string
  productTypeId: string
  variantId?: string
  files: QuoteFile[]
  quantity: number
  printMethod?: string
}

interface QuoteRequest {
  quoteReferenceId: string
  currency?: string
  products: QuoteProduct[]
  urgent?: boolean
  allowMultipleQuotes?: boolean
  shipmentMethod?: string
}

interface QuoteResponse {
  quoteReferenceId: string
  quotes: Array<{
    id: string
    itemReferenceIds: string[]
    products: Array<{
      itemReferenceId: string
      productTypeId: string
      quantity: number
      price: number
      currency: string
      breakdown: {
        basePrice: number
        designPrice: number
        setupFees: number
        qualityAdjustments?: number
        groupSavings?: number
      }
    }>
    totals: {
      subtotal: number
      setupFees: number
      total: number
      currency: string
      savings?: number
    }
    estimatedFulfillmentDays: {
      min: number
      max: number
    }
  }>
  errors?: string[]
}

// POST /store/design-quote - Get pricing quote for design products (Gelato-inspired)
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const { 
      quoteReferenceId, 
      currency = 'USD',
      products, 
      urgent = false,
      allowMultipleQuotes = false,
      shipmentMethod = 'standard'
    } = req.body as QuoteRequest

    if (!quoteReferenceId || !products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({
        error: "Missing required fields: quoteReferenceId, products (non-empty array)"
      })
    }

    // Validate products
    for (const product of products) {
      if (!product.itemReferenceId || !product.productTypeId || !product.files || !Array.isArray(product.files)) {
        return res.status(400).json({
          error: "Each product must have itemReferenceId, productTypeId, and files array"
        })
      }
      
      if (product.quantity < 1) {
        return res.status(400).json({
          error: "Product quantity must be at least 1"
        })
      }

      // Validate files
      for (const file of product.files) {
        if (!file.type || !file.url) {
          return res.status(400).json({
            error: "Each file must have type and url"
          })
        }
      }
    }

    const pricingService = new DesignPricingService(req.scope)
    const quotes: QuoteResponse['quotes'] = []
    const errors: string[] = []

    // Process each product and calculate pricing
    for (const product of products) {
      try {
        // Convert files to design submissions
        const designs = await Promise.all(product.files.map(async (file, index) => {
          // Map file type to area type and get area ID
          let areaType = file.type
          if (file.type === 'default') areaType = 'front'
          
          return {
            areaId: file.areaId || `${areaType}_${index}`,
            areaType: areaType as any,
            layers: 1, // Default to 1 layer per file
            colors: await estimateColorsFromFile(file.url),
            printMethod: product.printMethod || 'digital',
            fileUrl: file.url,
            fileType: file.type,
            imageMetadata: file.metadata
          }
        }))

        // Calculate pricing
        const pricing = await pricingService.calculatePricing(
          product.productTypeId, 
          designs, 
          product.quantity,
          {
            currency,
            urgent,
            shipmentMethod
          }
        )

        // Create quote product
        const quoteProduct = {
          itemReferenceId: product.itemReferenceId,
          productTypeId: product.productTypeId,
          quantity: product.quantity,
          price: pricing.totals.total,
          currency: pricing.totals.currency,
          breakdown: {
            basePrice: pricing.totals.subtotal - pricing.totals.setupFees,
            designPrice: pricing.totals.subtotal,
            setupFees: pricing.totals.setupFees,
            qualityAdjustments: pricing.areaBreakdown.reduce((sum, area) => {
              return sum + ((area as any).qualityAdjustment?.multiplier || 1) - 1
            }, 0),
            groupSavings: pricing.totals.savings
          }
        }

        // Check if we need separate quotes or can combine
        const existingQuote = quotes.find(q => q.products.length === 0 || allowMultipleQuotes)
        
        if (existingQuote && !allowMultipleQuotes) {
          existingQuote.products.push(quoteProduct)
          existingQuote.itemReferenceIds.push(product.itemReferenceId)
          existingQuote.totals.subtotal += pricing.totals.subtotal
          existingQuote.totals.setupFees += pricing.totals.setupFees
          existingQuote.totals.total += pricing.totals.total
          if (pricing.totals.savings) {
            existingQuote.totals.savings = (existingQuote.totals.savings || 0) + pricing.totals.savings
          }
        } else {
          // Create new quote
          const newQuote = {
            id: `quote_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            itemReferenceIds: [product.itemReferenceId],
            products: [quoteProduct],
            totals: {
              subtotal: pricing.totals.subtotal,
              setupFees: pricing.totals.setupFees,
              total: pricing.totals.total,
              currency: pricing.totals.currency,
              savings: pricing.totals.savings
            },
            estimatedFulfillmentDays: {
              min: urgent ? 1 : 3,
              max: urgent ? 3 : 7
            }
          }
          quotes.push(newQuote)
        }

      } catch (error: any) {
        errors.push(`Product ${product.itemReferenceId}: ${error.message}`)
      }
    }

    const response: QuoteResponse = {
      quoteReferenceId,
      quotes,
      ...(errors.length > 0 && { errors })
    }

    res.json(response)

  } catch (error: any) {
    console.error('Design quote calculation error:', error)
    res.status(500).json({
      error: "Failed to calculate design quote",
      message: error.message
    })
  }
}

// Helper function to estimate colors from a file URL (placeholder)
async function estimateColorsFromFile(fileUrl: string): Promise<number> {
  // In a real implementation, this would analyze the image
  // For now, return a reasonable default
  return 3
}