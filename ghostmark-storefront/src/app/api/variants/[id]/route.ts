import { NextRequest, NextResponse } from "next/server"
import { sdk } from "@lib/config"
import { getAuthHeaders } from "@lib/data/cookies"
import { getRegion } from "@lib/data/regions"
import type { HttpTypes } from "@medusajs/types"
import { convertToLocale } from "@lib/util/money"

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
  { params }: { params: { id: string } }
) {
  try {
    const id = params?.id
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

    const { variant }: { variant: HttpTypes.StoreProductVariant } = await sdk.client.fetch(
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

    if (!variant) {
      return NextResponse.json({ message: "Variant not found" }, { status: 404 })
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
    const printAreas = processPrintAreas(metadata)

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
      printAreas,
      designCapabilities: {
        maxPrintAreas: printAreas.length,
        supportedFormats: ['PNG', 'JPG', 'SVG'],
        maxFileSize: '10MB',
        minResolution: '300dpi',
        colorModes: ['RGB', 'CMYK']
      }
    })
  } catch (e: any) {
    const message = e?.message || "Failed to retrieve variant"
    return NextResponse.json({ message }, { status: 500 })
  }
}
