import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { DEFAULT_DPI } from "../../../../../utils/units"

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
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as any

    if (!productId) {
      return res.status(400).json({ message: "Missing product ID" })
    }

    // Fetch the product to verify it exists and get product type
    const { data: products } = await query.graph({
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
      const { data: productTypes } = await query.graph({
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

    // Get design area assignments for this product (in-memory mock for now)
    const assignments = mockProductDesignAreas[productId] || []

    // First, prefer print areas saved in product.metadata.pod.print_areas
    // so saving via PATCH /admin/products/:id (or POST to this endpoint with { pod })
    // is immediately reflected here in Admin, same as Storefront behavior.
    let availableDesignAreas: ProductDesignAreaConfig[] = []

    const metadata = (product as any)?.metadata || {}
    const pod = (metadata?.pod || {}) as any
    const printAreas = pod?.print_areas
    const podVersion = Number(pod?.version || 0)
    const dpi = Number(pod?.dpi || DEFAULT_DPI)

    if (printAreas && typeof printAreas === 'object') {
      const entries = Object.entries(printAreas) as [string, any][]
      const mappedFromMeta = entries.map(([side, area], index) => {
        const x_cm = Number(area?.x_cm || 0)
        const y_cm = Number(area?.y_cm || 0)
        const w_cm = Number(area?.width_cm || 0)
        const h_cm = Number(area?.height_cm || 0)
        const areaVersion = Number(area?.version ?? podVersion)
        const areaDpi = Number(area?.dpi || dpi || DEFAULT_DPI)

        const config: ProductDesignAreaConfig = {
          id: `${productId}_${side}_${areaVersion}`,
          name: `${side} area`,
          description: `Print area (${side}) v${areaVersion}`,
          type: side as any,
          position: { x: 0, y: 0 },
          dimensions: { width: Math.max(1, w_cm), height: Math.max(1, h_cm) },
          boundaries: { x: x_cm, y: y_cm, w: Math.max(1, w_cm), h: Math.max(1, h_cm) },
          constraints: {
            minWidth: 1,
            minHeight: 1,
            maxWidth: 1000,
            maxHeight: 1000,
            margin: 0,
            allowRotation: false,
            allowResize: true,
          },
          printMethods: ['dtg'],
          maxColors: 12,
          pricing: {
            basePrice: typeof area?.print_price_minor === 'number' ? (area.print_price_minor / 100) : 0,
            colorPrice: 0,
            layerPrice: 0,
            setupFee: 0,
            currency: (pod?.currency || 'USD') as string,
          },
          validation: {
            minDPI: areaDpi,
            recommendedDPI: areaDpi,
            maxFileSize: '50MB',
            supportedFormats: ['PNG', 'JPG', 'PDF'],
            allowedFileTypes: ['image/png', 'image/jpeg', 'application/pdf'],
          },
          isActive: true,
          sortOrder: index,
        }
        return config
      })

      availableDesignAreas = mappedFromMeta
    }

    try {
      const { data: productSpecificAreas } = await query.graph({
        entity: "design_area",
        fields: [
          "id",
          "name",
          "description",
          "area_type",
          "position",
          "dimensions",
          "boundaries",
          "constraints",
          "print_methods",
          "max_colors",
          "pricing",
          "validation",
          "is_active",
          "sort_order",
        ],
        filters: { product_id: product.id },
        pagination: { order: { sort_order: "ASC" } },
      })

      const dbAreas: ProductDesignAreaConfig[] = (productSpecificAreas || []).map((a: any) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        type: a.area_type,
        position: a.position,
        dimensions: a.dimensions,
        boundaries: a.boundaries,
        constraints: a.constraints,
        printMethods: a.print_methods,
        maxColors: a.max_colors,
        pricing: a.pricing,
        validation: a.validation,
        isActive: a.is_active,
        sortOrder: a.sort_order,
      }))

      // Merge DB-backed areas with metadata-derived areas, preferring metadata ones by id
      if (availableDesignAreas.length === 0) {
        availableDesignAreas = dbAreas
      } else {
        const seen = new Set(availableDesignAreas.map((a) => a.id))
        for (const area of dbAreas) {
          if (!seen.has(area.id)) {
            availableDesignAreas.push(area)
          }
        }
      }
    } catch (err) {
      console.warn("Failed to load product-specific design areas:", err)
    }

    // Also load product type default design areas as a fallback/merge source
    if (product.type_id) {
      try {
        const response = await fetch(`${req.protocol}://${req.get('host')}/admin/product-types/${product.type_id}/design-areas`)
        if (response.ok) {
          const data = await response.json()
          const typeAreas: ProductDesignAreaConfig[] = (data.designAreas || [])

          // Merge, preferring product-specific areas when ids collide
          const seen = new Set(availableDesignAreas.map((a) => a.id))
          for (const ta of typeAreas) {
            if (!seen.has(ta.id)) {
              availableDesignAreas.push(ta)
            }
          }
        }
      } catch (error) {
        console.warn('Could not fetch product type design areas:', error)
      }
    }

    // Merge assignments with design area configs. If there is a DB-backed product-specific
    // design area but no explicit assignment exists, treat it as assigned by default.
    const productDesignAreas = availableDesignAreas.map(area => ({
      ...area,
      assignment:
        assignments.find(a => a.designAreaId === area.id) ||
        (area && {
          id: `${productId}_${area.id}`,
          productId,
          designAreaId: area.id,
          productTypeId: product.type_id,
          isActive: (area as any).isActive ?? true,
          sortOrder: (area as any).sortOrder ?? 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
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
    const body = ((req as any).body ?? {}) as any
    const { designAreaIds, customOverrides, pod } = body as any
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as any

    if (!productId) {
      return res.status(400).json({ message: "Missing product ID" })
    }

    // If admin submits a POD print_areas payload, persist it in product.metadata and bump version
    if (pod && typeof pod === 'object') {
      const nextVersion = Number(pod.version ?? 0) + 1
      const dpi = Number(pod.dpi || DEFAULT_DPI)
      const print_areas = pod.print_areas || {}

      // Fetch product current metadata
      const { data: productsBefore } = await query.graph({
        entity: "product",
        filters: { id: productId },
        fields: ["id", "metadata"]
      })
      const current = productsBefore?.[0]
      const currentMeta = (current?.metadata as any) || {}

      const updatedMeta = {
        ...currentMeta,
        pod: {
          ...(currentMeta.pod || {}),
          dpi,
          version: nextVersion,
          print_areas,
          updated_at: new Date().toISOString(),
        },
      }

      // Update product metadata using Product module service (graph builder has no update())
      // Pass a single DTO object (not an array) to avoid MikroORM criteria errors like
      // "Trying to query by not existing property Product.0" in some versions.
      const productModuleService = req.scope.resolve(Modules.PRODUCT) as any
      await productModuleService.updateProducts({
        id: productId,
        metadata: updatedMeta,
      })

      return res.status(200).json({
        message: "POD print areas saved",
        product: { id: productId },
        pod: updatedMeta.pod,
      })
    }

    if (!designAreaIds || !Array.isArray(designAreaIds) || designAreaIds.length === 0) {
      return res.status(400).json({ message: "Missing or invalid design area IDs" })
    }

    // Verify product exists and is POD type
    const { data: products } = await query.graph({
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
      const { data: productTypes } = await query.graph({
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
    const body = ((req as any).body ?? {}) as any
    const { designAreaIds } = body

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