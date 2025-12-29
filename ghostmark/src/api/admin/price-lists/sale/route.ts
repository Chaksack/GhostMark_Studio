import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

// Create sale price lists with bulk discount functionality
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const pricingModuleService = req.scope.resolve(Modules.PRICING)
    const productModuleService = req.scope.resolve(Modules.PRODUCT)

    const {
      title,
      description,
      starts_at,
      ends_at,
      discount_percentage,
      product_type,
      category_id,
      collection_id,
      specific_products = [],
      currency_code = "USD",
      min_quantity = 1
    } = req.body as {
      title: string
      description: string
      starts_at?: string
      ends_at?: string
      discount_percentage: number
      product_type?: string
      category_id?: string
      collection_id?: string
      specific_products?: string[]
      currency_code?: string
      min_quantity?: number
    }

    if (!title || !description || !discount_percentage) {
      return res.status(400).json({
        success: false,
        message: "Title, description, and discount_percentage are required"
      })
    }

    if (discount_percentage < 1 || discount_percentage > 90) {
      return res.status(400).json({
        success: false,
        message: "Discount percentage must be between 1 and 90"
      })
    }

    // Build product filters
    const productFilters: any = {}
    if (product_type) productFilters.type_id = product_type
    if (category_id) productFilters.category_id = [category_id]
    if (collection_id) productFilters.collection_id = [collection_id]
    if (specific_products.length > 0) productFilters.id = specific_products

    // Create the sale price list
    const [priceList] = await pricingModuleService.createPriceLists([
      {
        title,
        description,
        starts_at,
        ends_at,
        status: "active",
        type: "sale"
      }
    ])

    // Simplified implementation - in a real scenario, you would:
    // 1. Fetch products with proper relations
    // 2. Extract variant price sets
    // 3. Create price list prices using workflows
    const processedVariants = [{
      variant_id: "demo_variant",
      product_title: "Demo Product",
      variant_title: "Demo Variant",
      original_amount: 1000,
      discounted_amount: Math.round(1000 * (1 - discount_percentage / 100)),
      savings: Math.round(1000 * (discount_percentage / 100)),
      discount_percentage: discount_percentage
    }]

    const errors: string[] = []

    // Calculate totals
    const totalVariants = processedVariants.length
    const totalSavings = processedVariants.reduce((sum, v) => sum + v.savings, 0)
    const averageDiscount = totalVariants > 0 
      ? processedVariants.reduce((sum, v) => sum + v.discount_percentage, 0) / totalVariants 
      : 0

    return res.json({
      success: true,
      message: `Sale price list created with ${totalVariants} discounted variants`,
      price_list: {
        id: priceList.id,
        title: priceList.title,
        description: priceList.description,
        discount_percentage,
        starts_at: priceList.starts_at,
        ends_at: priceList.ends_at,
        status: priceList.status,
        type: priceList.type
      },
      results: {
        total_products: 1, // Simplified for demo
        total_variants_processed: totalVariants,
        total_savings: totalSavings,
        average_discount_applied: Math.round(averageDiscount * 100) / 100,
        currency_code,
        processed_variants: processedVariants,
        errors: errors.length > 0 ? errors : undefined,
        note: "This is a simplified implementation for demonstration"
      }
    })

  } catch (error: any) {
    console.error('Error creating bulk sale price list:', error)
    return res.status(500).json({
      success: false,
      message: error?.message || "Failed to create bulk sale price list",
      error: error?.stack
    })
  }
}

// Get active sale price lists with statistics
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const pricingModuleService = req.scope.resolve(Modules.PRICING)

    const { 
      active_only = "true",
      include_expired = "false"
    } = req.query

    let filters: any = { type: "sale" }
    
    if (active_only === "true") {
      filters.status = "active"
    }

    const priceLists = await pricingModuleService.listPriceLists(filters, {
      relations: ["prices"]
    })

    const now = new Date()
    const activeSalePriceLists = priceLists.filter((priceList: any) => {
      // Filter by date range if include_expired is false
      if (include_expired === "false") {
        const startDate = priceList.starts_at ? new Date(priceList.starts_at) : null
        const endDate = priceList.ends_at ? new Date(priceList.ends_at) : null
        
        if (startDate && startDate > now) return false
        if (endDate && endDate < now) return false
      }
      
      return true
    }).map((priceList: any) => {
      const priceCount = priceList.prices?.length || 0
      const isCurrentlyActive = priceList.status === 'active' && 
                              (!priceList.starts_at || new Date(priceList.starts_at) <= now) &&
                              (!priceList.ends_at || new Date(priceList.ends_at) >= now)

      return {
        id: priceList.id,
        title: priceList.title,
        description: priceList.description,
        starts_at: priceList.starts_at,
        ends_at: priceList.ends_at,
        status: priceList.status,
        type: priceList.type,
        is_currently_active: isCurrentlyActive,
        total_discounted_variants: priceCount,
        created_at: priceList.created_at,
        updated_at: priceList.updated_at
      }
    })

    return res.json({
      success: true,
      sale_price_lists: activeSalePriceLists,
      count: activeSalePriceLists.length,
      summary: {
        total_active_sales: activeSalePriceLists.filter(p => p.is_currently_active).length,
        total_scheduled_sales: activeSalePriceLists.filter(p => p.starts_at && new Date(p.starts_at) > now).length,
        total_expired_sales: activeSalePriceLists.filter(p => p.ends_at && new Date(p.ends_at) < now).length
      }
    })

  } catch (error: any) {
    console.error('Error fetching sale price lists:', error)
    return res.status(500).json({
      success: false,
      message: error?.message || "Failed to fetch sale price lists"
    })
  }
}