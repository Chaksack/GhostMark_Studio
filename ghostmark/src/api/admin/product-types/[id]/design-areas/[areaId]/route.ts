import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

// Mock storage for design areas (shared with main route)
const mockDesignAreas: Record<string, any[]> = {}

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
) {
  try {
    const { id: productTypeId, areaId } = req.params

    if (!productTypeId || !areaId) {
      return res.status(400).json({ message: "Missing product type id or area id" })
    }

    const areas = mockDesignAreas[productTypeId] || []
    const designArea = areas.find(area => area.id === areaId)

    if (!designArea) {
      return res.status(404).json({ message: "Design area not found" })
    }

    return res.json({ designArea })

  } catch (error: any) {
    console.error('Error fetching design area:', error)
    return res.status(500).json({ message: error?.message || "Failed to retrieve design area" })
  }
}

export async function PATCH(
  req: MedusaRequest,
  res: MedusaResponse
) {
  try {
    const { id: productTypeId, areaId } = req.params
    const updates = req.body

    if (!productTypeId || !areaId) {
      return res.status(400).json({ message: "Missing product type id or area id" })
    }

    const areas = mockDesignAreas[productTypeId] || []
    const areaIndex = areas.findIndex(area => area.id === areaId)

    if (areaIndex === -1) {
      return res.status(404).json({ message: "Design area not found" })
    }

    // Update the design area
    mockDesignAreas[productTypeId][areaIndex] = {
      ...(areas[areaIndex] || {}),
      ...(updates as Record<string, any>),
      id: areaId // Ensure ID doesn't change
    }

    return res.json({
      designArea: mockDesignAreas[productTypeId][areaIndex],
      message: 'Design area updated successfully'
    })

  } catch (error: any) {
    console.error('Error updating design area:', error)
    return res.status(500).json({ message: error?.message || "Failed to update design area" })
  }
}

export async function DELETE(
  req: MedusaRequest,
  res: MedusaResponse
) {
  try {
    const { id: productTypeId, areaId } = req.params

    if (!productTypeId || !areaId) {
      return res.status(400).json({ message: "Missing product type id or area id" })
    }

    const areas = mockDesignAreas[productTypeId] || []
    const areaIndex = areas.findIndex(area => area.id === areaId)

    if (areaIndex === -1) {
      return res.status(404).json({ message: "Design area not found" })
    }

    // Remove the design area
    mockDesignAreas[productTypeId].splice(areaIndex, 1)

    return res.json({
      message: 'Design area deleted successfully',
      deletedId: areaId
    })

  } catch (error: any) {
    console.error('Error deleting design area:', error)
    return res.status(500).json({ message: error?.message || "Failed to delete design area" })
  }
}