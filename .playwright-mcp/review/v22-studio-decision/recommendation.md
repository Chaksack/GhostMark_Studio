# /studio route recommendation

## Verdict
**Yes — promote `/studio` to a real, dedicated B2B route now**, retire `/products?type=pod` as the public entry point, and back it with a Medusa `studio` sales channel + its own publishable API key. Crucially, the existing `storefront/app/pages/studio.vue` (an "our story / rooms / people" editorial page) must move to `/about/studio` before this lands — the URL is the most valuable B2B real estate on the domain and an editorial page is squatting on it.

## Decision criteria — scorecard

| Criterion | `/studio` (real route) | `?type=pod` (current) | Winner |
|---|---|---|---|
| Paid-marketing URL hygiene (LinkedIn / Google Ads B2B campaigns) | Clean, memorable, brandable; tracks as its own funnel out of the box | Query strings get stripped by some ad platforms, look generic, dilute conversion attribution | `/studio` |
| SEO — keyword targeting | Two distinct H1/title/meta surfaces; "custom apparel agency Bordeaux" can rank a page that doesn't compete with the D2C catalogue | Single `/products` URL forced to rank for both intents; query-string variants are not separate index targets | `/studio` |
| SEO — risk of thin content | Real risk if `/studio` just re-skins the PLP — must ship distinct copy, FAQ, social proof | No incremental risk (no extra page) | `?type=pod` |
| Conversion signal for B2B procurement buyers | "This is for procurement teams" — explicit | "This is the apparel catalog filtered" — feels generic | `/studio` |
| Engineering cost (one-time) | M: hero copy, microcopy, analytics tracking, breadcrumb, nav active-link logic, sitemap, redirect | Already shipped | `?type=pod` |
| Engineering cost (ongoing) | Marginal — same PLP filter UI, just a different layout shell | Couples B2B and D2C copy decisions to one PLP forever | `/studio` |
| Operational (Medusa) | Sales channel + scoped pkey lets B2B inventory, price lists, customer groups stay clean (confirmed in Context7: `/admin/api-keys/{id}/sales-channels`, `req.publishable_key_context.sales_channel_ids`) | All filtering happens client-side after a fetch that mixes both catalogs | `/studio` |
| Brand voice register | Lets `/studio` adopt agency-confident voice (merchery cadence) without polluting D2C `/shop` | Forces a single hero+microcopy register to span both audiences | `/studio` |
| Migration cost if we defer | Compounding: every new CTA/nav/sitemap/email points at `?type=pod` and has to be rewritten later | None today; high later | `/studio` |

Score: 8 to `/studio`, 1 to `?type=pod`. The only genuine risk on the "real route" side (thin content) is a content problem, not an architecture problem, and is mitigated below.

## If we ship `/studio` — capability plan

1. **MOVE the existing `/studio` editorial page** — Scope: rename `storefront/app/pages/studio.vue` (rooms/people/addresses page) to `storefront/app/pages/about/studio.vue`; add a `301`-equivalent in Nuxt routing (`definePageMeta({ alias: ['/our-studio'] })` is not a redirect — use a server middleware or `routeRules`). Files: `storefront/app/pages/studio.vue`, `nuxt.config.ts`. Effort: **S**. Dependencies: none. **This is a hard blocker** — you cannot put commerce on `/studio` while editorial content owns the URL.
2. **Build `/studio` as a B2B microsite landing + PLP** — Scope: new `storefront/app/pages/studio/index.vue` (B2B hero with merchery-cadence copy: "Branded objects for studios, agencies & teams." MOQ 25, e-proof in 48h, WeTransfer/Deloitte logo strip, lead-gen quote form, 4-step process strip from existing `pages/studio.vue` content, then a B2B-flavored product grid below). Reuses `FilterPill`, `MobileFilterSheet`, `ProductCard` with `:variant="'studio'"` prop to flip chip taxonomy (`FROM 25 UNITS`, `48H E-PROOF`). Files: `storefront/app/pages/studio/index.vue`, `storefront/app/components/ProductCard.vue`. Effort: **M**. Dependencies: chip taxonomy refresh (already on the v9 backlog).
3. **B2B PDP route** — Scope: do NOT create `pages/studio/[handle].vue` yet. Route B2B PDP traffic through `pages/products/[handle].vue` with `?from=studio` so the existing PDP can render the B2B flavor (MOQ banner, tier-price ladder, upload-artwork step) without forking the template. Forking is a v2 decision once the B2B PDP variant has stabilised. Files: `storefront/app/pages/products/[handle].vue`. Effort: **S**. Dependencies: none.
4. **Flip every CTA from `?type=pod` to `/studio`** — Scope: 10 occurrences across `HeroSection.vue`, `AppHeader.vue`, `MobileNav.vue`, plus the active-state computeds (`isPodActive` becomes `isStudioActive` checking `route.path.startsWith('/studio')`). Files listed in "Migration path" below. Effort: **S**. Dependencies: capability 2.
5. **Medusa sales channel + publishable API key** — Scope: create `studio` sales channel in Medusa admin, generate a dedicated pkey, scope it to B2B-decoration product family + POD bases. The `/studio` PLP fetches with that pkey; `/shop` keeps the existing pkey scoped to D2C SKUs only. Confirmed pattern (Context7, `/websites/medusajs_resources`): `linkSalesChannelsToApiKeyWorkflow` + `req.publishable_key_context.sales_channel_ids`. Files: `storefront/nuxt.config.ts` (add `MEDUSA_STUDIO_PUBLISHABLE_KEY` env), `storefront/app/composables/useMedusaClient.ts` (route-aware client selection). Effort: **M**. Dependencies: Medusa admin work.
6. **Sitemap + analytics + structured data** — Scope: add `/studio` to sitemap with priority 0.9 (peer of `/shop`, above category pages); add a separate GA4 funnel/conversion property for the studio flow; ship `BreadcrumbList` and `Service` schema.org JSON-LD on `/studio` (B2B intent reads better as `Service` than `Product`). Files: `storefront/server/routes/sitemap.xml.ts`, `storefront/app/pages/studio/index.vue` (Head schema), GA4 admin. Effort: **S**. Dependencies: capability 2.
7. **Server-side redirect** — Scope: in `nuxt.config.ts` `routeRules`, add `'/products': { redirect: { to: ({ query }) => query.type === 'pod' ? '/studio' : undefined, statusCode: 301 } }` so any inbound link or stale email still resolves cleanly. Files: `storefront/nuxt.config.ts`. Effort: **S**. Dependencies: capabilities 2 + 4.
8. **Lead-gen quote form** — Scope: simple form (company, brief, qty estimate, deadline, file upload) posting to a `/api/quote` endpoint that emails the studio inbox + writes a Medusa Draft Order. Files: `storefront/app/components/StudioQuoteForm.vue`, `storefront/server/api/quote.post.ts`. Effort: **M**. Dependencies: none — but the form is what makes `/studio` a B2B microsite instead of a re-skinned PLP, which mitigates the only real downside (thin content).

