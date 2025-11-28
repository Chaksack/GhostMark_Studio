import { NextRequest, NextResponse } from "next/server"
import { addToCustomProductCart } from "@lib/data/cart"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      cartId,
      variantId,
      designMetadata,
      quantity = 1,
      countryCode,
    } = body || {}

    if (!variantId) {
      return NextResponse.json(
        { message: "variantId is required" },
        { status: 400 }
      )
    }

    if (!designMetadata || typeof designMetadata !== "object") {
      return NextResponse.json(
        { message: "designMetadata is required" },
        { status: 400 }
      )
    }

    await addToCustomProductCart({
      cartId,
      variantId,
      designMetadata,
      quantity,
      countryCode,
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    const message = e?.message || "Failed to add customized item to cart"
    return NextResponse.json({ message }, { status: 500 })
  }
}
