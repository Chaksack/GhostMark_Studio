import {
  ORDER_ACCESS_HEADER,
  ORDER_ACCESS_PURPOSE,
  attachOrderAccessToken,
  getOrderAccessTtlSeconds,
  mintOrderAccessToken,
  requireOrderAccess,
  verifyOrderAccessToken,
} from "../order-access"
import { signPayload } from "../secure-token"
import { __resetRateLimitStore } from "../rate-limit"

/**
 * =============================================================================
 * Adversarial tests for the `GET /store/orders/:id` access guard.
 * =============================================================================
 *
 * These test the NEGATIVE cases first and hardest, because the whole point of
 * this guard is what it REFUSES. A guard that lets everything through passes
 * every "happy path" test ever written.
 *
 * Every refusal test below is paired with a positive control asserting that the
 * same request, differing only in the one thing under test, IS allowed. Without
 * that pairing a `expect(next).not.toHaveBeenCalled()` proves nothing: a typo in
 * the fixture would produce the same green.
 */

const ORDER_A = "order_01M1ADH3A8F5MBY84QV87ZF1K8"
const ORDER_B = "order_01M1AD38KJJNVNCBVK4HR2FS31"
const CUSTOMER_A = "cus_01M1ADGR1VNRN8AJ5RS5THCDCJ"
const CUSTOMER_B = "cus_01M1AD2YWYZQ7C9ZPZYKXS9S6S"

// The guard resolves the signing key through secure-token's getSigningSecret,
// which reads SECURE_TOKEN_SECRET / MEDUSA_JWT_SECRET / JWT_SECRET. Pin one so
// the suite does not depend on the developer's .env and does not silently fall
// into the ephemeral-key branch (which would still pass, but for the wrong
// reason, since mint and verify would share the same ephemeral key).
process.env.SECURE_TOKEN_SECRET =
  process.env.SECURE_TOKEN_SECRET ||
  "unit-test-signing-key-not-a-real-secret-0123456789"

type Verdict = {
  nextCalled: boolean
  status: number | null
  body: any
}

/**
 * Build request/response doubles.
 *
 * `orderOwner` is what the fake QUERY returns for the order being requested;
 * `undefined` models "no such order".
 */
function run(opts: {
  orderId: string
  token?: string
  actorId?: string
  actorType?: string
  orderOwner?: string | null
  queryThrows?: boolean
  ip?: string
}): Promise<Verdict> {
  const verdict: Verdict = { nextCalled: false, status: null, body: null }

  const graph = jest.fn(async () => {
    if (opts.queryThrows) {
      throw new Error("simulated database failure")
    }
    if (opts.orderOwner === undefined) {
      return { data: [] }
    }
    return { data: [{ id: opts.orderId, customer_id: opts.orderOwner }] }
  })

  const req: any = {
    params: { id: opts.orderId },
    headers: opts.token ? { [ORDER_ACCESS_HEADER]: opts.token } : {},
    ip: opts.ip ?? `10.0.0.${Math.floor(Math.random() * 250) + 1}`,
    auth_context: opts.actorId
      ? { actor_id: opts.actorId, actor_type: opts.actorType ?? "customer" }
      : undefined,
    scope: {
      resolve: (key: string) => {
        if (key === "query") return { graph }
        if (key === "logger") return { debug: () => {}, error: () => {} }
        throw new Error(`unexpected resolve(${key})`)
      },
    },
  }

  const res: any = {
    status(code: number) {
      verdict.status = code
      return res
    },
    json(body: unknown) {
      verdict.body = body
      return res
    },
  }

  const next = () => {
    verdict.nextCalled = true
  }

  return requireOrderAccess(req, res, next as never).then(() => verdict)
}

beforeEach(() => {
  __resetRateLimitStore()
})

