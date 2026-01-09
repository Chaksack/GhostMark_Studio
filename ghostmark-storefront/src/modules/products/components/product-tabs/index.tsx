"use client"

import Back from "@modules/common/icons/back"
import FastDelivery from "@modules/common/icons/fast-delivery"
import Refresh from "@modules/common/icons/refresh"

import Accordion from "./accordion"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { HttpTypes } from "@medusajs/types"
import { useEffect, useMemo, useState } from "react"

type ProductTabsProps = {
  product: HttpTypes.StoreProduct
}

const ProductTabs = ({ product }: ProductTabsProps) => {
  const tabs = [
    {
      label: "Product Information",
      component: <ProductInfoTab product={product} />,
      defaultOpen: true, // Open by default following Context7 best practices
    },
    {
      label: "Shipping & Returns", 
      component: <ShippingInfoTab />,
      defaultOpen: false,
    },
    {
      label: "Reviews",
      component: <ReviewsTab product={product} />,
      defaultOpen: false,
    },
  ]

  return (
    <div className="w-full">
      <Accordion type="multiple" defaultValue={["Product Information"]}>
        {tabs.map((tab, i) => (
          <Accordion.Item
            key={`product-tab-${i}-${tab.label.replace(/\s+/g, '-').toLowerCase()}`}
            title={tab.label}
            headingSize="medium"
            value={tab.label}
          >
            {tab.component}
          </Accordion.Item>
        ))}
      </Accordion>
    </div>
  )
}

const ProductInfoTab = ({ product }: ProductTabsProps) => {
  // Enhanced description handling - prioritize metadata.description over product.description
  const meta: any = (product as any)?.metadata || {}
  const fullDescription = (meta.description || product.description || "").trim()
  
  return (
    <div className="py-8">
      {/* Product Description - following Context7 best practices for information sections */}
      {fullDescription && (
        <div className="mb-10">
          <h3 className="font-semibold text-lg block mb-4 text-ui-fg-base">Product Description</h3>
          <div className="prose prose-sm max-w-none">
            <p className="text-ui-fg-base whitespace-pre-line leading-relaxed text-base">
              {fullDescription}
            </p>
          </div>
        </div>
      )}
      
      {/* Product Specifications */}
      <div className="mb-8">
        <h3 className="font-semibold text-lg block mb-4 text-ui-fg-base">Product Specifications</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
        <div className="flex flex-col gap-y-4">
          <div>
            <span className="font-semibold">Material</span>
            <p>{product.material ? product.material : "-"}</p>
          </div>
          <div>
            <span className="font-semibold">Country of origin</span>
            <p>{product.origin_country ? product.origin_country : "-"}</p>
          </div>
          <div>
            <span className="font-semibold">Type</span>
            <p>{product.type ? product.type.value : "-"}</p>
            </div>
          </div>
          <div className="flex flex-col gap-y-4">
            <div>
              <span className="font-semibold">Weight</span>
              <p>{product.weight ? `${product.weight} g` : "-"}</p>
            </div>
            <div>
              <span className="font-semibold">Dimensions</span>
              <p>
                {product.length && product.width && product.height
                  ? `${product.length}L x ${product.width}W x ${product.height}H`
                  : "-"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const ShippingInfoTab = () => {
  return (
    <div className="text-small-regular py-8">
      <div className="grid grid-cols-1 gap-y-8">
        <div className="flex items-start gap-x-2">
          <FastDelivery />
          <div>
            <span className="font-semibold">Fast delivery</span>
            <p className="max-w-sm">
              Your package will arrive in 3-5 business days at your pick up
              location or in the comfort of your home.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-x-2">
          <Refresh />
          <div>
            <span className="font-semibold">Simple exchanges</span>
            <p className="max-w-sm">
              Is the fit not quite right? No worries - we&apos;ll exchange your
              product for a new one.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-x-2">
          <Back />
          <div>
            <span className="font-semibold">Easy returns</span>
            <p className="max-w-sm">
              Just return your product and we&apos;ll refund your money. No
              questions asked – we&apos;ll do our best to make sure your return
              is hassle-free.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProductTabs

// ---------- Reviews UI (client-side fetch) ----------

type Review = {
  id: number
  product_id: string
  rating: number
  title?: string | null
  body?: string | null
  email?: string | null
  created_at: string
}

function Stars({ value }: { value: number }) {
  const full = Math.round(value)
  return <span aria-hidden>{"★★★★★".slice(0, full).padEnd(5, "☆")}</span>
}

function ReviewsTab({ product }: { product: HttpTypes.StoreProduct }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [avg, setAvg] = useState<number>(0)
  const [count, setCount] = useState<number>(0)

  const isPOD = useMemo(() => {
    const p: any = product as any
    const t = p?.type ?? p?.product_type
    let raw: string | undefined
    if (!t) raw = undefined
    else if (typeof t === "string") raw = t
    else raw = t?.value || t?.title || t?.name || t?.handle
    const s = (raw || "").toString().trim().toLowerCase()
    return s.includes("pod") || s === "pod"
  }, [product])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const base = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"
      const headers: HeadersInit = {}
      const pub = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
      if (pub) {
        ;(headers as any)["x-publishable-api-key"] = pub
      }
      const resp = await fetch(`${base}/store/products/${product.id}/reviews`, {
        cache: "no-store",
        headers,
      })
      const data = await resp.json()
      if (!resp.ok || !data?.ok) throw new Error(data?.message || "Failed to load reviews")
      setReviews(data.reviews || [])
      setAvg(Number(data.stats?.average || 0))
      setCount(Number(data.stats?.count || 0))
    } catch (e: any) {
      setError(e?.message || "Failed to load reviews")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id])

  // Review submission has moved to a dedicated page: /reviews/submit

  return (
    <div className="py-6 space-y-6">
      {/* Summary */}
      <div className="flex items-center gap-3 text-ui-fg-subtle">
        <div className="text-emerald-600"><Stars value={avg} /></div>
        <span className="text-sm">{avg.toFixed(1)} · {count} review{count === 1 ? '' : 's'}</span>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-sm text-ui-fg-muted">Loading reviews…</div>
      ) : reviews.length === 0 ? (
        <div className="text-sm text-ui-fg-muted">No reviews yet.</div>
      ) : (
        <div className="space-y-4">
          {reviews.map((r) => (
            <div key={r.id} className="border rounded p-3">
              <div className="flex items-center justify-between mb-1">
                <div className="text-amber-600 text-sm"><Stars value={r.rating} /></div>
                <div className="text-xs text-ui-fg-muted">{new Date(r.created_at).toLocaleDateString()}</div>
              </div>
              {r.title && <div className="font-medium mb-1">{r.title}</div>}
              {r.body && <div className="text-sm whitespace-pre-wrap">{r.body}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Review entry moved to a dedicated page. For POD products, show a link to the new page. */}
      {isPOD && (
        <div className="mt-6 border rounded p-4">
          <div className="font-semibold mb-2">Want to leave a review?</div>
          <p className="text-sm text-ui-fg-muted mb-3">
            After completing your Print-On-Demand purchase, you&apos;ll receive an email with a link to leave a review.
          </p>
        </div>
      )}
    </div>
  )
}
