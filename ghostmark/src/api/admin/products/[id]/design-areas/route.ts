import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * Admin API for managing design areas assigned to POD products
 * Following Context7 patterns for product-specific design area management
 */

interface ProductDesignAreaAssignment {
  id: string
  productId: string
  designAreaId: string
  productTypeId?: string
  isActive: boolean
  sortOrder: number
  customOverrides?: {
    pricing?: {
      basePrice?: number
      colorPrice?: number
      layerPrice?: number
      setupFee?: number
    }
    constraints?: {
      maxWidth?: number
      maxHeight?: number
      minWidth?: number
      minHeight?: number
    }
    validation?: {
      maxFileSize?: string
      allowedFormats?: string[]
    }
  }
  createdAt: string
  updatedAt: string
}

interface ProductDesignAreaConfig {
  id: string
  name: string
  description?: string
  type: 'front' | 'back' | 'sleeve_left' | 'sleeve_right' | 'neck' | 'pocket' | 'custom'
  position: { x: number; y: number; z?: number }
  dimensions: { width: number; height: number }
  boundaries: { x: number; y: number; w: number; h: number }
  constraints: {
    minWidth: number
    minHeight: number
    maxWidth: number
    maxHeight: number
    margin: number
    allowRotation: boolean
    allowResize: boolean
  }
  printMethods: string[]
  maxColors?: number
  pricing: {
    basePrice: number
    colorPrice: number
    layerPrice: number
    setupFee: number
    currency: string
  }
  validation: {
    minDPI: number
    recommendedDPI: number
    maxFileSize: string
    supportedFormats: string[]
    allowedFileTypes: string[]
  }
  isActive: boolean
  sortOrder: number
  assignment?: ProductDesignAreaAssignment
}

// Mock storage for product design area assignments
const mockProductDesignAreas: Record<string, ProductDesignAreaAssignment[]> = {}

/**
 * GET /admin/products/[id]/design-areas
 * Fetch design areas assigned to a specific product
 */
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
) {
  try {
    const { id: productId } = req.params
    const query = req.container.resolve(ContainerRegistrationKeys.QUERY)

    if (!productId) {
      return res.status(400).json({ message: "Missing product ID" })
    }

    // Fetch the product to verify it exists and get product type
    const [products] = await query.graph({
      entity: "product",
      filters: { id: productId },
      fields: ["id", "title", "type_id", "metadata", "handle"]
    })

    if (!products || products.length === 0) {
      return res.status(404).json({ message: "Product not found" })
    }

    const product = products[0]

    // Check if product type is POD (Print on Demand)
    let isPODProduct = false
    if (product.type_id) {
      const [productTypes] = await query.graph({
        entity: "product_type",
        filters: { id: product.type_id },
        fields: ["id", "value", "metadata"]
      })

      if (productTypes && productTypes.length > 0) {
        const productType = productTypes[0]
        isPODProduct = productType.value?.toLowerCase() === 'pod' || 
                       productType.metadata?.isPOD === true
      }
    }

    if (!isPODProduct) {
      return res.status(400).json({ 
        message: "Design areas can only be managed for POD (Print on Demand) products",
        productType: product.type_id 
      })
    }

    // Get design area assignments for this product
    const assignments = mockProductDesignAreas[productId] || []

    // For now, fetch design areas from the product type route as fallback
    // In a real implementation, this would query the database
    let availableDesignAreas: ProductDesignAreaConfig[] = []
    
    if (product.type_id) {
      try {
        // Mock fetching design areas from product type
        const response = await fetch(`${req.protocol}://${req.get('host')}/admin/product-types/${product.type_id}/design-areas`)
        if (response.ok) {
          const data = await response.json()
          availableDesignAreas = data.designAreas || []
        }
      } catch (error) {
        console.warn('Could not fetch product type design areas:', error)
      }
    }

    // Merge assignments with design area configs
    const productDesignAreas = availableDesignAreas.map(area => ({
      ...area,
      assignment: assignments.find(a => a.designAreaId === area.id)
    }))

    return res.json({
      product: {
        id: product.id,
        title: product.title,
        handle: product.handle,
        type_id: product.type_id,
        isPOD: isPODProduct
      },
      designAreas: productDesignAreas,
      assignments,
      capabilities: {
        maxDesignAreas: 6,
        supportedTypes: ['front', 'back', 'sleeve_left', 'sleeve_right', 'neck', 'pocket'],
        canCustomizeConstraints: true,
        canOverridePricing: true
      }
    })

  } catch (error: any) {
    console.error('Error fetching product design areas:', error)
    return res.status(500).json({ 
      message: error?.message || "Failed to fetch product design areas" 
    })
  }
}

/**
 * POST /admin/products/[id]/design-areas
 * Assign design areas to a POD product
 */
