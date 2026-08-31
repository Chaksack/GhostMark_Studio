/**
 * SECURITY LANE regression tests.
 *
 * These exist because a security fix without a test is a hypothesis. Each
 * assertion below corresponds to a specific defect that was live in
 * production, and several deliberately assert against the ORIGINAL attack
 * payload rather than a synthetic one.
 *
 * Run: npm run test:unit
 */
import {
  HUMAN_SAFE_ALPHABET, randomCode, randomToken, hashSecret,
  verifySecret, timingSafeEqualString, signPayload, verifyPayload,
} from "../secure-token"

describe('secure-token', () => {


  // alphabet sanity
  it(`alphabet is 30 chars (got ${HUMAN_SAFE_ALPHABET.length})`, () => { expect(HUMAN_SAFE_ALPHABET.length === 30).toBe(true) })
  it("alphabet has no duplicates", () => { expect(new Set(HUMAN_SAFE_ALPHABET).size === 30).toBe(true) })
  it("alphabet excludes I,L,O,U,0,1", () => { expect(!/[ILOU01]/.test(HUMAN_SAFE_ALPHABET)).toBe(true) })

  // length + membership
  const c = randomCode(12)
  it(`randomCode(12) length (got ${c.length})`, () => { expect(c.length === 12).toBe(true) })
  it("all chars in alphabet", () => { expect([...c].every(ch => HUMAN_SAFE_ALPHABET.includes(ch))).toBe(true) })

  // UNIFORMITY: this is the rejection-sampling check NOTIFY asked for.
  // 300k draws over 30 symbols => 10k expected each. Chi-square with 29 df,
  // p=0.001 critical value is 58.30. Modulo bias would blow this out massively.
  const N = 300_000
  const counts = new Map<string, number>([...HUMAN_SAFE_ALPHABET].map(ch => [ch, 0]))
  for (const ch of randomCode(N)) counts.set(ch, counts.get(ch)! + 1)
  const exp = N / 30
  let chi2 = 0
  for (const v of counts.values()) chi2 += (v - exp) ** 2 / exp
  const vals = [...counts.values()]
  console.log(`  chi2=${chi2.toFixed(2)} (29 df, crit@p.001=58.30)  min=${Math.min(...vals)} max=${Math.max(...vals)} expected=${exp}`)
  it("uniform distribution, no modulo bias", () => { expect(chi2 < 58.30).toBe(true) })

  // Demonstrate what the biased version would have scored, for contrast.
  const crypto = require("node:crypto")
  const biased = new Map<string, number>([...HUMAN_SAFE_ALPHABET].map(ch => [ch, 0]))
  const bb = crypto.randomBytes(N)
  for (let i = 0; i < N; i++) { const ch = HUMAN_SAFE_ALPHABET[bb[i] % 30]; biased.set(ch, biased.get(ch)! + 1) }
  let chi2b = 0
  for (const v of biased.values()) chi2b += (v - exp) ** 2 / exp
  console.log(`  naive 'byte % 30' would score chi2=${chi2b.toFixed(2)}, that is the bug we avoided`)
  it("naive modulo IS detectably biased (control)", () => { expect(chi2b > 58.30).toBe(true) })

  // guards
  const threw = (f: () => void) => { try { f(); return false } catch { return true } }
  it("randomCode(0) throws", () => { expect(threw(() => randomCode(0))).toBe(true) })
  it("duplicate alphabet throws", () => { expect(threw(() => randomCode(5, "AA"))).toBe(true) })
  it("1-char alphabet throws", () => { expect(threw(() => randomCode(5, "A"))).toBe(true) })
  it("randomToken(8) refuses <16 bytes", () => { expect(threw(() => randomToken(8))).toBe(true) })
  it("power-of-two alphabet still works", () => { expect(randomCode(5, "01").length === 5).toBe(true) })

  // tokens
  it(`randomToken(32) is 43 base64url chars (got ${randomToken(32).length})`, () => { expect(randomToken(32).length === 43).toBe(true) })
  it("randomToken is URL-safe", () => { expect(!/[+/=]/.test(randomToken(32))).toBe(true) })
  it("500 codes all distinct", () => { expect(new Set(Array.from({length: 500}, () => randomCode(12))).size === 500).toBe(true) })

  // hashing
  const s = randomCode(16)
  it("hashSecret is 64 hex chars", () => { expect(hashSecret(s).length === 64).toBe(true) })
  it("hashSecret deterministic", () => { expect(hashSecret(s) === hashSecret(s)).toBe(true) })
  it("hash differs from plaintext", () => { expect(hashSecret(s) !== s).toBe(true) })
  it("verifySecret accepts correct secret", () => { expect(verifySecret(s, hashSecret(s))).toBe(true) })
  it("verifySecret rejects wrong secret", () => { expect(!verifySecret(s + "X", hashSecret(s))).toBe(true) })
  it("verifySecret rejects empty", () => { expect(!verifySecret("", hashSecret(s))).toBe(true) })
  it("verifySecret rejects empty hash", () => { expect(!verifySecret(s, "")).toBe(true) })
  it("timingSafeEqualString equal", () => { expect(timingSafeEqualString("abc", "abc")).toBe(true) })
  it("timingSafeEqualString differing", () => { expect(!timingSafeEqualString("abc", "abd")).toBe(true) })
  it("timingSafeEqualString unequal length (no throw)", () => { expect(!timingSafeEqualString("abc", "abcd")).toBe(true) })

  // signed payloads
  const t = signPayload({ email: "a@b.test" }, 3600, "newsletter-confirm")
  const v = verifyPayload<{ email: string }>(t, "newsletter-confirm")
  it("signPayload/verifyPayload round trip", () => { expect(v.valid && v.payload.email === "a@b.test").toBe(true) })
  const wrongPurpose = verifyPayload(t, "something-else")
  it("domain separation: wrong purpose rejected", () => { expect(!wrongPurpose.valid).toBe(true) })
  const tampered = t.split(".")[0] + "." + "x".repeat(43)
  it("tampered signature rejected", () => { expect(!verifyPayload(tampered, "newsletter-confirm").valid).toBe(true) })
  const swapped = Buffer.from(JSON.stringify({ email: "attacker@evil.test", exp: 9e9 })).toString("base64url") + "." + t.split(".")[1]
  it("swapped payload rejected", () => { expect(!verifyPayload(swapped, "newsletter-confirm").valid).toBe(true) })
  const expired = signPayload({ email: "a@b.test" }, -10, "newsletter-confirm")
  const ev = verifyPayload(expired, "newsletter-confirm")
  it("expired token rejected with reason 'expired'", () => { expect(!ev.valid && (ev as any).reason === "expired").toBe(true) })
  it("garbage rejected", () => { expect(!verifyPayload("garbage", "newsletter-confirm").valid).toBe(true) })
  it("empty rejected", () => { expect(!verifyPayload("", "newsletter-confirm").valid).toBe(true) })


})
