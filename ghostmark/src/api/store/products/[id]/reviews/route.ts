import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { addReview, listReviews, getReviewStats } from "../../../../../services/reviews-db"
import { verifyReviewToken } from "../../../../../services/review-token"
import { enforceRateLimit, getClientIp, RATE_LIMITS } from "../../../../../utils/rate-limit"

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
    /*
     * Rate limit BEFORE the token check, so an attacker probing for a valid
     * token cannot use the 400 responses as a free oracle, and so the write
     * path stays bounded if REQUIRE_REVIEW_TOKEN is ever turned off again.
     *
     * Two buckets, and the second is the one that matters. Every other policy
     * in rate-limit.ts meters a cost the attacker imposes on someone else -
     * an email to a victim, guesses against one case's secret - so a per-caller
     * ceiling is the right shape there. Review spam is not that shape: the cost
     * is reputational and it concentrates on a PRODUCT. An IP ceiling alone
     * still lets a distributed client bury one product in five-star reviews
     * with every individual IP comfortably under its own limit.
     *
     * The ceilings are deliberately loose. The signed token is the primary
     * control - it is scoped to one order/product pair, which bounds legitimate
     * volume far tighter than any rate limit can. These are the secondary
     * control that still holds when a token leaks or the flag is off, so they
     * are set to catch automation without throttling a genuine product launch.
     */
    const allowed = enforceRateLimit(res, [
      { name: "review_submit_ip", key: getClientIp(req), ...RATE_LIMITS.REVIEW_SUBMIT_IP },
      { name: "review_submit_product", key: productId, ...RATE_LIMITS.REVIEW_SUBMIT_PRODUCT },
    ])
    if (!allowed) {
      return // 429 already sent
    }

    // Review token requirement. FAILS CLOSED.
    //
    // The default here is "true" and that is the whole point. It used to be
    // "false", and REQUIRE_REVIEW_TOKEN is absent from .env (it exists in
    // .env.template with an EMPTY value, which is falsy). The combination meant
    // the entire verification block below never executed: anyone holding the
    // publishable key — which ships in client-side JS and is therefore public —
    // could POST a forged review for any product, with any rating, under any
    // email address. The signed-token machinery in services/review-token.ts is
    // careful, well-built work that was simply never invoked.
    //
    // Defaulting to "false" meant a variable nobody remembered to set silently
    // disabled an authentication check. That is how this shipped, and it is the
    // failure mode worth engineering against: a fresh deploy that forgets the
    // variable must refuse reviews, not accept forged ones. Set
    // REQUIRE_REVIEW_TOKEN=false explicitly and deliberately if you ever need
    // the old behaviour; absence is no longer consent.
    const requireToken = String(process.env.REQUIRE_REVIEW_TOKEN || "true").toLowerCase() === "true"
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
