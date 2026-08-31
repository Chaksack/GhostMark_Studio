import crypto from "node:crypto"

/**
 * Shared cryptographic token helpers.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Two independent code paths in this repo were minting security-relevant
 * values with `Math.random()`:
 *
 *   - src/services/support-db.ts  - support ticket case IDs and secret codes
 *   - src/subscribers/gift-card-code.ts - gift card codes (a bearer instrument)
 *
 * `Math.random()` is a PRNG (V8 uses xorshift128+). It is seeded once per
 * isolate and its internal state is fully recoverable from a modest number of
 * consecutive outputs. It is not, and has never been, suitable for anything an
 * attacker benefits from predicting. Worse, the support ticket endpoint handed
 * the caller its generated value directly in the HTTP response, which turned
 * the endpoint into an unlimited, unauthenticated oracle for that PRNG's output
 * stream - the ideal condition for state recovery.
 *
 * Everything here draws from `crypto.randomBytes`, which is a CSPRNG.
 *
 * Consumers should import from this module rather than hand-rolling a
 * generator, so that a defect gets fixed once.
 */

/**
 * Human-transcribable alphabet, Crockford base32 style.
 *
 * Excludes I, L, O, U, 0 and 1:
 *   - I / L / 1 and O / 0 are the classic transcription confusions when a code
 *     is read off a printed card, dictated over the phone, or OCR'd.
 *   - U is excluded (as Crockford does) so that a randomly generated code
 *     cannot spell an obscenity in front of a customer.
 *
 * 30 characters. Note that 30 is NOT a power of two and 256 % 30 = 16, so
 * naive `byte % 30` selection is measurably biased toward the first 16
 * characters. `randomCode` uses rejection sampling for exactly this reason -
 * see the comment there.
 *
 * Entropy per character: log2(30) ~= 4.907 bits.
 *   10 chars ~= 49.1 bits
 *   12 chars ~= 58.9 bits
 *   16 chars ~= 78.5 bits
 */
export const HUMAN_SAFE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ"

/**
 * Dense URL-safe alphabet, for values that are only ever copy-pasted or
 * embedded in a link and never read aloud.
 */
export const URL_SAFE_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"

/**
 * Generate a random string of `length` characters drawn uniformly from
 * `alphabet`, using a CSPRNG.
 *
 * UNIFORMITY
 * ----------
 * The obvious implementation, `alphabet[randomByte % n]`, is biased whenever
 * `256 % n !== 0`. With n = 30 the byte values 0..239 map evenly (8 per
 * character) but 240..255 wrap around and give the first 16 characters a 9th
 * chance each - those characters are ~12.5% more likely than the rest. That
 * bias is invisible in casual testing and it directly reduces the effective
 * search space of the code.
 *
 * So we reject: any byte at or above the largest multiple of `n` that fits in
 * a byte is discarded and redrawn. The result is exactly uniform. The expected
 * number of bytes consumed per output character is 256 / (floor(256/n) * n),
 * which for n = 30 is ~1.067 - the cost of correctness here is negligible.
 *
 * Bytes are drawn in batches rather than one at a time because each
 * `randomBytes` call has real overhead.
 *
 * @param length   Number of characters to produce. Must be >= 1.
 * @param alphabet Characters to draw from. Must have 2..256 unique characters.
 */
export function randomCode(
  length: number,
  alphabet: string = HUMAN_SAFE_ALPHABET
): string {
  if (!Number.isInteger(length) || length < 1) {
    throw new Error("randomCode: length must be a positive integer")
  }

  const n = alphabet.length

  // A single byte cannot address more than 256 symbols. Silently truncating a
  // larger alphabet would quietly discard entropy the caller thought it had,
  // so refuse instead.
  if (n < 2 || n > 256) {
    throw new Error(
      `randomCode: alphabet must contain between 2 and 256 characters (got ${n})`
    )
  }

  // A repeated character is over-represented in the output, which again means
  // the caller's entropy estimate is wrong. This is cheap to catch and is
  // almost always a typo in a hand-written alphabet constant.
  if (new Set(alphabet).size !== n) {
    throw new Error("randomCode: alphabet must not contain duplicate characters")
  }

  // Largest multiple of n representable in one byte. Bytes >= limit are the
  // "ragged tail" and get discarded.
  const limit = Math.floor(256 / n) * n

  let out = ""
  while (out.length < length) {
    const needed = length - out.length
    // Over-draw slightly so the common case completes in one syscall.
    const batch = crypto.randomBytes(Math.max(16, Math.ceil(needed * 1.3)))
    for (let i = 0; i < batch.length && out.length < length; i++) {
      const b = batch[i]
      if (b >= limit) {
        continue // ragged tail - redraw
      }
      out += alphabet[b % n]
    }
  }
  return out
}

