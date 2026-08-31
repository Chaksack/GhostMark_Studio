// Per-instance throttling for the unauthenticated upload endpoint.
//
// SCOPE: READ THIS BEFORE RELYING ON IT
// -------------------------------------
// This is in-process state. It is per container replica, it resets on deploy,
// and it is trivially outrun by a distributed source. It is NOT the rate limit
// this endpoint ultimately needs; that belongs at the edge (AWS WAF rate-based
// rule on the ALB, or CloudFront) where it can see the whole fleet.
//
// What it *does* buy, today, for free and without a dependency:
//   - a concurrency ceiling that bounds peak heap. The 10 MB per-request cap
//     alone does not bound memory: N simultaneous 10 MB uploads cost N * 10 MB.
//     Capping concurrency turns an unbounded number into a known one.
//   - a per-IP burst limit that stops a single naive script from filling the
//     disk (uploads currently land on container-local storage).
//
// Both limits are env-tunable so they can be raised without a code change.

const MAX_CONCURRENT = readPositiveInt(process.env.NUXT_UPLOAD_MAX_CONCURRENCY, 8)
const PER_IP_LIMIT = readPositiveInt(process.env.NUXT_UPLOAD_RATE_LIMIT, 20)
const WINDOW_MS = readPositiveInt(process.env.NUXT_UPLOAD_RATE_WINDOW_MS, 60_000)

/** Ceiling on distinct tracked IPs, so the limiter itself cannot be turned
 *  into the memory-exhaustion vector it is meant to prevent. */
const MAX_TRACKED_KEYS = 10_000

interface Window {
  count: number
  resetAt: number
}

const windows = new Map<string, Window>()
let inFlight = 0

function readPositiveInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw)
  return Number.isInteger(n) && n > 0 ? n : fallback
}

/** Drop expired windows. Called on write, so there is no background timer to
 *  leak in a serverless/edge runtime. */
function sweep(now: number): void {
  for (const [key, win] of windows) {
    if (win.resetAt <= now) windows.delete(key)
  }
  // Pathological case: everything still live and we are over the ceiling.
  // Evict oldest-inserted (Map preserves insertion order) rather than grow.
  while (windows.size > MAX_TRACKED_KEYS) {
    const oldest = windows.keys().next()
    if (oldest.done) break
    windows.delete(oldest.value)
  }
}

export type ThrottleVerdict =
  | { ok: true; release: () => void }
  | { ok: false; reason: 'rate'; retryAfterSeconds: number }
  | { ok: false; reason: 'concurrency'; retryAfterSeconds: number }

/**
 * Claim a slot for one upload. On success the caller MUST invoke `release()`
 * in a `finally` block, or the concurrency counter leaks and the endpoint
 * wedges itself shut.
 */
export function acquireUploadSlot(clientKey: string): ThrottleVerdict {
  const now = Date.now()

  const existing = windows.get(clientKey)
  if (!existing || existing.resetAt <= now) {
    sweep(now)
    windows.set(clientKey, { count: 1, resetAt: now + WINDOW_MS })
  } else {
    existing.count += 1
    if (existing.count > PER_IP_LIMIT) {
      return {
        ok: false,
        reason: 'rate',
        retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
      }
    }
  }

  if (inFlight >= MAX_CONCURRENT) {
    return { ok: false, reason: 'concurrency', retryAfterSeconds: 2 }
  }

  inFlight += 1
  let released = false
  return {
    ok: true,
    release: () => {
      if (released) return
      released = true
      inFlight = Math.max(0, inFlight - 1)
    },
  }
}
