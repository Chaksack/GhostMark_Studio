# Merchery PDP customizer — observed flow

Based on live walkthrough on 2026-04-25 of three live products at desktop 1440x900 and mobile 390x844:
- Apparel: `https://merchery.co/shop/as-colour-vintage-hoodie`
- Drinkware: `https://merchery.co/shop/stanley-camp-mug`
- Office: `https://merchery.co/shop/merchery-notebook`

Screenshots: `storefront/.design-reference/merchery/flow-*.png`

## Layout (desktop)
- 2-col split, ~50/50. Gallery on the LEFT, configurator on the RIGHT.
- Configurator is the SCROLLING column. Gallery is sticky on the left and stays in viewport while the right column scrolls (until the page footer).
- Sticky bottom-right action bar inside the configurator column: lead time + total price + Add to cart CTA. This stays visible at all times so scroll position never hides the buy button.
- Gallery: standalone slider/carousel; horizontal pagination dots at the bottom of the gallery (no thumbnail strip, no Front/Back/Lifestyle labels on the photos themselves).
- Gallery photo count varies by product: hoodie 5, mug 5, notebook 7. Aspect: tall portrait (~3:4 to 4:5 of the gallery column width).
- Region/cookie modal appears on first load (auto-detect EU vs UK/US). Intercom-style chat widget anchored bottom-right.

## Section structure (numbered headings inside the configurator card)
The customizer is composed of numbered, accordion-free sections rendered top-to-bottom. Numbering and presence are PRODUCT-DEPENDENT — there is no fixed 3-section template.

| Product   | Section 1                | Section 2          | Section 3  |
|-----------|--------------------------|--------------------|------------|
| Hoodie    | 1. Pick a product variant | 2. Upload your design | 3. Quantity |
| Mug       | 1. Upload your design    | 2. Quantity        | (none)     |
| Notebook  | 1. Pick a product variant | 2. Upload your design | 3. Quantity |

If a product has only one variant (mug), the variant section is OMITTED entirely — sections renumber.

## Variant order & widget types
Order within "Pick a product variant" (when present):
1. Gender (apparel only) — pill buttons "Men" / "Women"
2. Color — round colour swatches with thin border, no inline labels (label appears via aria-label / hover). Selected swatch gets a black ring.
3. Paper type / other axes (notebook etc.) — pill buttons
4. Textile size — NOT shown as a widget on the hoodie PDP, but it IS persisted to URL (`?Textile+size=XL`). It appears the size is split out per-row in the cart/quantity step rather than on the PDP itself.

When the user clicks a colour, the gallery image swaps to a model wearing that colour (different photoshoot). The dashed "Your design here" placeholder on the gallery is also re-rendered for the new variant.

## Customise entry point
- DESKTOP: customizer is **immediately visible** on PDP load. NO "Customise" / "Add your logo" button is required. Variant + Upload + Quantity sections all render at once.
- MOBILE: opposite. The PDP shows the gallery + product description + a single primary CTA "**Customize this product**" with a secondary "Continue to Variants" button. The full customizer opens behind that tap (full-page takeover style).
- There is no separate sub-route — everything stays on the PDP URL; only query params change (`?Gender=Women&Color=Faded+Black&Textile+size=XL`).

## Upload UX (the headline question)
- The "Upload your design" section uses a **tablist** with one tab per print location. Tabs are confirmed via accessibility tree as `role="tab"` with `aria-selected`.
- Hoodie tabs: `Front`, `Back`. Notebook tabs: `Front`, `Back`. Mug tabs: `Back` ONLY (one tab).
- So the previous "Front/Back tabs" assumption is **PARTIALLY CORRECT**: it holds for apparel and notebook, but BREAKS for drinkware (and likely pens, etc.). The tabs are really "print locations", and a product can have 1, 2, or potentially more tabs.
- Only ONE `<input type="file">` exists in the DOM at any time. The active tab determines which location the file gets stored under. Tabs are not independent dropzones — they share the input.
- Empty state: large dashed-border tile, upload icon, "Click to upload or drag & drop". Both click and drag-drop work.
- After upload: the dropzone is replaced by a chip with a thumbnail + filename + × delete control. The active tab gets a small image-icon badge so the user can see at a glance which locations have a file.
- Below the upload chip, a NEW section appears: "Select customization technique" with pill buttons. Techniques are PRODUCT-DEPENDENT:
  - Hoodie: Embroidery, Full colour transfer, Screen printing, Screen transfer
  - Mug: Laser engraving, Pad printing
  - Notebook: not yet inspected (not uploaded), but technique buttons follow the same pattern
