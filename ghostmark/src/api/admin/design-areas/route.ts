import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

// GET /admin/design-areas - List all design areas with filtering
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  
  const {
    product_type_id,
    product_id,
    variant_id,
    area_type,
    is_active,
    limit = 50,
    offset = 0,
    order = "sort_order"
  } = req.query as {
    product_type_id?: string
    product_id?: string
    variant_id?: string
    area_type?: string
    is_active?: boolean
    limit?: number
    offset?: number
    order?: string
  }

  try {
    const filters: any = {}
    
    if (product_type_id) filters.product_type_id = product_type_id
    if (product_id) filters.product_id = product_id
    if (variant_id) filters.variant_id = variant_id
    if (area_type) filters.area_type = area_type
    if (typeof is_active === 'boolean') filters.is_active = is_active

    const { data: designAreas, metadata } = await query.graph({
      entity: "design_area",
      filters,
      pagination: {
        skip: offset,
        take: limit,
        order: { [order]: "ASC" }
      }
    })

    res.json({
      design_areas: designAreas,
      count: metadata?.count || designAreas.length,
      offset,
      limit
    })
  } catch (error: any) {
    res.status(500).json({ 
      message: "Failed to fetch design areas",
      error: error.message 
    })
  }
}

// POST /admin/design-areas - Create a new design area
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  
  const {
    name,
    product_type_id,
    product_id,
    variant_id,
    area_type,
    is_active = true,
    sort_order = 0,
    position,
    dimensions,
    boundaries,
    constraints,
    print_methods,
    techniques,
    max_colors,
    pricing,
    layer_support,
    validation,
    mockup,
    metadata
  } = req.body

  try {
    // Validate required fields
    if (!name || !area_type || !position || !dimensions || !boundaries) {
      return res.status(400).json({
        message: "Missing required fields: name, area_type, position, dimensions, boundaries"
      })
    }

    // Validate area_type
    const validAreaTypes = ["front", "back", "sleeve_left", "sleeve_right", "neck", "pocket", "custom"]
    if (!validAreaTypes.includes(area_type)) {
      return res.status(400).json({
        message: `Invalid area_type. Must be one of: ${validAreaTypes.join(", ")}`
      })
    }

    // Default constraints
    const defaultConstraints = {
      minWidth: 20,
      minHeight: 20,
      maxWidth: 300,
      maxHeight: 300,
      margin: 5,
      allowRotation: true,
      allowResize: true,
      ...constraints
    }

    // Default pricing
    const defaultPricing = {
      basePrice: 2.0,
      colorPrice: 0.5,
      layerPrice: 1.0,
      setupFee: 0.0,
      currency: "USD",
      ...pricing
    }

    // Default layer support
    const defaultLayerSupport = {
      maxLayers: 3,
      supportedTypes: ["file", "text"],
      blendModes: ["normal"],
      ...layer_support
    }

    // Default validation rules
    const defaultValidation = {
      minDPI: 150,
      recommendedDPI: 300,
      maxFileSize: "25MB",
      supportedFormats: ["PNG", "JPG", "SVG"],
      colorModes: ["RGB"],
      ...validation
    }

    // Default mockup settings
    const defaultMockup = {
      previewScale: 1.0,
      ...mockup
    }

    const designArea = await query.graph({
      entity: "design_area",
      data: {
        name,
        product_type_id,
        product_id,
        variant_id,
        area_type,
        is_active,
        sort_order,
        position,
        dimensions,
        boundaries,
        constraints: defaultConstraints,
        print_methods: print_methods || ["dtg"],
        techniques: techniques || ["dtg"],
        max_colors,
        pricing: defaultPricing,
        layer_support: defaultLayerSupport,
        validation: defaultValidation,
        mockup: defaultMockup,
        metadata
      }
    }).create()

    res.status(201).json({ design_area: designArea })
  } catch (error: any) {
    res.status(500).json({ 
      message: "Failed to create design area",
      error: error.message 
    })
  }
}