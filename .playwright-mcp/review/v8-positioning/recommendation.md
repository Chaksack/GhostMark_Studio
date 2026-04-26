# B2B vs D2C positioning — recommendation

## TL;DR

**Go B2B branded-merch agency. Stop hedging.** The MOQ=25 + DTF print + per-unit-tier economics are physically incompatible with a D2C apparel brand, and the studio has zero owned lifestyle photography to compete in D2C anyway. Every honest signal on the site (WeTransfer/Deloitte/Deliveroo logos, "e-proof", "lead time", "Buy a sample", "campaign", "Bordeaux studio") already points B2B — the D2C signals are cosmetic chrome borrowed from Shopify themes and can be peeled off in a week.

## What the current site signals (mixed)

| B2B (corporate gifting / branded merch) | D2C (apparel / lifestyle) |
|---|---|
| WeTransfer, Deliveroo, Deloitte logo strip | Hero: model from behind in grey crewneck |
| Shelves: "STUDIO CANON", "WELCOME BUNDLES", "END OF YEAR" | "BEST SELLERS" chip on ProductCard |
| FAQ: "e-proof before production", "MOQ", "lead time", "prices vary" | PLP H1: "All products" |
| PDP MOQ = 25 pieces | SKU naming: Studio Tee, Atelier Hoodie |
| "Buy a sample" CTA (RFP pattern) | Editorial Fraunces serif on tile labels |
| "View product details" (formal) | Pistacho newsletter band (branded-content vibe) |
| "Letters from the studio" newsletter | Color-swatch variant picker |
| Tagline: "A mark that outlasts the campaign" | Wishlist icon throughout |
| "Studio · Bordeaux, France" | Breadcrumb chrome inherited from apparel themes |
| Breadcrumb: "Branded objects, made to last" | |

The B2B signals are **structural** (pricing model, fulfilment, CTAs, copy). The D2C signals are **decorative** (theme defaults, icons, typography).

## What merchery and other references do

- **merchery.co** — pure B2B branded merch agency. PLP/PDP/FAQ all B2B-framed, MOQ + tier pricing visible, hero is product-led editorial, "Corporate Swag Supplier" in their own meta. This is the direct comparable.
- **everpress.com** — D2C-leaning crowdfund-merch platform: "Create and Sell Beautiful Limited Edition Merch." No client-logo strip, no MOQ surfaced, aspirational creator tone. Different business entirely.
- **printful.com** — D2C-enabling print-on-demand: "Unleash your inner brand," no MOQ, per-order fulfilment. Their B2B is a separate enterprise SKU. Not comparable to GhostMark.
- **Industry MOQ benchmarks (2026)**: T-shirts 50–200pcs, hoodies 100–300pcs. MOQ=25 is *aggressively low for B2B* and *physically impossible for D2C* (D2C MOQ is 1).

## Cost of picking each path

**B2B path (recommended):**
- *Changes:* Hero copy, PLP H1, PDP price label ("from £X / piece, MOQ 25"), ProductCard chip taxonomy ("STUDIO CANON" / "GIFTING" / "EVENT KITS" not "BEST SELLERS"), add a /work or /clients page, add "Request a quote" alongside "Buy a sample."
- *Stays:* 90% of the IA, FAQ, newsletter tone, photography brief, MOQ logic, tier pricing, sample flow, editorial typography. Logo strip stays. Bordeaux address stays.
- *Already built:* MOQ engine, sample CTA, FAQ, brand strip, "campaign" tagline, e-proof copy.

