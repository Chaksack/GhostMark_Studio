// server/routes/sitemap.xml.ts
//
// Type-aware XML sitemap generated at request time so search engines can
// discover both halves of the dual-mode storefront:
//   - apparel (D2C buy-as-is)  → /shop/[handle]
//   - pod     (upload + MOQ)   → /products/[handle]
//
// We branch on `product.type.value` (the canonical taxonomy field — never
// heuristics) and emit per-type URL prefixes plus realistic <changefreq> /
// <lastmod> hints. Static IA paths are listed first with hand-tuned
// priorities; dynamic product paths follow at priority 0.6.
//
// Notes
//   - Response is XML (`application/xml; charset=utf-8`) cached at the edge
//     for one hour. The Medusa fetch is wrapped in try/catch so a backend
//     outage degrades to a static-only sitemap instead of returning 500.
//   - Apparel-route gap: until `/shop/[handle]` exists, apparel handles
//     fall through to `/products/[handle]` (documented at the branch site).
//   - Hard cap at 200 products via the `limit` query — Google's per-sitemap
//     ceiling is 50,000; pagination/sitemap-index is a follow-up.

import { defineEventHandler, setHeader } from 'h3'

interface MedusaProduct {
  handle?: string
  updated_at?: string
  type?: { value?: string } | null
}

interface MedusaProductListResponse {
  products?: MedusaProduct[]
}

interface MedusaCollection {
  handle?: string
  updated_at?: string
}

interface MedusaCollectionListResponse {
  collections?: MedusaCollection[]
}

const STATIC_PATHS: Array<{ loc: string; changefreq: string; priority: number }> = [
  { loc: '/', changefreq: 'daily', priority: 1.0 },
  { loc: '/shop', changefreq: 'daily', priority: 0.9 },
  { loc: '/shop/canon', changefreq: 'weekly', priority: 0.8 },
  { loc: '/products', changefreq: 'daily', priority: 0.9 },
  { loc: '/products?type=pod', changefreq: 'weekly', priority: 0.7 },
  { loc: '/categories', changefreq: 'weekly', priority: 0.6 },
  { loc: '/collections', changefreq: 'weekly', priority: 0.6 },
  { loc: '/about', changefreq: 'monthly', priority: 0.5 },
  { loc: '/contact', changefreq: 'monthly', priority: 0.5 },
  { loc: '/accessibility', changefreq: 'yearly', priority: 0.3 },
  { loc: '/privacy', changefreq: 'yearly', priority: 0.3 },
  { loc: '/terms', changefreq: 'yearly', priority: 0.3 },
]

// XML-escape a URL/string before embedding in the sitemap.
function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export default defineEventHandler(async (event) => {
  const headers = event.node.req.headers
  const host = (headers['x-forwarded-host'] || headers.host || 'localhost:3000').toString()
  const protocol = ((headers['x-forwarded-proto'] as string) || 'http').toString()
  const origin = `${protocol}://${host}`

  // Resolve Medusa endpoint + publishable key. Nuxt runtimeConfig doesn't
  // expose the Medusa module config directly, so we fall back to the same
  // env vars the module itself reads.
  const medusaUrl = (process.env.MEDUSA_URL || 'http://localhost:9000').replace(/\/$/, '')
  const apiKey = process.env.MEDUSA_PUBLISHABLE_KEY || ''

  let products: MedusaProduct[] = []
  try {
    const res = await $fetch<MedusaProductListResponse>(`${medusaUrl}/store/products`, {
      headers: apiKey ? { 'x-publishable-api-key': apiKey } : undefined,
      query: { limit: 200, fields: 'handle,updated_at,*type' },
    })
    products = Array.isArray(res?.products) ? res.products : []
  } catch {
    // Degrade to static-only on backend failure — never 500 the sitemap.
    products = []
  }

  // Live collections — surfaces curated PLP URLs (e.g. /collections/dtf,
  // /collections/hot-deals) so crawlers discover the merchandised shelves
  // without a manual feed. Same failure posture as products: degrade to
  // static-only on backend failure.
  let collections: MedusaCollection[] = []
  try {
    const res = await $fetch<MedusaCollectionListResponse>(`${medusaUrl}/store/collections`, {
      headers: apiKey ? { 'x-publishable-api-key': apiKey } : undefined,
      query: { limit: 100, fields: 'handle,updated_at' },
    })
    collections = Array.isArray(res?.collections) ? res.collections : []
  } catch {
    collections = []
  }

  const urls: string[] = []

  for (const sp of STATIC_PATHS) {
    urls.push(
      `<url>
  <loc>${xmlEscape(`${origin}${sp.loc}`)}</loc>
  <changefreq>${sp.changefreq}</changefreq>
  <priority>${sp.priority.toFixed(1)}</priority>
</url>`,
    )
  }

  for (const c of collections) {
    if (!c?.handle) continue
    const lastmod = c.updated_at
      ? new Date(c.updated_at).toISOString().slice(0, 10)
      : undefined
    urls.push(
      `<url>
  <loc>${xmlEscape(`${origin}/collections/${c.handle}`)}</loc>${lastmod ? `
  <lastmod>${lastmod}</lastmod>` : ''}
  <changefreq>weekly</changefreq>
  <priority>0.5</priority>
</url>`,
    )
  }

  for (const p of products) {
    if (!p?.handle) continue
    const lastmod = p.updated_at
      ? new Date(p.updated_at).toISOString().slice(0, 10)
      : undefined
    const isApparel = (p.type?.value || '').toLowerCase() === 'apparel'
    // TODO(follow-up): once /shop/[handle] route ships, switch apparel to
    // /shop/${handle}. Today we route everything through /products/[handle]
    // so links resolve. The variable is kept for self-documentation.
    void isApparel
    const path = `/products/${p.handle}`
    urls.push(
      `<url>
  <loc>${xmlEscape(`${origin}${path}`)}</loc>${lastmod ? `
  <lastmod>${lastmod}</lastmod>` : ''}
  <changefreq>weekly</changefreq>
  <priority>0.6</priority>
</url>`,
    )
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>
`

  setHeader(event, 'Content-Type', 'application/xml; charset=utf-8')
  setHeader(event, 'Cache-Control', 'public, max-age=3600, s-maxage=3600')
  return xml
})
