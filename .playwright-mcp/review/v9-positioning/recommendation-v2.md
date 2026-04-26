# 3-mode commerce IA — recommendation v2

## What changed
POD + an actual D2C own-brand line ("Studio Canon") means GhostMark is a hybrid commerce business, not a pure B2B agency, and v1's "kill all D2C signals" guidance was wrong for ~1/3 of the catalog.

## Recommended IA option
**Option B (modified): Two storefronts under one domain — `/shop` (D2C own-brand + POD) and `/studio` (B2B custom services), sharing one Medusa backend.** A single unified PDP (Option A) collapses three fundamentally different buyer journeys (impulse D2C, considered POD, procurement-grade B2B) into one over-loaded page that confuses everyone and converts nobody. A pure mode-switcher on every PDP (Option C) bloats every product card with paths most visitors will never use and forces every card chip and CTA to be tri-modal. Separate catalogs (Option D) is right at the SKU level (see Medusa section) but wrong as the *navigation* primitive — buyers don't think in SKUs, they think in intents ("I want to buy a thing" vs. "I want a thing made for my team"). Option B aligns nav with intent, lets each surface use its native conversion language, and still lets POD live on `/shop` because the POD buyer is closer to the D2C buyer (per-unit, no procurement) than the B2B buyer. The home page is the one place all three converge.

## Per-page implications
- **Hero (home)**: Two-CTA hero — primary "Shop the Studio Canon" (D2C), secondary "Make it yours — custom & POD" (routes to `/studio`). One headline that names both: "Objects we design. Objects we make for you." Below the fold: three-tile mode picker (Shop / Customize for your team / Print on demand) with one-line value prop each.
- **PLP**: Two routes. `/shop` is a clean D2C grid (price, ATC, BEST SELLERS chip, wishlist, sort by popularity). `/studio` is a service catalog (base products with "from €X / 25 units", "E-proof in 48h" chip, "Request quote" CTA). Filter chips are mode-aware: `/shop` filters by category/color/price; `/studio` filters by product type / decoration technique / lead time.
- **PDP**: Two PDP templates. **D2C PDP** (`/shop/[handle]`): per-unit price, qty stepper max ~10, ATC, wishlist, reviews, "Pairs with" cross-sell. **B2B PDP** (`/studio/[handle]`): MOQ=25 banner, tier price ladder, decoration zone picker, "Upload your artwork" Step 2, "Request e-proof (48h)" CTA, lead-time calculator. POD lives as a *third lightweight PDP variant* under `/shop/pod/[handle]` reusing the D2C template plus a single artwork-upload step (no MOQ, no quote).
- **Cart**: One unified cart at the data layer (Medusa supports it natively), but rendered with mode-grouped line items. B2B lines show "Awaiting e-proof" status and route to quote-confirmation, not Stripe. D2C and POD lines route to standard checkout. One cart icon, sectioned drawer.

## What we KEEP that we previously killed
- **BEST SELLERS chip** — keep on `/shop` D2C cards; never show on `/studio`.
- **Wishlist** — keep globally; it's useful for B2B procurement shortlists too (rename "Saved" rather than "Wishlist" in `/studio` context).
- **"Sneak peeks on new launches" newsletter line** — keep, but split list-of-record into two consent buckets (Drops vs. Studio updates).
- **ProductCard chip taxonomy** — needs mode-aware variants: `BEST SELLER` / `NEW DROP` for D2C; `FROM 25 UNITS` / `48H E-PROOF` / `POD READY` for studio.

## What stays B2B
- MOQ + tier-pricing flow on `/studio` custom path
- "E-proof in 48h" promise
- "Request a quote" CTA (alongside instant checkout for POD)
- WeTransfer/Deloitte client logo strip — `/studio` only, not on `/shop`
- Bordeaux studio + agency framing in About / FAQ

## What's NEW that needs scoping
- D2C PDP template ("Buy this piece" path with single-unit ATC, no Step 2 upload)
- `/shop` route + Studio Canon collection landing page
- `/studio` route restructure (existing storefront becomes this)
- POD micro-flow (one upload step, no quote loop)
- Mode-grouped cart drawer
- Mode-aware ProductCardChips component
- Hero v3 acknowledging both paths
- Sales-channel split in Medusa: `shop` channel (D2C + POD) and `studio` channel (B2B)

## Medusa product modeling
Confirmed via Context7 (`/websites/medusajs_resources`): Medusa supports the full hybrid model on a **single product** with the right primitives:
- **Tier pricing** is native on a variant via `min_quantity` / `max_quantity` on price entries — one variant can carry a default per-unit D2C price *and* a 25+/100+/500+ B2B ladder simultaneously.
- **Customer-group scoped price lists** let B2B groups see ladder prices while D2C anonymous traffic sees the per-unit price.
- **Sales channels** scope product *availability* per storefront surface — so the `studio` channel exposes the custom-decoration variants and the `shop` channel exposes only the canonical Studio Canon SKUs, even if backed by the same product record.

**Recommended modeling**: Studio Canon = distinct products in their own collection (clean D2C semantics, simple inventory). B2B custom bases = separate products with tier pricing + customer-group price lists. POD bases = a third product family scoped to the `shop` channel with per-unit pricing and a metadata flag `pod_enabled=true` that the storefront uses to inject the upload step. **Do not try to make one product serve all three modes** — Medusa *allows* it, but operationally (inventory, returns, fulfillment SLA, tax, reporting) it creates more pain than it saves. Distinct SKUs, shared cart, separate channels.

## What unblocks
- ProductCardChips taxonomy refresh (mode-aware variants)
- Hero copy v3 (dual-path)
- `/shop` route scaffold + Studio Canon collection
- Sales-channel + customer-group setup in Medusa admin

## What still needs decisions from user
- IA option A/B/C/D (recommendation: B)
- Whether POD lives under `/shop` (recommended) or as third top-nav entry `/print-on-demand`
- Whether Studio Canon gets its own dedicated landing (`/shop/canon`) above and beyond the `/shop` grid
- Whether B2B quote-flow customers must self-serve a login or stay anonymous-quote-then-account (affects customer-group price-list strategy)

---

**File path**: `/Users/ybk/GolandProjects/GhostMark_Studio/.playwright-mcp/review/v9-positioning/recommendation-v2.md`
