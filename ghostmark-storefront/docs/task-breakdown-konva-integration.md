
Cross-origin and assets:
- [x] Mockup and uploads use crossOrigin when needed to avoid tainted canvas
- [x] CDN images render and allow exporting previews (subject to CDN CORS policy)

---

10) Acceptance Criteria (DoD)

- Design editor shows mockup, guides, draggable design/text, and uploaded image
- Exporter returns a high-resolution preview and stage JSON reliably
- Finalize action adds line item with metadata.customization in Medusa cart
- App builds without SSR/node-canvas issues; editor is client-only via dynamic import

---

Appendix: Current Repository Mapping (for quick navigation)

- Design page route: src/app/[countryCode]/(design)/design/[productId]/page.tsx
- Design layout (isolated): src/app/[countryCode]/(design)/layout.tsx
- Editor wrapper (SSR disabled, finalize action): src/modules/products/components/design-editor/Wrapper.tsx
- Editor (Konva canvas and interactions): src/modules/products/components/design-editor/index.tsx
- Client cart helper: src/lib/client/add-to-custom-cart.ts
- Custom cart API route: src/app/api/custom-cart/route.ts
- Server cart utility: src/lib/data/cart.ts (addToCustomProductCart)

Pricing fallback:
- [x] If a selected variant lacks calculated_price in the initial product payload, the wrapper fetches fresh pricing via a lightweight API route (/api/variants/[id]?countryCode=XX). While loading, the price shows an ellipsis (…). Errors are displayed non-blockingly.
