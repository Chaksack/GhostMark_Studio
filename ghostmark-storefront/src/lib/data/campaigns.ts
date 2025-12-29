"use server"

import { sdk } from "@lib/config"
import { HttpTypes } from "@medusajs/types"
import { getAuthHeaders, getCacheOptions } from "./cookies"

export type StoreCampaign = {
  id: string
  title: string
  description?: string
  active: boolean
  start_date?: string
  end_date?: string
  banner_text?: string
  banner_link?: string
  banner_color?: string
  created_at: string
  updated_at: string
}

/**
 * Mock campaigns data - replace with backend data when available
 */
function getMockCampaigns(): StoreCampaign[] {
  return [
    {
      id: "campaign_1",
      title: "Holiday Sale",
      description: "Get up to 50% off on all custom products",
      active: true,
      banner_text: "🎄 Holiday Sale: Up to 50% OFF Custom Products - Limited Time! 🎁",
      banner_link: "/store",
      banner_color: "#000000", // Black background
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
}

/**
 * Retrieves active campaigns that should be displayed as banners
 */
export async function listActiveCampaigns(): Promise<StoreCampaign[]> {
  const headers = {
    ...(await getAuthHeaders()),
  }

  const next = {
    ...(await getCacheOptions("campaigns")),
  }

  try {
    // Try to fetch campaigns from the backend
    const response = await sdk.client.fetch<{ campaigns: StoreCampaign[] }>(
      "/admin/campaigns",
      {
        method: "GET",
        query: {
          active: "true",
          fields: "id,title,description,active,banner_text,banner_link,banner_color,start_date,end_date",
        },
        headers,
        next,
        cache: "force-cache",
      }
    )

    const campaigns = response.campaigns || []
    
    // Filter campaigns that are currently active based on date
    const now = new Date()
    return campaigns.filter(campaign => {
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
  } catch (error) {
    // If campaigns endpoint doesn't exist or fails, use mock data
    if (process.env.NODE_ENV !== "production") {
      console.warn("Failed to fetch campaigns, using mock data:", error)
    }
    
    // Use mock campaigns data
    const mockCampaigns = getMockCampaigns()
    const now = new Date()
    
    return mockCampaigns.filter(campaign => {
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
}

/**
 * Retrieves a specific campaign by ID
 */
export async function retrieveCampaign(campaignId: string): Promise<StoreCampaign | null> {
  const headers = {
    ...(await getAuthHeaders()),
  }

  const next = {
    ...(await getCacheOptions("campaigns")),
  }

  try {
    const { campaign } = await sdk.client.fetch<{ campaign: StoreCampaign }>(
      `/store/campaigns/${campaignId}`,
      {
        method: "GET",
        headers,
        next,
        cache: "force-cache",
      }
    )

    return campaign
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`Failed to fetch campaign ${campaignId}:`, error)
    }
    return null
  }
}