/**
 * SECURITY LANE regression tests for the two unauthenticated email routes and
 * the support credential flow.
 *
 * These drive the REAL route handlers. Two side effects are neutralised:
 *   - the Resend SDK is mocked, so no email leaves the process;
 *   - DATABASE_URL is unset before support-db loads, forcing its in-memory
 *     mode, so no database is touched.
 * Both are asserted, not assumed - see the guards below.
 *
 * Several assertions use the literal phishing payload the original code was
 * vulnerable to, rather than a synthetic one.
 *
 * Run: npm run test:unit
 */

const mockSent: any[] = []
jest.mock("resend", () => ({
  Resend: class {
    emails = {
      send: async (payload: any) => {
        mockSent.push(payload)
        return { data: { id: "stub" }, error: null }
      },
    }
  },
}))

// Must happen before support-db is required: it decides memoryMode at import.
delete process.env.DATABASE_URL
process.env.RESEND_API_KEY = "re_test_key_not_real"
process.env.JWT_SECRET = "test-only-signing-key-not-a-real-secret-000"
process.env.SUPPORT_ADMIN_EMAIL = "admin@ghostmark.invalid"
process.env.STOREFRONT_PUBLIC_URL = "https://shop.invalid"
process.env.MEDUSA_BACKEND_URL = "https://api.invalid"

const supportCreate = require("../store/support/tickets/route")
const supportRead = require("../store/support/tickets/[caseId]/route")
const newsletterSubscribe = require("../store/newsletter/subscribe/route")
const newsletterConfirm = require("../store/newsletter/confirm/route")
const casePage = require("../support/[caseId]/route")
const adminList = require("../admin/support/tickets/route")
const db = require("../../services/support-db")
const { hashSecret } = require("../../utils/secure-token")
const { __resetRateLimitStore } = require("../../utils/rate-limit")

/** The exact shape of payload the original routes let through. */
const PHISH = `</p><a href="https://evil.test/steal">Click to verify your account</a><p>`

function mkRes() {
  const r: any = { _status: 200, _json: null, _body: null, _headers: {} }
  r.status = (s: number) => { r._status = s; return r }
  r.json = (b: any) => { r._json = b; return r }
  r.send = (b: any) => { r._body = b; return r }
  r.setHeader = (k: string, v: string) => { r._headers[k] = v; return r }
  return r
}
const mkReq = (o: any = {}) => ({
  body: {}, query: {}, params: {}, ip: "203.0.113.9",
  scope: { resolve: () => { throw new Error("no container in unit test") } },
  ...o,
})

beforeEach(() => { mockSent.length = 0; __resetRateLimitStore() })

describe("test harness safety guards", () => {
  it("the Resend SDK is mocked, so no real email can be sent", async () => {
    // Prove the interception behaviourally rather than by class name: a send
    // must land in mockSent and never touch the network.
    const probe = new (require("resend").Resend)("unused")
    const result = await probe.emails.send({ to: "guard@invalid", subject: "guard" })
    expect(result).toEqual({ data: { id: "stub" }, error: null })
    expect(mockSent.pop()).toMatchObject({ to: "guard@invalid" })
  })
  it("support-db is in memory mode, so no database is touched", () => {
    expect(process.env.DATABASE_URL).toBeUndefined()
  })
})

