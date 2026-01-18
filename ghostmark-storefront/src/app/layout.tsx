import { getBaseURL } from "@lib/util/env"
import PageTransitions from "@modules/common/components/page-transitions"
import CookieConsent from "@modules/common/components/cookie-consent"
import NewsletterPopup from "@modules/common/components/newsletter-popup"
import { Metadata } from "next"
import "styles/globals.css"

export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
    title: "GhostMark Studio",
    description: "Print on demand business",
    keywords: "GhostMark Studio",
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
          {/* Global page transition animations */}
          {/* Client-only wrapper to animate route changes */}
          {/* eslint-disable-next-line @next/next/no-sync-scripts */}
          {/* Wrapped children in AutoAnimate container */}
          <PageTransitions>{props.children}</PageTransitions>
          {/* Newsletter signup modal */}
          <NewsletterPopup />
          {/* Cookie consent banner */}
          <CookieConsent />
        </main>
      </body>
    </html>
  )
}
