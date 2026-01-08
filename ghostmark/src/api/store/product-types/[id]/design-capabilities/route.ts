import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

interface DesignCapabilities {
  maxPrintAreas: number
  supportedFormats: string[]
  maxFileSize: string
  minResolution: string
  recommendedResolution: string
  colorModes: string[]
  maxColors: number
  printMethods: string[]
  hasProductTypeSupport: boolean
  qualityRequirements: {
    minDPI: number
    recommendedDPI: number
    maxFileSize: number
    supportedColorSpaces: string[]
  }
  costFactors: {
    baseSetupFee: number
    perColorCost: number
    perLayerCost: number
    qualityMultipliers: {
      lowQuality: number
      standardQuality: number
      highQuality: number
      printReady: number
    }
  }
}

// GET /store/product-types/:id/design-capabilities - Get design capabilities for product type
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const { id: productTypeId } = req.params as { id: string }

    if (!productTypeId) {
      return res.status(400).json({
        error: "Product type ID is required"
      })
    }

    // In a real implementation, this would fetch from database
    // For now, return enhanced capabilities based on Gelato's approach
    const capabilities: DesignCapabilities = {
      maxPrintAreas: 6,
      supportedFormats: ['JPEG', 'PNG', 'SVG', 'PDF'],
      maxFileSize: '50MB',
      minResolution: '150 DPI',
      recommendedResolution: '300 DPI',
      colorModes: ['RGB', 'CMYK'],
      maxColors: 8,
      printMethods: ['DTG', 'Screen Print', 'Embroidery', 'Heat Transfer'],
      hasProductTypeSupport: true,
      qualityRequirements: {
        minDPI: 150,
        recommendedDPI: 300,
        maxFileSize: 50 * 1024 * 1024, // 50MB
        supportedColorSpaces: ['sRGB', 'Adobe RGB', 'CMYK']
      },
      costFactors: {
        baseSetupFee: 2.50,
        perColorCost: 0.75,
        perLayerCost: 0.50,
        qualityMultipliers: {
          lowQuality: 1.2, // 20% surcharge for low quality
          standardQuality: 1.0,
          highQuality: 0.95, // 5% discount for high quality
          printReady: 0.9 // 10% discount for print-ready files
        }
      }
    }

    // Customize capabilities based on product type
    switch (productTypeId) {
      case 't-shirt':
      case 'apparel':
        capabilities.maxPrintAreas = 8
        capabilities.printMethods = ['DTG', 'Screen Print', 'Heat Transfer', 'Vinyl']
        capabilities.maxColors = 12
        break
      
      case 'poster':
      case 'print':
        capabilities.maxPrintAreas = 1
        capabilities.printMethods = ['Digital Print', 'Offset Print']
        capabilities.qualityRequirements.recommendedDPI = 300
        capabilities.maxColors = 4
        break
      
      case 'mug':
      case 'ceramic':
        capabilities.maxPrintAreas = 2
        capabilities.printMethods = ['Sublimation', 'Digital Transfer']
        capabilities.qualityRequirements.recommendedDPI = 200
        break
      
      case 'canvas':
        capabilities.maxPrintAreas = 1
        capabilities.printMethods = ['Digital Print', 'Giclee']
        capabilities.qualityRequirements.recommendedDPI = 300
        capabilities.maxFileSize = '100MB'
        break
        
      default:
        // Keep default capabilities
        break
    }

    res.json({
      productTypeId,
      capabilities,
      recommendations: [
        'Use vector files (SVG, PDF) for best quality',
        'Ensure images are at least 300 DPI for print',
        'Use RGB color mode for digital files',
        'Keep file sizes under 50MB for best processing speed'
      ],
      supportedWorkflows: [
        {
          name: 'Simple Design Upload',
          description: 'Upload a single image to one print area',
          steps: ['Select print area', 'Upload design file', 'Review quality', 'Confirm order']
        },
        {
          name: 'Multi-Area Design',
          description: 'Add designs to multiple print areas',
          steps: ['Select multiple areas', 'Upload files for each area', 'Review layout', 'Confirm order']
        },
        {
          name: 'Design Editor',
          description: 'Create custom designs with text and graphics',
          steps: ['Open design editor', 'Add text/graphics', 'Customize layout', 'Export and order']
        }
      ]
    })

  } catch (error: any) {
    console.error('Error fetching design capabilities:', error)
    res.status(500).json({
      error: "Failed to fetch design capabilities",
      message: error.message
    })
  }
}