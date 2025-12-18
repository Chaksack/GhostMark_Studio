import { NextRequest, NextResponse } from "next/server"
import { listCartShippingMethods } from "@lib/data/fulfillment"

// GET /api/checkout/shipping/options?cartId=...
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const cartId = searchParams.get("cartId") || undefined

    if (!cartId) {
      return NextResponse.json({ message: "cartId is required" }, { status: 400 })
    }

    const shipping_options = await listCartShippingMethods(cartId)
    if (!shipping_options) {
      return NextResponse.json({ shipping_options: [] })
    }

    return NextResponse.json({ shipping_options })
  } catch (e: any) {
    const message = e?.message || "Failed to list shipping options"
    return NextResponse.json({ message }, { status: 500 })
  }
}
