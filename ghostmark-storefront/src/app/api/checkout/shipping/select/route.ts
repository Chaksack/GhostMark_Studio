import { NextRequest, NextResponse } from "next/server"
import { setShippingMethod } from "@lib/data/cart"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const cartId: string | undefined = body?.cartId
    const shippingMethodId: string | undefined = body?.shippingMethodId

    if (!cartId) {
      return NextResponse.json({ message: "cartId is required" }, { status: 400 })
    }
    if (!shippingMethodId) {
      return NextResponse.json({ message: "shippingMethodId is required" }, { status: 400 })
    }

    await setShippingMethod({ cartId, shippingMethodId })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    const message = e?.message || "Failed to set shipping method"
    return NextResponse.json({ message }, { status: 500 })
  }
}