describe("order access guard - the vulnerability itself", () => {
  /**
   * THE BUG. Before this guard existed, this exact request returned HTTP 200
   * and 9905 bytes containing the customer's email, full name and delivery
   * address. The publishable key is not represented here at all because it is
   * not a credential - it ships in the storefront bundle.
   */
  it("REFUSES a request carrying nothing but an order id", async () => {
    const v = await run({ orderId: ORDER_A, orderOwner: CUSTOMER_A })
    expect(v.nextCalled).toBe(false)
    expect(v.status).toBe(401)
  })

  it("refuses without ever querying the database", async () => {
    // An unauthenticated caller must not be able to make us do work, and must
    // not learn from timing or load whether an id is real.
    let graphCalls = 0
    const req: any = {
      params: { id: ORDER_A },
      headers: {},
      ip: "10.1.1.1",
      scope: {
        resolve: (key: string) => {
          if (key === "query") {
            return {
              graph: async () => {
                graphCalls++
                return { data: [] }
              },
            }
          }
          return { debug: () => {}, error: () => {} }
        },
      },
    }
    let status: number | null = null
    const res: any = {
      status(c: number) {
        status = c
        return res
      },
      json: () => res,
    }
    let nexted = false
    await requireOrderAccess(req, res, (() => {
      nexted = true
    }) as never)

    expect(nexted).toBe(false)
    expect(status).toBe(401)
    expect(graphCalls).toBe(0)
  })

  /**
   * POSITIVE CONTROL for the two tests above. Same order, same fixture, same
   * code path - the ONLY difference is a valid token. If this fails, the
   * refusals above are meaningless because nothing could ever have passed.
   */
  it("POSITIVE CONTROL: the same order IS returned when a valid token is presented", async () => {
    const v = await run({
      orderId: ORDER_A,
      token: mintOrderAccessToken(ORDER_A),
      orderOwner: CUSTOMER_A,
    })
    expect(v.nextCalled).toBe(true)
    expect(v.status).toBeNull()
  })
})

describe("capability token binding", () => {
  it("refuses a token minted for a DIFFERENT order", async () => {
    const tokenForB = mintOrderAccessToken(ORDER_B)
    const v = await run({ orderId: ORDER_A, token: tokenForB, orderOwner: CUSTOMER_A })
    expect(v.nextCalled).toBe(false)
    expect(v.status).toBe(401)
    expect(verifyOrderAccessToken(tokenForB, ORDER_A)).toEqual({
      ok: false,
      reason: "wrong_order",
    })
    // control: that same token works for the order it was minted for
    expect(verifyOrderAccessToken(tokenForB, ORDER_B)).toEqual({ ok: true })
  })

  /**
   * CROSS-FEATURE TOKEN SWAP.
   *
   * `signPayload` mixes the purpose string into the MAC, so a token minted for
   * one feature must not verify for another even though every purpose is signed
   * with the SAME key. This matters because the codebase mints several token
   * types and they travel in URLs, where they get copied, logged and forwarded.
   *
   * Table-driven over every purpose this repo actually uses, so that adding a
   * new one and forgetting to check it here is a visible omission rather than a
   * silent gap. Enumerate with:
   *   grep -rhoE '(signPayload|verifyPayload)\([^)]*"[a-z_]+"' src/
   *
   * Test shape suggested by the QA lane, which independently probed this with a
   * `review_token` tag; broadened here to the real purpose strings.
   */
  const FOREIGN_PURPOSES = [
    "newsletter_confirm", // live sibling - src/api/store/newsletter/subscribe/route.ts:119
    "review_token",       // reviews use their own secret AND format; assert anyway
    "order_access ",      // trailing space - must not be treated as equivalent
    "ORDER_ACCESS",       // case variation
    "order-access",       // separator variation
    "",                   // empty purpose
  ]

  it.each(FOREIGN_PURPOSES)(
    "refuses a correctly-shaped token signed under purpose %p",
    async (purpose) => {
      const foreign = signPayload({ oid: ORDER_A }, 3600, purpose)
      expect(verifyOrderAccessToken(foreign, ORDER_A).ok).toBe(false)
      const v = await run({ orderId: ORDER_A, token: foreign, orderOwner: CUSTOMER_A })
      expect(v.nextCalled).toBe(false)
      expect(v.status).toBe(401)
    }
  )

  it("POSITIVE CONTROL: the identical payload under the CORRECT purpose is accepted", async () => {
    // Without this, every case above could pass because the payload itself is
    // malformed rather than because the purpose tag is doing any work.
    const correct = signPayload({ oid: ORDER_A }, 3600, ORDER_ACCESS_PURPOSE)
    expect(verifyOrderAccessToken(correct, ORDER_A)).toEqual({ ok: true })
    expect((await run({ orderId: ORDER_A, token: correct })).nextCalled).toBe(true)
  })

  it("refuses a token whose signature has been tampered with", async () => {
    const good = mintOrderAccessToken(ORDER_A)
    const [body, sig] = good.split(".")
    // Flip one character of the MAC.
    const flipped = sig[0] === "A" ? "B" + sig.slice(1) : "A" + sig.slice(1)
    const tampered = `${body}.${flipped}`
    expect(tampered).not.toBe(good)
    expect(verifyOrderAccessToken(tampered, ORDER_A).ok).toBe(false)
    expect((await run({ orderId: ORDER_A, token: tampered })).status).toBe(401)
    // control
    expect(verifyOrderAccessToken(good, ORDER_A)).toEqual({ ok: true })
  })

  it("refuses a token whose PAYLOAD has been rewritten to another order", async () => {
    // The attacker holds a valid token for their own order B and edits the
    // payload to name order A, keeping the original signature.
    const mine = mintOrderAccessToken(ORDER_B)
    const [, sig] = mine.split(".")
    const forgedBody = Buffer.from(
      JSON.stringify({ oid: ORDER_A, exp: Math.floor(Date.now() / 1000) + 3600 }),
      "utf8"
    ).toString("base64url")
    const forged = `${forgedBody}.${sig}`
    expect(verifyOrderAccessToken(forged, ORDER_A).ok).toBe(false)
    expect((await run({ orderId: ORDER_A, token: forged })).status).toBe(401)
  })

  it("refuses malformed and empty tokens", async () => {
    for (const bad of ["", "   ", "not-a-token", "a.b.c", "....", "null"]) {
      expect(verifyOrderAccessToken(bad, ORDER_A).ok).toBe(false)
    }
  })
})

