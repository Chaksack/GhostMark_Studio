import crypto from "crypto"

export type ReviewTokenPayload = {
  orderId: string
  productId: string
  email?: string
  exp: number // epoch seconds
}

const IS_PRODUCTION = (process.env.NODE_ENV || "development") === "production"

/** Minimum length for a hand-set secret. Mirrors medusa-config.ts. */
const MIN_SECRET_LENGTH = 32

/**
 * Values refused even when explicitly configured, framework/tutorial
 * placeholders and wordlist entries. Kept in sync with medusa-config.ts.
 */
const REJECTED_SECRETS: ReadonlySet<string> = new Set([
  "supersecret",
  "super_secret",
  "super-secret",
  "secret",
  "mysecret",
  "changeme",
  "change_me",
  "change-me",
  "medusa",
  "medusa-secret",
  "medusa_secret",
  "test",
  "dev",
  "development",
  "password",
  "some_secret",
  "your-secret-here",
  "dev-insecure-review-token-secret",
])

const GENERATE_SECRET_CMD =
  `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`

/**
 * Resolve the HMAC key for review tokens.
 *
 * Previously this fell back to the literal "dev-insecure-review-token-secret",
 * which meant anyone reading this (open) source could forge a token for any
 * orderId/productId pair and post reviews as a verified purchaser.
 *
 * Resolution order: REVIEW_TOKEN_SECRET, then the JWT secrets as a
 * compatibility fallback for deployments that never set a dedicated one.
 * There is no hardcoded fallback.
 *
 * - production: missing / well-known / too-short throws at import, i.e. at boot.
 *   This is deliberately not resolved lazily: verifyReviewToken() has a
 *   catch-all that would otherwise swallow a configuration error and merely
 *   report "invalid token" forever.
 * - development: an ephemeral random key is generated and loudly announced.
 *   Tokens minted with it stop verifying after a restart.
 *
 * The secret itself is never logged.
 */
function resolveSecret(): string {
  const source =
    (process.env.REVIEW_TOKEN_SECRET ?? "").trim() ? "REVIEW_TOKEN_SECRET" :
    (process.env.MEDUSA_JWT_SECRET ?? "").trim() ? "MEDUSA_JWT_SECRET" :
    (process.env.JWT_SECRET ?? "").trim() ? "JWT_SECRET" :
    "REVIEW_TOKEN_SECRET"

  const value = (process.env[source] ?? "").trim()

  let weakness: string | null = null
  if (!value) {
    weakness = "none of REVIEW_TOKEN_SECRET, MEDUSA_JWT_SECRET or JWT_SECRET is set"
  } else if (REJECTED_SECRETS.has(value.toLowerCase())) {
    weakness = `${source} is set to a well-known placeholder value`
  } else if (value.length < MIN_SECRET_LENGTH) {
    weakness = `${source} is shorter than the ${MIN_SECRET_LENGTH}-character minimum`
  }

  if (!weakness) {
    return value
  }

  if (IS_PRODUCTION) {
    throw new Error(
      [
        "",
        "FATAL: review token signing key is unusable because " + weakness + ".",
        "",
        "This key authenticates 'verified purchaser' review submissions. A guessable",
        "value lets anyone forge a review for any order/product pair.",
        "",
        "Generate one with:",
        `  ${GENERATE_SECRET_CMD}`,
        "then set REVIEW_TOKEN_SECRET in the deployment environment.",
        "Rotating it invalidates review links already emailed to customers.",
        "",
      ].join("\n")
    )
  }

  const ephemeral = crypto.randomBytes(32).toString("base64url")
  console.warn(
    [
      "",
      "WARNING: review token signing key is unusable because " + weakness + ".",
      "A random ephemeral key was generated for this process only, review links",
      "stop verifying after a restart, and this WILL throw once NODE_ENV=production.",
      `Generate a persistent value with:\n  ${GENERATE_SECRET_CMD}`,
      "then set REVIEW_TOKEN_SECRET in ghostmark/.env",
      "",
    ].join("\n")
  )
  return ephemeral
}

// Resolved once, at import time, so a misconfiguration fails at boot rather
// than being swallowed by verifyReviewToken()'s catch block.
const REVIEW_TOKEN_SECRET = resolveSecret()

function base64url(input: Buffer | string) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input)
  return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")
}

function hmac(data: string): Buffer {
  return crypto.createHmac("sha256", REVIEW_TOKEN_SECRET).update(data).digest()
}

/**
 * Constant-time comparison of two signatures.
 *
 * crypto.timingSafeEqual throws on unequal lengths, so the length check has to
 * happen first. That is not a leak: these are base64url-encoded HMAC-SHA256
 * digests, so the correct length (43) is a public constant, an attacker learns
 * nothing from it that the algorithm doesn't already tell them. What must not
 * leak is *how far* a same-length candidate matched, which is exactly what the
 * previous `!==` string compare exposed via early-exit.
 */
function signaturesMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, "utf8")
  const b = Buffer.from(expected, "utf8")
  if (a.length !== b.length) {
    // Burn an equivalent comparison so the reject path costs roughly the same.
    crypto.timingSafeEqual(b, b)
    return false
  }
  return crypto.timingSafeEqual(a, b)
}

export function signReviewToken(payload: ReviewTokenPayload): string {
  const header = { alg: "HS256", typ: "JWT" }
  const encHeader = base64url(JSON.stringify(header))
  const encPayload = base64url(JSON.stringify(payload))
  const data = `${encHeader}.${encPayload}`
  const encSig = base64url(hmac(data))
  return `${data}.${encSig}`
}

export function verifyReviewToken(token: string): { valid: boolean; payload?: ReviewTokenPayload; message?: string } {
  try {
    const parts = token.split(".")
    if (parts.length !== 3) return { valid: false, message: "Malformed token" }
    const [h, p, s] = parts
    const data = `${h}.${p}`

    // Pin the algorithm. The signature is always recomputed as HMAC-SHA256
    // regardless of the header, so `alg: none` was never actually accepted,
    // this makes the guarantee explicit rather than incidental.
    const header = JSON.parse(
      Buffer.from(h.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")
    )
    if (!header || header.alg !== "HS256") {
      return { valid: false, message: "Unsupported token algorithm" }
    }

    const expected = base64url(hmac(data))
    if (!signaturesMatch(s, expected)) return { valid: false, message: "Invalid signature" }

    const json = JSON.parse(Buffer.from(p.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")) as ReviewTokenPayload
    if (!json || typeof json.exp !== "number") return { valid: false, message: "Invalid payload" }
    const now = Math.floor(Date.now() / 1000)
    if (json.exp < now) return { valid: false, message: "Token expired" }
    return { valid: true, payload: json }
  } catch (e: any) {
    return { valid: false, message: e?.message || "Token verification failed" }
  }
}