- Below the technique buttons: a small info card "Not sure which technique fits your design?" with a "Explore the guide" link.
- Accepted file types (from the actual `<input accept="...">` attribute):
  `image/jpeg, image/png, image/svg+xml, application/pdf, application/postscript, application/illustrator, image/vnd.adobe.photoshop, .pdf, .eps, .ai, .psd`
- User-facing copy says "Maximum file size 10Mb. For best results please upload an EPS, ai. or PDF file. We can vectorize your artwork if necessary." — vectorisation is offered as a service.
- For logged-in users (and even guests via session memory), a "Recently uploaded" row shows previously uploaded logos as clickable thumbnails next to a black "Upload new" button. There is also a permanent "Save & access your full library — Login or Sign up" sub-card. Cross-product memory is REAL: the SVG I uploaded on the hoodie reappeared as a "Recently uploaded" suggestion when I navigated to the mug PDP in the same session.

## Live preview (the other big finding)
- The preview renders directly **on the gallery image**, not in a separate panel. The uploaded design is composited as an absolutely-positioned overlay on top of the product photo.
- Updates in real time the moment the file is parsed (no "apply" button).
- Pre-upload state: a subtle dashed circle reading "Your design here" sits on the chest of the apparel mockup, hinting at where the design will land. Disappears once a file is uploaded (or when on the Back tab without a file).
- Once a file is uploaded, the preview is technique-aware: laser engraving on the mug renders as a flat dark monochrome silhouette of the design (NOT the original orange — the mug photo composite simulates the etched look). Embroidery/print on the hoodie renders the design closer to true colour.

## Position / edit tools
The moment a file is uploaded, an additional toolbar layer appears OVER the gallery image:
- Top-left of gallery: 3 round icon buttons — Save, Download, Share
- Top-center of gallery: 2 round icon buttons — Zoom out (−) / Zoom in (+)
- Left edge of gallery (vertical strip, just inside the image): 2 buttons with text labels — "Remove background" (magic-wand icon) and "Edit colors" (palette icon)
- Bottom-center of gallery: a Front / Back pill toggle — separate from the upload-section tabs, lets the user flip the gallery view to inspect the back without scrolling. Only present for products with multiple locations.
- The design itself is freely DRAGGABLE inside the gallery to reposition. There are NO numeric X/Y/scale/rotation sliders and NO preset position buttons (top-center, left-chest, etc.). It's pure freeform drag + zoom buttons.

## Quantity ladder (it is NOT a fixed 7-tier system)
Tiers are PER-PRODUCT, not universal:
- Hoodie: 7 tiers — 15 / 25 / 50 / 100 / 200 / 300 / 400. MOQ 15. Default qty 30.
- Mug: 5 tiers — 25 / 50 / 100 / 200 / 500. MOQ 25. Default qty 50.
- Each tier is a tappable card showing: quantity, €/piece, "Save N%" green badge (omitted from the smallest tier), line total.
- A free-form quantity input sits at the top of the ladder. It updates the active tier highlight and recomputes the price as the user types.
- Help copy: "Fill in the exact amount you need. The minimum quantity for this product is N."
- Live total (and per-piece price) updates instantly when the user changes quantity OR uploads a design OR picks a different technique. After uploading + selecting Embroidery on the hoodie, qty 30 jumped from 32,45 €/piece → 65,26 €/piece (technique premium baked into per-piece).

## Add to cart flow
- Sticky CTA at bottom-right of the configurator: "Add to cart" (full-width, black, rounded). To its left: "Lead time: Approximately 10-16 business days" (or 8-12 for mug, 9-14 for notebook) and "Total: 1.957,80 €".
- Pre-upload, a red warning sits next to the total: "Upload your design to get your final price." It's replaced by "Shipping cost is calculated at checkout" once a design is applied.
- On click: a **right-side slide-in drawer** opens with header "Added to your cart" and a × close.
- Drawer contents: line-item card (lifestyle product photo + variant attributes "Gender: Women / ● Faded Black / Textile size: XL"), a confirmation banner "The product has been added to your cart !", a "You might also like…" cross-sell carousel (3 cards), and a sticky bottom row with "Continue shopping" (secondary) + "View my cart" (primary, black).
- IMPORTANT: the cart drawer thumbnail is the LIFESTYLE product photo, NOT the customised mockup. The user's design is referenced only by the variant text — there is no design preview thumbnail in the cart line at this stage of the flow.

