import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

/**
 * Shared in-process rate limiter.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * There was no rate limiting anywhere in this backend. Two unauthenticated
 * endpoints (/store/support/tickets and /store/newsletter/subscribe) each send
 * a branded email from a verified Resend domain, so "no rate limit" meant an
 * attacker could pump unlimited mail through our sending reputation.
 *
 * -------------------------------------------------------------------------
 * READ THIS BEFORE YOU RELY ON IT
 * -------------------------------------------------------------------------
 * This is a single-process, in-memory limiter. It is a speed bump, not a
 * control you should bet the domain reputation on. Three concrete limits:
 *
 *   1. NOT SHARED ACROSS PROCESSES. Medusa can run multiple workers / replicas.
 *      Each holds its own counters, so the effective ceiling is
 *      (limit x replica count). Fine at one instance; wrong at ten.
 *
 *   2. NOT PERSISTENT. A restart or deploy resets every counter. An attacker
 *      who can trigger restarts, or who simply waits for a deploy, gets a
 *      fresh budget.
 *
 *   3. THE PER-IP BUCKET IS ONLY AS TRUSTWORTHY AS `trust proxy`.
 *      @medusajs/framework sets `app.set("trust proxy", 1)`
 *      (node_modules/@medusajs/framework/dist/http/express-loader.js:68), so
 *      Express derives req.ip from the LAST hop in X-Forwarded-For. That is
 *      correct behind exactly one reverse proxy. If this app is ever exposed
 *      directly, or sits behind two proxies, req.ip becomes attacker-
 *      controlled and per-IP limiting is trivially bypassed by rotating the
 *      X-Forwarded-For header.
 *
 * Because of (3), THE PER-RECIPIENT BUCKET IS THE LOAD-BEARING ONE. An
 * attacker can forge their apparent IP; they cannot forge the address they are
 * trying to get us to email, because that address IS the payload. Every email-
 * sending route here must limit on the recipient, not only on the IP.
 *
 * For a real control, move these counters to Redis and keep the same API.
 */

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/**
 * Documented policy. Every ceiling and window used by a route lives here so
 * the whole posture is reviewable in one place rather than scattered across
 * handlers.
 *
 * Ceilings are deliberately generous against real human use and tight against
 * automation. A real person files at most one or two support tickets an hour
 * and subscribes to a newsletter once, ever.
 */
export const RATE_LIMITS = {
  /** POST /store/support/tickets - creates a ticket AND sends 2 emails. */
  SUPPORT_TICKET_CREATE_IP: { limit: 5, windowMs: HOUR },
  SUPPORT_TICKET_CREATE_RECIPIENT: { limit: 3, windowMs: HOUR },
  SUPPORT_TICKET_CREATE_RECIPIENT_DAILY: { limit: 8, windowMs: DAY },

  /** POST /store/newsletter/subscribe - sends a confirmation email. */
  NEWSLETTER_SUBSCRIBE_IP: { limit: 5, windowMs: HOUR },
  /**
   * Deliberately the tightest ceiling in the file. "Resend the confirmation"
   * is the classic mail-bombing primitive: the address is the attacker's
   * target and the send is free. Three per day is more than a confused user
   * needs and useless as a flood.
   */
  NEWSLETTER_SUBSCRIBE_RECIPIENT: { limit: 3, windowMs: DAY },

  /** GET /store/support/tickets/:caseId - secret is presented here. */
  SUPPORT_TICKET_READ_IP: { limit: 30, windowMs: 10 * MINUTE },
  /**
   * Anti-brute-force on the per-case secret. 10 attempts per 10 minutes per
   * case caps an online guessing attack at ~1,440/day against a 2^78 keyspace,
   * which is not a threat, and it bounds enumeration of case IDs.
   */
  SUPPORT_TICKET_READ_CASE: { limit: 10, windowMs: 10 * MINUTE },

  /** POST /store/support/tickets/:caseId/messages - emails the admin. */
  SUPPORT_MESSAGE_IP: { limit: 20, windowMs: HOUR },
  SUPPORT_MESSAGE_CASE: { limit: 20, windowMs: HOUR },

  /**
   * POST /store/products/:id/reviews
   *
   * NOT YET WIRED. These constants are declared ahead of their call site
   * deliberately, and that needs justifying because unused config is normally
   * a smell.
   *
   * The reviews route is unauthenticated, writes to a table, and its token
   * check is disabled by default (REQUIRE_REVIEW_TOKEN is absent from .env, so
   * src/api/store/products/[id]/reviews/route.ts:52 evaluates false and the
   * whole verification block is skipped). It has no rate limiting at all -
   * verified, the file imports nothing from here.
   *
   * It is not exploitable today only because no storefront page posts reviews.
   * The moment someone builds that page, FOUR things must land together or the
   * feature ships insecure by default:
   *
   *   1. the page itself
   *   2. REQUIRE_REVIEW_TOKEN=true            (production config, needs sign-off)
   *   3. these rate limits, actually called
   *   4. the review token moved out of the URL query string into the POST body
   *      (the backend already accepts it there - route.ts:54 - so this is a
   *      storefront-only change)
   *
   * Any three without the fourth is a false sense of done. The numbers live
   * here rather than in a document so that whoever writes step 1 finds them.
   *
   * WHY A PER-PRODUCT BUCKET, which is a different shape from everything above.
   * Every other policy in this file meters a cost the attacker imposes on
   * SOMEONE ELSE - an email sent to a victim, or guesses against one case's
   * secret. Review spam is not like that: the cost is reputational and it
   * concentrates on a PRODUCT. An IP ceiling alone still lets a distributed
   * client bury one product in 5-star reviews, because each IP stays under its
   * own limit. So the product is the bucket that matters, exactly as
   * SUPPORT_TICKET_READ_CASE buckets on the case rather than the caller.
   * (Bucket shape identified by the NOTIFY lane.)
   *
   * These ceilings are deliberately loose. The token check is the PRIMARY
   * control - a valid token is scoped to one order/product pair, which bounds
   * legitimate volume far more tightly than any rate limit could. This is the
   * secondary control that still holds when the token is off or one leaks, so
   * it is set to catch automation without throttling a genuine product launch.
   */
  REVIEW_SUBMIT_IP: { limit: 5, windowMs: HOUR },
  REVIEW_SUBMIT_PRODUCT: { limit: 20, windowMs: HOUR },
} as const

