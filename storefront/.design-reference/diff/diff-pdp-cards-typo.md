# Side-by-side diff — PDP, cards, type+photo

Captured at desktop viewport 1440x900 on 2026-04-25. Numbers are computed-style values from `getBoundingClientRect()` and `getComputedStyle()` — no estimation.

Sources:
- Merchery PDP: https://merchery.co/shop/as-colour-vintage-hoodie
- Ours PDP:     http://localhost:3000/products/atelier-hoodie
- Merchery shop: https://merchery.co/shop
- Ours shop:    http://localhost:3000/products
- Merchery home: https://merchery.co/
- Ours home:    http://localhost:3000/

## A. PDP

### Layout
| Metric | Merchery | Ours | Delta |
|---|---|---|---|
| Layout grid (`main > section`) | `51.84px / 582.66px` (offset col + content col, 2-col flex w/ outer gutter) | not a grid (`mainKids[0].display = block`, full-width 1425px) | ours not using a real 2-col grid container |
| Gallery image width | 713px (sticky 50%/50%) | 641.5px | ours ~71px narrower |
| Info-column width | 682.5px | 656.5px | ~26px narrower; comparable |
| Sticky element | gallery (`lg:sticky lg:top-[68px] h-[calc(100vh-68px)]`) | gallery (`lg:sticky lg:top-28 lg:max-h-[calc(100vh-7rem)]`) | both sticky, similar formula |
| Customizer entry | INLINE numbered steps: "1. Pick a product variant" + "2. Upload your design"; tabs Front/Back inside step 2 | INLINE numbered steps: "1. Pick a product variant" + "2. Customise this product"; tabs Front (chest) / Back (full) | parity in pattern; ours adds chest/full subtitle that breaks visual rhythm |
| Photo count (gallery) | 19 image elements | 8 image elements | ours 11 fewer photos |
| Tab count + labels | 2 — `Front`, `Back` | 2 — `Front (chest)no design uploaded`, `Back (full)no design uploaded` | tab labels concatenate status text; needs separation |
| Sample button | "Buy a sample" — 50px tall, dark, beside h1 | "Buy a sample" — 37px tall, soft beige `rgb(242,229,217)`, beside h1 | ours under-emphasised |

### PDP h1 typography
| Metric | Merchery | Ours | Delta |
|---|---|---|---|
| Font family | `Reckless, serif` | `"Playfair Display", Georgia, serif` | substitute family |
| Size | 24px | 38px | ours +14px, oversized vs. PDP context |
| Weight | 400 | 400 | match |
| Line-height | 28px (1.17) | 43.7px (1.15) | match ratio; absolute differs because of size |
| Letter-spacing | normal | normal | match |

### Primary CTA
| Metric | Merchery | Ours | Delta |
|---|---|---|---|
| Label | "Add to cart" | "Add customised item" | wordy; ours violates 2-3 word convention |
| Width | 688.5px (full info-column) | ~ collapsed (56px measured at default scroll, dock width unclear) — visible CTA is right-docked button bar | merchery is wide and dominant; ours is a small floating dock chip |
| Height | 50px | 50px | match |
| Background | `rgb(23,23,23)` near-black | `rgb(31,28,24)` warm-black | close, both dark |
| Text color | `rgb(250,250,250)` | `rgb(251,247,241)` cream | match family |
| Font family | `Grotesk` | system `ui-sans-serif` | substitute |
| Font size | 16px | 15px | -1px |
| Border-radius | 0px | 0px | match |
| Padding | 12px 16px | 0 28px | ours uses fixed-height bar without vertical padding |

## B. Product cards (catalog grid)

