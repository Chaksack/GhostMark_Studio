"use client"

import { Button } from "@medusajs/ui"
import { useParams, useRouter } from "next/navigation"
import { useState } from "react"

type QuickAddButtonProps = Readonly<{
  variantId?: string
  isApparel?: boolean
  className?: string
}>

/**
 * Client-side quick add-to-cart button intended to be rendered inside a product card.
 * - Only renders when `isApparel` is true.
 * - Prevents parent link navigation; performs a lightweight POST to /api/cart/add.
 */
export default function QuickAddButton({ variantId, isApparel, className }: QuickAddButtonProps) {
  const params = useParams()
  const rawCountryCode = params?.countryCode
  const countryCode = typeof rawCountryCode === "string" ? rawCountryCode : undefined
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [added, setAdded] = useState(false)

  if (!isApparel) return null
  if (!variantId || !countryCode) return null

  const addToCart = async () => {
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
      router.refresh()
      globalThis.setTimeout(() => setAdded(false), 1500)
    } catch (err: any) {
      setError(err?.message || "Failed to add to cart")
    } finally {
      setLoading(false)
    }
  }

  const onClick: React.MouseEventHandler<HTMLButtonElement> = (e) => {
    e.preventDefault()
    e.stopPropagation()
    void addToCart()
  }

  return (
    <div className={className}>
      <Button
        size="small"
        variant="secondary"
        className="h-9 px-4 w-full bg-mono-1000 text-mono-0 hover:bg-mono-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mono-1000 border border-mono-1000 transition-colors"
        onClick={onClick}
        isLoading={loading}
        aria-label={added ? "Added to cart" : "Add to cart"}
      >
        {added ? "Added" : "Add to cart"}
      </Button>
      {error && (
        <span className="ml-2 text-[11px] text-accent-error">{error}</span>
      )}
    </div>
  )
}
