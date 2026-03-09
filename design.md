
When a customer saves a design:

Store:

Canvas JSON

Preview image

Product ID

Variant ID

Side (front/back/sleeve)

Print area version

Design version

Increment design version on each save

Lock versions after checkout

7️⃣ Order & Production Safety

Attach design metadata to Medusa line items

Ensure print area version used at design time is immutable

Export print-ready files at 300 DPI

Support PNG and PDF output

🏗️ TECHNICAL CONSTRAINTS

Medusa backend (Node.js)

Medusa Admin (React)

Storefront (Next.js or React)

Fabric.js for canvas rendering

Follow Medusa best practices:

Metadata

Services

Subscribers

📦 DELIVERABLES

Generate:

Backend models & services

Admin UI code (React)

Storefront Fabric.js components

Unit conversion utilities

Versioning logic

Folder structure

Example API calls

Code must be:

Production-ready

Typed (TypeScript)

Modular

Scalable

🚫 DO NOT

Hardcode print areas

Allow POD products without print areas

Allow design edits after payment

✅ EXPECTED OUTPUT

A complete, end-to-end POD customization implementation compatible with Medusa, ready for real-world production and scaling.

Think like a production engineer, not a demo tutorial.

Begin implementation now.
Where print areas are stored and how they are retrieved

Storage (Admin save paths):
- Product metadata under product.metadata.pod.print_areas. This is written by:
  - PATCH /admin/products/:id — accepts { pod: { print_areas, dpi, version? } } or { print_areas } and merges/bumps version automatically.
  - POST /admin/products/:id/design-areas with a body containing { pod } — persists pod.print_areas into product.metadata and bumps version.
- Optional DB model rows in design_area when you create explicit records tied to a product (product_id) or product type (product_type_id). These are not required if you store areas in metadata, but can be used as defaults/templates or overrides.

Structure:
- product.metadata.pod.print_areas is an object keyed by side (e.g., front, back) with cm-based geometry and optional per-area pricing in minor units:
  {
    "pod": {
      "dpi": 300,
      "version": 2,
      "currency": "USD",
      "print_areas": {
        "front": { "x_cm": 5, "y_cm": 7, "width_cm": 28, "height_cm": 36, "dpi": 300, "print_price_minor": 250 },
        "back": { "x_cm": 5, "y_cm": 7, "width_cm": 28, "height_cm": 36 }
      },
      "updated_at": "2026-01-24T00:00:00.000Z"
    }
  }

Retrieval (runtime APIs):
- Storefront GET /store/products/:id/design-areas
  - Preference order:
    1) product.metadata.pod.print_areas (primary source)
    2) DB-backed design_area rows with product_id (fallback)
    3) Product-type default design areas (fallback)
  - Converts print_price_minor → pricing.basePrice (major units) and exposes cm-based boundaries along with validation (dpi) for the designer.

- Admin GET /admin/products/:id/design-areas
  - Same preference order as Storefront. Shows metadata-derived areas immediately after saving.

Debugging:
- GET /admin/products/:id/metadata returns the product metadata (including pod.print_areas) to verify persistence during development.

CMS (Strapi) Integration Notes — 2026-03-08
- The storefront can optionally read content from a Strapi CMS instance. This is kept decoupled from the Medusa backend for now to minimize risk.
- Env vars (ghostmark-storefront/.env.template):
  - STRAPI_URL — base URL, e.g., http://localhost:1337
  - STRAPI_API_TOKEN — optional API token if your Strapi collection types aren’t public
- Full setup guide: see gms_strapi/README.md for step-by-step instructions to install Strapi, create content types, set permissions, configure env vars, allow media domains, and verify the integration end-to-end.
- Client utility: ghostmark-storefront/src/lib/strapi.ts
  - strapiFetch(path) reads the above env vars and gracefully returns an empty list if disabled.
- Implemented CMS-powered pages/sections:
  - Homepage hero (optional): src/app/[countryCode]/(main)/page.tsx fetches api/homepage?populate=heroImage
  - About Us page (single type): src/app/[countryCode]/(main)/about/page.tsx fetches api/about?populate=heroImage
  - Customer Stories list: src/app/[countryCode]/(main)/customer-stories/page.tsx fetches api/customer-stories?populate=cover
  - Customer Story detail: src/app/[countryCode]/(main)/customer-stories/[slug]/page.tsx filters by slug and populates cover
  - Banners on listing pages:
    - All products: src/modules/store/templates/index.tsx — queries api/banners?filters[placement][$eq]=all-products
    - Per-collection: src/modules/collections/templates/index.tsx — queries api/banners?filters[placement][$eq]=collection:{handle}
- Expected Strapi content types (suggested uids/fields):
  - Single type: homepage { title, subtitle, description, primaryCtaLabel, secondaryCtaLabel, heroImage }
  - Single type: about { title, content, heroImage }
  - Collection type: customer-stories { title, excerpt, slug, content, cover, publishedAt }
  - Collection type: banners { title, text, placement, link, backgroundColor, image }
- If Strapi isn’t configured, the pages/components render with safe fallbacks and do not crash.
- Image hosting: If Strapi media comes from another host, add it to Next.js images.remotePatterns in ghostmark-storefront/next.config.js.
- Future work: If desired, wire Medusa workflows/webhooks to sync products or content with Strapi. For now, the CMS is read-only from the storefront.

Gift Card System — 2026-03-08
- Backend: Medusa cart supports applying gift cards using the cart update API with a gift_cards payload. Admin issuance/management can be done via Medusa Admin or API as per your setup.
- Storefront: Added a Gift Card redemption UI that lets shoppers enter a gift card code and remove applied gift cards.
  - Component: ghostmark-storefront/src/modules/checkout/components/gift-card-code
  - Rendered in:
    - Cart summary: ghostmark-storefront/src/modules/cart/templates/summary.tsx
    - Checkout summary: ghostmark-storefront/src/modules/checkout/templates/checkout-summary/index.tsx
  - Totals: Gift-card deductions appear automatically in CartTotals if present on the cart (gift_card_subtotal).
- Usage steps (dev):
  1) Issue a gift card in Medusa Admin (or via API) to obtain a code.
  2) In the Cart or Checkout summary, click “Add Gift Card”, enter the code, and click Apply.
  3) The cart totals update to reflect the gift card deduction; if total becomes 0, checkout can complete without card entry.
  4) Remove an applied gift card via the trash icon next to the code.
- Notes:
  - Storefront calls applyGiftCard/removeGiftCard in src/lib/data/cart.ts, which update the cart via sdk.store.cart.update.
  - If your backend doesn’t accept gift_cards in cart.update, ensure the gift card functionality/module is enabled in your Medusa backend version.
