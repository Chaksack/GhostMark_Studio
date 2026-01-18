import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

// Create a simple test sale to verify price list functionality
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const pricingModuleService = req.scope.resolve(Modules.PRICING)

    // Create a simple test sale price list
    const [testPriceList] = await pricingModuleService.createPriceLists([
      {
        title: "Test Sale - 20% Off",
        description: "Test sale to verify price list functionality",
        status: "active",
        type: "sale",
        starts_at: new Date().toISOString(),
        ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
      }
    ])

    // Get existing price lists to show what we have
    const existingPriceLists = await pricingModuleService.listPriceLists({}, {
      relations: ["prices"]
    })

    return res.json({
      success: true,
      message: "Test sale price list created successfully",
      created_price_list: {
        id: testPriceList.id,
        title: testPriceList.title,
        description: testPriceList.description,
        type: testPriceList.type,
        status: testPriceList.status,
        starts_at: testPriceList.starts_at,
        ends_at: testPriceList.ends_at
      },
      existing_price_lists: existingPriceLists.map((pl: any) => ({
        id: pl.id,
        title: pl.title,
        type: pl.type,
        status: pl.status,
        prices_count: pl.prices?.length || 0
      })),
      next_steps: [
        "1. Use the admin dashboard or API to add products to this price list",
        "2. Set discounted prices for specific variants",
        "3. The storefront should automatically show sale pricing for listed items",
        "4. Use /api/debug/product-pricing?product_id=<id> to verify pricing data"
      ]
    })

  } catch (error: any) {
    console.error('Error creating test sale:', error)
    return res.status(500).json({
      success: false,
      message: error?.message || "Failed to create test sale",
      error: error?.stack
    })
  }
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const pricingModuleService = req.scope.resolve(Modules.PRICING)

    // Get all price lists
    const priceLists = await pricingModuleService.listPriceLists({}, {
      relations: ["prices"]
    })

    return res.json({
      success: true,
      price_lists: priceLists.map((pl: any) => ({
        id: pl.id,
        title: pl.title,
        description: pl.description,
        type: pl.type,
        status: pl.status,
        starts_at: pl.starts_at,
        ends_at: pl.ends_at,
        prices_count: pl.prices?.length || 0,
        is_currently_active: pl.status === 'active' && 
                           (!pl.starts_at || new Date(pl.starts_at) <= new Date()) &&
                           (!pl.ends_at || new Date(pl.ends_at) >= new Date())
      })),
      instructions: {
        create_test_sale: "POST to this endpoint to create a test sale price list",
        add_prices: "Use the admin dashboard to add specific product prices to the price list",
        verify_storefront: "Check the storefront to see if sale pricing appears"
      }
    })

  } catch (error: any) {
    console.error('Error getting price lists:', error)
    return res.status(500).json({
      success: false,
      message: error?.message || "Failed to get price lists"
    })
  }
}