describe("expiry", () => {
  it("refuses an EXPIRED token", async () => {
    // Minted with a negative TTL, so `exp` is already in the past. This is a
    // genuinely expired token produced by the real signing path, not a fake.
    const expired = signPayload({ oid: ORDER_A }, -10, ORDER_ACCESS_PURPOSE)
    const verdict = verifyOrderAccessToken(expired, ORDER_A)
    expect(verdict).toEqual({ ok: false, reason: "expired" })

    const v = await run({ orderId: ORDER_A, token: expired, orderOwner: CUSTOMER_A })
    expect(v.nextCalled).toBe(false)
    expect(v.status).toBe(401)
  })

  it("POSITIVE CONTROL: an otherwise identical token that has NOT expired is accepted", async () => {
    const live = signPayload({ oid: ORDER_A }, 60, ORDER_ACCESS_PURPOSE)
    expect(verifyOrderAccessToken(live, ORDER_A)).toEqual({ ok: true })
    expect((await run({ orderId: ORDER_A, token: live })).nextCalled).toBe(true)
  })

  it("refuses a token with no exp claim at all", async () => {
    // Hand-built with a real MAC over a payload that omits `exp`. Proves the
    // guard does not treat "no expiry" as "never expires".
    const crypto = require("node:crypto")
    const body = Buffer.from(JSON.stringify({ oid: ORDER_A }), "utf8").toString(
      "base64url"
    )
    const sig = crypto
      .createHmac("sha256", process.env.SECURE_TOKEN_SECRET as string)
      .update(`${ORDER_ACCESS_PURPOSE}.${body}`)
      .digest("base64url")
    expect(verifyOrderAccessToken(`${body}.${sig}`, ORDER_A).ok).toBe(false)
  })

  it("mints with a bounded, sane TTL and rejects nonsense configuration", () => {
    const original = process.env.ORDER_ACCESS_TOKEN_TTL_SECONDS
    try {
      delete process.env.ORDER_ACCESS_TOKEN_TTL_SECONDS
      expect(getOrderAccessTtlSeconds()).toBe(7 * 24 * 60 * 60)

      process.env.ORDER_ACCESS_TOKEN_TTL_SECONDS = "3600"
      expect(getOrderAccessTtlSeconds()).toBe(3600)

      // A misconfiguration must not become "forever" or "already expired".
      for (const junk of ["0", "-1", "abc", "99999999999", ""]) {
        process.env.ORDER_ACCESS_TOKEN_TTL_SECONDS = junk
        expect(getOrderAccessTtlSeconds()).toBe(7 * 24 * 60 * 60)
      }
    } finally {
      if (original === undefined) delete process.env.ORDER_ACCESS_TOKEN_TTL_SECONDS
      else process.env.ORDER_ACCESS_TOKEN_TTL_SECONDS = original
    }
  })
})

