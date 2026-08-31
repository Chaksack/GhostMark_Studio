/**
 * SECURITY LANE regression tests for the shared rate limiter.
 *
 * The peek-then-commit test is the important one: it proves a request rejected
 * by a later rule does not burn budget in the earlier buckets, which is what a
 * naive check-and-increment loop gets wrong.
 *
 * Run: npm run test:unit
 */
import {
  checkRateLimits, enforceRateLimit, getClientIp, RATE_LIMITS,
  __resetRateLimitStore, __rateLimitBucketCount,
} from "../rate-limit"

beforeEach(() => __resetRateLimitStore())

describe("ceilings", () => {
  const r = (key: string) => [{ name: "t", key, limit: 3, windowMs: 60000 }]

  it("allows up to the limit then blocks", () => {
    expect(checkRateLimits(r("a")).allowed).toBe(true)
    expect(checkRateLimits(r("a")).allowed).toBe(true)
    expect(checkRateLimits(r("a")).allowed).toBe(true)
    const blocked = checkRateLimits(r("a"))
    expect(blocked.allowed).toBe(false)
    expect((blocked as any).retryAfterSec).toBeGreaterThan(0)
    expect((blocked as any).retryAfterSec).toBeLessThanOrEqual(60)
  })

  it("scopes buckets by key", () => {
    checkRateLimits(r("a")); checkRateLimits(r("a")); checkRateLimits(r("a"))
    expect(checkRateLimits(r("a")).allowed).toBe(false)
    expect(checkRateLimits(r("b")).allowed).toBe(true)
  })

  it("resets after the window expires", async () => {
    const short = [{ name: "s", key: "x", limit: 1, windowMs: 40 }]
    expect(checkRateLimits(short).allowed).toBe(true)
    expect(checkRateLimits(short).allowed).toBe(false)
    await new Promise((res) => setTimeout(res, 60))
    expect(checkRateLimits(short).allowed).toBe(true)
  })

  it("enforces the strictest of several rules", () => {
    const multi = () => checkRateLimits([
      { name: "loose", key: "k", limit: 10, windowMs: 60000 },
      { name: "tight", key: "k", limit: 2, windowMs: 60000 },
    ])
    expect(multi().allowed).toBe(true)
    expect(multi().allowed).toBe(true)
    const third = multi()
    expect(third.allowed).toBe(false)
    expect((third as any).rule).toBe("tight")
  })
})

describe("peek-then-commit", () => {
  it("does NOT burn the IP budget when a later rule rejects", () => {
    // exhaust the recipient bucket
    checkRateLimits([{ name: "rcpt", key: "v@t", limit: 1, windowMs: 60000 }])
    const before = __rateLimitBucketCount()

    const verdict = checkRateLimits([
      { name: "ip", key: "1.2.3.4", limit: 100, windowMs: 60000 },
      { name: "rcpt", key: "v@t", limit: 1, windowMs: 60000 },
    ])
    expect(verdict.allowed).toBe(false)
    expect((verdict as any).rule).toBe("rcpt")
    // no new bucket was created for the ip rule
    expect(__rateLimitBucketCount()).toBe(before)

    // and the ip bucket still has its full budget
    for (let i = 0; i < 100; i++) {
      expect(checkRateLimits([{ name: "ip", key: "1.2.3.4", limit: 100, windowMs: 60000 }]).allowed).toBe(true)
    }
  })
})

describe("enforceRateLimit", () => {
  const mkRes = () => {
    const r: any = { _status: 0, _json: null, _headers: {} }
    r.setHeader = (k: string, v: string) => { r._headers[k] = v; return r }
    r.status = (s: number) => { r._status = s; return r }
    r.json = (b: any) => { r._json = b; return r }
    return r
  }

  it("returns true and sends nothing when allowed", () => {
    const res = mkRes()
    expect(enforceRateLimit(res, [{ name: "zzbucketzz", key: "z", limit: 1, windowMs: 60000 }])).toBe(true)
    expect(res._status).toBe(0)
  })

  it("sends 429 with Retry-After when blocked", () => {
    const res = mkRes()
    const rule = [{ name: "zzbucketzz", key: "z", limit: 1, windowMs: 60000 }]
    enforceRateLimit(res, rule)
    expect(enforceRateLimit(res, rule)).toBe(false)
    expect(res._status).toBe(429)
    expect(res._headers["Retry-After"]).toBeTruthy()
    expect(res._json.ok).toBe(false)
  })

  it("does not name the bucket that tripped (no enumeration oracle)", () => {
    const res = mkRes()
    const rule = [{ name: "zzbucketzz", key: "z", limit: 1, windowMs: 60000 }]
    enforceRateLimit(res, rule)
    enforceRateLimit(res, rule)
    expect(JSON.stringify(res._json).includes("zzbucketzz")).toBe(false)
  })
})

describe("getClientIp", () => {
  it("prefers req.ip", () => expect(getClientIp({ ip: "9.9.9.9" } as any)).toBe("9.9.9.9"))
  it("falls back to the socket", () => expect(getClientIp({ socket: { remoteAddress: "8.8.8.8" } } as any)).toBe("8.8.8.8"))
  it("never returns undefined", () => expect(getClientIp({} as any)).toBe("unknown"))
})

describe("memory bounds", () => {
  it("caps the bucket map under a unique-key flood", () => {
    for (let i = 0; i < 60000; i++) {
      checkRateLimits([{ name: "flood", key: "k" + i, limit: 5, windowMs: 3600_000 }])
    }
    expect(__rateLimitBucketCount()).toBeLessThanOrEqual(50_000)
  })
})

describe("documented policy", () => {
  it("every policy has a positive limit and window", () => {
    for (const p of Object.values(RATE_LIMITS as any)) {
      expect((p as any).limit).toBeGreaterThan(0)
      expect((p as any).windowMs).toBeGreaterThan(0)
    }
  })
  it("newsletter per-recipient is 3 per day", () => {
    expect(RATE_LIMITS.NEWSLETTER_SUBSCRIBE_RECIPIENT).toEqual({ limit: 3, windowMs: 86400000 })
  })
  it("support ticket creation per-recipient is 3 per hour", () => {
    expect(RATE_LIMITS.SUPPORT_TICKET_CREATE_RECIPIENT).toEqual({ limit: 3, windowMs: 3600000 })
  })
})
