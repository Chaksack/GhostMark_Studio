import { NextRequest, NextResponse } from "next/server"
import { listProducts } from "@lib/data/products"
import { getRegion } from "@lib/data/regions"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get("q")
  const limit = parseInt(searchParams.get("limit") || "12")
  const countryCode = searchParams.get("countryCode") || "us"

  if (!query || query.length < 2) {
    return NextResponse.json({ products: [], count: 0 })
  }

  try {
    // Get region for proper pricing
    const region = await getRegion(countryCode)
    
    if (!region) {
      return NextResponse.json({ products: [], count: 0 })
    }

    // Following Context7 pattern for product search with text query
    const { response } = await listProducts({
      pageParam: 1,
      queryParams: {
        q: query, // Use the 'q' parameter for text search as per MedusaJS API
        limit,
        // Avoid requesting unsupported fields like 'type' which causes backend validation errors
        fields: "id,title,handle,description,*images", // Include essential fields only
      },
      countryCode,
    })

    // Transform products for search results
    const searchResults = response.products.map((product: any) => ({
      id: product.id,
      title: product.title,
      handle: product.handle,
      description: product.description,
      // Prefer product.product_type?.value if available; otherwise null
      type: (product as any).product_type?.value || (product as any).type?.value || null,
      thumbnail: product.images?.[0]?.url || null,
    }))

    return NextResponse.json({
      products: searchResults,
      count: response.count,
    })
  } catch (error) {
    console.error("Search API error:", error)
    return NextResponse.json(
      { products: [], count: 0, error: "Search failed" },
      { status: 500 }
    )
  }
}