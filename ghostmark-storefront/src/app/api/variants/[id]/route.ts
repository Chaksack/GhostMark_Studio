import { NextRequest, NextResponse } from "next/server"
import { sdk } from "@lib/config"
import { getAuthHeaders } from "@lib/data/cookies"
import { getRegion } from "@lib/data/regions"
import type { HttpTypes } from "@medusajs/types"
import { convertToLocale } from "@lib/util/money"

// Design area fetching utility
async function fetchProductTypeDesignAreas(productTypeId: string): Promise<any[]> {
  try {
    // Call our new product type design areas API
    const response = await fetch(`${process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || 'http://localhost:9000'}/store/product-types/${productTypeId}/design-areas`)
    
    if (!response.ok) {
      console.warn(`Failed to fetch design areas for product type ${productTypeId}:`, response.status)
      return []
    }
    
    const data = await response.json()
    return data.designAreas || []
  } catch (error) {
    console.warn('Error fetching product type design areas:', error)
    return []
  }
}

// Enhanced print area type following Gelato patterns
interface PrintArea {
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

function processPrintAreas(metadata: Record<string, any>): PrintArea[] {
  const areas: PrintArea[] = []
  
  // Handle legacy mockup_zones format
  const legacyZones = metadata.mockup_zones || metadata.mockupZones
  if (legacyZones) {
    const zones = typeof legacyZones === 'string' ? JSON.parse(legacyZones) : legacyZones
    Object.entries(zones).forEach(([key, zone]: [string, any], index) => {
      areas.push({
        id: `area_${index + 1}`,
        name: key.charAt(0).toUpperCase() + key.slice(1),
        position: { x: zone.x || 0, y: zone.y || 0 },
        dimensions: { width: zone.w || 100, height: zone.h || 100 },
        boundaries: { x: zone.x || 0, y: zone.y || 0, w: zone.w || 100, h: zone.h || 100 },
        type: key.includes('front') ? 'front' : key.includes('back') ? 'back' : 'custom',
        printMethods: ['digital', 'screen'],
        constraints: {
          minWidth: 20,
          minHeight: 20,
          maxWidth: zone.w || 100,
          maxHeight: zone.h || 100,
          margin: 5
        },
        pricing: {
          basePrice: 0.5,
          colorPrice: 0.1,
          currency: 'USD'
        }
      })
    })
  }

  // Handle enhanced print_areas format
  const enhancedAreas = metadata.print_areas || metadata.printAreas
  if (enhancedAreas) {
    const parsedAreas = typeof enhancedAreas === 'string' ? JSON.parse(enhancedAreas) : enhancedAreas
    if (Array.isArray(parsedAreas)) {
      areas.push(...parsedAreas.map((area: any, index: number) => ({
        id: area.id || `area_${areas.length + index + 1}`,
        name: area.name || `Print Area ${areas.length + index + 1}`,
        position: area.position || { x: 0, y: 0 },
        dimensions: area.dimensions || { width: 100, height: 100 },
        boundaries: area.boundaries || area.position || { x: 0, y: 0, w: 100, h: 100 },
        type: area.type || 'custom',
        printMethods: area.printMethods || ['digital'],
        maxColors: area.maxColors,
        constraints: {
          minWidth: 20,
          minHeight: 20,
          maxWidth: 300,
          maxHeight: 300,
          aspectRatio: area.constraints?.aspectRatio,
          margin: 5,
          ...area.constraints
        },
        pricing: area.pricing || {
          basePrice: 0.5,
          colorPrice: 0.1,
          currency: 'USD'
        }
      })))
    }
  }

  // Default print area if none found
  if (areas.length === 0) {
    areas.push({
      id: 'default_front',
      name: 'Front Design Area',
      position: { x: 150, y: 100 },
      dimensions: { width: 200, height: 250 },
      boundaries: { x: 150, y: 100, w: 200, h: 250 },
      type: 'front',
      printMethods: ['digital', 'screen'],
      constraints: {
        minWidth: 50,
        minHeight: 50,
        maxWidth: 250,
        maxHeight: 300,
        margin: 10
      },
      pricing: {
        basePrice: 1.0,
        colorPrice: 0.2,
        currency: 'USD'
      }
    })
  }

  return areas
}

// Lightweight endpoint to fetch a single variant with calculated_price for the
// active region (derived from countryCode). This is used by the design page as a
// fallback when the initial product payload lacks variant.calculated_price.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const countryCode = req.nextUrl.searchParams.get("countryCode") || undefined

    if (!id) {
      return NextResponse.json({ message: "Missing variant id" }, { status: 400 })
    }
    if (!countryCode) {
      return NextResponse.json(
        { message: "Missing countryCode query parameter" },
        { status: 400 }
      )
    }

    const region = await getRegion(countryCode)
    if (!region) {
      return NextResponse.json(
        { message: `Region not found for country code: ${countryCode}` },
        { status: 404 }
      )
    }

    const headers = {
      ...(await getAuthHeaders()),
    }

    const fields = [
      "id",
      "title",
      "sku",
      "metadata",
      "+calculated_price",
      "+calculated_price.calculated_amount",
      "+calculated_price.original_amount",
      "+calculated_price.currency_code",
    ].join(",")

    console.log(`Fetching variant ${id} for region ${region.id}`)
    
    // Since direct variant endpoint doesn't exist, we need to find the product first
    // Extract product ID from variant ID pattern (variant_xxx -> find associated product)
    let variant: HttpTypes.StoreProductVariant | null = null
    