describe("C6+C7: POST /store/support/tickets", () => {
  async function createTicket(body: any, ip = "203.0.113.9") {
    const res = mkRes()
    await supportCreate.POST(mkReq({ body, ip }), res)
    return res
  }

  it("C7: the secret is NOT returned to the caller", async () => {
    const res = await createTicket({ email: "a@example.invalid", subject: "s", message: "m" })
    expect(res._json.ok).toBe(true)
    expect(typeof res._json.caseId).toBe("string")
    expect("secret" in res._json).toBe(false)
  })

  it("C7: case IDs are CSPRNG-shaped, not Math.random base36", async () => {
    const res = await createTicket({ email: "a@example.invalid", subject: "s", message: "m" })
    expect(res._json.caseId).toMatch(/^GM-\d{8}-[23456789ABCDEFGHJKMNPQRSTVWXYZ]{10}$/)
  })

  it("C6: no attacker-controlled content reaches the customer's email at all", async () => {
    const res = await createTicket({ email: "victim@example.invalid", subject: PHISH, message: PHISH })
    const cust = mockSent.find((s) => s.to === "victim@example.invalid")
    expect(cust).toBeDefined()
    // Not merely escaped - absent. Escaping alone would not stop a mail client
    // autolinking a bare URL in the text part.
    expect(cust.html.includes("evil.test")).toBe(false)
    expect(cust.text.includes("evil.test")).toBe(false)
    expect(cust.html.includes("Click to verify")).toBe(false)
    expect(cust.html.includes(res._json.caseId)).toBe(true)
  })

  it("C6: the admin email shows the report but escapes it at the sink", async () => {
    await createTicket({ email: "victim@example.invalid", subject: PHISH, message: PHISH })
    const adm = mockSent.find((s) => s.to === "admin@ghostmark.invalid")
    expect(adm).toBeDefined()
    expect(adm.html.includes("evil.test")).toBe(true)              // staff must see it
    expect(adm.html.includes(`<a href="https://evil.test`)).toBe(false) // but not live
    expect(adm.html.includes("&lt;a href=&quot;")).toBe(true)
  })

  it("C7: the secret is stored as a hash and delivered only by email", async () => {
    const res = await createTicket({ email: "h@example.invalid", subject: "s", message: "m" })
    const stored = await db.getTicketByCaseId(res._json.caseId)
    expect(stored.ticket.secret_code).toBeNull()
    expect(stored.ticket.secret_hash).toMatch(/^[0-9a-f]{64}$/)
    expect(stored.ticket.secret_expires_at).toBeTruthy()

    const cust = mockSent.find((s) => s.to === "h@example.invalid")
    const secret = cust.text.match(/Secret: ([23456789ABCDEFGHJKMNPQRSTVWXYZ]{16})/)[1]
    expect(stored.ticket.secret_hash).toBe(hashSecret(secret))
    expect(stored.ticket.secret_hash).not.toBe(secret)
  })

  it("C6: per-recipient rate limit holds even across rotating source IPs", async () => {
    const statuses: number[] = []
    for (let i = 0; i < 6; i++) {
      const r = await createTicket({ email: "flood@example.invalid", subject: "s", message: "m" }, `198.51.100.${i}`)
      statuses.push(r._status)
    }
    expect(statuses).toEqual([200, 200, 200, 429, 429, 429])
    expect(mockSent.filter((s) => s.to === "flood@example.invalid").length).toBe(3)
  })

  it("C6: per-IP rate limit holds across differing recipients", async () => {
    const statuses: number[] = []
    for (let i = 0; i < 7; i++) {
      const r = await createTicket({ email: `u${i}@example.invalid`, subject: "s", message: "m" }, "192.0.2.1")
      statuses.push(r._status)
    }
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429, 429])
  })

  it.each([
    ["not-an-email", "malformed"],
    ["a@b.test\nBcc: victim@x.test", "CRLF header injection"],
    ["", "empty"],
  ])("rejects %s (%s) with 400", async (addr) => {
    const r = await createTicket({ email: addr, subject: "s", message: "m" })
    expect(r._status).toBe(400)
    expect(mockSent.length).toBe(0)
  })
})

