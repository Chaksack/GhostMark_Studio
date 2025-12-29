"use client"

import { useState } from "react"
import { X } from "lucide-react"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { StoreCampaign } from "@lib/data/campaigns"

type CampaignBannerProps = {
  campaign: StoreCampaign
}

export default function CampaignBanner({ campaign }: CampaignBannerProps) {
  const [isVisible, setIsVisible] = useState(true)

  if (!isVisible || !campaign.banner_text) {
    return null
  }

  const handleDismiss = () => {
    setIsVisible(false)
  }

  const bannerContent = campaign.banner_link ? (
    <LocalizedClientLink
      href={campaign.banner_link}
      className="block text-center font-medium hover:underline"
    >
      {campaign.banner_text}
    </LocalizedClientLink>
  ) : (
    <div className="text-center font-medium">{campaign.banner_text}</div>
  )

  return (
    <div 
      className="relative bg-black text-white py-2 px-4 text-sm transition-all duration-300"
      style={{
        backgroundColor: campaign.banner_color || '#000000'
      }}
    >
      <div className="content-container flex items-center justify-between">
        <div className="flex-1">
          {bannerContent}
        </div>
        <button
          onClick={handleDismiss}
          className="ml-4 p-1 hover:bg-white/10 rounded transition-colors"
          aria-label="Dismiss banner"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}