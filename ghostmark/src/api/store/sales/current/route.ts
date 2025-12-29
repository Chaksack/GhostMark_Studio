import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

// Get current active sales and discounted products
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const pricingModuleService = req.scope.resolve(Modules.PRICING)
    const productModuleService = req.scope.resolve(Modules.PRODUCT)

    const { 
      product_id,
      variant_id,
      category_id,
      product_type,
      limit = 50 
    } = req.query

    const now = new Date()

    // Get active sale price lists
    const salePriceLists = await pricingModuleService.listPriceLists({
      type: "sale",
      status: "active"
    }, {
      relations: ["prices"]
    })

    // Filter by date range
    const activeSalePriceLists = salePriceLists.filter((priceList: any) => {
      const startDate = priceList.starts_at ? new Date(priceList.starts_at) : null
      const endDate = priceList.ends_at ? new Date(priceList.ends_at) : null
      
      if (startDate && startDate > now) return false
      if (endDate && endDate < now) return false
      
      return true
    })

    if (activeSalePriceLists.length === 0) {
      return res.json({
        success: true,
        message: "No active sales found",
        current_sales: [],
        discounted_products: [],
        count: 0
      })
    }

    // Collect all sale prices
    const allSalePrices: any[] = []
    activeSalePriceLists.forEach((priceList: any) => {
      if (priceList.prices) {
        priceList.prices.forEach((price: any) => {
          allSalePrices.push({
            ...price,
            price_list_id: priceList.id,
            price_list_title: priceList.title,
            price_list_description: priceList.description,
            sale_ends_at: priceList.ends_at
          })
        })
      }
    })

    // If specific product/variant requested, filter prices
    if (product_id || variant_id) {
      let filteredPrices = allSalePrices

      if (variant_id) {
        // Get the variant's price set ID
        const variants = await productModuleService.listProductVariants({ id: [variant_id] })
        if (variants.length > 0) {
          const priceSetId = variants[0].price_set_id
          filteredPrices = allSalePrices.filter(price => price.price_set_id === priceSetId)
        }
      } else if (product_id) {
        // Get all variants for the product
        const products = await productModuleService.listProducts({ id: [product_id] }, {
          relations: ["variants"]
        })
        
        if (products.length > 0 && products[0].variants) {
          const priceSetIds = products[0].variants.map((v: any) => v.price_set_id).filter(Boolean)
          filteredPrices = allSalePrices.filter(price => priceSetIds.includes(price.price_set_id))
        }
      }

      return res.json({
        success: true,
        sale_prices: filteredPrices,
        count: filteredPrices.length
      })
    }

    // Get products with sale pricing
    const productFilters: any = {}
    if (category_id) productFilters.category_id = [category_id]
    if (product_type) productFilters.type_id = product_type

    const products = await productModuleService.listProducts(productFilters, {
      relations: ["variants", "variants.calculated_price"],
      take: Number(limit)
    })

    // Match products with sale prices
    const discountedProducts: Array<{
      product_id: string
      product_title: string
      product_handle: string
      total_discounted_variants: number
      best_discount_percentage: number
      max_savings: number
      sale_ends_at: string | null
      variant_discounts: Array<{
        variant_id: string
        variant_title: string
        original_price: number
        sale_price: number
        savings: number
        discount_percentage: number
        currency_code: string
        price_list_title: string
        sale_ends_at: string | null
      }>
    }> = []
    
    for (const product of products) {
      if (!product.variants) continue

      const productDiscounts = []
      
      for (const variant of product.variants) {
        if (!variant.price_set_id) continue

        // Check if this variant has sale pricing
        const salePrices = allSalePrices.filter(price => price.price_set_id === variant.price_set_id)
        
        if (salePrices.length > 0) {
          const bestSalePrice = salePrices.reduce((best, current) => 
            current.amount < best.amount ? current : best
          )

          // Get original price
          const originalPrice = variant.calculated_price?.original_amount || variant.calculated_price?.calculated_amount

          if (originalPrice && originalPrice > bestSalePrice.amount) {
            const savings = originalPrice - bestSalePrice.amount
            const discountPercentage = Math.round((savings / originalPrice) * 100)

            productDiscounts.push({
              variant_id: variant.id,
              variant_title: variant.title,
              original_price: originalPrice,
              sale_price: bestSalePrice.amount,
              savings,
              discount_percentage: discountPercentage,
              currency_code: bestSalePrice.currency_code,
              price_list_title: bestSalePrice.price_list_title,
              sale_ends_at: bestSalePrice.sale_ends_at
            })
          }
        }
      }

      if (productDiscounts.length > 0) {
        // Get best discount for product-level stats
        const bestDiscount = productDiscounts.reduce((best, current) => 
          current.discount_percentage > best.discount_percentage ? current : best
        )

        discountedProducts.push({
          product_id: product.id,
          product_title: product.title,
          product_handle: (product as any).handle,
          total_discounted_variants: productDiscounts.length,
          best_discount_percentage: bestDiscount.discount_percentage,
          max_savings: Math.max(...productDiscounts.map(d => d.savings)),
          sale_ends_at: bestDiscount.sale_ends_at,
          variant_discounts: productDiscounts
        })
      }
    }

    // Sort by best discount
    discountedProducts.sort((a, b) => b.best_discount_percentage - a.best_discount_percentage)

    return res.json({
      success: true,
      current_sales: activeSalePriceLists.map((priceList: any) => ({
        id: priceList.id,
        title: priceList.title,
        description: priceList.description,
        starts_at: priceList.starts_at,
        ends_at: priceList.ends_at,
        total_discounted_items: priceList.prices?.length || 0
      })),
      discounted_products,
      count: discountedProducts.length,
      summary: {
        total_active_sales: activeSalePriceLists.length,
        total_discounted_products: discountedProducts.length,
        best_discount: discountedProducts.length > 0 ? discountedProducts[0].best_discount_percentage : 0,
        total_variants_on_sale: discountedProducts.reduce((sum, p) => sum + p.total_discounted_variants, 0)
      }
    })

  } catch (error: any) {
    console.error('Error fetching current sales:', error)
    return res.status(500).json({
      success: false,
      message: error?.message || "Failed to fetch current sales"
    })
  }
}