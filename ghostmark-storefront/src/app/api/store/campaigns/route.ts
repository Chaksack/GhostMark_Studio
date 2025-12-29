import { NextRequest, NextResponse } from "next/server"

// Mock campaigns data - in production this would come from your database
const campaigns = [
  {
    id: "campaign_1",
    title: "Holiday Sale",
    description: "Get up to 50% off on all custom products",
    active: true,
    banner_text: "🎄 Holiday Sale: Up to 50% OFF Custom Products - Limited Time! 🎁",
    banner_link: "/store",
    banner_color: "#000000",
    start_date: "2024-12-01T00:00:00Z",
    end_date: "2025-01-15T23:59:59Z",
    created_at: "2024-12-01T00:00:00Z",
    updated_at: "2024-12-01T00:00:00Z",
  },
  {
    id: "campaign_2",
    title: "Free Shipping",
    description: "Free shipping on orders over $50",
    active: true,
    banner_text: "🚚 FREE SHIPPING on orders over $50 - Shop Now!",
    banner_link: "/store", 
    banner_color: "#000000",
    start_date: "2024-12-01T00:00:00Z",
    end_date: "2025-03-01T23:59:59Z",
    created_at: "2024-12-01T00:00:00Z",
    updated_at: "2024-12-01T00:00:00Z",
  }
]

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get("active") === "true"
    const fields = searchParams.get("fields")

    let filteredCampaigns = campaigns

    // Filter by active status if requested
    if (activeOnly) {
      const now = new Date()
      filteredCampaigns = campaigns.filter(campaign => {
        if (!campaign.active) return false
        
        // Check start date
        if (campaign.start_date && new Date(campaign.start_date) > now) {
          return false
        }
        
        // Check end date  
        if (campaign.end_date && new Date(campaign.end_date) < now) {
          return false
        }
        
        return true
      })
    }

    // Apply field filtering if requested (basic implementation)
    if (fields) {
      const requestedFields = fields.split(",")
      filteredCampaigns = filteredCampaigns.map(campaign => {
        const filteredCampaign: any = {}
        requestedFields.forEach(field => {
          if (campaign.hasOwnProperty(field.trim())) {
            filteredCampaign[field.trim()] = (campaign as any)[field.trim()]
          }
        })
        return filteredCampaign
      })
    }

    return NextResponse.json({
      campaigns: filteredCampaigns,
      count: filteredCampaigns.length
    })
  } catch (error) {
    console.error("Error fetching campaigns:", error)
    return NextResponse.json(
      { error: "Failed to fetch campaigns" },
      { status: 500 }
    )
  }
}