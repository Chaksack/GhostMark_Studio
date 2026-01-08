import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * Storefront API for fetching design areas assigned to POD products
 * Following Context7 patterns for customer-facing design area access
 */

interface StorefrontDesignArea {
  id: string
  name: string
  description?: string
  type: string
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
  sortOrder: number
  isActive: boolean
}

interface DesignCapabilities {
  maxDesignAreas: number
  supportedFormats: string[]
  maxFileSize: string
  minResolution: string
  recommendedResolution: string
  colorModes: string[]
  maxColors: number
  printMethods: string[]
  qualityRequirements: {
    minDPI: number
    recommendedDPI: number
    maxFileSize: string
    allowedTypes: string[]
  }
}

// Mock storage for product design areas (matches admin API)
const mockProductDesignAreas: Record<string, any[]> = {}

/**
 * GET /store/products/[id]/design-areas
 * Fetch design areas for a specific product (POD products only)
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

    // Fetch the product to verify it exists and is POD
    const [products] = await query.graph({
      entity: "product",
      filters: { 
        id: productId,
        status: "published" // Only published products for storefront
      },
      fields: ["id", "title", "handle", "type_id", "metadata", "status", "variants.id", "variants.title"]
    })

    if (!products || products.length === 0) {
      return res.status(404).json({ message: "Product not found" })
    }

    const product = products[0]

    // Verify this is a POD product
    let isPODProduct = false
    let productType = null
    if (product.type_id) {
      const [productTypes] = await query.graph({
        entity: "product_type",
        filters: { id: product.type_id },
        fields: ["id", "value", "metadata"]
      })

      if (productTypes && productTypes.length > 0) {
        productType = productTypes[0]
        isPODProduct = productType.value?.toLowerCase() === 'pod' || 
                       productType.metadata?.isPOD === true
      }
    }

    if (!isPODProduct) {
      return res.status(404).json({ 
        message: "Design areas are not available for this product type",
        productType: productType?.value || 'unknown'
      })
    }

    // Get design areas assignments for this product
    const assignments = mockProductDesignAreas[productId] || []

    // Fetch design areas from product type
    let designAreas: StorefrontDesignArea[] = []
    let designCapabilities: DesignCapabilities = {
      maxDesignAreas: 4,
      supportedFormats: ['PNG', 'JPG', 'SVG', 'PDF'],
      maxFileSize: '25MB',
      minResolution: '150dpi',
      recommendedResolution: '300dpi',
      colorModes: ['RGB', 'CMYK'],
      maxColors: 12,
      printMethods: ['dtg', 'screen_print', 'embroidery'],
      qualityRequirements: {
        minDPI: 150,
        recommendedDPI: 300,
        maxFileSize: '25MB',
        allowedTypes: ['image/png', 'image/jpeg', 'image/svg+xml', 'application/pdf']
      }
    }

    if (product.type_id) {
      try {
        // Fetch from internal product type API
        const baseUrl = process.env.MEDUSA_BACKEND_URL || `${req.protocol}://${req.get('host')}`
        const response = await fetch(`${baseUrl}/admin/product-types/${product.type_id}/design-areas`)
        
        if (response.ok) {
          const data = await response.json()
          
          // Filter to only active design areas and sanitize for storefront
          const activeAreas = (data.designAreas || [])
            .filter((area: any) => area.isActive)
            .map((area: any): StorefrontDesignArea => ({
              id: area.id,
              name: area.name,
              description: area.description,
              type: area.type,
              position: area.position,
              dimensions: area.dimensions,
              boundaries: area.boundaries,
              constraints: area.constraints,
              printMethods: area.printMethods || [],
              maxColors: area.maxColors,
              pricing: {
                basePrice: area.pricing?.basePrice || 0,
                colorPrice: area.pricing?.colorPrice || 0,
                layerPrice: area.pricing?.layerPrice || 0,
                setupFee: area.pricing?.setupFee || 0,
                currency: area.pricing?.currency || 'USD'
              },
              validation: {
                minDPI: area.validation?.minDPI || 150,
                recommendedDPI: area.validation?.recommendedDPI || 300,
                maxFileSize: area.validation?.maxFileSize || '25MB',
                supportedFormats: area.validation?.supportedFormats || ['PNG', 'JPG'],
                allowedFileTypes: area.validation?.allowedFileTypes || ['image/png', 'image/jpeg']
              },
              sortOrder: area.sortOrder || 0,
              isActive: area.isActive
            }))

          designAreas = activeAreas.sort((a, b) => a.sortOrder - b.sortOrder)
          
          // Update capabilities based on actual design areas
          if (data.designCapabilities) {
            designCapabilities = {
              ...designCapabilities,
              ...data.designCapabilities,
              qualityRequirements: {
                minDPI: Math.min(...designAreas.map(a => a.validation.minDPI)),
                recommendedDPI: Math.max(...designAreas.map(a => a.validation.recommendedDPI)),
                maxFileSize: designAreas[0]?.validation.maxFileSize || '25MB',
                allowedTypes: [...new Set(designAreas.flatMap(a => a.validation.allowedFileTypes))]
              }
            }
          }
        } else {
          console.warn(`Failed to fetch design areas for product type ${product.type_id}`)
        }
      } catch (error) {
        console.warn('Error fetching product type design areas:', error)
      }
    }

    return res.json({
      product: {
        id: product.id,
        title: product.title,
        handle: product.handle,
        type_id: product.type_id,
        isPOD: isPODProduct,
        variants: product.variants || []
      },
      designAreas,
      designCapabilities,
      productTypeDesignAreas: designAreas, // For backward compatibility
      assignments: assignments.length, // Just count for storefront
      metadata: {
        totalAreas: designAreas.length,
        activeAreas: designAreas.filter(area => area.isActive).length,
        availablePrintMethods: [...new Set(designAreas.flatMap(area => area.printMethods))],
        priceRange: designAreas.length > 0 ? {
          min: Math.min(...designAreas.map(area => area.pricing.basePrice)),
          max: Math.max(...designAreas.map(area => area.pricing.basePrice)),
          currency: designAreas[0]?.pricing.currency || 'USD'
        } : null
      }
    })

  } catch (error: any) {
    console.error('Error fetching storefront design areas:', error)
    return res.status(500).json({ 
      message: "Failed to fetch design areas for this product",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
}

/**
 * GET /store/products/[id]/design-areas/capabilities
 * Get design capabilities and requirements for a product
 */