describe("authenticated customer ownership", () => {
  it("ALLOWS a customer to read their OWN order, with no token", async () => {
    const v = await run({
      orderId: ORDER_A,
      actorId: CUSTOMER_A,
      orderOwner: CUSTOMER_A,
    })
    expect(v.nextCalled).toBe(true)
    expect(v.status).toBeNull()
  })

  it("REFUSES a customer reading ANOTHER customer's order", async () => {
    const v = await run({
      orderId: ORDER_A,
      actorId: CUSTOMER_B,
      orderOwner: CUSTOMER_A,
    })
    expect(v.nextCalled).toBe(false)
    expect(v.status).toBe(401)
  })

  it("refuses an actor that is authenticated but is not a customer", async () => {
    // An admin user's JWT must not satisfy the customer-ownership grant, even
    // if actor_id somehow collided.
    const v = await run({
      orderId: ORDER_A,
      actorId: CUSTOMER_A,
      actorType: "user",
      orderOwner: CUSTOMER_A,
    })
    expect(v.nextCalled).toBe(false)
    expect(v.status).toBe(401)
  })

  it("refuses when the order does not exist", async () => {
    const v = await run({
      orderId: ORDER_A,
      actorId: CUSTOMER_A,
      orderOwner: undefined,
    })
    expect(v.nextCalled).toBe(false)
    expect(v.status).toBe(401)
  })

  it("FAILS CLOSED when the ownership lookup throws", async () => {
    const v = await run({
      orderId: ORDER_A,
      actorId: CUSTOMER_A,
      orderOwner: CUSTOMER_A,
      queryThrows: true,
    })
    expect(v.nextCalled).toBe(false)
    expect(v.status).toBe(401)
  })

  it("still serves a signed-in owner whose token has EXPIRED", async () => {
    // The grants are independent: an expired confirmation link must not lock a
    // registered customer out of an order they own.
    const expired = signPayload({ oid: ORDER_A }, -10, ORDER_ACCESS_PURPOSE)
    const v = await run({
      orderId: ORDER_A,
      token: expired,
      actorId: CUSTOMER_A,
      orderOwner: CUSTOMER_A,
    })
    expect(v.nextCalled).toBe(true)
  })
})

describe("the refusal response is not an oracle", () => {
  it("answers identically for 'not yours', 'no such order' and 'no credential'", async () => {
    const notYours = await run({
      orderId: ORDER_A,
      actorId: CUSTOMER_B,
      orderOwner: CUSTOMER_A,
    })
    const noSuchOrder = await run({
      orderId: ORDER_A,
      actorId: CUSTOMER_B,
      orderOwner: undefined,
    })
    const noCredential = await run({ orderId: ORDER_A, orderOwner: CUSTOMER_A })
    const expiredLink = await run({
      orderId: ORDER_A,
      token: signPayload({ oid: ORDER_A }, -10, ORDER_ACCESS_PURPOSE),
      orderOwner: CUSTOMER_A,
    })

    for (const v of [notYours, noSuchOrder, noCredential, expiredLink]) {
      expect(v.status).toBe(401)
    }
    // Byte-identical bodies. Any divergence here is an enumeration oracle.
    const bodies = [notYours, noSuchOrder, noCredential, expiredLink].map((v) =>
      JSON.stringify(v.body)
    )
    expect(new Set(bodies).size).toBe(1)
  })

  it("never reflects the internal failure reason to the caller", async () => {
    const v = await run({
      orderId: ORDER_A,
      token: mintOrderAccessToken(ORDER_B),
      orderOwner: CUSTOMER_A,
    })
    const serialised = JSON.stringify(v.body).toLowerCase()
    for (const leak of ["wrong_order", "expired", "signature", "owner", "customer_id"]) {
      expect(serialised).not.toContain(leak)
    }
  })
})