| Metric | Merchery | Ours | Delta |
|---|---|---|---|
| Card width | 318.75px | 328.25px | +9.5px (negligible) |
| Card height | 446.25px | 382.75px | -63.5px |
| Card aspect (W/H) | 0.71 (portrait 5:7) | 0.86 (near-square) | ours visibly squarer — different rhythm |
| Image aspect (W/H) | 0.71 (portrait, fills full card incl. 5 chip-tags overlaid) | 1.00 (square) | core silhouette differs |
| Image bg color | `rgb(239,234,226)` (sand tint baked into image area) | `rgba(0,0,0,0)` transparent | ours has no warm photo plate behind product |
| Border / shadow | none / none | none / none | match |
| Title text | "Merchery heavy cabas" | "Atelier Hoodie" | --- |
| Title font | `Grotesk` | `ui-sans-serif` system | substitute |
| Title size | 16px | 14px | -2px (ours smaller) |
| Title weight | 400 | 500 | ours heavier |
| Title color | `rgb(10,10,10)` | `rgb(9,9,11)` | match |
| Price size / weight | 16px / 400 | 13px / 400 | -3px (ours smaller, lower contrast color `rgb(113,113,122)`) |
| Tag chips above image | yes — 5 small Grotesk chips (B Corp, Best sellers, Fast shipping, Made in Europe, Merchery product) on every card | none | ours missing trust/category chip system |
| Grid template | `grid grid-cols-2 ... md:grid-cols-4 gap:30px` | `grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8` | ours has 3-col breakpoint; gap differs (16x32 vs 30x30) |
| Grid gap | 30px both axes | 16px x / 32px y | ours horizontal gap is ~half — denser |

## D. Hero typography + photography

