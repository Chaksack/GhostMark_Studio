"use client"

import { Button } from "@medusajs/ui"
import { useParams } from "next/navigation"
import { useState } from "react"

type QuickAddButtonProps = {
  variantId?: string
  isApparel?: boolean
  className?: string
}

/**
 * Client-side quick add-to-cart button intended to be rendered inside a product card.
 * - Only renders when `isApparel` is true.
 * - Prevents parent link navigation; performs a lightweight POST to /api/cart/add.
 */
export default function QuickAddButton({ variantId, isApparel, className }: QuickAddButtonProps) {
  const params = useParams() as { countryCode?: string }
  const countryCode = params?.countryCode
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [added, setAdded] = useState(false)

  if (!isApparel) return null
  if (!variantId || !countryCode) return null

  const onClick: React.MouseEventHandler<HTMLButtonElement> = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (loading) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/cart/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId, quantity: 1, countryCode }),
      })
      if (!res.ok) {
        let message = `Failed to add to cart (${res.status})`
        try {
          const j = await res.json()
          if (j?.message) message = j.message
        } catch {}
        throw new Error(message)
      }
      setAdded(true)
      // Reset the added state after a short delay to allow repeated adds
      setTimeout(() => setAdded(false), 1500)
    } catch (err: any) {
      setError(err?.message || "Failed to add to cart")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={className} onClick={(e) => { e.stopPropagation() }}>
      <Button
        size="small"
        variant="secondary"
        className="h-8 px-3 w-full bg-black text-white hover:bg-black/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black border-transparent transition-colors"
        onClick={onClick}
        isLoading={loading}
        aria-label={added ? "Added to cart" : "Add to cart"}
      >
        {added ? "Added" : "Add to cart"}
      </Button>
      {error && (
        <span className="ml-2 text-[11px] text-red-600">{error}</span>
      )}
    </div>
  )
}