## Mobile differences
- Gallery and product description sit at the top, then a single primary CTA "**Customize this product**" + a secondary "Continue to Variants". The variant/upload/quantity sections are NOT rendered inline above the fold — the user must tap the CTA to enter the customisation flow (full-screen takeover).
- After upload (which I forced via DataTransfer for the test), the gallery photo on the PDP DOES update to show the design overlay even before the takeover is triggered, with a small file chip beneath. So the upload state is shared, but the position/zoom/technique tools live behind the takeover.
- The Front/Back gallery toggle moves to a small pill above the dots on mobile.
- Lead time + total + Add-to-cart row remains sticky at the bottom of the viewport on mobile.

## Per-product variations (summary)
- **Apparel (hoodie)**: Variant section (Gender + Color), Front+Back upload tabs, Embroidery / Full colour transfer / Screen printing / Screen transfer techniques, 7-tier qty ladder starting at 15.
- **Drinkware (mug)**: NO variant section, single "Back" upload tab, Laser engraving / Pad printing techniques, 5-tier qty ladder starting at 25, monochrome preview rendering for laser engraving.
- **Office (notebook)**: Variant section (Color + Paper type), Front+Back upload tabs (book covers), techniques not inspected, default qty visible.

## What we got WRONG in our implementation (or in our previous assumptions)
1. **Universal "Front/Back tabs"** — only true for apparel & notebooks. Mug and many other single-surface items have ONE tab (named "Back" specifically). The model is "print locations" with N tabs, not a fixed Front+Back binary.
2. **Universal 7-tier quantity ladder (15/25/50/100/200/300/400)** — only true for the hoodie. The mug uses 5 tiers (25/50/100/200/500) with MOQ 25. Tiers must be data-driven per product, not hard-coded.
3. **Variant section is mandatory** — false. Mug PDP has no variant section at all and renumbers Upload → 1, Quantity → 2.
4. **Customise is gated behind a button** — false on desktop (it's inline by default), but TRUE on mobile (CTA "Customize this product" gates the configurator).
5. **Customisation technique is a single global list** — false. Techniques are per-product (apparel: Embroidery/Print/Transfer; drinkware: Laser/Pad printing). The technique list has to come from the product attributes, and each technique should drive a different price multiplier.
6. **Live preview is a separate panel** — false. The preview overlays the gallery image directly. The gallery becomes the canvas after upload, with a Save/Download/Share/Zoom toolbar appearing on top of it.
7. **Position controls are sliders or presets** — false. It's freeform drag + zoom buttons (− / +). NO X/Y/scale/rotation sliders, NO preset position buttons.
8. **Cart line shows the design preview** — false. The cart drawer line uses the lifestyle product photo only; the design is referenced via variant text. Storing the rendered mockup for the cart line is something WE could do better, but matching merchery means NOT showing it there.
9. **Recently-uploaded library is a logged-in feature** — partially false. There is a "Recently uploaded" row that works in-session for guests too (cross-product within the same browser session). The login CTA is for *persistent* library only.
10. **Single PNG/JPG upload** — false. Merchery accepts SVG, PDF, EPS, AI, PSD too, with a vectorisation service offered for raster uploads.

## What we should change (concrete, ranked by impact)
1. **Make tabs data-driven**: model each product as `printLocations: PrintLocation[]` where PrintLocation has `{ id, label, defaultPosition, mockupOverlayBox }`. Render N tabs accordingly. Replace any hard-coded "Front | Back" with this.
2. **Make quantity ladder data-driven**: each product carries `quantityTiers: { quantity, pricePerPiece, discountPct }[]` and an explicit MOQ. Stop assuming 7 tiers / 15-MOQ universally.
3. **Move the live preview onto the gallery image, not a side panel**. The gallery becomes the canvas. Add the gallery toolbar layer (Save / Download / Share, Zoom −/+, Remove background, Edit colors) only after upload.
4. **Add a per-location "tab badge"** showing whether a file has been uploaded for that location (small image icon next to the label). Use shared file input semantics — only one input, swap target by active tab.
5. **Add a technique selector** that appears only after upload, with per-product technique groups, and have each technique drive a per-piece price delta.
6. **Make the variant section optional** — render only when `product.variants.length > 1` for any axis. Renumber sections accordingly.
7. **Mobile**: replace inline configurator with a "Customize this product" CTA that opens a full-screen takeover. Keep the sticky lead-time/total/Add-to-cart bar visible.
8. **Cart drawer**: open a right-side slide-in with the lifestyle photo + variant attribute summary + cross-sell carousel + Continue shopping / View my cart dual CTAs. Skip the design preview thumbnail in the cart line (match merchery).
9. **Add an in-session "Recently uploaded" library** so a designer customising 5 products in one sitting can re-apply the same logo without re-uploading.
10. **Broaden accepted file types** to include SVG, PDF, EPS, AI, PSD and surface a "We can vectorise your artwork" line in the upload-area helper text.

---

# Round 2 — headwear & bags walkthrough (2026-04-25)

Two more PDP categories were walked to validate (and stress-test) the data model derived from the first three products. All numbers below were extracted via `browser_evaluate` against the live DOM at desktop 1440x900. Techniques are intentionally NOT in the per-product table for round 2 because Merchery only renders the technique pill list AFTER a file is uploaded; technique inference is recorded in the category-specific findings section instead.

## Headwear products

Walked: `https://merchery.co/shop/vintage-cap` (snapback-style) and `https://merchery.co/shop/merino-wool-beanie` (knitted beanie). Picked deliberately — different silhouettes, different production lead times, different print-location semantics.

### Per-product evaluation (raw)

| Product | Variants (axes / option count) | Print location tabs | MOQ | Quantity tiers | Lead time | Notes |
|---|---|---|---|---|---|---|
| Vintage cap (`/shop/vintage-cap`) | Color x7 (Washed amazon green, Washed navy blue, Washed dark camel, Washed black, Washed organic khaki, Washed ivory, Washed almond green) | **Front**, **Side**, **Back** (3 tabs) | 20 | 6 tiers: 20 / 50 / 100 / 200 / 300 / 400 (Save 0/2/20/23/26/29 %) | 10-15 business days | Three-tab cap is a NEW print-location count we hadn't seen. "Side" sits between Front and Back, which the cart/render engine must respect as an ordered list, not a Front/Back boolean. |
| Merino wool beanie (`/shop/merino-wool-beanie`) | Color x8 (Ecru, Khaki, Red, Medium Grey, Black, Coffee, Natural, Navy) | **Cuff** (1 tab only) | 50 | 4 tiers: 50 / 100 / 250 / 500 (Save 0/2/12/20 %) | 20-25 business days | Single-location product but the location label is body-part-specific ("Cuff"), not the generic "Back" used by the mug. Lead time is the longest of any product seen so far — knitwear production runs are slow. |

### Headwear-specific findings
- Print-location count for headwear is **product-shape-driven**, not category-driven. Caps want 3 (Front / Side / Back); beanies want 1 (Cuff); a 5-panel cap might want 4 (Front / Left side / Right side / Back); a bucket hat might want 2 (Front / Side). The "Back" label used on the mug is itself an example of label-as-data.
- Headwear has **no Gender axis**, unlike apparel. Color is usually the only variant axis. Some caps may add a size axis (one-size vs. fitted), but neither product surveyed exposed it.
- Lead time varies dramatically inside one category: 10-15 days for the cap (embroidery runs are quick) vs. 20-25 days for the beanie (custom merino knitting is slow). Lead-time per product is non-trivial UX.
- MOQ also varies inside the category (20 vs 50). Cannot be assumed.
- Techniques (inferred from category convention since the technique pill list only renders post-upload): caps almost universally support **Embroidery / Patch / Screen printing / Heat transfer**; beanies typically restrict to **Embroidery / Woven patch / Leather patch** (no screen printing on knit fabric). Worth confirming with a real upload in a follow-up session.

## Bags products

Walked: `https://merchery.co/shop/recycled-canvas-tote` (flat tote), `https://merchery.co/shop/sandqvist-rolltop` (premium backpack). A third bag (`/shop/patagonia-backpack`) was sampled and revealed an even more stripped-down PDP shape — recorded under "edge cases" below.

### Per-product evaluation (raw)

| Product | Variants (axes / option count) | Print location tabs | MOQ | Quantity tiers | Lead time | Notes |
|---|---|---|---|---|---|---|
| Recycled canvas tote (`/shop/recycled-canvas-tote`) | Color x3 (Navy, Black, Off white) | **Center front**, **Center back** (2 tabs) | 15 | 4 tiers: 15 / 50 / 100 / 500 (Save 0/2/5/12 %) | 6-15 business days | Note tab labels are ANCHORED ("Center front" / "Center back") — a hint to the renderer that the design is centered horizontally on each face; this is a Merchery UX choice we should mirror so users don't have to drag the design into the middle. |
| Sandqvist rolltop (`/shop/sandqvist-rolltop`) | None exposed (single SKU as displayed) | **Above brand logo** (1 tab) | 15 | 6 tiers: 15 / 25 / 51 / 101 / 250 / 500 (Save 0/3/12/27/28/30 %) | 12-17 business days | Premium co-brand item: the print location label refers to a SPECIFIC FEATURE of the host product ("above brand logo" = above the existing Sandqvist patch). NON-ROUND tier breakpoints (51, 101) come from supplier MOQs, not pretty round numbers — confirms tiers must be a free array of integers, not a multiplier formula. |

### Edge case found while sampling

| Product | Variants | Print location tabs | MOQ | Quantity tiers | Lead time | Notes |
|---|---|---|---|---|---|---|
| Patagonia backpack (`/shop/patagonia-backpack`) | None | **None** (no `role="tab"` rendered; assumed implicit single location) | 15 | Single tier shown: 15 / 150 € per piece | not exposed | Premium co-brand product where the upload simply targets ONE pre-defined area; the configurator skips the print-location tablist entirely. The numbered sections renumber to "1. Upload your design / 2. Quantity" with NO variant section AND NO tab strip. |

### Bag-specific findings
- Tab labels in bags are usually **semantic to the bag's geometry** ("Center front" / "Center back" / "Above brand logo") rather than the generic Front/Back used in apparel. The model needs a free-text label per print location, not an enum.
- Backpacks/co-branded items often have **no color axis** — the silhouette is the brand statement and the user is only buying a printable surface. The UI must collapse the variant section gracefully when no axes exist.
- Some bags omit the print-location tablist entirely (Patagonia backpack). In other words, `printLocations.length` can be 0, 1, 2, or 3, and the configurator must render correspondingly (no tablist when N <= 1, simple tablist when N >= 2).
- Tier breakpoints in bags can be NON-ROUND (Sandqvist 51 / 101) — they reflect actual supplier minimums, not marketing-friendly round numbers. The data model must store an arbitrary `quantity: number` per tier, not derive from a `step` value.
- Techniques (inferred): bags accept **Screen printing / Heat transfer / Embroidery (canvas) / Woven label**; Patagonia and other premium brands typically restrict to **Embroidery only** (no screen printing on technical fabrics). Worth confirming with a real upload.

## 7-product synthesis (now 8 with Patagonia edge case)

| Product | Category | Variant axes | Print locations | Tabs label(s) | MOQ | Tier count | Tier sequence | Lead time |
|---|---|---|---|---|---|---|---|---|
| Hoodie (`as-colour-vintage-hoodie`) | apparel | Gender x2, Color x N, Size x N (URL-only) | 2 | Front, Back | 15 | 7 | 15 / 25 / 50 / 100 / 200 / 300 / 400 | 10-16 d |
| Stanley camp mug (`stanley-camp-mug`) | drinkware | none | 1 | Back | 25 | 5 | 25 / 50 / 100 / 200 / 500 | 8-12 d |
| Merchery notebook (`merchery-notebook`) | office | Color, Paper type | 2 | Front, Back (covers) | unknown | unknown | unknown | 9-14 d |
| Vintage cap (`vintage-cap`) | headwear | Color x7 | **3** | Front, **Side**, Back | 20 | 6 | 20 / 50 / 100 / 200 / 300 / 400 | 10-15 d |
| Merino wool beanie (`merino-wool-beanie`) | headwear | Color x8 | 1 | **Cuff** | 50 | 4 | 50 / 100 / 250 / 500 | **20-25 d** |
| Recycled canvas tote (`recycled-canvas-tote`) | bags | Color x3 | 2 | **Center front**, **Center back** | 15 | 4 | 15 / 50 / 100 / 500 | 6-15 d |
| Sandqvist rolltop (`sandqvist-rolltop`) | bags | none | 1 | **Above brand logo** | 15 | 6 | 15 / **25 / 51 / 101** / 250 / 500 | 12-17 d |
| Patagonia backpack (`patagonia-backpack`) | bags (edge case) | none | **0** | (no tablist) | 15 | 1 | 15 (single tier shown) | not exposed |

### Refined data model implication

The data captured across 8 PDPs lets us harden the round-1 hypotheses:

```ts
type PrintLocation = {
  key: string;          // stable id, e.g. "front" | "side" | "cuff" | "above_brand_logo"
  label: string;        // free-text — Merchery uses "Front", "Side", "Cuff", "Above brand logo", "Center front"
  defaultPosition?: { x: number; y: number; scale: number };
  mockupOverlay?: { box: { x: number; y: number; w: number; h: number }; mode?: "raster" | "engraved" };
};

type Technique = {
  key: string;          // "embroidery" | "screen_printing" | "heat_transfer" | "patch" | "laser_engraving" | "pad_printing" | "woven_patch" | ...
  label: string;
  surcharge?: number;   // per-piece price delta vs. baseline technique
  colorLimit?: number;  // for screen printing etc.
  fabricCompat?: string[]; // optional: which materials this technique can be applied to
};

type QuantityTier = {
  quantity: number;     // arbitrary integer; do NOT assume round numbers (Sandqvist uses 51, 101)
  pricePerPiece: number;
  discountPct?: number; // 0 means show no badge
};

type ProductMeta = {
  print_locations: PrintLocation[];     // length 0..N (Patagonia=0, beanie=1, hoodie/notebook/tote=2, cap=3)
  techniques: Technique[];              // category- AND product-driven; revealed only after upload
  quantity_tiers: QuantityTier[];       // length 1..7+
  moq: number;
  lead_time_days: { min: number; max: number }; // per product, NOT per category
  variant_axes: Array<{ key: string; label: string; widget: "swatch" | "pill" | "select"; required: boolean }>;
};
```

Concrete invariants that fall out of the 8 products:

1. **Print locations are 0..3, not always 2.** UI must:
   - render NO tablist when length === 0 or 1 (Patagonia, mug, beanie, Sandqvist).
   - render a tablist when length >= 2 (hoodie, tote, cap).
   - allow free-text labels (`Cuff`, `Above brand logo`, `Center front`), not a Front/Back enum.
2. **Variant axes are 0..3.** UI must collapse the entire "Pick a product variant" section when length === 0 (Patagonia, Sandqvist, mug). Section numbering must renumber accordingly.
3. **Quantity tiers are arbitrary integer arrays, length 1..7+.** No round-number assumption (51, 101). MOQ is `tiers[0].quantity`. Single-tier products (Patagonia) are valid.
4. **Lead time is per-product, not per-category.** Range observed: 6-15 days (tote) up to 20-25 days (beanie). UX must surface this prominently in the sticky bottom bar.
5. **Techniques are revealed lazily after upload.** This is intentional — Merchery doesn't want to show the technique selector until the design exists. Our implementation can either keep the lazy reveal (matches Merchery) or eagerly show "Available customization techniques" in the product description (better SEO + lower friction). I'd recommend showing them eagerly in a read-only chip row inside the product description, AND interactively after upload in section "3. Select customization technique".
6. **Print location labels carry render-engine semantics.** "Center front" tells the renderer to auto-center the design on the X axis on first drop. "Above brand logo" tells the renderer to anchor the design above an existing artwork mask. We should attach an `anchor` field (`{ horizontalAlign?: "center" | "left" | "right"; verticalAlign?: "top" | "middle" | "bottom"; relativeTo?: string }`) to each PrintLocation to capture this without baking it into the label.
7. **Co-brand products (Patagonia, Sandqvist) are a distinct mode.** Single SKU, single print location (or zero), restricted technique list, premium per-piece pricing (Patagonia: 150 €/piece at MOQ 15). The data model handles them via the same shape — no special-case branch needed — but the UI may want to surface a "Co-branded with Patagonia" badge in the gallery.