**D2C path (not recommended):**
- *Changes:* Rip out MOQ entirely (re-platform pricing). Kill sample CTA, replace with add-to-cart-1. Kill brand-logo strip (D2C brands don't show client logos — they show press). Re-shoot **entire catalogue** as on-model lifestyle (4–6 weeks, €15–40k). Re-write FAQ from scratch (no "e-proof", no "lead time"). Re-name SKUs. Build returns flow. Build size-guide. Build influencer/UGC engine. New tagline (campaign metaphor dies).
- *Stays:* The Next.js shell, the cart, the auth.
- *Already built:* Almost nothing reusable for D2C positioning.

## Recommendation

**Position as a B2B branded-merch / corporate-gifting studio.** Three reasons, in order of weight:

**1. Unit economics make D2C impossible.** DTF print + MOQ=25 + tier pricing is a B2B cost structure. D2C apparel runs on per-unit pick-pack-ship with MOQ=1, free returns, and 60–70% gross margin on stocked SKUs. GhostMark has none of that infrastructure — no warehouse for finished goods, no returns workflow, no per-unit pricing. A D2C re-platform isn't a copy change; it's a re-foundation. The MOQ=25 is already aggressively low for the B2B segment (industry benchmark is 50–200), which is actually a competitive *advantage* against Merchery — lean into it, don't bury it.

**2. The brand-asset gap is fatal for D2C.** Per the PM audit, all imagery is third-party stock (Unsplash/RVCA/KIIKI). D2C apparel brands live or die on owned editorial photography — it is the single largest line item in their P&L and the single biggest visual differentiator. GhostMark cannot ship a credible D2C brand with stock photos in 2026; the audience reads it as drop-shipper in under 3 seconds. B2B buyers, by contrast, evaluate on case studies, samples, and proof-of-concept e-proofs — none of which require lifestyle photography. The one hero shot can be replaced with a flat-lay or a tagged client deliverable for under €2k.

**3. Competitive whitespace and conversion physics favour B2B.** The corporate gifting market is €17.5B in 2026 and growing on personalisation + sustainability — both of which "A mark that outlasts the campaign" speaks to directly. Merchery owns the French-speaking corner with clinical execution but no editorial soul. GhostMark's editorial Fraunces / Bordeaux-studio aesthetic is a *real* differentiator there. In D2C, GhostMark is competitor #4,001 against Uniqlo, Everlane, COS, and 4,000 Shopify stores with better photos and lower prices.

**4. The site already knows what it is.** The PM-flagged "mixed signals" are honest B2B substance with a thin coat of D2C theme dust. Strip the dust. The substance is sound.

## What unblocks if user accepts

- **Bug 14** — PLP H1 "All products" → "Branded objects for studios & teams" (or similar B2B framing)
- **Bug 17** — ProductCard chip taxonomy resolves to {STUDIO CANON, GIFTING, EVENT KITS, NEW DROP}; "BEST SELLERS" deleted
- **Bug 20** — PDP price label resolves to "from £X / piece · MOQ 25 · e-proof in 48h"
- **Bug 26** — closed (this doc)
- **Bug 5** — hero campaign concept brief writes itself: product-led editorial, no on-model lifestyle
- **Bug 21** — newsletter "Letters from the studio" stays as-is (validated)
- **Bug 23** — FAQ tone validated, no rewrite needed
- **Wave 2 polish** — unblocked

## What changes operationally

- **Hero copy** — Replace "model-from-behind grey crewneck" with product-led flat-lay or tagged client deliverable. Headline: "Branded objects for studios, teams and the campaigns that matter." Sub: "Designed in Bordeaux. Produced from 25. E-proof in 48h."
- **Newsletter copy** — Keep "Letters from the studio." Add "for procurement leads and brand managers" microcopy.
- **FAQ copy** — No rewrite. Promote MOQ / lead-time / e-proof Qs to the top. Add "Do you ship internationally for events?"
- **PDP "Buy a sample"** — Keep. Add secondary "Request a quote (25+)" button. Price label: "from £18 / piece · MOQ 25."
- **ProductCard chip taxonomy** — `STUDIO CANON` · `GIFTING` · `EVENT KITS` · `WELCOME BUNDLES` · `END OF YEAR` · `NEW DROP`. Delete `BEST SELLERS` and `WISHLIST`.
- **Photography brief — CONFIRM BEFORE SPENDING.** B2B brief: 1 day flat-lay + 1 day "in-context on a desk / in a tote / on an event table." Budget €3–5k. Do *not* book on-model editorial; that is a D2C spend and would be wasted here.

---
**Word count: ~795**
