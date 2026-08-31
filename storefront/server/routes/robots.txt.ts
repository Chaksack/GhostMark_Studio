// server/routes/robots.txt.ts
//
// Dynamic robots.txt: allows crawl of /shop and /products (both halves of
// the dual-mode storefront) while keeping authenticated, transactional, and
// upload-asset paths out of the index.
//
// Disallow rationale
//   /account:    gated, personalised content (no SEO value, exposes flow)
//   /checkout:   transient, contains cart state in some flows
//   /cart:       view-only, transient, dupes PLP value
//   /uploads/:   user-uploaded artwork (privacy + legal exposure)
//   /api/:       internal Nitro server routes; never useful in SERP
//
// The trailing `Sitemap:` directive lets crawlers auto-discover the dynamic
// sitemap.xml route in this same folder. Cached for 24h at the edge.

import { defineEventHandler, setHeader } from 'h3'

export default defineEventHandler((event) => {
  const headers = event.node.req.headers
  const host = (headers['x-forwarded-host'] || headers.host || 'localhost:3000').toString()
  const protocol = ((headers['x-forwarded-proto'] as string) || 'http').toString()

  setHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
  setHeader(event, 'Cache-Control', 'public, max-age=86400')

  return `User-agent: *
Allow: /
Disallow: /account
Disallow: /checkout
Disallow: /cart
Disallow: /uploads/
Disallow: /api/

Sitemap: ${protocol}://${host}/sitemap.xml
`
})
