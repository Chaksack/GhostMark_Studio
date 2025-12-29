import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

// Enhanced design area interface following clothes2order.com patterns
interface DesignAreaConfig {
  id: string
  name: string
  description?: string
  position: { x: number; y: number; z?: number }
  dimensions: { width: number; height: number }
  boundaries: { x: number; y: number; w: number; h: number }
  type: 'front' | 'back' | 'sleeve' | 'pocket' | 'custom' | 'embroidery_chest_left' | 'embroidery_chest_right' | 'full_wrap' | 'all_over'
  printMethods: ('dtg' | 'screen_print' | 'embroidery' | 'vinyl' | 'sublimation' | 'heat_transfer')[]
  techniques: string[]
  maxColors?: number
  layerSupport: {
    maxLayers: number
    supportedTypes: string[]
    blendModes: string[]
  }
  constraints: {
    minWidth: number
    minHeight: number
    maxWidth: number
    maxHeight: number
    aspectRatio?: number
    margin: number
    allowRotation: boolean
    allowResize: boolean
    snapToGrid?: boolean
    gridSize?: number
  }
  pricing: {
    basePrice: number
    colorPrice: number
    layerPrice: number
    setupFee: number
    currency: string
    priceBreaks?: Array<{
      quantity: number
      discount: number
      type: 'percentage' | 'fixed'
    }>
    bulkPricing?: Array<{
      minQuantity: number
      maxQuantity?: number
      pricePerUnit: number
      setupFee?: number
    }>
    expressDeliveryFee?: number
  }
  mockup: {
    templateUrl?: string
    overlayUrl?: string
    backgroundUrl?: string
    previewScale: number
    variants?: Array<{
      color: string
      imageUrl: string
    }>
  }
  validation: {
    minDPI: number
    recommendedDPI: number
    maxFileSize: string
    supportedFormats: string[]
    colorModes: string[]
    allowedFileTypes: string[]
  }
  isActive: boolean
  sortOrder: number
  metadata?: Record<string, any>
  categories?: string[]
  targetMarket?: 'individual' | 'corporate' | 'both'
}

// Mock storage for design areas (in production, this would be in the database)
const mockDesignAreas: Record<string, DesignAreaConfig[]> = {}

