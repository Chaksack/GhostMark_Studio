"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { Button } from "@medusajs/ui"

type Product = {
  id: string
  title?: string
  handle?: string
  thumbnail?: string | null
  images?: { url?: string }[]
}

export default function WishlistClient() {
  const { countryCode } = useParams() as { countryCode?: string }
  const [ids, setIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState<Product[]>([])

  const storageKey = "wishlist"

  const readIds = () => {
    try {
      const raw = localStorage.getItem(storageKey)
      const arr = raw ? (JSON.parse(raw) as unknown) : []
      if (Array.isArray(arr)) setIds(arr as string[])
      else setIds([])
    } catch {
      setIds([])
    }
  }

  useEffect(() => {
    readIds()
    const onCustom = () => readIds()
    window.addEventListener("wishlist:updated", onCustom as EventListener)
    return () => window.removeEventListener("wishlist:updated", onCustom as EventListener)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const run = async () => {
      if (!countryCode) return
      setLoading(true)
      try {
        if (!ids.length) {
          setProducts([])
          return
        }
        const q = new URLSearchParams({
          ids: ids.join(","),
          countryCode,
        })
        const res = await fetch(`/api/wishlist?${q.toString()}`, { cache: "no-store" })
        if (!res.ok) throw new Error(`Failed to load wishlist (${res.status})`)
        const data = await res.json()
        setProducts((data?.products as Product[]) || [])
      } catch {
        setProducts([])
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [ids, countryCode])

  const remove = (id: string) => {
    try {
      const raw = localStorage.getItem(storageKey)
      const arr = raw ? (JSON.parse(raw) as string[]) : []
      const next = Array.isArray(arr) ? arr.filter((x) => x !== id) : []
      localStorage.setItem(storageKey, JSON.stringify(next))
      window.dispatchEvent(new Event("wishlist:updated"))
      setIds(next)
    } catch {}
  }

  if (loading) {
    return (
      <div className="content-container py-12">
        <p className="text-ui-fg-subtle">Loading wishlist…</p>
      </div>
    )
  }

  if (!products.length) {
    return (
      <div className="content-container py-12">
        <h1 className="text-2xl-semi mb-2">Your wishlist</h1>
        <p className="text-ui-fg-subtle mb-6">You haven’t added any items yet.</p>
        <LocalizedClientLink href="/products">
          <Button variant="primary">Browse products</Button>
        </LocalizedClientLink>
      </div>
    )
  }

  return (
    <div className="content-container py-8">
      <h1 className="text-2xl-semi mb-6">Your wishlist</h1>
      <ul className="grid grid-cols-2 small:grid-cols-3 medium:grid-cols-4 large:grid-cols-5 gap-4 small:gap-6">
        {products.map((p) => {
          const image = p.thumbnail || p.images?.[0]?.url || ""
          return (
            <li key={p.id} className="group border rounded-lg overflow-hidden">
              <LocalizedClientLink href={`/products/${p.handle || p.id}`} className="block">
                <div className="aspect-square bg-ui-bg-subtle overflow-hidden">
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={image} alt={p.title || ""} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-ui-fg-muted text-sm">
                      No image
                    </div>
                  )}
                </div>
                <div className="p-3 flex items-start justify-between gap-2">
                  <div className="truncate">
                    <div className="text-sm font-medium truncate">{p.title || "Product"}</div>
                  </div>
                </div>
              </LocalizedClientLink>
              <div className="px-3 pb-3">
                <Button size="small" variant="secondary" className="w-full" onClick={(e) => { e.preventDefault(); e.stopPropagation(); remove(p.id) }}>
                  Remove
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