export type RateLimitPolicy = { limit: number; windowMs: number }

export type RateLimitRule = {
  /** Stable identifier for the bucket family, e.g. "support_create_ip". */
  name: string
  /** The value being limited on, e.g. an IP or a lowercased email. */
  key: string
} & RateLimitPolicy

type Bucket = { count: number; resetAt: number }

/**
 * Bucket store.
 *
 * Keys are derived from attacker-supplied values (IP, email), so an unbounded
 * map is itself a memory-exhaustion vector. Two defences: expired buckets are
 * swept periodically, and the map is hard-capped.
 */
const buckets = new Map<string, Bucket>()

/** Hard cap on distinct tracked keys. */
const MAX_BUCKETS = 50_000

let lastSweep = 0
const SWEEP_INTERVAL_MS = 5 * MINUTE

function sweep(now: number): void {
  if (now - lastSweep < SWEEP_INTERVAL_MS) {
    return
  }
  lastSweep = now
  for (const [k, b] of buckets) {
    if (b.resetAt <= now) {
      buckets.delete(k)
    }
  }
}

/**
 * Last-resort shedding when the map is at capacity and sweeping did not free
 * anything (i.e. we are under active flood with many live keys).
 *
 * We drop the entries closest to expiry. This FAILS OPEN for those keys, which
 * is the deliberate trade: the alternative - refusing all traffic once the map
 * fills - would let an attacker deny service to every legitimate user by
 * spraying unique keys. Losing some limiting under flood beats losing the
 * whole endpoint.
 */
function shed(): void {
  const drop = Math.ceil(MAX_BUCKETS * 0.1)
  const sorted = [...buckets.entries()]
    .sort((a, b) => a[1].resetAt - b[1].resetAt)
    .slice(0, drop)
  for (const [k] of sorted) {
    buckets.delete(k)
  }
}

/**
 * Extract the client IP.
 *
 * Prefers Express's own `req.ip`, which honours the framework's
 * `trust proxy` setting. See the header comment for why this value must not be
 * treated as authenticated.
 */
export function getClientIp(req: MedusaRequest): string {
  const anyReq = req as any
  const ip =
    anyReq.ip ||
    anyReq.socket?.remoteAddress ||
    anyReq.connection?.remoteAddress ||
    "unknown"
  return String(ip)
}

export type RateLimitVerdict =
  | { allowed: true }
  | { allowed: false; retryAfterSec: number; rule: string }

/**
 * Evaluate several buckets together, atomically.
 *
 * PEEK, THEN COMMIT. Every rule is tested before any counter is incremented.
 * The naive loop - check-and-increment per rule - burns budget in the earlier
 * buckets even when a later rule rejects the request, so a caller who is
 * blocked by the per-recipient rule would still drain their per-IP allowance.
 * That both distorts the accounting and hands an attacker a way to exhaust a
 * victim's shared bucket.
 *
 * Node is single-threaded and there is no await between peek and commit, so
 * this whole function is atomic with respect to other requests in this process.
 */
export function checkRateLimits(rules: RateLimitRule[]): RateLimitVerdict {
  const now = Date.now()
  sweep(now)

  const staged: Array<{ id: string; bucket: Bucket }> = []

  // --- peek ---
  for (const rule of rules) {
    const id = `${rule.name}:${rule.key}`
    let bucket = buckets.get(id)

    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + rule.windowMs }
    }

    if (bucket.count >= rule.limit) {
      return {
        allowed: false,
        retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
        rule: rule.name,
      }
    }

    staged.push({ id, bucket })
  }

  // --- commit ---
  if (buckets.size + staged.length > MAX_BUCKETS) {
    shed()
  }
  for (const { id, bucket } of staged) {
    bucket.count += 1
    buckets.set(id, bucket)
  }

  return { allowed: true }
}

/**
 * Enforce rate limits on a request, responding with 429 if exceeded.
 *
 * @returns true if the caller may proceed. If false, a response has ALREADY
 *          been sent and the handler must return immediately.
 *
 * The 429 body deliberately does not say WHICH bucket tripped. Telling an
 * attacker "you hit the per-recipient limit" confirms that the address is one
 * we already sent to, which is a small account-enumeration oracle.
 */
export function enforceRateLimit(
  res: MedusaResponse,
  rules: RateLimitRule[]
): boolean {
  const verdict = checkRateLimits(rules)
  if (verdict.allowed) {
    return true
  }

  res.setHeader("Retry-After", String(verdict.retryAfterSec))
  res.status(429).json({
    ok: false,
    message: "Too many requests. Please try again later.",
  })
  return false
}

/** Test-only: clear all counters. */
export function __resetRateLimitStore(): void {
  buckets.clear()
  lastSweep = 0
}

/** Test-only: current number of tracked buckets. */
export function __rateLimitBucketCount(): number {
  return buckets.size
}

export default {
  RATE_LIMITS,
  getClientIp,
  checkRateLimits,
  enforceRateLimit,
}
