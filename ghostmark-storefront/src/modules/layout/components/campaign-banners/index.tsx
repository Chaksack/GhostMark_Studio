import { listActiveCampaigns } from "@lib/data/campaigns"
import CampaignBanner from "../campaign-banner"

export default async function CampaignBanners() {
  try {
    const campaigns = await listActiveCampaigns()
    
    if (!campaigns || campaigns.length === 0) {
      return null
    }

    return (
      <div className="campaign-banners">
        {campaigns.map((campaign) => (
          <CampaignBanner key={campaign.id} campaign={campaign} />
        ))}
      </div>
    )
  } catch (error) {
    // Fail gracefully - don't break the page if campaigns can't be loaded
    if (process.env.NODE_ENV !== "production") {
      console.warn("Failed to render campaign banners:", error)
    }
    return null
  }
}