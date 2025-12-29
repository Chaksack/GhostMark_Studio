import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const productModuleService = req.scope.resolve(Modules.PRODUCT)
    const pricingModuleService = req.scope.resolve(Modules.PRICING)

    const { product_id, variant_id } = req.query

    if (!product_id) {
      return res.status(400).json({
        success: false,
        message: "product_id parameter is required"
      })
    }

    // Get product with variants
    const products = await productModuleService.listProducts(
      { id: [product_id as string] },
      { relations: ["variants"] }
    )

    if (products.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      })
    }

    const product = products[0]
    
    // Get all price lists to see what's available
    const priceLists = await pricingModuleService.listPriceLists({
      status: "active"
    }, {
      relations: ["prices"]
    })

    // Get price sets if variants exist
    const debugData: any = {
      product: {
        id: product.id,
        title: product.title,
        variants_count: product.variants?.length || 0
      },
      price_lists: priceLists.map((pl: any) => ({
        id: pl.id,
        title: pl.title,
        type: pl.type,
        status: pl.status,
        prices_count: pl.prices?.length || 0
      })),
      pricing_debug: {}
    }

    // If specific variant requested, get its pricing details
    if (variant_id && product.variants) {
      const variant = product.variants.find((v: any) => v.id === variant_id)
      if (variant) {
        debugData.variant_debug = {
          id: variant.id,
          title: variant.title,
          price_set_id: (variant as any).price_set_id,
          raw_variant_data: variant
        }
      }
    }

    // Test price calculation if we have a valid context
    if (product.variants && product.variants.length > 0) {
      const firstVariant = product.variants[0]
      debugData.first_variant_raw = firstVariant
    }

    return res.json({
      success: true,
      debug_info: debugData,
      note: "This endpoint shows the raw structure of products and pricing data for debugging"
    })

  } catch (error: any) {
    console.error('Debug endpoint error:', error)
    return res.status(500).json({
      success: false,
      message: error?.message || "Debug endpoint failed",
      error: error?.stack
    })
  }
}