describe("access control: GET /store/support/tickets/:caseId", () => {
  let caseId: string, secret: string
  const EMAIL = "owner@example.invalid"

  beforeEach(async () => {
    const res = mkRes()
    await supportCreate.POST(mkReq({ body: { email: EMAIL, subject: "s", message: "m" } }), res)
    caseId = res._json.caseId
    secret = mockSent.find((s) => s.to === EMAIL).text.match(/Secret: (\S+)/)[1]
    __resetRateLimitStore()
  })

  const read = async (params: any, query: any) => {
    const r = mkRes()
    await supportRead.GET(mkReq({ params, query }), r)
    return r
  }

  it("accepts correct credentials", async () => {
    const r = await read({ caseId }, { email: EMAIL, secret })
    expect(r._status).toBe(200)
    expect(r._json.ok).toBe(true)
  })

  it("gives an IDENTICAL response for a bad secret and a nonexistent case", async () => {
    const bad = await read({ caseId }, { email: EMAIL, secret: "WRONGWRONGWRONG9" })
    const missing = await read({ caseId: "GM-20260101-ZZZZZZZZZZ" }, { email: EMAIL, secret })
    expect(bad._status).toBe(404)
    expect(missing._status).toBe(404)
    // No enumeration oracle: an attacker cannot learn which case IDs exist.
    expect(JSON.stringify(bad._json)).toBe(JSON.stringify(missing._json))
  })

  it("rejects the right secret with the wrong email", async () => {
    const r = await read({ caseId }, { email: "someone@else.invalid", secret })
    expect(r._status).toBe(404)
  })

  it("C7: enforces expiry", async () => {
    const stored = await db.getTicketByCaseId(caseId)
    stored.ticket.secret_expires_at = new Date(Date.now() - 1000).toISOString()
    const r = await read({ caseId }, { email: EMAIL, secret })
    expect(r._status).toBe(403)
    expect(r._json.code).toBe("expired")
  })
})

describe("C7: GET /admin/support/tickets no longer emits secrets", () => {
  it("returns no secret material", async () => {
    const c = mkRes()
    await supportCreate.POST(mkReq({ body: { email: "adm@example.invalid", subject: "s", message: "m" } }), c)
    const secret = mockSent.find((s) => s.to === "adm@example.invalid").text.match(/Secret: (\S+)/)[1]

    const res = mkRes()
    await adminList.GET(mkReq({ query: {} }), res)
    const body = JSON.stringify(res._json)

    expect(res._json.ok).toBe(true)
    expect(res._json.tickets.length).toBeGreaterThan(0)
    expect(body.includes(secret)).toBe(false)
    for (const t of res._json.tickets) {
      expect("secret_code" in t).toBe(false)
      expect("secret_hash" in t).toBe(false)
      expect("case_id" in t).toBe(true) // still returns what the UI uses
    }
  })
})

