import { NextRequest, NextResponse } from "next/server"
import { sdk } from "@lib/config"
import { getAuthHeaders } from "@lib/data/cookies"
import { getRegion } from "@lib/data/regions"
import type { HttpTypes } from "@medusajs/types"
import { convertToLocale } from "@lib/util/money"

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
    })
  } catch (e: any) {
    const message = e?.message || "Failed to retrieve variant"
    return NextResponse.json({ message }, { status: 500 })
  }
}
