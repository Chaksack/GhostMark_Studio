import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { DesignPricingService } from "../../../services/design-pricing-service"

interface DesignSubmissionRequest {
  areaId: string
  areaType: string
  layers: number
  colors: number
  printMethod?: string
}

interface PricingRequest {
  productTypeId: string
  variantId?: string
  designs: DesignSubmissionRequest[]
  quantity?: number
}

// POST /store/design-pricing - Calculate pricing for design submissions
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const { productTypeId, designs, quantity = 1 } = req.body as PricingRequest

    if (!productTypeId || !designs || !Array.isArray(designs) || designs.length === 0) {
      return res.status(400).json({
        error: "Missing required fields: productTypeId, designs (non-empty array)"
      })
    }

    // Validate design submissions
    for (const design of designs) {
      if (!design.areaId || !design.areaType || typeof design.layers !== 'number' || typeof design.colors !== 'number') {
        return res.status(400).json({
          error: "Each design must have areaId, areaType, layers (number), and colors (number)"
        })
      }
      
      if (design.layers < 1 || design.colors < 1) {
        return res.status(400).json({
          error: "Layers and colors must be at least 1"
        })
      }
    }

    if (quantity < 1) {
      return res.status(400).json({
        error: "Quantity must be at least 1"
      })
    }

    // Initialize pricing service
    const pricingService = new DesignPricingService(req.scope)

    // Calculate pricing
    const pricing = await pricingService.calculatePricing(productTypeId, designs, quantity)

    // Add helpful summary
    const summary = {
      totalAreas: designs.length,
      totalLayers: designs.reduce((sum, d) => sum + d.layers, 0),
      totalColors: designs.reduce((sum, d) => sum + d.colors, 0),
      groupCharges: pricing.groupCharges.length,
      hasGroupSavings: !!pricing.totals.savings && pricing.totals.savings > 0
    }

    res.json({
      pricing,
      summary,
      success: true
    })

  } catch (error: any) {
    console.error('Design pricing calculation error:', error)
    res.status(500).json({
      error: "Failed to calculate design pricing",
      message: error.message
    })
  }
}

// GET /store/design-pricing/areas/:productTypeId - Get available design areas for pricing
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const { productTypeId } = req.query as { productTypeId?: string }

    if (!productTypeId) {
      return res.status(400).json({
        error: "Missing productTypeId query parameter"
      })
    }

    const pricingService = new DesignPricingService(req.scope)
    
    // Fetch areas and groups for reference
    const [designAreas, designAreaGroups] = await Promise.all([
      pricingService['fetchDesignAreas'](productTypeId),
      pricingService['fetchDesignAreaGroups'](productTypeId)
    ])

    // Create area groups mapping for frontend
    const areaGroupsMap = new Map()
    designAreaGroups.forEach(group => {
      group.design_area_ids.forEach(areaId => {
        areaGroupsMap.set(areaId, {
          groupId: group.id,
          groupName: group.name,
          pricingStrategy: group.pricing_strategy,
          groupPrice: group.group_price
        })
      })
    })

    // Enhance areas with group information
    const enhancedAreas = designAreas.map(area => ({
      ...area,
      groupInfo: areaGroupsMap.get(area.id) || null
    }))

    // Group areas by type for easier frontend handling
    const areasByType = enhancedAreas.reduce((acc: any, area) => {
      if (!acc[area.area_type]) {
        acc[area.area_type] = []
      }
      acc[area.area_type].push(area)
      return acc
    }, {})

    res.json({
      designAreas: enhancedAreas,
      areasByType,
      designAreaGroups,
      pricingInfo: {
        hasGroupPricing: designAreaGroups.length > 0,
        supportedAreaTypes: [...new Set(designAreas.map(area => area.area_type))],
        maxColors: Math.max(...designAreas.map(area => area.max_colors || 6)),
        supportedPrintMethods: [...new Set(designAreas.flatMap(area => area.print_methods || []))]
      }
    })

  } catch (error: any) {
    console.error('Error fetching design areas for pricing:', error)
    res.status(500).json({
      error: "Failed to fetch design areas",
      message: error.message
    })
  }
}