import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { addReview, listReviews, getReviewStats } from "../../../../../services/reviews-db"
import { verifyReviewToken } from "../../../../../services/review-token"

/**
 * GET /store/products/:id/reviews
 * List reviews for a product
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    // Optional publishable API key enforcement (enabled when env is set)
    const requiredKey = process.env.MEDUSA_PUBLISHABLE_KEY
    if (requiredKey) {
      // Support both lowercase/uppercase header keys
      const gotKey = (req.headers as any)["x-publishable-api-key"] || (req.headers as any)["X-Publishable-Api-Key"] || (req.headers as any)["x-publishable-key"]
      if (!gotKey || String(gotKey) !== String(requiredKey)) {
        return res.status(401).json({ ok: false, message: "Unauthorized: invalid publishable key" })
      }
    }
    const productId = (req.params as any).id as string
    if (!productId) {
      return res.status(400).json({ ok: false, message: "product id required" })
    }
    const reviews = await listReviews(productId)
    const stats = await getReviewStats(productId)
    return res.json({ ok: true, reviews, stats })
  } catch (e: any) {
    return res.status(500).json({ ok: false, message: e?.message || "Failed to list reviews" })
  }
}

/**
 * POST /store/products/:id/reviews
 * Body: { rating: 1-5, title?: string, body?: string, email?: string }
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    // Optional publishable API key enforcement (enabled when env is set)
    const requiredKey = process.env.MEDUSA_PUBLISHABLE_KEY
    if (requiredKey) {
      const gotKey = (req.headers as any)["x-publishable-api-key"] || (req.headers as any)["X-Publishable-Api-Key"] || (req.headers as any)["x-publishable-key"]
      if (!gotKey || String(gotKey) !== String(requiredKey)) {
        return res.status(401).json({ ok: false, message: "Unauthorized: invalid publishable key" })
      }
    }
    const productId = (req.params as any).id as string
    const body = (req.body || {}) as { rating?: number; title?: string; body?: string; email?: string; reviewToken?: string }
    if (!productId || typeof body?.rating !== 'number') {
      return res.status(400).json({ ok: false, message: "product id and numeric rating are required" })
    }
    // Optional token requirement
    const requireToken = String(process.env.REQUIRE_REVIEW_TOKEN || "false").toLowerCase() === "true"
    if (requireToken) {
      const token = (body as any).reviewToken || (req.headers as any)["x-review-token"]
      if (!token) {
        return res.status(400).json({ ok: false, message: "review token required" })
      }
      const result = verifyReviewToken(String(token))
      if (!result.valid || !result.payload) {
        return res.status(400).json({ ok: false, message: result.message || "invalid review token" })
      }
      if (result.payload.productId !== productId) {
        return res.status(400).json({ ok: false, message: "token does not match product" })
      }
      if (result.payload.email && body.email && result.payload.email.toLowerCase() !== String(body.email).toLowerCase()) {
        return res.status(400).json({ ok: false, message: "email does not match token" })
      }
    }
    const rating = Math.round(body.rating)
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ ok: false, message: "rating must be between 1 and 5" })
    }
    const review = await addReview({
      productId,
      rating,
      title: (body.title || '').toString().slice(0, 200) || undefined,
      body: (body.body || '').toString().slice(0, 4000) || undefined,
      email: (body.email || '').toString().slice(0, 200) || undefined,
    })
    const stats = await getReviewStats(productId)
    return res.json({ ok: true, review, stats })
  } catch (e: any) {
    return res.status(500).json({ ok: false, message: e?.message || "Failed to add review" })
  }
}
