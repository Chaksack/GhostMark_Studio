import crypto from "crypto"

export type ReviewTokenPayload = {
  orderId: string
  productId: string
  email?: string
  exp: number // epoch seconds
}

function getSecret() {
  return (
    process.env.REVIEW_TOKEN_SECRET ||
    process.env.MEDUSA_JWT_SECRET ||
    "dev-insecure-review-token-secret"
  )
}

function base64url(input: Buffer | string) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input)
  return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")
}

export function signReviewToken(payload: ReviewTokenPayload): string {
  const header = { alg: "HS256", typ: "JWT" }
  const encHeader = base64url(JSON.stringify(header))
  const encPayload = base64url(JSON.stringify(payload))
  const data = `${encHeader}.${encPayload}`
  const sig = crypto.createHmac("sha256", getSecret()).update(data).digest()
  const encSig = base64url(sig)
  return `${data}.${encSig}`
}

export function verifyReviewToken(token: string): { valid: boolean; payload?: ReviewTokenPayload; message?: string } {
  try {
    const parts = token.split(".")
    if (parts.length !== 3) return { valid: false, message: "Malformed token" }
    const [h, p, s] = parts
    const data = `${h}.${p}`
    const expected = base64url(crypto.createHmac("sha256", getSecret()).update(data).digest())
    if (s !== expected) return { valid: false, message: "Invalid signature" }
    const json = JSON.parse(Buffer.from(p.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")) as ReviewTokenPayload
    if (!json || typeof json.exp !== "number") return { valid: false, message: "Invalid payload" }
    const now = Math.floor(Date.now() / 1000)
    if (json.exp < now) return { valid: false, message: "Token expired" }
    return { valid: true, payload: json }
  } catch (e: any) {
    return { valid: false, message: e?.message || "Token verification failed" }
  }
}
