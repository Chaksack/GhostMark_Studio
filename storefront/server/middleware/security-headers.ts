// Baseline HTTP security headers for every storefront response.
//
// WHY THIS FILE, AND WHY IN THE APP
// ---------------------------------
// The storefront previously returned NO security headers at all, no CSP, no
// `X-Content-Type-Options`, no `X-Frame-Options`, no HSTS, no `Referrer-Policy`
// (verified: `curl -I http://127.0.0.1:3000/` returned only `set-cookie`,
// `content-type`, `x-powered-by`).
//
// It cannot be fixed at the edge:
//   - the CloudFront distribution in terraform/modules/cloudfront fronts the
//     uploads bucket, not the storefront;
//   - an ALB listener cannot inject response headers.
// So the app is the only place this can come from.
//
// Implemented as Nitro server middleware rather than `routeRules.headers`
// because we need to vary the policy by path (documents vs. the uploads
// webroot) and by scheme (HSTS only over TLS), which static route rules can't
// express. No new dependency, `nuxt-security` is deliberately not added.
//
// THE CSP IS REPORT-ONLY, ON PURPOSE
// ----------------------------------
// This app loads Google Fonts, lazily injects Stripe.js, and runs a Konva
// canvas that reads `blob:` and `data:` image sources. A blocking policy
// written from assumption would break checkout. Report-only lets the real
// violation set be observed first. See the switch-to-enforcing checklist at
// the bottom of this file.
//
// !!! HONEST LIMITATION !!!
// `app/plugins/medusa-token-cookie.ts` keeps a 30-day JWT in a NON-HttpOnly
// cookie and justifies it with "XSS defence is delegated to CSP script-src".
// The policy below contains `'unsafe-inline'` in `script-src`, because Nuxt
// emits inline bootstrap scripts and has no nonce support without
// `nuxt-security`. An `'unsafe-inline'` script-src does NOT stop XSS. Adding
// this header therefore does NOT make that comment true. Until the policy is
// nonce-based AND enforcing, that JWT is still readable by any injected
// script. Flagged, not fixed, the cookie belongs to the storefront owner.
import { defineEventHandler, getRequestHeader } from 'h3'

const isProd = process.env.NODE_ENV === 'production'

/** Paths under the public uploads webroot. Customer artwork lives here. */
const UPLOADS_PREFIX = '/uploads/'

/**
 * Origins the browser genuinely needs to reach. Kept as data so the list is
 * reviewable, and resolved once at module load.
 */
function buildConnectSrc(): string[] {
  const sources = new Set<string>(["'self'"])

  // Medusa store API: the SDK calls it directly from the browser.
  const medusaUrl = process.env.MEDUSA_URL || 'http://localhost:9000'
  try {
    sources.add(new URL(medusaUrl).origin)
  } catch {
    /* malformed env; fall through to 'self' only */
  }

  // Stripe. Every entry below was OBSERVED in the network log of a live
  // /checkout load with Stripe.js initialised, except api.stripe.com, that
  // one is Stripe's documented confirmation endpoint and could not be
  // exercised without putting a real payment through.
  sources.add('https://api.stripe.com') // confirmPayment / PaymentIntent (not observed)
  sources.add('https://m.stripe.com') // observed: POST /6 (device fingerprint)
  sources.add('https://r.stripe.com') // observed: POST /b (metrics beacon)

  if (!isProd) {
    // Vite HMR websocket + dev asset fetches.
    sources.add('ws:')
    sources.add('wss:')
  }
  return [...sources]
}

const CONNECT_SRC = buildConnectSrc()

/**
 * The report-only Content-Security-Policy for HTML documents.
 *
 * Every source here corresponds to something observed in the running app,
 * see the report accompanying this change for the request-by-request evidence.
 */
function buildDocumentCsp(): string {
  const scriptSrc = [
    "'self'",
    // Nuxt/Vite emit inline bootstrap + payload-hydration scripts. Without
    // nonce support this cannot be removed. It is the reason this policy is
    // not yet an XSS control.
    "'unsafe-inline'",
    'https://js.stripe.com',
    'https://m.stripe.network',
    ...(isProd ? [] : ["'unsafe-eval'"]), // Vite dev transform
  ]

  const directives: Record<string, string[] | null> = {
    'default-src': ["'self'"],
    'base-uri': ["'self'"],
    'object-src': ["'none'"],
    'frame-ancestors': ["'none'"],
    'form-action': ["'self'"],
    'script-src': scriptSrc,
    // Tailwind + Nuxt inject inline <style> blocks; Google Fonts serves the
    // face declarations as a cross-origin stylesheet.
    'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    'style-src-elem': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
    // data: Konva `stage.toDataURL()` previews (verified in-browser: the
    //         editor's canvas export produces `data:image/png;base64,…`).
    // blob: `URL.createObjectURL(file)` for the just-picked design file
    //         (DesignEditor.vue:371; verified rendering under this policy).
    // unsplash: observed loading DIRECTLY as <img src> on /shop, not via
    //            /_ipx, so the remote origin really is needed.
    'img-src': [
      "'self'",
      'data:',
      'blob:',
      'https://images.unsplash.com',
      'https://*.stripe.com',
    ],
    'connect-src': CONNECT_SRC,
    // Stripe Elements render inside cross-origin iframes.
    'frame-src': ['https://js.stripe.com', 'https://hooks.stripe.com', 'https://m.stripe.network'],
    'worker-src': ["'self'", 'blob:'],
    'media-src': ["'self'"],
    'manifest-src': ["'self'"],
    // Only meaningful over TLS; in dev it would break http://127.0.0.1:3000.
    'upgrade-insecure-requests': isProd ? [] : null,
  }

  return Object.entries(directives)
    .filter(([, v]) => v !== null)
    .map(([name, v]) => (v!.length ? `${name} ${v!.join(' ')}` : name))
    .join('; ')
}

