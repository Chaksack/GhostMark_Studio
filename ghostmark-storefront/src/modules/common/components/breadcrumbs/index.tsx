"use client"

import React from "react"
import { usePathname } from "next/navigation"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

function titleCase(segment: string) {
  try {
    const decoded = decodeURIComponent(segment)
    return decoded
      .replace(/[-_]+/g, " ")
      .trim()
      .replace(/\s+/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
  } catch {
    return segment
  }
}

const Breadcrumbs: React.FC = () => {
  const pathname = usePathname()

  if (!pathname) return null

  // Example pathnames:
  // /us -> homepage for country (hide)
  // /us/products/awesome-shirt
  // /us/collections/summer
  const parts = pathname.split("/").filter(Boolean)

  if (parts.length <= 1) {
    // Only country code present => homepage. Hide breadcrumbs.
    return null
  }

  // Build cumulative hrefs EXCLUDING the country code since LocalizedClientLink
  // will add it automatically. We start from parts[1].
  const pathWithoutCountry = parts.slice(1)
  const items = pathWithoutCountry.map((part, idx) => {
    const href = "/" + pathWithoutCountry.slice(0, idx + 1).join("/")
    return { label: titleCase(part), href }
  })

  return (
    <nav aria-label="Breadcrumb" className="content-container py-3">
      <ol className="flex flex-wrap items-center gap-2 text-sm text-ui-fg-muted">
        <li className="flex items-center gap-2">
          <LocalizedClientLink href={`/`} className="hover:text-ui-fg-subtle">
            Home
          </LocalizedClientLink>
        </li>
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1
          return (
            <li key={item.href} className="flex items-center gap-2">
              <span aria-hidden className="text-ui-fg-muted">/</span>
              {isLast ? (
                <span className="text-ui-fg-subtle" aria-current="page">
                  {item.label}
                </span>
              ) : (
                <LocalizedClientLink href={item.href} className="hover:text-ui-fg-subtle">
                  {item.label}
                </LocalizedClientLink>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export default Breadcrumbs
