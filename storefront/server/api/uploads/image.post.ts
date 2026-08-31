// Server route to receive a design preview image and persist it under
// /public/uploads/designs/YYYY-MM/DD/<uuid>.<ext>. The Nuxt static server
// will then serve those files at the same URL path.
//
// MVP-grade: writes to local FS. Production should swap the body of this
// handler for an S3/R2/Cloudinary client. Keep the request/response shape
// stable so the client never has to know which backend is in use.
//
// Hardening (what is actually enforced here, in request order):
//   1. Throttle:     per-IP burst limit + a global concurrency ceiling that
//                    bounds peak heap. Per-instance only; see upload-throttle.ts
//                    for why this is not a substitute for an edge rate limit.
//   2. Same-origin:  reject a browser-issued cross-site POST. The endpoint has
//                    no session to forge, but this stops third-party pages
//                    using our disk as free storage.
//   3. Size:         10 MB, refused on `Content-Length` *before* any body byte
//                    is read, and re-checked while streaming because
//                    `Content-Length` is client-controlled.
//   4. Content:      magic-byte sniff. The sniffed type must be on the
//                    allowlist AND match the type the client claimed.
//   5. Naming:       filename is server-generated from `crypto.randomUUID()`
//                    (CSPRNG, 122 bits). Nothing client-supplied (not the
//                    filename, not the extension) reaches the filesystem path.
//
// PREVIOUS COMMENT WAS WRONG: CORRECTED
//   This header used to claim the 10 MB cap "mirrors
//   nuxt-security.requestSizeLimiter". `nuxt-security` is not, and has never
//   been, a dependency of this project (check storefront/package.json). No
//   such limiter existed. The cap below is the only one there is.
//
// KNOWN, UNFIXED, BY DESIGN
//   Files still land in the *public* webroot with no access control:
//   `GET /uploads/designs/…` returns 200 to anyone with the URL. Random UUIDs
//   make the URLs unguessable, which is meaningfully better than the previous
//   `Date.now()` + `Math.random()` scheme (~31 bits, and the time component is
//   narrowed by the order timestamp), but unguessable is not access-controlled.
//   Moving storage out of the webroot is a migration, not an edit: existing
//   URLs are persisted in `line_item.metadata.designDataJson[*].originalUrl`
//   and rendered by the admin "Download original" button, so relocating files
//   breaks artwork retrieval for every order already placed. That plan is
//   written up separately and must land with a backfill.
import {
  defineEventHandler,
  readMultipartFormData,
  getRequestHeader,
  getRequestIP,
  createError,
  type H3Event,
} from 'h3'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { readBoundedRawBody } from '../../lib/bounded-body'
import { sniffImageMime, type SniffedImageMime } from '../../lib/image-sniff'
import { acquireUploadSlot } from '../../lib/upload-throttle'

const MAX_BYTES = 10 * 1024 * 1024 // 10 MB of file content
/** The multipart envelope (boundaries, part headers) costs a little more than
 *  the file itself. Give the raw-body cap a small allowance so a legitimate
 *  10 MB file is not rejected by the wire-level check. */
const MAX_RAW_BYTES = MAX_BYTES + 64 * 1024

const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/webp'] as const
type AllowedMime = (typeof ALLOWED_MIME)[number]

const isAllowedMime = (m: string | undefined): m is AllowedMime =>
  !!m && (ALLOWED_MIME as readonly string[]).includes(m)

// Extension is derived from the *validated* MIME, never from the uploaded
// filename. This is why `.svg` / `.html` cannot land in the webroot, and it
// must stay that way: it is the reason stored XSS does not work here.
const extFor = (mime: AllowedMime): string =>
  mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg'

/** Normalise a client-supplied `Content-Type` for comparison: strip parameters
 *  (`image/png; charset=binary`) and case. */
const bareMime = (raw: string | undefined): string | undefined =>
  raw?.split(';')[0]?.trim().toLowerCase() || undefined

/**
 * Reject browser-originated cross-site POSTs.
 *
 * There is no session cookie to ride here, so this is not classic CSRF
 * defence. It is anti-abuse: without it, any page on the internet can make
 * its visitors' browsers fill our disk. Requests with no `Origin` header
 * (curl, server-to-server, our own Playwright specs) are allowed through:
 * every browser sends `Origin` on a cross-site POST, so absence is not a
 * bypass a browser attacker can use.
 */
