import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { DEFAULT_DPI } from "../../../../../utils/units"

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
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as any

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
    let productType: any = null
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

    // Prepare defaults
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

    // Prefer product.metadata.pod.print_areas if present
    const metadata = (product as any)?.metadata || {}
    const pod = metadata?.pod || {}
    const printAreas = pod?.print_areas
    const podVersion = Number(pod?.version || 0)
    const dpi = Number(pod?.dpi || DEFAULT_DPI)

    if (printAreas && typeof printAreas === 'object') {
      const entries = Object.entries(printAreas) as [string, any][]
      designAreas = entries.map(([side, area], index) => {
        const x_cm = Number(area?.x_cm || 0)
        const y_cm = Number(area?.y_cm || 0)
        const w_cm = Number(area?.width_cm || 0)
        const h_cm = Number(area?.height_cm || 0)
        const areaVersion = Number(area?.version ?? podVersion)
        const areaDpi = Number(area?.dpi || dpi || DEFAULT_DPI)

        return {
          id: `${productId}_${side}_${areaVersion}`,
          name: `${side} area`,
          description: `Print area (${side}) v${areaVersion}`,
          type: side,
          // We keep cm values in boundaries for downstream conversion
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
            // Admin may set per-area print price in minor units (e.g., cents) at metadata.pod.print_areas[side].print_price_minor
            // Expose as major units for storefront display
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
          sortOrder: index,
          isActive: true,
        }
      })

      // Return early using metadata-defined areas
      return res.json({
        product: {
          id: product.id,
          title: product.title,
          handle: product.handle,
          type_id: product.type_id,
          isPOD: isPODProduct,
          variants: product.variants || [],
        },
        designAreas,
        designCapabilities,
        productTypeDesignAreas: designAreas,
        assignments: assignments.length,
        metadata: {
          totalAreas: designAreas.length,
          activeAreas: designAreas.filter(a => a.isActive).length,
          availablePrintMethods: ['dtg'],
          units: 'cm',
          dpi,
          version: podVersion,
        },
      })
    }

    // Fallback: fetch from product type
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