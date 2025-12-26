import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

// Enhanced design area type following print-on-demand best practices
interface DesignArea {
  id: string
  name: string
  position: { x: number; y: number; z?: number }
  dimensions: { width: number; height: number }
  boundaries: { x: number; y: number; w: number; h: number }
  type: 'front' | 'back' | 'sleeve' | 'pocket' | 'custom'
  printMethods: string[]
  maxColors?: number
  constraints: {
    minWidth: number
    minHeight: number
    maxWidth: number
    maxHeight: number
    aspectRatio?: number
    margin: number
  }
  pricing?: {
    basePrice: number
    colorPrice: number
    currency: string
  }
}

// Default design areas based on product type
const getDefaultDesignAreas = (productType: string): DesignArea[] => {
  const baseAreas: Record<string, DesignArea[]> = {
    't-shirt': [
      {
        id: 'tshirt_front',
        name: 'Front Design Area',
        position: { x: 150, y: 120 },
        dimensions: { width: 250, height: 300 },
        boundaries: { x: 150, y: 120, w: 250, h: 300 },
        type: 'front',
        printMethods: ['dtg', 'screen', 'vinyl'],
        constraints: {
          minWidth: 50,
          minHeight: 50,
          maxWidth: 300,
          maxHeight: 350,
          margin: 15
        },
        pricing: {
          basePrice: 2.0,
          colorPrice: 0.5,
          currency: 'USD'
        }
      },
      {
        id: 'tshirt_back',
        name: 'Back Design Area',
        position: { x: 150, y: 120 },
        dimensions: { width: 250, height: 300 },
        boundaries: { x: 150, y: 120, w: 250, h: 300 },
        type: 'back',
        printMethods: ['dtg', 'screen', 'vinyl'],
        constraints: {
          minWidth: 50,
          minHeight: 50,
          maxWidth: 300,
          maxHeight: 350,
          margin: 15
        },
        pricing: {
          basePrice: 1.5,
          colorPrice: 0.3,
          currency: 'USD'
        }
      }
    ],
    'hoodie': [
      {
        id: 'hoodie_front',
        name: 'Front Design Area',
        position: { x: 150, y: 140 },
        dimensions: { width: 280, height: 320 },
        boundaries: { x: 150, y: 140, w: 280, h: 320 },
        type: 'front',
        printMethods: ['dtg', 'screen', 'embroidery'],
        constraints: {
          minWidth: 60,
          minHeight: 60,
          maxWidth: 320,
          maxHeight: 380,
          margin: 20
        },
        pricing: {
          basePrice: 3.0,
          colorPrice: 0.7,
          currency: 'USD'
        }
      },
      {
        id: 'hoodie_back',
        name: 'Back Design Area',
        position: { x: 150, y: 140 },
        dimensions: { width: 280, height: 320 },
        boundaries: { x: 150, y: 140, w: 280, h: 320 },
        type: 'back',
        printMethods: ['dtg', 'screen', 'embroidery'],
        constraints: {
          minWidth: 60,
          minHeight: 60,
          maxWidth: 320,
          maxHeight: 380,
          margin: 20
        },
        pricing: {
          basePrice: 2.5,
          colorPrice: 0.5,
          currency: 'USD'
        }
      }
    ],
    'mug': [
      {
        id: 'mug_wrap',
        name: 'Wrap Around Design',
        position: { x: 50, y: 80 },
        dimensions: { width: 300, height: 200 },
        boundaries: { x: 50, y: 80, w: 300, h: 200 },
        type: 'custom',
        printMethods: ['sublimation', 'ceramic'],
        constraints: {
          minWidth: 100,
          minHeight: 50,
          maxWidth: 350,
          maxHeight: 250,
          aspectRatio: 1.5,
          margin: 10
        },
        pricing: {
          basePrice: 1.0,
          colorPrice: 0.2,
          currency: 'USD'
        }
      }
    ],
    'sticker': [
      {
        id: 'sticker_main',
        name: 'Main Design Area',
        position: { x: 25, y: 25 },
        dimensions: { width: 150, height: 150 },
        boundaries: { x: 25, y: 25, w: 150, h: 150 },
        type: 'custom',
        printMethods: ['digital', 'vinyl'],
        constraints: {
          minWidth: 25,
          minHeight: 25,
          maxWidth: 200,
          maxHeight: 200,
          margin: 5
        },
        pricing: {
          basePrice: 0.5,
          colorPrice: 0.1,
          currency: 'USD'
        }
      }
    ]
  }

  const normalizedType = productType.toLowerCase().replace(/[-_\s]/g, '')
  
  // Find matching type or use generic pattern
  for (const [key, areas] of Object.entries(baseAreas)) {
    if (normalizedType.includes(key) || key.includes(normalizedType)) {
      return areas
    }
  }

  // Default fallback design area
  return [
    {
      id: 'default_front',
      name: 'Design Area',
      position: { x: 100, y: 100 },
      dimensions: { width: 200, height: 200 },
      boundaries: { x: 100, y: 100, w: 200, h: 200 },
      type: 'front',
      printMethods: ['digital'],
      constraints: {
        minWidth: 50,
        minHeight: 50,
        maxWidth: 250,
        maxHeight: 250,
        margin: 10
      },
      pricing: {
        basePrice: 1.0,
        colorPrice: 0.2,
        currency: 'USD'
      }
    }
  ]
}

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: productTypeId } = await params

    if (!productTypeId) {
      return res.status(400).json({ message: "Missing product type id" })
    }

    // Mock product type for now (in production, would fetch from database)
    const product_type = {
      id: productTypeId,
      value: 'mock-product-type',
      metadata: {}
    }

    // Get design areas from metadata or generate defaults
    const metadata: Record<string, any> = product_type.metadata || {}
    let designAreas: DesignArea[] = []

    // Check for existing design areas in metadata
    if (metadata.design_areas) {
      try {
        const storedAreas = typeof metadata.design_areas === 'string' 
          ? JSON.parse(metadata.design_areas) 
          : metadata.design_areas
        
        if (Array.isArray(storedAreas)) {
          designAreas = storedAreas
        }
      } catch (error) {
        console.warn('Failed to parse stored design areas:', error)
      }
    }

    // If no stored design areas, generate defaults based on product type
    if (designAreas.length === 0) {
      designAreas = getDefaultDesignAreas(product_type.value || 'default')
    }

    return res.json({
      productType: {
        id: product_type.id,
        value: product_type.value,
        metadata: product_type.metadata
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
    console.error('Error fetching product type design areas:', error)
    const message = error?.message || "Failed to retrieve product type design areas"
    return res.status(500).json({ message })
  }
}