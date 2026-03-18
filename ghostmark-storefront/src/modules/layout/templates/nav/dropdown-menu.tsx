"use client"

import { useEffect, useId, useRef, useState } from "react"
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
  const contentId = useId()
  const containerRef = useRef<HTMLDivElement | null>(null)

  const slugify = (str: string) =>
    str
      .toLowerCase()
      .trim()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")

  useEffect(() => {
    if (!isOpen) return

    const onPointerDown = (e: MouseEvent) => {
      const el = containerRef.current
      if (!el) return
      if (e.target instanceof Node && el.contains(e.target)) return
      setIsOpen(false)
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false)
    }

    globalThis.document.addEventListener("mousedown", onPointerDown)
    globalThis.document.addEventListener("keydown", onKeyDown)
    return () => {
      globalThis.document.removeEventListener("mousedown", onPointerDown)
      globalThis.document.removeEventListener("keydown", onKeyDown)
    }
  }, [isOpen])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        className="flex items-center gap-1 font-medium text-mono-900 hover:text-mono-700 transition-colors px-1 py-1"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={contentId}
        onClick={() => setIsOpen((v) => !v)}
      >
        <span>{label}</span>
        <ChevronDown 
          className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>
      
      {isOpen && (
        <div
          id={contentId}
          role="menu"
          aria-label={label}
          className="absolute top-full left-0 min-w-[220px] bg-mono-0 border border-mono-200 rounded-large shadow-sm py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200"
        >
          {sections && sections.length > 0 ? (
            <div className="grid grid-cols-1 gap-2">
              {sections.map((section, sIdx) => (
                <div key={section.title} className="px-2">
                  <div className="px-3 py-2 text-[10px] uppercase tracking-wide text-mono-500 font-semibold">
                    {section.title}
                  </div>
                  <div className="flex flex-col">
                    {section.items.map((it) => (
                      <LocalizedClientLink
                        key={it.href}
                        href={it.href}
                        role="menuitem"
                        onClick={() => setIsOpen(false)}
                      >
                        <span className="block px-4 py-2 text-sm text-mono-700 hover:bg-mono-50 hover:text-mono-1000 transition-colors rounded">
                          {it.label}
                        </span>
                      </LocalizedClientLink>
                    ))}
                  </div>
                  {sIdx < sections.length - 1 && (
                    <div className="my-2 h-px bg-mono-100" />
                  )}
                </div>
              ))}
            </div>
          ) : (
            items.map((item) => {
              const content = (
                <span className="block px-4 py-2 text-sm text-mono-700 hover:bg-mono-50 hover:text-mono-1000 transition-colors font-medium rounded">
                  {item}
                </span>
              )

              if (basePath) {
                const path = `${basePath}/${slugify(item)}`
                return (
                  <LocalizedClientLink key={item} href={path} role="menuitem" onClick={() => setIsOpen(false)}>
                    {content}
                  </LocalizedClientLink>
                )
              }

              return (
                <div key={item} className="block" aria-hidden>
                  {content}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}