import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

// GET /store/product-types/:id/design-areas - Get design areas for a product type
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { id: productTypeId } = req.params
  
  const {
    include_groups = false,
    include_pricing = false,
    area_type,
    is_active = true
  } = req.query as {
    include_groups?: boolean
    include_pricing?: boolean
    area_type?: string
    is_active?: boolean
  }

  try {
    const filters: any = {
      product_type_id: productTypeId,
      is_active
    }
    
    if (area_type) filters.area_type = area_type

    // Fetch design areas for this product type
    const designAreas = await query.graph({
      entity: "design_area",
      filters,
      pagination: {
        order: { sort_order: "ASC" }
      }
    }).find()

    let result: any = {
      designAreas,
      designCapabilities: generateDesignCapabilities(designAreas)
    }

    // Include groups if requested
    if (include_groups) {
      const groups = await query.graph({
        entity: "design_area_group",
        filters: {
          product_type_id: productTypeId,
          is_active: true
        },
        pagination: {
          order: { sort_order: "ASC" }
        }
      }).find()
      
      result.designAreaGroups = groups
    }

    // Include pricing rules if requested
    if (include_pricing) {
      const pricingRules = await query.graph({
        entity: "design_pricing_rule",
        filters: {
          product_type_id: productTypeId,
          is_active: true
        },
        pagination: {
          order: { priority: "DESC" }
        }
      }).find()
      
      result.pricingRules = pricingRules
    }

    res.json(result)
  } catch (error: any) {
    res.status(500).json({ 
      message: "Failed to fetch design areas",
      error: error.message 
    })
  }
}

// Helper function to generate design capabilities from areas
function generateDesignCapabilities(areas: any[]) {
  if (!areas || areas.length === 0) {
    return {
      maxPrintAreas: 1,
      supportedFormats: ['PNG', 'JPG', 'SVG'],
      maxFileSize: '25MB',
      minResolution: '150dpi',
      recommendedResolution: '300dpi',
      colorModes: ['RGB'],
      maxColors: 6,
      printMethods: ['dtg'],
      hasProductTypeSupport: false
    }
  }

  const allFormats = new Set<string>()
  const allColorModes = new Set<string>()
  const allPrintMethods = new Set<string>()
  let maxColors = 0
  let maxFileSize = '25MB'
  let minDPI = 150
  let recommendedDPI = 300

  areas.forEach(area => {
    // Collect supported formats
    if (area.validation?.supportedFormats) {
      area.validation.supportedFormats.forEach((format: string) => allFormats.add(format))
    }
    
    // Collect color modes
    if (area.validation?.colorModes) {
      area.validation.colorModes.forEach((mode: string) => allColorModes.add(mode))
    }
    
    // Collect print methods
    if (area.print_methods) {
      area.print_methods.forEach((method: string) => allPrintMethods.add(method))
    }
    
    // Get max colors
    if (area.max_colors && area.max_colors > maxColors) {
      maxColors = area.max_colors
    }
    
    // Update DPI requirements
    if (area.validation?.minDPI && area.validation.minDPI > minDPI) {
      minDPI = area.validation.minDPI
    }
    if (area.validation?.recommendedDPI && area.validation.recommendedDPI > recommendedDPI) {
      recommendedDPI = area.validation.recommendedDPI
    }
    
    // Update max file size (take the largest)
    if (area.validation?.maxFileSize) {
      maxFileSize = area.validation.maxFileSize
    }
  })

  return {
    maxPrintAreas: areas.length,
    supportedFormats: Array.from(allFormats),
    maxFileSize,
    minResolution: `${minDPI}dpi`,
    recommendedResolution: `${recommendedDPI}dpi`,
    colorModes: Array.from(allColorModes),
    maxColors: maxColors || 6,
    printMethods: Array.from(allPrintMethods),
    hasProductTypeSupport: true
  }
}