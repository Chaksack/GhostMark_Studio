"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

export default function SubmitReviewPage() {
  const router = useRouter()
  const sp = useSearchParams()

  const productId = sp?.get("productId") || ""
  const presetRating = parseInt(sp?.get("rating") || "", 10)
  const reviewToken = sp?.get("token") || ""
  const [rating, setRating] = useState<number>(Number.isFinite(presetRating) ? Math.min(5, Math.max(1, presetRating)) : 5)
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [email, setEmail] = useState(sp?.get("email") || "")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const canSubmit = useMemo(() => {
    return !!productId && rating >= 1 && rating <= 5 && body.trim().length > 0
  }, [productId, rating, body])

  useEffect(() => {
    // If no productId, stay but show error
    if (!productId) {
      setError("Missing productId. Please use the link provided in your order email or select a product.")
    }
  }, [productId])

  async function submit() {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const base = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"
      const headers: HeadersInit = { "Content-Type": "application/json" }
      const pub = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
      if (pub) {
        ;(headers as any)["x-publishable-api-key"] = pub
      }
      const resp = await fetch(`${base}/store/products/${productId}/reviews`, {
        method: "POST",
        headers,
        body: JSON.stringify({ rating, title, body, email, reviewToken }),
      })
      const data = await resp.json()
      if (!resp.ok || !data?.ok) throw new Error(data?.message || "Failed to submit review")
      setSuccess(true)
      setTitle("")
      setBody("")
    } catch (e: any) {
      setError(e?.message || "Failed to submit review")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="content-container py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-semibold mb-2">Leave a Review</h1>
        <p className="text-sm text-ui-fg-muted mb-6">
          Thank you for your Print-On-Demand purchase. We value your feedback! Use the form below to share your experience.
        </p>

        {!productId && (
          <div className="mb-6 rounded border border-amber-300 bg-amber-50 text-amber-900 p-3 text-sm">
            No product selected. Add <span className="font-mono">productId</span> to the URL query to review a specific product.
          </div>
        )}

        {success ? (
          <div className="rounded border border-emerald-300 bg-emerald-50 text-emerald-900 p-4">
            <div className="font-medium mb-1">Thanks for your review!</div>
            <p className="text-sm">It has been recorded successfully.</p>
            <div className="mt-4 flex items-center gap-3">
              <LocalizedClientLink href={`/`} className="underline text-ui-fg-base">
                Back to home
              </LocalizedClientLink>
              <button className="text-sm underline" onClick={() => setSuccess(false)}>Write another</button>
            </div>
          </div>
        ) : (
          <div className="border rounded p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1">Rating</label>
                <select
                  className="w-full border rounded px-3 py-2"
                  value={rating}
                  onChange={(e) => setRating(parseInt(e.target.value) || 5)}
                >
                  {[5,4,3,2,1].map((n) => (
                    <option key={n} value={n}>{n} star{n===1?'':'s'}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm mb-1">Email (optional)</label>
                <input
                  type="email"
                  className="w-full border rounded px-3 py-2"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm mb-1">Title (optional)</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Great quality!"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm mb-1">Review</label>
                <textarea
                  className="w-full border rounded px-3 py-2 min-h-[120px]"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Share your experience…"
                />
              </div>
            </div>
            {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={submit}
                disabled={!canSubmit || submitting}
                className="bg-black text-white rounded px-4 py-2 disabled:opacity-50"
              >
                {submitting ? "Submitting…" : "Submit review"}
              </button>
              <LocalizedClientLink href={`/`} className="text-sm underline">
                Cancel
              </LocalizedClientLink>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
