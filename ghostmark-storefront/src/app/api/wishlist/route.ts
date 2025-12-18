import { NextRequest, NextResponse } from "next/server"
import { getRegion } from "@lib/data/regions"
import { listProducts } from "@lib/data/products"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const idsParam = searchParams.get("ids") || ""
    const countryCode = searchParams.get("countryCode") || undefined

    if (!countryCode) {
      return NextResponse.json({ message: "countryCode is required" }, { status: 400 })
    }

    const region = await getRegion(countryCode)
    if (!region) {
      return NextResponse.json({ message: "Region not found" }, { status: 400 })
    }

    const ids = idsParam
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)

    if (!ids.length) {
      return NextResponse.json({ products: [], count: 0 })
    }

    // Limit to a sane number to avoid huge queries
    const MAX = 50
    const slice = ids.slice(0, MAX)

    const { response } = await listProducts({
      regionId: region.id,
      queryParams: {
        id: slice as any,
        limit: slice.length,
        // Safe essential fields for grid rendering
        fields:
          "+metadata,+tags,*images,*variants,*variants.images,*variants.calculated_price,thumbnail,title,handle,*type",
      },
    })

    // Preserve the order of IDs as given by the client when possible
    const map = new Map(response.products.map((p) => [p.id!, p]))
    const ordered = slice.map((id) => map.get(id)).filter(Boolean)

    return NextResponse.json({ products: ordered, count: ordered.length })
  } catch (e: any) {
    const message = e?.message || "Failed to load wishlist"
    return NextResponse.json({ message }, { status: 500 })
  }
}
