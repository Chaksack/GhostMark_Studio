import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const pricingModuleService = req.scope.resolve(Modules.PRICING)
    const productModuleService = req.scope.resolve(Modules.PRODUCT)

    const {
      title,
      description,
      starts_at,
      ends_at,
      status = "active",
      type = "sale",
      variant_discounts = []
    } = req.body as {
      title: string
      description: string
      starts_at?: string
      ends_at?: string
      status?: string
      type?: string
      variant_discounts?: Array<{
        variant_id: string
        discount_percentage: number
        currency_code?: string
      }>
    }

    if (!title || !description) {
      return res.status(400).json({
        success: false,
        message: "Title and description are required"
      })
    }

    // Create the price list first
    const [priceList] = await pricingModuleService.createPriceLists([
      {
        title,
        description,
        starts_at,
        ends_at,
        status,
        type
      }
    ])

    // Note: Price creation would be handled differently in a real implementation
    // This is a simplified version for demonstration
    const createdPrices: Array<{
      variant_id: string
      original_amount: number
      discounted_amount: number
      discount_percentage: number
      currency_code: string
      message: string
    }> = []

    if (variant_discounts.length > 0) {
      for (const discount of variant_discounts) {
        const { variant_id, discount_percentage, currency_code = "USD" } = discount

        // In a real implementation, you would:
        // 1. Get variant's current price from price sets
        // 2. Calculate discounted amount
        // 3. Create price list prices using proper price set workflow
        
        // For now, we'll simulate this
        const simulatedCurrentPrice = 1000 // This would come from actual variant data
        const discountDecimal = discount_percentage / 100
        const discountedAmount = Math.round(simulatedCurrentPrice * (1 - discountDecimal))

        createdPrices.push({
          variant_id,
          original_amount: simulatedCurrentPrice,
          discounted_amount: discountedAmount,
          discount_percentage,
          currency_code,
          message: "Price list created - actual price application requires workflow implementation"
        })
      }
    }

    return res.json({
      success: true,
      message: "Sale price list created successfully",
      price_list: {
        id: priceList.id,
        title: priceList.title,
        description: priceList.description,
        starts_at: priceList.starts_at,
        ends_at: priceList.ends_at,
        status: priceList.status,
        type: priceList.type,
        created_prices: createdPrices
      }
    })

  } catch (error: any) {
    console.error('Error creating sale price list:', error)
    return res.status(500).json({
      success: false,
      message: error?.message || "Failed to create sale price list",
      error: error?.stack
    })
  }
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const pricingModuleService = req.scope.resolve(Modules.PRICING)

    const { 
      limit = 20, 
      offset = 0, 
      status, 
      type 
    } = req.query

    const filters: any = {}
    if (status) filters.status = status
    if (type) filters.type = type

    const priceLists = await pricingModuleService.listPriceLists(filters, {
      take: Number(limit),
      skip: Number(offset),
      relations: ["prices", "price_list_rules"]
    })

    // Enhance price lists with pricing statistics
    const enhancedPriceLists = await Promise.all(
      priceLists.map(async (priceList: any) => {
        const priceCount = priceList.prices?.length || 0
        const activeRulesCount = priceList.price_list_rules?.length || 0
        
        // Calculate savings if it's a sale price list
        let totalSavings = 0
        if (priceList.type === 'sale' && priceList.prices) {
          for (const price of priceList.prices) {
            if (price.original_amount && price.calculated_amount) {
              totalSavings += price.original_amount - price.calculated_amount
            }
          }
        }

        return {
          ...priceList,
          statistics: {
            total_prices: priceCount,
            active_rules: activeRulesCount,
            total_savings: totalSavings,
            is_active: priceList.status === 'active' && 
                      (!priceList.starts_at || new Date(priceList.starts_at) <= new Date()) &&
                      (!priceList.ends_at || new Date(priceList.ends_at) >= new Date())
          }
        }
      })
    )

    return res.json({
      success: true,
      price_lists: enhancedPriceLists,
      count: enhancedPriceLists.length,
      pagination: {
        limit: Number(limit),
        offset: Number(offset),
        has_more: enhancedPriceLists.length === Number(limit)
      }
    })

  } catch (error: any) {
    console.error('Error fetching price lists:', error)
    return res.status(500).json({
      success: false,
      message: error?.message || "Failed to fetch price lists"
    })
  }
}