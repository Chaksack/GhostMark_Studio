import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

// GET /admin/design-areas/:id - Get a specific design area
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { id } = req.params

  try {
    const designArea = await query.graph({
      entity: "design_area",
      filters: { id }
    }).findOne()

    if (!designArea) {
      return res.status(404).json({ message: "Design area not found" })
    }

    res.json({ design_area: designArea })
  } catch (error: any) {
    res.status(500).json({ 
      message: "Failed to fetch design area",
      error: error.message 
    })
  }
}

// PUT /admin/design-areas/:id - Update a design area
export const PUT = async (req: MedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { id } = req.params

  try {
    const existingArea = await query.graph({
      entity: "design_area",
      filters: { id }
    }).findOne()

    if (!existingArea) {
      return res.status(404).json({ message: "Design area not found" })
    }

    const updateData = { ...req.body }
    
    // Validate area_type if provided
    if (updateData.area_type) {
      const validAreaTypes = ["front", "back", "sleeve_left", "sleeve_right", "neck", "pocket", "custom"]
      if (!validAreaTypes.includes(updateData.area_type)) {
        return res.status(400).json({
          message: `Invalid area_type. Must be one of: ${validAreaTypes.join(", ")}`
        })
      }
    }

    // Update timestamp
    updateData.updated_at = new Date()

    const updatedArea = await query.graph({
      entity: "design_area",
      data: updateData,
      filters: { id }
    }).update()

    res.json({ design_area: updatedArea })
  } catch (error: any) {
    res.status(500).json({ 
      message: "Failed to update design area",
      error: error.message 
    })
  }
}

// DELETE /admin/design-areas/:id - Delete a design area
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { id } = req.params

  try {
    const existingArea = await query.graph({
      entity: "design_area",
      filters: { id }
    }).findOne()

    if (!existingArea) {
      return res.status(404).json({ message: "Design area not found" })
    }

    await query.graph({
      entity: "design_area",
      filters: { id }
    }).delete()

    res.status(204).send()
  } catch (error: any) {
    res.status(500).json({ 
      message: "Failed to delete design area",
      error: error.message 
    })
  }
}