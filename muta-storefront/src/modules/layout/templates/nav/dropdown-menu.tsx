"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

interface DropdownMenuProps {
  label: string
  items?: string[]
  /**
   * Optional base path to build item links. When provided, each item will link to
   * `${basePath}/${slug(item)}` using LocalizedClientLink. If omitted, items are rendered
   * as non-navigating anchors (current behavior).
   */
  basePath?: string
  /**
   * Optional grouped sections mode. When provided, the component will ignore `items`
   * and render groups with titles and direct hrefs for each item.
   */
  sections?: {
    title: string
    items: { label: string; href: string }[]
  }[]
}

export const DropdownMenu = ({ label, items = [], basePath, sections }: DropdownMenuProps) => {
  const [isOpen, setIsOpen] = useState(false)

  const slugify = (str: string) =>
    str
      .toLowerCase()
      .trim()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")

  return (
    <div 
      className="relative"
      onMouseEnter={() => setIsOpen(true)}
      onMouseOver={() => setIsOpen(true)}
      onMouseDown={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button className="flex items-center gap-1 font-medium hover:text-gray-600 transition-colors px-4 py-2">
        <span>{label}</span>
        <ChevronDown 
          className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>
      
      {isOpen && (
        <div className="absolute top-full left-0 min-w-[200px] bg-white border border-gray-200 rounded-xl shadow-xl py-3 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          {sections && sections.length > 0 ? (
            <div className="grid grid-cols-1 gap-2">
              {sections.map((section, sIdx) => (
                <div key={sIdx} className="px-2">
                  <div className="px-3 py-2 text-[11px] uppercase tracking-wide text-gray-400 font-semibold">
                    {section.title}
                  </div>
                  <div className="flex flex-col">
                    {section.items.map((it, iIdx) => (
                      <LocalizedClientLink key={`${sIdx}-${iIdx}`} href={it.href}>
                        <span className="block px-5 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors">
                          {it.label}
                        </span>
                      </LocalizedClientLink>
                    ))}
                  </div>
                  {sIdx < sections.length - 1 && (
                    <div className="my-2 h-px bg-gray-100" />
                  )}
                </div>
              ))}
            </div>
          ) : (
            items.map((item, index) => {
              const content = (
                <span className="block px-5 py-3 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors font-medium">
                  {item}
                </span>
              )

              if (basePath) {
                const path = `${basePath}/${slugify(item)}`
                return (
                  <LocalizedClientLink key={index} href={path}>
                    {content}
                  </LocalizedClientLink>
                )
              }

              return (
                <a key={index} href="#" className="block">
                  {content}
                </a>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}