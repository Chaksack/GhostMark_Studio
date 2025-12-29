import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

// Setup predefined apparel product types with metadata for clothes2order.com-style functionality
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const productModuleService = req.scope.resolve(Modules.PRODUCT)

    // Define apparel product types with enhanced metadata
    const apparelProductTypes = [
      {
        value: "apparel",
        metadata: {
          category: "clothing",
          target_market: "both", // individual + corporate
          bulk_available: true,
          min_bulk_quantity: 10,
          print_methods: ["dtg", "screen_print", "embroidery", "vinyl"],
          size_options: ["xs", "s", "m", "l", "xl", "2xl", "3xl"],
          material_types: ["cotton", "polyester", "blend"],
          corporate_features: {
            volume_discounts: true,
            custom_branding: true,
            extended_payment_terms: true,
            dedicated_account_manager: true
          }
        }
      },
      {
        value: "t-shirt",
        metadata: {
          category: "clothing",
          parent_type: "apparel",
          target_market: "both",
          bulk_available: true,
          min_bulk_quantity: 10,
          print_methods: ["dtg", "screen_print", "vinyl"],
          size_options: ["xs", "s", "m", "l", "xl", "2xl", "3xl"],
          fit_types: ["regular", "slim", "relaxed"],
          corporate_features: {
            volume_discounts: true,
            custom_branding: true,
            logo_placement: ["chest", "back", "sleeve"]
          }
        }
      },
      {
        value: "hoodie",
        metadata: {
          category: "clothing",
          parent_type: "apparel", 
          target_market: "both",
          bulk_available: true,
          min_bulk_quantity: 10,
          print_methods: ["dtg", "screen_print", "embroidery"],
          size_options: ["xs", "s", "m", "l", "xl", "2xl", "3xl"],
          style_options: ["pullover", "zip-up"],
          corporate_features: {
            volume_discounts: true,
            custom_branding: true,
            logo_placement: ["chest", "back", "hood"]
          }
        }
      },
      {
        value: "polo",
        metadata: {
          category: "clothing",
          parent_type: "apparel",
          target_market: "corporate", // primarily corporate
          bulk_available: true,
          min_bulk_quantity: 5,
          print_methods: ["embroidery", "screen_print"],
          size_options: ["xs", "s", "m", "l", "xl", "2xl", "3xl"],
          corporate_features: {
            volume_discounts: true,
            custom_branding: true,
            professional_appearance: true,
            logo_placement: ["chest", "sleeve", "back"]
          }
        }
      },
      {
        value: "jacket",
        metadata: {
          category: "clothing",
          parent_type: "apparel",
          target_market: "both",
          bulk_available: true,
          min_bulk_quantity: 5,
          print_methods: ["embroidery", "screen_print"],
          size_options: ["xs", "s", "m", "l", "xl", "2xl", "3xl"],
          jacket_types: ["windbreaker", "fleece", "soft-shell"],
          corporate_features: {
            volume_discounts: true,
            custom_branding: true,
            logo_placement: ["chest", "back", "sleeve"]
          }
        }
      }
    ]

    const createdTypes = []
    
    for (const typeData of apparelProductTypes) {
      try {
        // Check if product type already exists
        const existingTypes = await productModuleService.listProductTypes({
          value: typeData.value
        })

        if (existingTypes.length === 0) {
          // Create new product type
          const [newType] = await productModuleService.createProductTypes([typeData])
          createdTypes.push(newType)
        } else {
          // Update existing product type with enhanced metadata
          const [updatedType] = await productModuleService.updateProductTypes(
            existingTypes[0].id,
            {
              metadata: {
                ...existingTypes[0].metadata,
                ...typeData.metadata
              }
            }
          )
          createdTypes.push(updatedType)
        }
      } catch (error) {
        console.error(`Error processing product type ${typeData.value}:`, error)
      }
    }

    return res.json({
      success: true,
      message: `Successfully processed ${createdTypes.length} apparel product types`,
      product_types: createdTypes,
      setup_features: {
        individual_corporate_selection: true,
        bulk_pricing_tiers: true,
        corporate_benefits: true,
        print_method_filtering: true,
        size_option_filtering: true
      }
    })

  } catch (error: any) {
    console.error('Error setting up apparel product types:', error)
    return res.status(500).json({
      success: false,
      message: error?.message || "Failed to setup apparel product types",
      error: error?.stack
    })
  }
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const productModuleService = req.scope.resolve(Modules.PRODUCT)

    // Get all apparel-related product types
    const apparelTypes = await productModuleService.listProductTypes({
      metadata: {
        category: "clothing"
      }
    })

    // Get statistics
    const totalApparelTypes = apparelTypes.length
    const corporateTypes = apparelTypes.filter(type => 
      type.metadata?.target_market === 'corporate' || 
      type.metadata?.target_market === 'both'
    ).length
    const bulkEnabledTypes = apparelTypes.filter(type => 
      type.metadata?.bulk_available === true
    ).length

    return res.json({
      success: true,
      apparel_types: apparelTypes,
      statistics: {
        total_apparel_types: totalApparelTypes,
        corporate_enabled_types: corporateTypes,
        bulk_enabled_types: bulkEnabledTypes,
        individual_corporate_filtering: totalApparelTypes > 0
      },
      setup_status: {
        configured: totalApparelTypes > 0,
        features_enabled: [
          "individual_corporate_selection",
          "bulk_pricing_tiers", 
          "corporate_benefits",
          "print_method_filtering"
        ]
      }
    })

  } catch (error: any) {
    console.error('Error fetching apparel product types:', error)
    return res.status(500).json({
      success: false,
      message: error?.message || "Failed to fetch apparel product types"
    })
  }
}