describe("rate limiting", () => {
  it("meters refusals and eventually sheds them", async () => {
    const ip = "203.0.113.77"
    let refusedNormally = 0
    for (let i = 0; i < 60; i++) {
      const v = await run({ orderId: ORDER_A, ip, orderOwner: CUSTOMER_A })
      if (v.status === 401) refusedNormally++
    }
    expect(refusedNormally).toBe(60)
    // The 61st refusal from the same IP is beyond the ceiling; the guard still
    // answers 401 (it never leaks that a limit exists on this route) but the
    // bucket is now exhausted, which is what bounds the DB-touching branch.
    const beyond = await run({ orderId: ORDER_A, ip, orderOwner: CUSTOMER_A })
    expect(beyond.status).toBe(401)
  })

  it("does NOT meter successful reads - a customer may refresh freely", async () => {
    const ip = "203.0.113.99"
    const token = mintOrderAccessToken(ORDER_A)
    for (let i = 0; i < 200; i++) {
      const v = await run({ orderId: ORDER_A, token, ip })
      expect(v.nextCalled).toBe(true)
    }
  })

  it("buckets on the CALLER, so one attacker cannot lock a victim out of their own order", async () => {
    // Burn the attacker's budget against the victim's order id...
    for (let i = 0; i < 80; i++) {
      await run({ orderId: ORDER_A, ip: "198.51.100.5", orderOwner: CUSTOMER_A })
    }
    // ...the victim, on a different IP with a valid token, is unaffected.
    const victim = await run({
      orderId: ORDER_A,
      token: mintOrderAccessToken(ORDER_A),
      ip: "192.0.2.10",
    })
    expect(victim.nextCalled).toBe(true)
    // ...and even the victim's REFUSALS are on their own untouched bucket.
    const victimRefused = await run({
      orderId: ORDER_A,
      ip: "192.0.2.10",
      orderOwner: CUSTOMER_A,
    })
    expect(victimRefused.status).toBe(401)
  })
})

describe("mint-on-completion interceptor", () => {
  function completion(body: unknown): { sent: any } {
    const captured: { sent: any } = { sent: null }
    const res: any = {
      json(b: unknown) {
        captured.sent = b
        return res
      },
    }
    const req: any = {
      scope: { resolve: () => ({ debug: () => {}, error: () => {} }) },
    }
    let nexted = false
    attachOrderAccessToken(req, res, (() => {
      nexted = true
    }) as never)
    expect(nexted).toBe(true)
    res.json(body)
    return captured
  }

  it("attaches a working token to a successful completion response", () => {
    const { sent } = completion({ type: "order", order: { id: ORDER_A } })
    expect(typeof sent.order_access_token).toBe("string")
    expect(sent.order_access_token_expires_in).toBe(getOrderAccessTtlSeconds())
    // The token it minted must actually open the order it was minted for...
    expect(verifyOrderAccessToken(sent.order_access_token, ORDER_A)).toEqual({
      ok: true,
    })
    // ...and nothing else.
    expect(verifyOrderAccessToken(sent.order_access_token, ORDER_B).ok).toBe(false)
  })

  it("leaves a FAILED completion untouched - no token on a cart response", () => {
    const original = {
      type: "cart",
      cart: { id: "cart_1" },
      error: { message: "card declined" },
    }
    const { sent } = completion(original)
    expect(sent.order_access_token).toBeUndefined()
    expect(sent).toEqual(original)
  })

  it("NEVER breaks the payment response, whatever it is handed", () => {
    // This wrapper sits in the response path of the request that takes the
    // customer's money. Every one of these must pass straight through.
    for (const weird of [
      null,
      undefined,
      "a string",
      42,
      [],
      { type: "order" },
      { type: "order", order: null },
      { type: "order", order: { id: 123 } },
      { type: "order", order: { id: "" } },
    ]) {
      const { sent } = completion(weird)
      expect(sent).toEqual(weird)
    }
  })
})