// Default design area templates following clothes2order.com structure
const getDefaultDesignAreas = (productTypeId: string): DesignAreaConfig[] => [
  {
    id: `${productTypeId}_front`,
    name: 'Front Design Area',
    description: 'Main front design area for logos and graphics',
    position: { x: 150, y: 120 },
    dimensions: { width: 250, height: 300 },
    boundaries: { x: 150, y: 120, w: 250, h: 300 },
    type: 'front',
    printMethods: ['dtg', 'screen_print', 'embroidery', 'vinyl'],
    techniques: ['dtg', 'screen_print'],
    maxColors: 12,
    layerSupport: {
      maxLayers: 5,
      supportedTypes: ['file', 'text', 'logo'],
      blendModes: ['normal', 'multiply', 'overlay']
    },
    constraints: {
      minWidth: 50,
      minHeight: 50,
      maxWidth: 300,
      maxHeight: 350,
      margin: 15,
      allowRotation: true,
      allowResize: true,
      snapToGrid: true,
      gridSize: 10
    },
    pricing: {
      basePrice: 2.50,
      colorPrice: 0.75,
      layerPrice: 1.25,
      setupFee: 5.00,
      currency: 'USD',
      bulkPricing: [
        { minQuantity: 1, maxQuantity: 9, pricePerUnit: 2.50, setupFee: 5.00 },
        { minQuantity: 10, maxQuantity: 24, pricePerUnit: 2.25, setupFee: 3.00 },
        { minQuantity: 25, maxQuantity: 49, pricePerUnit: 2.00, setupFee: 2.00 },
        { minQuantity: 50, maxQuantity: 99, pricePerUnit: 1.85, setupFee: 1.00 },
        { minQuantity: 100, pricePerUnit: 1.60, setupFee: 0.00 }
      ],
      priceBreaks: [
        { quantity: 10, discount: 10, type: 'percentage' },
        { quantity: 25, discount: 15, type: 'percentage' },
        { quantity: 50, discount: 20, type: 'percentage' },
        { quantity: 100, discount: 25, type: 'percentage' }
      ],
      expressDeliveryFee: 15.00
    },
    mockup: {
      previewScale: 1.0,
      variants: [
        { color: 'white', imageUrl: '/mockups/tshirt-white-front.jpg' },
        { color: 'black', imageUrl: '/mockups/tshirt-black-front.jpg' },
        { color: 'navy', imageUrl: '/mockups/tshirt-navy-front.jpg' }
      ]
    },
    validation: {
      minDPI: 150,
      recommendedDPI: 300,
      maxFileSize: '50MB',
      supportedFormats: ['PNG', 'JPG', 'SVG', 'PDF', 'AI', 'EPS'],
      colorModes: ['RGB', 'CMYK'],
      allowedFileTypes: ['image/png', 'image/jpeg', 'image/svg+xml', 'application/pdf']
    },
    isActive: true,
    sortOrder: 0,
    categories: ['apparel', 'corporate', 'promotional'],
    targetMarket: 'both'
  },
  {
    id: `${productTypeId}_back`,
    name: 'Back Design Area',
    description: 'Full back design area for larger graphics',
    position: { x: 100, y: 100 },
    dimensions: { width: 300, height: 400 },
    boundaries: { x: 100, y: 100, w: 300, h: 400 },
    type: 'back',
    printMethods: ['dtg', 'screen_print', 'vinyl'],
    techniques: ['dtg', 'screen_print'],
    maxColors: 12,
    layerSupport: {
      maxLayers: 5,
      supportedTypes: ['file', 'text', 'logo'],
      blendModes: ['normal', 'multiply', 'overlay']
    },
    constraints: {
      minWidth: 75,
      minHeight: 75,
      maxWidth: 350,
      maxHeight: 450,
      margin: 20,
      allowRotation: true,
      allowResize: true,
      snapToGrid: true,
      gridSize: 10
    },
    pricing: {
      basePrice: 3.00,
      colorPrice: 0.85,
      layerPrice: 1.50,
      setupFee: 6.00,
      currency: 'USD',
      bulkPricing: [
        { minQuantity: 1, maxQuantity: 9, pricePerUnit: 3.00, setupFee: 6.00 },
        { minQuantity: 10, maxQuantity: 24, pricePerUnit: 2.70, setupFee: 4.00 },
        { minQuantity: 25, maxQuantity: 49, pricePerUnit: 2.40, setupFee: 3.00 },
        { minQuantity: 50, maxQuantity: 99, pricePerUnit: 2.20, setupFee: 2.00 },
        { minQuantity: 100, pricePerUnit: 1.95, setupFee: 0.00 }
      ],
      expressDeliveryFee: 15.00
    },
    mockup: {
      previewScale: 1.0,
      variants: [
        { color: 'white', imageUrl: '/mockups/tshirt-white-back.jpg' },
        { color: 'black', imageUrl: '/mockups/tshirt-black-back.jpg' },
        { color: 'navy', imageUrl: '/mockups/tshirt-navy-back.jpg' }
      ]
    },
    validation: {
      minDPI: 150,
      recommendedDPI: 300,
      maxFileSize: '50MB',
      supportedFormats: ['PNG', 'JPG', 'SVG', 'PDF', 'AI', 'EPS'],
      colorModes: ['RGB', 'CMYK'],
      allowedFileTypes: ['image/png', 'image/jpeg', 'image/svg+xml', 'application/pdf']
    },
    isActive: true,
    sortOrder: 1,
    categories: ['apparel', 'corporate', 'promotional'],
    targetMarket: 'both'
  }
]

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
) {
  try {
    const { id: productTypeId } = req.params

    if (!productTypeId) {
      return res.status(400).json({ message: "Missing product type id" })
    }

    // Get or create design areas for this product type
    if (!mockDesignAreas[productTypeId]) {
      mockDesignAreas[productTypeId] = getDefaultDesignAreas(productTypeId)
    }

    const designAreas = mockDesignAreas[productTypeId]

    return res.json({
      productType: {
        id: productTypeId,
        value: 'mock-product-type',
        metadata: {}
      },
      designAreas,
      designCapabilities: {
        maxDesignAreas: Math.min(designAreas.length, 4),
        supportedFormats: ['PNG', 'JPG', 'SVG', 'PDF'],
        maxFileSize: '25MB',
        minResolution: '150dpi',
        recommendedResolution: '300dpi',
        colorModes: ['RGB', 'CMYK'],
        maxColors: Math.max(...designAreas.map(area => area.maxColors || 6)),
        printMethods: [...new Set(designAreas.flatMap(area => area.printMethods))]
      }
    })

  } catch (error: any) {
    console.error('Error fetching design areas:', error)
    return res.status(500).json({ message: error?.message || "Failed to retrieve design areas" })
  }
}

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
) {
  try {
    const { id: productTypeId } = req.params
    const areaData = req.body as Partial<DesignAreaConfig>

    if (!productTypeId) {
      return res.status(400).json({ message: "Missing product type id" })
    }

    if (!areaData.name || !areaData.type) {
      return res.status(400).json({ message: "Missing required fields: name, type" })
    }

    // Initialize design areas array if not exists
    if (!mockDesignAreas[productTypeId]) {
      mockDesignAreas[productTypeId] = []
    }

    // Create new design area with defaults
    const newArea: DesignAreaConfig = {
      id: `${productTypeId}_${Date.now()}`,
      name: areaData.name,
      description: areaData.description,
      position: areaData.position || { x: 100, y: 100 },
      dimensions: areaData.dimensions || { width: 200, height: 200 },
      boundaries: areaData.boundaries || { x: 100, y: 100, w: 200, h: 200 },
      type: areaData.type,
      printMethods: areaData.printMethods || ['dtg'],
      techniques: areaData.techniques || ['dtg'],
      maxColors: areaData.maxColors || 6,
      layerSupport: areaData.layerSupport || {
        maxLayers: 3,
        supportedTypes: ['file', 'text'],
        blendModes: ['normal']
      },
      constraints: areaData.constraints || {
        minWidth: 50,
        minHeight: 50,
        maxWidth: 250,
        maxHeight: 250,
        margin: 10,
        allowRotation: true,
        allowResize: true
      },
      pricing: areaData.pricing || {
        basePrice: 2.0,
        colorPrice: 0.5,
        layerPrice: 1.0,
        setupFee: 0.0,
        currency: 'USD'
      },
      mockup: areaData.mockup || {
        previewScale: 1.0
      },
      validation: areaData.validation || {
        minDPI: 150,
        recommendedDPI: 300,
        maxFileSize: '25MB',
        supportedFormats: ['PNG', 'JPG', 'SVG'],
        colorModes: ['RGB']
      },
      isActive: areaData.isActive !== false,
      sortOrder: areaData.sortOrder || mockDesignAreas[productTypeId].length,
      metadata: areaData.metadata
    }

    mockDesignAreas[productTypeId].push(newArea)

    return res.status(201).json({
      designArea: newArea,
      message: 'Design area created successfully'
    })

  } catch (error: any) {
    console.error('Error creating design area:', error)
    return res.status(500).json({ message: error?.message || "Failed to create design area" })
  }
}