function assertSameOrigin(event: H3Event): void {
  const origin = getRequestHeader(event, 'origin')
  if (!origin || origin === 'null') return

  const host = getRequestHeader(event, 'x-forwarded-host') ?? getRequestHeader(event, 'host')
  if (!host) return // cannot evaluate; do not guess

  let originHost: string
  try {
    originHost = new URL(origin).host
  } catch {
    throw createError({ statusCode: 403, statusMessage: 'Bad origin' })
  }

  const extra = (process.env.NUXT_UPLOAD_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const loopback = (h: string) => /^(localhost|127\.0\.0\.1|\[::1\]|::1)(:\d+)?$/i.test(h)
  const sameHost =
    originHost.toLowerCase() === host.toLowerCase() ||
    // dev convenience: localhost:3000 and 127.0.0.1:3000 are the same server
    (process.env.NODE_ENV !== 'production' &&
      loopback(originHost) &&
      loopback(host) &&
      originHost.split(':')[1] === host.split(':')[1])

  if (sameHost || extra.includes(origin)) return

  throw createError({ statusCode: 403, statusMessage: 'Cross-origin upload rejected' })
}

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)

  // `xForwardedFor: true` is required behind the ALB: without it every
  // request keys on the load balancer's IP and the per-IP limit collapses into
  // a global 20/min that would take the site down.
  //
  // The trade-off, stated plainly: h3 takes the LEFTMOST X-Forwarded-For
  // entry, which the client writes. An attacker can therefore rotate that
  // header and walk straight past the per-IP limit. The spoof-proof control
  // here is the global concurrency ceiling in upload-throttle.ts, which is
  // keyed on nothing. Fixing the per-IP limit properly means an edge rate
  // limit (AWS WAF rate-based rule) that sees the real source address.
  const clientKey = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  const slot = acquireUploadSlot(clientKey)
  if (!slot.ok) {
    event.node.res.setHeader('Retry-After', String(slot.retryAfterSeconds))
    throw createError({
      statusCode: slot.reason === 'rate' ? 429 : 503,
      statusMessage:
        slot.reason === 'rate' ? 'Too many uploads, slow down' : 'Upload capacity reached, retry shortly',
    })
  }

  try {
    // Bound the body BEFORE h3 buffers it. `readMultipartFormData` below then
    // parses the buffer this call produced rather than re-reading the socket.
    await readBoundedRawBody(event, { maxBytes: MAX_RAW_BYTES })

    const form = await readMultipartFormData(event)
    if (!form) {
      throw createError({ statusCode: 400, statusMessage: 'No form data' })
    }

    const file = form.find((f) => f.name === 'image' && f.data)
    if (!file?.data?.length) {
      throw createError({ statusCode: 400, statusMessage: 'No image field' })
    }
    if (file.data.length > MAX_BYTES) {
      throw createError({ statusCode: 413, statusMessage: 'Image too large (max 10MB)' })
    }

    // --- Content validation ---------------------------------------------------
    // `file.type` is whatever the client wrote in the part header. Check the
    // claim against the allowlist first (cheap reject), then check the bytes,
    // then require the two to agree. Storing under a type the content does not
    // match is how "a .png that is really something else" gets into the webroot.
    const claimed = bareMime(file.type)
    if (!isAllowedMime(claimed)) {
      throw createError({ statusCode: 415, statusMessage: 'Unsupported image type' })
    }

    const sniffed: SniffedImageMime | null = sniffImageMime(file.data)
    if (!sniffed || !isAllowedMime(sniffed)) {
      throw createError({
        statusCode: 415,
        statusMessage: 'File content is not a supported image',
      })
    }
    if (sniffed !== claimed) {
      throw createError({
        statusCode: 415,
        statusMessage: 'File content does not match the declared image type',
      })
    }

    // --- Persist --------------------------------------------------------------
    const date = new Date()
    const yyyymm = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const dd = String(date.getDate()).padStart(2, '0')
    const dir = join(process.cwd(), 'public', 'uploads', 'designs', yyyymm, dd)
    await fs.mkdir(dir, { recursive: true })

    // `crypto.randomUUID()` is CSPRNG-backed (122 bits of entropy); the old
    // `Date.now()` + `Math.random().toString(36).slice(2,8)` gave ~31 bits from
    // a non-cryptographic PRNG, with the timestamp half inferable from the
    // order's own created_at. These names are the ONLY thing standing between
    // the internet and a customer's artwork until storage moves behind auth.
    const ext = extFor(sniffed)
    const name = `${randomUUID()}.${ext}`
    const absPath = join(dir, name)
    // wx: never overwrite. A UUID collision is not realistic, but failing
    // closed on one is free.
    await fs.writeFile(absPath, file.data, { flag: 'wx' })

    const publicPath = `/uploads/designs/${yyyymm}/${dd}/${name}`
    return { url: publicPath, bytes: file.data.length, mime: sniffed }
  } finally {
    slot.release()
  }
})
