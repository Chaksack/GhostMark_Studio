"use client"

import { useEffect, useMemo, useState } from "react"
import { Heart } from "lucide-react"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/**
 * Small navbar wishlist button showing a heart icon and current wishlist count.
 * Uses localStorage key `wishlist` (array of product ids). It listens to
 * `storage` events and a custom `wishlist:updated` event to stay in sync with
 * product-card wishlist toggles.
 */
export default function WishlistButton() {
  const [count, setCount] = useState<number>(0)

  const readCount = () => {
    try {
      const raw = localStorage.getItem("wishlist")
      const arr = raw ? (JSON.parse(raw) as unknown) : []
      const n = Array.isArray(arr) ? arr.length : 0
      setCount(n)
    } catch {
      setCount(0)
    }
  }

  useEffect(() => {
    // Initial
    readCount()
    const onStorage = (e: StorageEvent) => {
      if (!e || e.key === null || e.key === "wishlist") {
        readCount()
      }
    }
    const onCustom = () => readCount()
    window.addEventListener("storage", onStorage)
    window.addEventListener("wishlist:updated", onCustom as EventListener)
    return () => {
      window.removeEventListener("storage", onStorage)
      window.removeEventListener("wishlist:updated", onCustom as EventListener)
    }
  }, [])

  return (
    <LocalizedClientLink
      href="/wishlist"
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-gray-50"
      data-testid="nav-wishlist-link"
      aria-label={`Wishlist (${count})`}
    >
      <Heart className="w-5 h-5" />
      {count > 0 && (
        <span
          className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-1 rounded-full bg-black text-white text-[10px] leading-none flex items-center justify-center shadow-sm"
          aria-hidden="true"
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </LocalizedClientLink>
  )
}
