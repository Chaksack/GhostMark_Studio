"use client"

import { useEffect, useMemo, useState } from "react"
import { Heart } from "lucide-react"

type QuickWishlistButtonProps = {
  productId?: string
  isApparel?: boolean
  className?: string
}

/**
 * Lightweight client-only wishlist toggle for product cards.
 * - Renders only for apparel products.
 * - Persists a list of product IDs in localStorage under `wishlist`.
 * - Stops event propagation so clicking does not navigate the product card link.
 */
export default function QuickWishlistButton({ productId, isApparel, className }: QuickWishlistButtonProps) {
  const [isWishlisted, setIsWishlisted] = useState(false)
  const storageKey = "wishlist"

  // Only render for apparel and when we have an id
  if (!isApparel || !productId) return null

  // Initialize state from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      const arr = raw ? (JSON.parse(raw) as string[]) : []
      setIsWishlisted(Array.isArray(arr) && arr.includes(productId))
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId])

  const toggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()

    try {
      const raw = localStorage.getItem(storageKey)
      const arr = raw ? (JSON.parse(raw) as string[]) : []
      let next: string[]
      if (Array.isArray(arr) && arr.includes(productId)) {
        next = arr.filter((id) => id !== productId)
        setIsWishlisted(false)
      } else {
        next = Array.isArray(arr) ? [...arr, productId] : [productId]
        setIsWishlisted(true)
      }
      localStorage.setItem(storageKey, JSON.stringify(next))
      // notify other UI (navbar counter, other tabs) that wishlist changed
      try {
        window.dispatchEvent(new Event("wishlist:updated"))
      } catch {}
    } catch {
      // ignore storage errors to avoid breaking UX
    }
  }

  return (
    <button
      onClick={toggle}
      className={[
        "inline-flex items-center justify-center h-8 w-8 rounded-md border transition-colors",
        isWishlisted
          ? "bg-black text-white border-transparent hover:bg-black/90"
          : "bg-white text-gray-700 border-ui-border-base hover:bg-gray-50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black",
        className || "",
      ].join(" ")}
      aria-pressed={isWishlisted}
      aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
      title={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
    >
      <Heart
        className={[
          "h-4 w-4",
          isWishlisted ? "fill-white stroke-white" : "stroke-current",
        ].join(" ")}
      />
    </button>
  )
}