/**
 * Generate a dense, URL-safe random token.
 *
 * @param bytes Number of RANDOM BYTES of entropy (not output characters).
 *              32 bytes = 256 bits, encoded as 43 base64url characters.
 */
export function randomToken(bytes = 32): string {
  if (!Number.isInteger(bytes) || bytes < 16) {
    // Below 128 bits there is no honest reason to be using this helper.
    throw new Error("randomToken: refuse to mint a token with under 16 bytes of entropy")
  }
  return crypto.randomBytes(bytes).toString("base64url")
}

/**
 * Hash a secret for at-rest storage.
 *
 * SHA-256, not bcrypt/argon2, and that is a deliberate choice rather than an
 * oversight. Password hashing is slow on purpose because passwords are
 * low-entropy and human-chosen. The values passed through here are machine
 * generated with >= 49 bits of uniform entropy, so an offline attacker gains
 * nothing from a fast hash - there is no dictionary to run. What matters is
 * that the plaintext is not sitting in the database, so that a read-only
 * database leak (or an over-sharing admin endpoint) does not hand out live
 * credentials.
 *
 * No salt, also deliberate: the inputs are already globally unique and
 * high-entropy, and an unsalted hash lets us look a value up by its hash in a
 * single indexed query.
 *
 * Do NOT route user-chosen passwords through this function.
 */
export function hashSecret(secret: string): string {
  return crypto.createHash("sha256").update(String(secret), "utf8").digest("hex")
}

/**
 * Constant-time string comparison.
 *
 * `crypto.timingSafeEqual` throws when the buffers differ in length, so the
 * length check has to happen first. Leaking the length of a fixed-format token
 * is not a meaningful disclosure; leaking HOW FAR a same-length candidate
 * matched - which is exactly what a `===` early-exit does - is.
 */
export function timingSafeEqualString(a: string, b: string): boolean {
  const bufA = Buffer.from(String(a), "utf8")
  const bufB = Buffer.from(String(b), "utf8")
  if (bufA.length !== bufB.length) {
    // Burn a comparable amount of work so the mismatched-length path does not
    // return conspicuously faster than the matched-length path.
    crypto.timingSafeEqual(bufB, bufB)
    return false
  }
  return crypto.timingSafeEqual(bufA, bufB)
}

/**
 * Verify a presented secret against a stored hash, in constant time.
 */
export function verifySecret(secret: string, storedHash: string): boolean {
  if (!secret || !storedHash) {
    return false
  }
  return timingSafeEqualString(hashSecret(secret), storedHash)
}

/* -------------------------------------------------------------------------
 * Signed, expiring, stateless payloads
 * -------------------------------------------------------------------------
 * Used where we need to hand a value to a user, get it back later, and trust
 * it - without a table to store it in. The newsletter double opt-in
 * confirmation link is the motivating case: the pending subscription has
 * nowhere to live, so it lives inside the (signed) link itself.
 */

const MIN_SIGNING_SECRET_LENGTH = 32

/**
 * Placeholder values that are refused even when explicitly configured.
 * Mirrors the list in src/services/review-token.ts.
 */
const REJECTED_SIGNING_SECRETS: ReadonlySet<string> = new Set([
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
])

let cachedSigningSecret: string | null = null

/**
 * Resolve the HMAC key used by signPayload/verifyPayload.
 *
 * Resolution order: SECURE_TOKEN_SECRET, then the JWT secrets as a
 * compatibility fallback. There is deliberately no hardcoded default - a
 * checked-in fallback key means anyone who can read this (open) source can
 * forge a confirmation link for any address.
 *
 * In production a missing or weak key throws. In development an ephemeral key
 * is generated and loudly announced; links minted with it stop verifying after
 * a restart, which is the correct and visible failure mode.
 *
 * The secret itself is never logged.
 */
