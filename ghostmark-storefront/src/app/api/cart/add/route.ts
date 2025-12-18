import { NextRequest, NextResponse } from "next/server"
import { addToCart } from "@lib/data/cart"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const variantId: string | undefined = body?.variantId
    const quantity: number = Number(body?.quantity ?? 1)
    const countryCode: string | undefined = body?.countryCode

    if (!variantId) {
      return NextResponse.json({ message: "variantId is required" }, { status: 400 })
    }
    if (!countryCode) {
      return NextResponse.json({ message: "countryCode is required" }, { status: 400 })
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return NextResponse.json({ message: "quantity must be a positive number" }, { status: 400 })
    }

    await addToCart({ variantId, quantity, countryCode })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    const message = e?.message || "Failed to add to cart"
    return NextResponse.json({ message }, { status: 500 })
  }
}
