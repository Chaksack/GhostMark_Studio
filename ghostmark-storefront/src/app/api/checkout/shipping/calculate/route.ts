import { NextRequest, NextResponse } from "next/server"
import { calculatePriceForShippingOption } from "@lib/data/fulfillment"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const optionId: string | undefined = body?.optionId
    const cartId: string | undefined = body?.cartId
    const data: Record<string, unknown> | undefined = body?.data

    if (!optionId) {
      return NextResponse.json({ message: "optionId is required" }, { status: 400 })
    }
    if (!cartId) {
      return NextResponse.json({ message: "cartId is required" }, { status: 400 })
    }

    const shippingOption = await calculatePriceForShippingOption(optionId, cartId, data)
    if (!shippingOption) {
      return NextResponse.json({ message: "Failed to calculate price" }, { status: 500 })
    }

    return NextResponse.json({ shipping_option: shippingOption })
  } catch (e: any) {
    const message = e?.message || "Failed to calculate shipping option"
    return NextResponse.json({ message }, { status: 500 })
  }
}