| Metric | Merchery | Ours | Delta |
|---|---|---|---|
| H1 text | "Good merch, for good brands." | "A mark that outlasts the campaign." | --- |
| H1 font family | `Reckless, serif` | `"Playfair Display", Georgia, serif` | substitute |
| H1 size desktop | 60px | 68px | +8px ours larger |
| H1 line-height | 69px (1.15) | 74.8px (1.10) | ours tighter (+/- ok) |
| H1 weight | 400 | 400 | match |
| H1 color | `rgb(10,10,10)` | `rgb(9,9,11)` | match |
| Hero image source | CDN photo (`merchery.co/cdn-cgi/image/.../Newsletter_big_image_carrousel_horizontal_575x383_6_3_79a574`), 1365x806 (~57% viewport width, side-by-side w/ text) | NO hero image present in `h1`-section. Largest media in main is a 259x259 product card. Below-the-fold "showcase" tiles are placeholder `<img>` icons (no real photos behind Cabas bag / Arc'teryx / Kaweco pen / Soeur) | content gap; ours ships with placeholder broken-image SVG glyphs |
| Hero image aspect | 1.69 (cinematic 16:9-ish) | n/a | --- |
| Body font | `Grotesk` | `ui-sans-serif` system stack | substitute (no real body font loaded) |
| H2 sizes (top 5) | 67.7 / 40 / 16 / 44 / 44 px — Reckless serif, weight 400 | 26 / 26 / 26 / 26 / 26 px — system sans, weight 600 | ours has uniform tiny serif-less h2; merchery has dramatic editorial scale |
| Page bg | warm cream (visible behind hero) | `rgb(250,250,250)` near-white | ours cooler/flatter |

---

## Top 10 ranked fixes (by visual impact, not effort)

1. **Add real hero photography on the homepage**
   Delta: ours has zero hero image (largest `<main>` image is a 259x259 product card; logo-row tiles render placeholder glyphs); merchery hero is a 1365x806 lifestyle photo at 1.69 aspect occupying ~50% of viewport. Visual weight gap is enormous.
   Files: `storefront/components/home/Hero.*` (hero section component), `storefront/components/home/Showcase*` or showcase tiles, `storefront/public/images/hero/*` (add assets).
   Effort: M (asset sourcing + responsive `<picture>` + skeleton).

2. **Swap the display serif from Playfair Display to a Reckless-class wedge serif**
   Delta: H1 family currently `"Playfair Display", Georgia, serif` 68px/1.10; merchery uses `Reckless, serif` 60px/1.15. Reckless has narrower counters and softer terminals — Playfair reads more "wedding invite". Use a license-friendly substitute: PP Editorial New, GT Sectra Display, or Source Serif 4 (Display optical size).
   Files: `storefront/app/layout.tsx` (font import), `storefront/tailwind.config.*` or `storefront/app/globals.css` (font-family CSS var, `--font-display`).
   Effort: S.

3. **Drop our PDP h1 from 38px to 24-28px and switch to the new display serif**
   Delta: ours h1 is 38px Playfair; merchery is 24px Reckless 28px line-height. Our oversized h1 fights the customizer steps.
   Files: `storefront/app/products/[handle]/page.*` or `storefront/components/product/ProductHeader.*`.
   Effort: S.

4. **Make the PDP "Add to cart" CTA full-width within info column, 50px tall, dark, with a real label**
   Delta: ours is a docked chip ~56px wide with label "Add customised item" (wordy); merchery is 688.5px wide, 50px tall, `rgb(23,23,23)` bg, white text, label "Add to cart". Full-width primary action is the strongest PDP affordance.
   Files: `storefront/components/product/AddToCartButton.*`, `storefront/components/product/StickyDock.*` (or wherever the dock lives).
   Effort: S.

5. **Load Grotesk (or a Söhne-class neo-grotesque) for body + UI**
   Delta: body computed font-family is the system `ui-sans-serif` stack with no custom font; merchery body is `Grotesk` 16/24. The system stack is what makes our cards/labels feel generic.
   Files: `storefront/app/layout.tsx` (next/font), `storefront/app/globals.css`. License options: Söhne (paid), Inter (free, `font-feature-settings: "ss01","cv11"`), or GT America.
   Effort: S.

6. **Restore product-card 5:7 portrait aspect with a sand-tinted plate behind the photo**
   Delta: cards are 0.86 (near-square) with transparent `rgba(0,0,0,0)` background; merchery cards are 0.71 portrait with `rgb(239,234,226)` baked-in sand backdrop. Portrait + warm plate is most of merchery's editorial signature.
   Files: `storefront/components/product/ProductCard.*` (image wrapper aspect-ratio + bg utility), `storefront/tailwind.config.*` (add `bg-sand` token if missing).
   Effort: S.

7. **Add chip/tag overlay on product cards (B Corp, Best sellers, Fast shipping, Made in Europe, Brand)**
   Delta: every merchery card stacks 5 small Grotesk 12px/400 light-grey chips above the image; ours has zero. Big density/credibility difference.
   Files: `storefront/components/product/ProductCardChips.*` (new), `storefront/lib/data/product-tags.*` (data source — tie to Medusa tags), `ProductCard.*` (mount).
   Effort: M (data wiring + visual).

8. **Bump catalog grid horizontal gap from 16px to ~30px and remove the 3-col breakpoint**
   Delta: ours `gap-x-4 gap-y-8` (16/32) with `sm:grid-cols-3 lg:grid-cols-4`; merchery is symmetric 30px gap and skips 3-col (`grid-cols-2 md:grid-cols-4`). The 3-col view distorts card aspect at mid widths.
   Files: `storefront/app/products/page.*` or `storefront/components/products/ProductsGrid.*`.
   Effort: S.

9. **Replace product-card title from 14px/500 system-sans to 16px/400 Grotesk**
   Delta: merchery is 16/400 Grotesk `rgb(10,10,10)`; ours is 14/500 system sans `rgb(9,9,11)`. The heavier weight + smaller size makes ours feel more "SaaS dashboard" and less editorial.
   Files: `storefront/components/product/ProductCard.*` (title `<h3>` classes).
   Effort: S.

10. **Promote h2 section headings to dramatic Reckless 40-68px (currently flat 26px sans)**
    Delta: merchery h2s scale 67.7 / 40 / 44 / 44 px in Reckless 400; ours all collapse to 26px system-sans 600. Section headings are the rhythm of the home page — they currently read like card labels.
    Files: `storefront/components/home/Section*` heading component, `storefront/tailwind.config.*` (add `text-display-lg/md/sm` typography scale).
    Effort: S–M.

### Notes
- "Customizer entry" achieves rough parity (numbered inline steps + Front/Back tabs). The biggest functional gap is label hygiene: our tab labels concatenate `"Front (chest)no design uploaded"` — split into `<Tab label>` + `<Tab status>` slots.
- Photo count gap on PDP (19 vs 8) is mostly content; not a code fix unless we want to repeat angles.
- Color tokens are very close (`rgb(31,28,24)` vs `rgb(23,23,23)` for buttons; `rgb(9,9,11)` vs `rgb(10,10,10)` for headings) — palette is fine, problem is type + photography.
