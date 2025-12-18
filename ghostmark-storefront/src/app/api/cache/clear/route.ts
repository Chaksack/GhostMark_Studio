import { NextRequest, NextResponse } from "next/server"
import { revalidateTag } from "next/cache"
import { cookies } from "next/headers"

// Bases used across the app when tagging fetches via getCacheOptions
const TAG_BASES = [
  "products",
  "collections",
  "categories",
  "regions",
  "customers",
  "carts",
  "fulfillment",
  "payment_providers",
  "orders",
  "variants",
  "product-types",
  "shippingOptions",
]

export async function POST(_req: NextRequest) {
  try {
    const c = await cookies()
    const oldId = c.get("_medusa_cache_id")?.value || null

    // If we know the old cache id, actively revalidate known tags
    const revalidated: string[] = []
    if (oldId) {
      for (const base of TAG_BASES) {
        const tag = `${base}-${oldId}`
        try {
          // Best effort; even if a tag wasn't used, calling is harmless
          revalidateTag(tag)
          revalidated.push(tag)
        } catch {
          // ignore
        }
      }
    }

    // Rotate the cache id cookie so subsequent requests use a fresh tag set
    const newId = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    c.set("_medusa_cache_id", newId, {
      maxAge: 60 * 60 * 24 * 7, // 7 days
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    })

    return NextResponse.json({ ok: true, oldId, newId, revalidated })
  } catch (e: any) {
    const message = e?.message || "Failed to clear cache"
    return NextResponse.json({ ok: false, message }, { status: 500 })
  }
}

// Allow a simple GET for convenience, behaves the same as POST
export const GET = POST