export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
) {
  try {
    const { id: productId } = req.params
    const { designAreaIds, customOverrides } = req.body
    const query = req.container.resolve(ContainerRegistrationKeys.QUERY)

    if (!productId) {
      return res.status(400).json({ message: "Missing product ID" })
    }

    if (!designAreaIds || !Array.isArray(designAreaIds) || designAreaIds.length === 0) {
      return res.status(400).json({ message: "Missing or invalid design area IDs" })
    }

    // Verify product exists and is POD type
    const [products] = await query.graph({
      entity: "product",
      filters: { id: productId },
      fields: ["id", "type_id"]
    })

    if (!products || products.length === 0) {
      return res.status(404).json({ message: "Product not found" })
    }

    const product = products[0]

    // Verify POD product type
    if (product.type_id) {
      const [productTypes] = await query.graph({
        entity: "product_type",
        filters: { id: product.type_id },
        fields: ["value", "metadata"]
      })

      if (productTypes && productTypes.length > 0) {
        const productType = productTypes[0]
        const isPOD = productType.value?.toLowerCase() === 'pod' || 
                      productType.metadata?.isPOD === true

        if (!isPOD) {
          return res.status(400).json({ 
            message: "Can only assign design areas to POD products" 
          })
        }
      }
    }

    // Initialize assignments array for this product
    if (!mockProductDesignAreas[productId]) {
      mockProductDesignAreas[productId] = []
    }

    // Create new assignments
    const newAssignments: ProductDesignAreaAssignment[] = designAreaIds.map((areaId: string, index: number) => ({
      id: `${productId}_${areaId}_${Date.now()}`,
      productId,
      designAreaId: areaId,
      productTypeId: product.type_id,
      isActive: true,
      sortOrder: index,
      customOverrides: customOverrides?.[areaId] || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }))

    // Replace existing assignments (or append to them based on requirements)
    mockProductDesignAreas[productId] = newAssignments

    return res.status(201).json({
      message: 'Design areas assigned successfully',
      product: {
        id: productId,
        type_id: product.type_id
      },
      assignments: newAssignments,
      assignedCount: newAssignments.length
    })

  } catch (error: any) {
    console.error('Error assigning design areas:', error)
    return res.status(500).json({ 
      message: error?.message || "Failed to assign design areas" 
    })
  }
}

/**
 * PUT /admin/products/[id]/design-areas
 * Update design area assignments for a POD product
 */
export async function PUT(
  req: MedusaRequest,
  res: MedusaResponse
) {
  try {
    const { id: productId } = req.params
    const { assignments } = req.body as { assignments: Partial<ProductDesignAreaAssignment>[] }

    if (!productId) {
      return res.status(400).json({ message: "Missing product ID" })
    }

    if (!assignments || !Array.isArray(assignments)) {
      return res.status(400).json({ message: "Missing or invalid assignments data" })
    }

    // Update existing assignments
    if (mockProductDesignAreas[productId]) {
      assignments.forEach(updateData => {
        const existingIndex = mockProductDesignAreas[productId].findIndex(
          a => a.id === updateData.id || a.designAreaId === updateData.designAreaId
        )

        if (existingIndex >= 0) {
          mockProductDesignAreas[productId][existingIndex] = {
            ...mockProductDesignAreas[productId][existingIndex],
            ...updateData,
            updatedAt: new Date().toISOString()
          }
        }
      })
    }

    return res.json({
      message: 'Design area assignments updated successfully',
      productId,
      updatedCount: assignments.length
    })

  } catch (error: any) {
    console.error('Error updating design area assignments:', error)
    return res.status(500).json({ 
      message: error?.message || "Failed to update assignments" 
    })
  }
}

/**
 * DELETE /admin/products/[id]/design-areas
 * Remove design area assignments from a POD product
 */
export async function DELETE(
  req: MedusaRequest,
  res: MedusaResponse
) {
  try {
    const { id: productId } = req.params
    const { designAreaIds } = req.body

    if (!productId) {
      return res.status(400).json({ message: "Missing product ID" })
    }

    if (designAreaIds && Array.isArray(designAreaIds)) {
      // Remove specific design areas
      if (mockProductDesignAreas[productId]) {
        mockProductDesignAreas[productId] = mockProductDesignAreas[productId].filter(
          assignment => !designAreaIds.includes(assignment.designAreaId)
        )
      }

      return res.json({
        message: 'Specified design areas removed successfully',
        productId,
        removedAreaIds: designAreaIds
      })
    } else {
      // Remove all design areas for this product
      delete mockProductDesignAreas[productId]

      return res.json({
        message: 'All design areas removed from product',
        productId
      })
    }

  } catch (error: any) {
    console.error('Error removing design area assignments:', error)
    return res.status(500).json({ 
      message: error?.message || "Failed to remove assignments" 
    })
  }
}