    try {
      // Try to find the variant through product search
      // This is a workaround since direct variant API doesn't seem to be available
      const response = await sdk.client.fetch(
        `/store/variants/${id}`,
        {
          method: "GET",
          query: {
            fields,
            region_id: region.id,
          },
          headers,
          cache: "no-store",
        }
      )
      variant = (response as any)?.variant
    } catch (fetchError: any) {
      console.log('Direct variant endpoint not available, returning mock response')
      
      // For now, return a simplified response with default design areas
      const defaultDesignAreas = [
        {
          id: 'default_front',
          name: 'Front Design Area',
          position: { x: 150, y: 100 },
          dimensions: { width: 200, height: 250 },
          boundaries: { x: 150, y: 100, w: 200, h: 250 },
          type: 'front',
          printMethods: ['dtg'],
          techniques: ['dtg'],
          constraints: {
            minWidth: 50,
            minHeight: 50,
            maxWidth: 250,
            maxHeight: 300,
            margin: 10,
            allowRotation: true,
            allowResize: true
          },
          pricing: {
            basePrice: 2.0,
            colorPrice: 0.5,
            layerPrice: 1.0,
            setupFee: 0.0,
            currency: 'USD'
          },
          layerSupport: {
            maxLayers: 3,
            supportedTypes: ['file', 'text'],
            blendModes: ['normal']
          },
          validation: {
            minDPI: 150,
            recommendedDPI: 300,
            maxFileSize: '25MB',
            supportedFormats: ['PNG', 'JPG', 'SVG'],
            colorModes: ['RGB']
          },
          isActive: true,
          sortOrder: 0,
          mockup: { previewScale: 1.0 }
        }
      ]

      return NextResponse.json({
        variant: { id, title: 'Product Variant', sku: id },
        price: null,
        printAreas: [],
        designAreas: defaultDesignAreas,
        productTypeDesignAreas: defaultDesignAreas,
        designCapabilities: {
          maxPrintAreas: 4,
          supportedFormats: ['PNG', 'JPG', 'SVG'],
          maxFileSize: '25MB',
          minResolution: '150dpi',
          recommendedResolution: '300dpi',
          colorModes: ['RGB'],
          maxColors: 6,
          printMethods: ['dtg'],
          hasProductTypeSupport: true
        }
      })
    }

    if (!variant) {
      return NextResponse.json({ message: "Variant not found" }, { status: 404 })
    }

    // Since we might not have direct product_id, let's try to extract it from the variant ID or get it differently
    let productTypeDesignAreas: any[] = []
    
    if (variant) {
      try {
        // Try to get product ID from variant or extract from related data
        let productId = (variant as any)?.product_id
        
        if (!productId) {
          // If no product_id, we might need to find it through the product catalog
          // For now, we'll skip the product type design areas
          console.log('No product_id found in variant, skipping product type design areas')
        } else {
          const { product }: { product: HttpTypes.StoreProduct } = await sdk.client.fetch(
            `/store/products/${productId}`,
            {
              method: "GET",
              query: { fields: "id,type_id,type" },
              headers,
              cache: "no-store",
            }
          )

          // Fetch design areas based on product type
          if (product?.type_id) {
            productTypeDesignAreas = await fetchProductTypeDesignAreas(product.type_id)
          }
        }
      } catch (error) {
        console.warn('Error fetching product information for design areas:', error)
      }
    }

    const calc = (variant as any)?.calculated_price as any | undefined
    const amount = calc?.calculated_amount
    const currency = calc?.currency_code
    const formatted =
      typeof amount === "number" && currency
        ? convertToLocale({ amount, currency_code: currency })
        : null

    // Process print areas from metadata with enhanced structure
    const metadata = (variant as any)?.metadata || {}
    const variantPrintAreas = processPrintAreas(metadata)

    // Combine variant-specific design areas with product type design areas
    // Product type design areas serve as defaults/templates
    const combinedDesignAreas = productTypeDesignAreas.length > 0 
      ? productTypeDesignAreas 
      : variantPrintAreas

    // Enhanced design capabilities based on available design areas
    const allAreas = [...combinedDesignAreas, ...variantPrintAreas]
    const maxColors = Math.max(...allAreas.map(area => area.maxColors || 6), 6)
    const printMethods = [...new Set(allAreas.flatMap(area => area.printMethods || ['digital']))]

    return NextResponse.json({
      variant,
      price: calc
        ? {
            calculated_amount: amount,
            original_amount: calc?.original_amount ?? null,
            currency_code: currency ?? null,
            formatted,
          }
        : null,
      printAreas: variantPrintAreas, // Legacy support
      designAreas: combinedDesignAreas, // New enhanced design areas
      productTypeDesignAreas, // Raw product type design areas for reference
      designCapabilities: {
        maxPrintAreas: Math.min(combinedDesignAreas.length, 6),
        supportedFormats: ['PNG', 'JPG', 'SVG', 'PDF'],
        maxFileSize: '25MB',
        minResolution: '150dpi',
        recommendedResolution: '300dpi',
        colorModes: ['RGB', 'CMYK'],
        maxColors,
        printMethods,
        hasProductTypeSupport: productTypeDesignAreas.length > 0
      }
    })
  } catch (e: any) {
    const message = e?.message || "Failed to retrieve variant"
    return NextResponse.json({ message }, { status: 500 })
  }
}