const DOCUMENT_CSP = buildDocumentCsp()

/**
 * Enforcing (not report-only) policy for the uploads webroot.
 *
 * IMPORTANT: for an upload that actually exists on disk this middleware never
 * runs, Nitro unshifts its static-asset handler ahead of user middleware
 * (nitropack/dist/rollup/index.mjs:1003), so the file is served and the chain
 * short-circuits. The header that reaches real uploads comes from
 * `routeRules['/uploads/**']` in nuxt.config.ts, which Nitro installs before
 * every handler. This copy covers the residual case (a request under
 * /uploads/ that misses the static handler and falls through to the renderer)
 * and is kept byte-identical to the route rule on purpose. Change both.
 *
 * (Also verified: the static handler sets its own `Cache-Control: public,
 * max-age=0` after the route rule runs, so a `no-store` on artwork cannot be
 * won here. Cache control for artwork has to be solved by the storage
 * relocation, not by a header on the webroot.)
 */
const UPLOADS_CSP = "default-src 'none'; sandbox; frame-ancestors 'none'; base-uri 'none'"

export default defineEventHandler((event) => {
  const res = event.node?.res
  if (!res || res.headersSent) return

  const path = event.path || ''

  // --- Applies to every response --------------------------------------------
  // Stops content-type sniffing. This is what keeps a mislabelled or polyglot
  // upload from being reinterpreted as script/HTML by the browser.
  res.setHeader('X-Content-Type-Options', 'nosniff')
  // Clickjacking. `frame-ancestors` in the CSP supersedes this for modern
  // browsers, but the CSP is report-only, so XFO is currently the only
  // *enforcing* frame control we have.
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  // The legacy XSS auditor is itself exploitable; 0 disables it explicitly.
  res.setHeader('X-XSS-Protection', '0')
  // Deny browser capabilities this storefront never uses. `payment` is left
  // open to self + Stripe because Payment Request / Apple Pay needs it.
  res.setHeader(
    'Permissions-Policy',
    [
      'accelerometer=()',
      'camera=()',
      'display-capture=()',
      'geolocation=()',
      'gyroscope=()',
      'magnetometer=()',
      'microphone=()',
      'usb=()',
      'payment=(self "https://js.stripe.com")',
    ].join(', '),
  )
  // `same-origin-allow-popups`, not `same-origin`: Stripe 3-D Secure and Link
  // open cross-origin popups that must keep their opener reference.
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups')

  // HSTS only when the request actually arrived over TLS. Behind the ALB that
  // is signalled by x-forwarded-proto. Setting it on plain http://localhost
  // would pin the dev host to HTTPS and make the dev server unreachable.
  // `x-forwarded-proto` may be a comma-joined chain through multiple proxies;
  // the client-facing hop is the first entry.
  const forwardedProto = getRequestHeader(event, 'x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase()
  const socketEncrypted = Boolean(
    (event.node.req as { socket?: { encrypted?: boolean } }).socket?.encrypted,
  )
  const isHttps = forwardedProto ? forwardedProto === 'https' : socketEncrypted
  if (isHttps) {
    // `preload` is intentionally omitted: submitting to the preload list is an
    // org-level, hard-to-reverse decision, not a code change.
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }

  // --- Path-specific ---------------------------------------------------------
  if (path.startsWith(UPLOADS_PREFIX)) {
    res.setHeader('Content-Security-Policy', UPLOADS_CSP)
    // Customer artwork must never sit in a shared cache.
    res.setHeader('Cache-Control', 'private, no-store')
    return
  }

  res.setHeader('Content-Security-Policy-Report-Only', DOCUMENT_CSP)
})

// ---------------------------------------------------------------------------
// BEFORE FLIPPING report-only -> enforcing, ALL of these must be true:
//
//  1. Zero `Content-Security-Policy-Report-Only` violations in the browser
//     console across: home, a POD PDP (Konva editor: file pick, drag, render),
//     an apparel PDP, cart, and a full checkout through Stripe confirmation,
//     including the 3-D Secure challenge path.
//  2. A violation *sink* exists. `report-to` / `report-uri` is not configured
//     here because there is nowhere to send them; wire an endpoint first,
//     otherwise "no violations" only means "nobody was looking".
//  3. `'unsafe-inline'` is gone from `script-src`. That requires per-request
//     nonces on every Nuxt-emitted inline script. Nuxt has no built-in nonce
//     support, so this means either adding `nuxt-security` (a dependency
//     decision) or a custom Nitro render hook that stamps a nonce into the
//     inline tags and into this header. Until then, enforcing the policy adds
//     clickjacking/base-tag/form-action protection but NOT XSS protection,
//     and the non-HttpOnly JWT cookie stays exposed.
//  4. Re-verify the Stripe source list against a live payment. Stripe rotates
//     the js.stripe.com script path (e.g. /v3, /basil, /dahlia); the host is
//     stable but confirm no new host appears in the network log.
// ---------------------------------------------------------------------------
