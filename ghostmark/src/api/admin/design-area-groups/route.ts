import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

// GET /admin/design-area-groups - List all design area groups
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  
  const {
    product_type_id,
    is_active,
    limit = 50,
    offset = 0,
    order = "sort_order"
  } = req.query as {
    product_type_id?: string
    is_active?: boolean
    limit?: number
    offset?: number
    order?: string
  }

  try {
    const filters: any = {}
    
    if (product_type_id) filters.product_type_id = product_type_id
    if (typeof is_active === 'boolean') filters.is_active = is_active

    const { data: groups, metadata } = await query.graph({
      entity: "design_area_group",
      filters,
      pagination: {
        skip: offset,
        take: limit,
        order: { [order]: "ASC" }
      }
    })

    res.json({
      design_area_groups: groups,
      count: metadata?.count || groups.length,
      offset,
      limit
    })
  } catch (error: any) {
    res.status(500).json({ 
      message: "Failed to fetch design area groups",
      error: error.message 
    })
  }
}

// POST /admin/design-area-groups - Create a new design area group
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  
  const {
    name,
    description,
    product_type_id,
    pricing_strategy = "single_charge",
    group_price,
    currency_code = "USD",
    design_area_ids = [],
    max_designs_per_group = 1,
    require_all_areas = false,
    is_active = true,
    sort_order = 0,
    metadata
  } = req.body

  try {
    // Validate required fields
    if (!name || !design_area_ids || !Array.isArray(design_area_ids) || design_area_ids.length === 0) {
      return res.status(400).json({
        message: "Missing required fields: name, design_area_ids (must be non-empty array)"
      })
    }

    // Validate pricing strategy
    const validStrategies = ["single_charge", "per_area", "tiered"]
    if (!validStrategies.includes(pricing_strategy)) {
      return res.status(400).json({
        message: `Invalid pricing_strategy. Must be one of: ${validStrategies.join(", ")}`
      })
    }

    // Validate that design areas exist
    const existingAreas = await query.graph({
      entity: "design_area",
      filters: { id: { $in: design_area_ids } }
    }).find()

    if (existingAreas.length !== design_area_ids.length) {
      return res.status(400).json({
        message: "One or more design area IDs do not exist"
      })
    }

    const group = await query.graph({
      entity: "design_area_group",
      data: {
        name,
        description,
        product_type_id,
        pricing_strategy,
        group_price,
        currency_code,
        design_area_ids,
        max_designs_per_group,
        require_all_areas,
        is_active,
        sort_order,
        metadata
      }
    }).create()

    res.status(201).json({ design_area_group: group })
  } catch (error: any) {
    res.status(500).json({ 
      message: "Failed to create design area group",
      error: error.message 
    })
  }
}