export async function OPTIONS(
  req: MedusaRequest,
  res: MedusaResponse
) {
  try {
    const { id: productId } = req.params

    // This could be expanded to return specific capabilities for the product
    return res.json({
      supportedMethods: ['GET'],
      designCapabilities: {
        maxDesignAreas: 6,
        supportedFormats: ['PNG', 'JPG', 'JPEG', 'SVG', 'PDF'],
        maxFileSize: '50MB',
        minResolution: '150dpi',
        recommendedResolution: '300dpi',
        colorModes: ['RGB', 'CMYK'],
        maxColors: 12,
        printMethods: ['dtg', 'screen_print', 'embroidery', 'vinyl', 'sublimation'],
        qualityRequirements: {
          minDPI: 150,
          recommendedDPI: 300,
          maxFileSize: '50MB',
          allowedTypes: [
            'image/png', 
            'image/jpeg', 
            'image/svg+xml', 
            'application/pdf'
          ]
        },
        constraints: {
          minWidth: 50,
          minHeight: 50,
          maxWidth: 500,
          maxHeight: 600,
          allowRotation: true,
          allowResize: true
        }
      },
      cors: {
        origin: true,
        methods: ['GET', 'OPTIONS'],
        credentials: true
      }
    })
  } catch (error: any) {
    console.error('Error fetching design capabilities:', error)
    return res.status(500).json({ message: "Failed to fetch design capabilities" })
  }
}