describe("C6: newsletter double opt-in", () => {
  const VICTIM = "victim2@example.invalid"

  async function subscribe(body: any, ip = "203.0.113.9") {
    const res = mkRes()
    await newsletterSubscribe.POST(mkReq({ body, ip }), res)
    return res
  }

  it("sends a CONFIRMATION carrying no attacker content, not a welcome", async () => {
    const res = await subscribe({ email: VICTIM, first_name: PHISH, interests: [PHISH] })
    expect(res._json.pending).toBe(true)
    expect(mockSent.length).toBe(1)

    const conf = mockSent[0]
    expect(conf.to).toBe(VICTIM)
    expect(conf.subject).toMatch(/confirm/i)
    expect(conf.html.includes("evil.test")).toBe(false)
    expect(conf.text.includes("evil.test")).toBe(false)
    expect(conf.html.includes("/store/newsletter/confirm?token=")).toBe(true)
  })

  it("sends NO welcome email for a forged token", async () => {
    await subscribe({ email: VICTIM })
    const token = mockSent[0].text.match(/token=([A-Za-z0-9_\-.]+)/)[1]
    mockSent.length = 0

    const forged = token.split(".")[0] + "." + "A".repeat(43)
    const r = mkRes()
    await newsletterConfirm.GET(mkReq({ query: { token: forged } }), r)
    expect(r._status).toBe(400)
    expect(mockSent.length).toBe(0)
  })

  it("sends NO welcome email with no token", async () => {
    const r = mkRes()
    await newsletterConfirm.GET(mkReq({ query: {} }), r)
    expect(r._status).toBe(400)
    expect(mockSent.length).toBe(0)
  })

  it("sends the welcome only after a valid confirmation, with content escaped", async () => {
    await subscribe({ email: VICTIM, first_name: PHISH, interests: [PHISH] })
    const token = mockSent[0].text.match(/token=([A-Za-z0-9_\-.]+)/)[1]
    mockSent.length = 0
    __resetRateLimitStore()

    const r = mkRes()
    await newsletterConfirm.GET(mkReq({ query: { token } }), r)

    expect(r._status).toBe(200)
    expect(mockSent.length).toBe(1)
    const wel = mockSent[0]
    expect(wel.to).toBe(VICTIM)
    expect(wel.subject).toMatch(/welcome/i)
    // Now that the address is confirmed, the subscriber's own text renders -
    // but escaped, so it can never be live markup.
    expect(wel.html.includes(`<a href="https://evil.test`)).toBe(false)
    expect(wel.html.includes("&lt;a href=&quot;")).toBe(true)
    // The result page must not reflect the token back.
    expect(r._body.includes(token)).toBe(false)
    expect(r._headers["Content-Security-Policy"]).toBeTruthy()
  })

  it("caps a victim at 3 confirmation emails per day across rotating IPs", async () => {
    const statuses: number[] = []
    for (let i = 0; i < 5; i++) {
      const r = await subscribe({ email: "spam-target@example.invalid" }, `198.51.100.${i}`)
      statuses.push(r._status)
    }
    expect(statuses).toEqual([200, 200, 200, 429, 429])
    expect(mockSent.length).toBe(3)
  })
})

describe("GET /support/:caseId encodes at the sink instead of blacklisting", () => {
  const render = async (caseId: string) => {
    const r = mkRes()
    await casePage.GET(mkReq({ params: { caseId } }), r)
    return r
  }

  it("escapes a script tag rather than stripping characters", async () => {
    const r = await render(`<script>alert(1)</script>`)
    expect(r._status).toBe(200)
    expect(r._body.includes("<script>alert(1)</script>")).toBe(false)
    expect(r._body.includes("&lt;script&gt;")).toBe(true)
  })

  it("neutralises an attribute breakout", async () => {
    const r = await render(`A"onmouseover="alert(1)`)
    expect(r._body.includes(`"onmouseover="`)).toBe(false)
  })

  it("encodes the ampersand the old blacklist left broken", async () => {
    const r = await render(`Tom & Jerry`)
    expect(r._body.includes("Tom &amp; Jerry")).toBe(true)
  })

  it("sets defensive headers", async () => {
    const r = await render("GM-1")
    expect(r._headers["Content-Security-Policy"]).toBeTruthy()
    expect(r._headers["X-Content-Type-Options"]).toBe("nosniff")
    expect(r._headers["Referrer-Policy"]).toBe("no-referrer")
  })
})

describe("email-service.ts: the shared text-only HTML sink", () => {
  it("escapes a text-only body instead of promoting it to live markup", async () => {
    const { sendEmail } = require("../../services/email-service")
    await sendEmail({
      to: "staff@ghostmark.invalid",
      subject: "text-only send",
      text: `Customer said:\n<a href="https://evil.test/phish">Reset your password</a>`,
    })
    expect(mockSent.length).toBe(1)
    const m = mockSent[0]
    expect(m.html.includes(`<a href="https://evil.test`)).toBe(false)
    expect(m.html.includes("&lt;a href=&quot;https://evil.test")).toBe(true)
    expect(m.html.includes("<br/>")).toBe(true)
    // The plain-text part is correctly left verbatim.
    expect(m.text.includes(`<a href="https://evil.test`)).toBe(true)
  })
})