function getSigningSecret(): string {
  if (cachedSigningSecret) {
    return cachedSigningSecret
  }

  const source =
    (process.env.SECURE_TOKEN_SECRET ?? "").trim() ? "SECURE_TOKEN_SECRET" :
    (process.env.MEDUSA_JWT_SECRET ?? "").trim() ? "MEDUSA_JWT_SECRET" :
    (process.env.JWT_SECRET ?? "").trim() ? "JWT_SECRET" :
    "SECURE_TOKEN_SECRET"

  const value = (process.env[source] ?? "").trim()

  let weakness: string | null = null
  if (!value) {
    weakness = "none of SECURE_TOKEN_SECRET, MEDUSA_JWT_SECRET or JWT_SECRET is set"
  } else if (REJECTED_SIGNING_SECRETS.has(value.toLowerCase())) {
    weakness = `${source} is set to a well-known placeholder value`
  } else if (value.length < MIN_SIGNING_SECRET_LENGTH) {
    weakness = `${source} is shorter than the ${MIN_SIGNING_SECRET_LENGTH}-character minimum`
  }

  if (!weakness) {
    cachedSigningSecret = value
    return value
  }

  if ((process.env.NODE_ENV || "development") === "production") {
    throw new Error(
      [
        "",
        "FATAL: secure-token signing key is unusable because " + weakness + ".",
        "",
        "This key authenticates newsletter double opt-in confirmations. A",
        "guessable value lets anyone self-confirm an address they do not own,",
        "which reopens the arbitrary-recipient email abuse this was added to close.",
        "",
        "Generate one with:",
        `  node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`,
        "then set SECURE_TOKEN_SECRET in the deployment environment.",
        "",
      ].join("\n")
    )
  }

  const ephemeral = crypto.randomBytes(32).toString("base64url")
  console.warn(
    [
      "",
      "WARNING: secure-token signing key is unusable because " + weakness + ".",
      "A random ephemeral key was generated for this process only - confirmation",
      "links stop verifying after a restart, and this WILL throw once",
      "NODE_ENV=production. Set SECURE_TOKEN_SECRET in ghostmark/.env",
      "",
    ].join("\n")
  )
  cachedSigningSecret = ephemeral
  return ephemeral
}

export type SignedPayload = Record<string, unknown> & { exp?: number }

/**
 * Sign an arbitrary JSON payload with an expiry.
 *
 * Format: base64url(JSON payload) + "." + base64url(HMAC-SHA256).
 *
 * NOT ENCRYPTION. The payload is signed, not hidden - anyone holding the token
 * can read it. Do not put anything confidential in it.
 *
 * @param payload Data to carry. An `exp` claim is added from `ttlSeconds`.
 * @param ttlSeconds Lifetime in seconds.
 * @param purpose Domain separation tag. A token minted for one purpose must
 *                not verify for another, so this is mixed into the MAC.
 */
export function signPayload(
  payload: SignedPayload,
  ttlSeconds: number,
  purpose: string
): string {
  const withExp = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  }
  const body = Buffer.from(JSON.stringify(withExp), "utf8").toString("base64url")
  const sig = crypto
    .createHmac("sha256", getSigningSecret())
    .update(`${purpose}.${body}`)
    .digest("base64url")
  return `${body}.${sig}`
}

/**
 * Verify and decode a token produced by signPayload.
 *
 * Returns `{ valid: false }` for every failure mode. The `reason` is for
 * server-side logging; do not reflect it verbatim to an unauthenticated caller
 * beyond distinguishing "expired" from "invalid", which is all a legitimate
 * user needs.
 */
export function verifyPayload<T extends SignedPayload>(
  token: string,
  purpose: string
): { valid: true; payload: T } | { valid: false; reason: string } {
  try {
    const parts = String(token || "").split(".")
    if (parts.length !== 2) {
      return { valid: false, reason: "malformed" }
    }
    const [body, sig] = parts

    const expected = crypto
      .createHmac("sha256", getSigningSecret())
      .update(`${purpose}.${body}`)
      .digest("base64url")

    if (!timingSafeEqualString(sig, expected)) {
      return { valid: false, reason: "bad signature" }
    }

    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8")
    ) as T

    if (typeof payload?.exp !== "number") {
      return { valid: false, reason: "missing exp" }
    }
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return { valid: false, reason: "expired" }
    }

    return { valid: true, payload }
  } catch (e: any) {
    return { valid: false, reason: e?.message || "verification failed" }
  }
}

export default {
  HUMAN_SAFE_ALPHABET,
  URL_SAFE_ALPHABET,
  randomCode,
  randomToken,
  hashSecret,
  verifySecret,
  timingSafeEqualString,
  signPayload,
  verifyPayload,
}