Total effort: roughly **2 sprints / 1 senior FE engineer** end-to-end. Capability 1 unblocks everything. Capability 4 is the smallest payload but the highest visibility — do it last so the redirect from capability 7 catches anyone mid-session.

## Migration path from current state

1. **Move editorial `/studio`** → rename `storefront/app/pages/studio.vue` → `storefront/app/pages/about/studio.vue`. Add `routeRules['/studio-old']` redirect for any inbound links. (Required first; cannot ship `/studio` commerce while this page exists.)
2. **Stand up `/studio/index.vue`** with the B2B microsite + PLP (capability 2 + 8 in parallel).
3. **Flip CTAs** in `storefront/app/components/HeroSection.vue` line 100 (`{ path: '/products', query: { type: 'pod' } }` → `'/studio'`), `storefront/app/components/AppHeader.vue` lines 198 + 200 (incl. active-state computed at lines 368-369), `storefront/app/components/MobileNav.vue` lines 131 + 308 (active-state).
4. **Ship the 301** in `storefront/nuxt.config.ts` so `/products?type=pod` → `/studio` keeps any external links live.

## What changes for SEO + analytics + brand

- **SEO**: two distinct indexable surfaces (`/shop` for "branded apparel cream Bordeaux", `/studio` for "custom apparel agency / B2B merch / corporate gifting Europe") that no longer compete for the same H1. Risk: Google treats `/studio` as thin content if it's just a PLP — mitigated by the lead-gen form, process strip, logo strip, and a unique 250-400 word intro paragraph above the grid.
- **Analytics**: clean funnel split — `/studio` traffic, quote-form submissions, and B2B-PDP views become a coherent B2B conversion journey distinct from D2C. Today's `?type=pod` is invisible to most attribution tooling.
- **Brand voice**: `/shop` stays D2C-direct ("Buy this piece"); `/studio` adopts the merchery-style "we make this for you" register. Same brand, two registers, neither pollutes the other. The home hero remains the one place both voices coexist.

## Open risks

1. **URL collision with editorial `/studio`** — current `pages/studio.vue` is "rooms / people / addresses" content. If someone ships the new commerce `/studio` without migrating the editorial page, you get a silent overwrite or a routing bug. Mitigation: capability 1 is a hard blocker; gate the PR on it.
2. **Thin-content SEO penalty** — if `/studio` is just `/products?type=pod` with a different background colour, Google will treat it as duplicate intent and rank neither. Mitigation: ship capability 8 (lead-gen form) and a real intro section before requesting indexing; otherwise leave `noindex` until content is in.
3. **Sales-channel pkey leakage** — if the `/shop` pkey is also scoped to studio products (or vice versa), the D2C grid will surface MOQ-only SKUs and confuse buyers. Mitigation: enforce strict pkey scoping in Medusa admin and assert it in a CI check that fetches both pkeys and diffs the product lists.

## My recommendation, defended

Promoting `/studio` to a real route is one of those decisions where the "wait and see" path quietly gets more expensive every week. Every CTA, email link, sitemap entry, and ad URL added against `?type=pod` is a future migration cost, and the marketing team will ship campaigns against the URL that exists — meaning a query-string entry point will leak into LinkedIn collateral, partner emails, and Google Ads landing pages within a sprint. Conversely, the engineering cost of `/studio` today is small (S/M tickets, mostly already-built primitives reused) and Medusa has first-class primitives for the sales-channel scoping (publishable API key + `linkSalesChannelsToApiKeyWorkflow`, both confirmed in current docs). The single counter-argument worth taking seriously is "thin content," but that's a content problem with a content fix (lead-gen form + intro copy + process strip + logo strip), not an architectural one. The blocker nobody has flagged: the existing `pages/studio.vue` editorial page must move first — moving editorial to `/about/studio` is a 5-minute change but a non-negotiable prerequisite. Ship `/studio` now.
