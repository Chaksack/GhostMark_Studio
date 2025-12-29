import { getBaseURL } from "@lib/util/env"
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
        <main className="relative min-h-screen">{props.children}</main>
      </body>
    </html>
  )
}
