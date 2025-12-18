import { NextResponse } from "next/server"
import { retrieveCart } from "@lib/data/cart"

function getOrigin(req: Request) {
  const origin = req.headers.get("origin")
  if (origin) return origin
  const host = req.headers.get("host") || "localhost:8000"
  const proto = host.includes("localhost") || host.startsWith("127.") ? "http" : "https"
  return `${proto}://${host}`
}

export async function POST(req: Request) {
  try {
    const secretKey =
      process.env.STRIPE_SECRET_KEY || process.env.MEDUSA_PAYMENTS_SECRET_KEY

    if (!secretKey) {
      return NextResponse.json(
        { message: "Stripe secret key is not configured." },
        { status: 500 }
      )
    }

    // Get the current cart to build line items
    const cart = await retrieveCart()
    if (!cart || !cart.items || cart.items.length === 0) {
      return NextResponse.json(
        { message: "Your cart is empty." },
        { status: 400 }
      )
    }

    const origin = getOrigin(req)

    // Build x-www-form-urlencoded body for Stripe API
    const params = new URLSearchParams()
    params.append("mode", "payment")
    params.append("success_url", `${origin}/?payment=success&session_id={CHECKOUT_SESSION_ID}`)
    params.append("cancel_url", `${origin}/cart?payment=cancelled`)
    params.append("client_reference_id", cart.id)

    // Add each cart item as a line_item
    cart.items.forEach((item: any, idx: number) => {
      const unitAmount: number | undefined =
        typeof item.unit_price === "number"
          ? item.unit_price
          : typeof item.total === "number" && item.quantity
          ? Math.max(0, Math.round(item.total / item.quantity))
          : undefined

      const quantity: number = item.quantity || 1
      const currency = (cart.currency_code || "usd").toLowerCase()
      const name: string = item.title || "Item"

      // price_data
      params.append(`line_items[${idx}][quantity]`, String(quantity))
      params.append(
        `line_items[${idx}][price_data][currency]`,
        currency
      )
      params.append(
        `line_items[${idx}][price_data][product_data][name]`,
        name
      )
      if (item.thumbnail) {
        params.append(
          `line_items[${idx}][price_data][product_data][images][0]`,
          item.thumbnail
        )
      }
      params.append(
        `line_items[${idx}][price_data][unit_amount]`,
        String(unitAmount ?? 0)
      )
    })

    // Optional: pass cart id in metadata
    params.append("metadata[cart_id]", cart.id)

    const headers: Record<string, string> = {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    }

    // Support connected accounts when provided
    if (process.env.NEXT_PUBLIC_MEDUSA_PAYMENTS_ACCOUNT_ID) {
      headers["Stripe-Account"] = process.env.NEXT_PUBLIC_MEDUSA_PAYMENTS_ACCOUNT_ID
    }

    const resp = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers,
      body: params.toString(),
      cache: "no-store",
    })

    const data = await resp.json()

    if (!resp.ok) {
      return NextResponse.json(
        { message: data?.error?.message || "Failed to create session" },
        { status: 400 }
      )
    }

    return NextResponse.json({ id: data.id })
  } catch (e: any) {
    return NextResponse.json(
      { message: e?.message || "Unexpected error" },
      { status: 500 }
    )
  }
}

export const dynamic = "force-dynamic"
