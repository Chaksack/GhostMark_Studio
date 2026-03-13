import { getBaseURL } from "@lib/util/env"
import PageTransitions from "@modules/common/components/page-transitions"
import CookieConsent from "@modules/common/components/cookie-consent"
import NewsletterPopup from "@modules/common/components/newsletter-popup"
import { Metadata } from "next"
import "styles/globals.css"
import CampaignBanners from "@modules/layout/components/campaign-banners"
import dynamic from "next/dynamic"

const RegisterSW = dynamic(() => import("@modules/pwa/RegisterSW"), { ssr: false })

export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
    title: "GhostMark Studio",
    description: "Print on demand business",
    keywords: "GhostMark Studio",
        manifest: "/manifest.webmanifest",
        icons: {
            icon: "/favicon.ico",
            shortcut: "/favicon.ico",
            apple: "/apple-touch-icon.png",
        },

}

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="en" data-mode="light">
      <body className="bg-mono-0 text-mono-1000 font-sans antialiased">
        <main className="relative min-h-screen">
          {/* Site-wide campaign/promotion banners */}
          <CampaignBanners />
          {/* Global page transition animations */}
          {/* Client-only wrapper to animate route changes */}
          {/* eslint-disable-next-line @next/next/no-sync-scripts */}
          {/* Wrapped children in AutoAnimate container */}
          <PageTransitions>{props.children}</PageTransitions>
          {/* Newsletter signup modal */}
          <NewsletterPopup />
          {/* Cookie consent banner */}
          <CookieConsent />
          {/* PWA: register service worker on client */}
          <RegisterSW />
        </main>
      </body>
    </html>
  )
}
