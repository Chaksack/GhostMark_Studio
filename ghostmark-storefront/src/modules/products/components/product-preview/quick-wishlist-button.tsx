"use client"

import { useEffect, useState, type MouseEvent } from "react"
import { Heart } from "lucide-react"

type QuickWishlistButtonProps = Readonly<{
  productId?: string
  className?: string
}>

const STORAGE_KEY = "wishlist" as const

/**
 * Lightweight client-only wishlist toggle for product cards.
 * - Renders only for apparel products.
 * - Persists a list of product IDs in localStorage under `wishlist`.
 * - Stops event propagation so clicking does not navigate the product card link.
 */
export default function QuickWishlistButton({ productId, className }: QuickWishlistButtonProps) {
  const [isWishlisted, setIsWishlisted] = useState(false)

  // Initialize state from localStorage on mount
  useEffect(() => {
    if (!productId) {
      setIsWishlisted(false)
      return
    }

    try {
      if (!("localStorage" in globalThis)) return

      const raw = globalThis.localStorage.getItem(STORAGE_KEY)
      const arr = raw ? (JSON.parse(raw) as string[]) : []
      setIsWishlisted(Array.isArray(arr) && arr.includes(productId))
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId])

  if (!productId) return null

  const toggle = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()

    try {
      if (!("localStorage" in globalThis)) return

      const raw = globalThis.localStorage.getItem(STORAGE_KEY)
      const arr = raw ? (JSON.parse(raw) as string[]) : []
      let next: string[]
      if (Array.isArray(arr) && arr.includes(productId)) {
        next = arr.filter((id) => id !== productId)
        setIsWishlisted(false)
      } else {
        next = Array.isArray(arr) ? [...arr, productId] : [productId]
        setIsWishlisted(true)
      }
      globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      // notify other UI (navbar counter, other tabs) that wishlist changed
      try {
        globalThis.dispatchEvent(new Event("wishlist:updated"))
      } catch {}
    } catch {
      // ignore storage errors to avoid breaking UX
    }
  }

  return (
    <button
      onClick={toggle}
      className={[
        "inline-flex items-center justify-center h-9 w-9 rounded-md border transition-colors",
        isWishlisted
          ? "bg-mono-1000 text-mono-0 border-mono-1000 hover:bg-mono-900"
          : "bg-mono-0 text-mono-700 border-mono-200 hover:bg-mono-50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mono-1000",
        className || "",
      ].join(" ")}
      aria-pressed={isWishlisted}
      aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
      title={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
    >
      <Heart
        className={[
          "h-4 w-4",
          isWishlisted ? "fill-mono-0 stroke-mono-0" : "stroke-current",
        ].join(" ")}
      />
    </button>
  )
}
