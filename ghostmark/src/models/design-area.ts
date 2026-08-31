import { model } from "@medusajs/framework/utils"

// =============================================================================
// Design Area Configuration Models
// =============================================================================
//
// !! THESE MODELS ARE NOT LIVE !!
//
// There is no module wrapping them; they are not registered in
// medusa-config.ts, and the `design_area`, `design_area_group` and
// `design_pricing_rule` tables DO NOT EXIST in the database (verified against
// the configured Neon instance). Every `query.graph({ entity: "design_area" })`
// call in this codebase therefore fails. DesignPricingService now raises
// DesignPricingUnavailableError on those paths instead of silently returning an
// empty list and pricing print at zero.
//
// -----------------------------------------------------------------------------
// What registering this would require
// -----------------------------------------------------------------------------
//   1. Create src/modules/design-area/ containing:
//        - models/  (move or re-export the three definitions below)
//        - service.ts  extending MedusaService({ DesignArea, DesignAreaGroup,
//                      DesignPricingRule }) to get generated CRUD methods
//        - index.ts    exporting
//                        export const DESIGN_AREA_MODULE = "design_area"
//                        export default Module(DESIGN_AREA_MODULE, { service })
//   2. Add `{ resolve: "./src/modules/design-area" }` to `modules[]` in
//      medusa-config.ts.
//   3. Generate and apply migrations:
//        npx medusa db:generate design_area
//        npx medusa db:migrate
//
// -----------------------------------------------------------------------------
// What it would cost: READ BEFORE DOING IT
// -----------------------------------------------------------------------------
// DATABASE_URL points at a SHARED REMOTE Neon Postgres holding real orders.
// Step 3 creates three new tables there. The tables are additive (no existing
// table is altered and no row is rewritten), so the blast radius is small, but
// it is a schema change against production data and should be taken as a
// deliberate, backed-up action rather than a side effect of `medusa develop`.
// Until then, leave this unregistered.
//
// -----------------------------------------------------------------------------
// MONEY UNITS: MAJOR UNITS (pounds / dollars), everywhere in these models
// -----------------------------------------------------------------------------
// Every money value below is MAJOR units: £12.50 is 12.5, not 1250.
//
// This is deliberate and it is a CHANGE from the previous comment on
// `group_price`, which said "minor units" while `DesignArea.pricing.basePrice`
// was populated in major units by both consumer routes
// (src/api/store/products/[id]/design-areas/route.ts:185 and
//  src/api/admin/products/[id]/design-areas/route.ts:176, both divide
//  print_price_minor by 100). Mixing the two inside one subtotal made a
// grouped 500 plus an ungrouped 500 add up to 505.
//
// Major units is the right side to land on because:
//   * it matches Medusa v2's documented convention (v2 stores major units;
//     $10.00 is 10, not 1000), and `model.bigNumber()` is v2's money type;
//   * it matches what the two existing consumer routes already emit;
//   * these tables contain ZERO rows, so fixing the convention costs nothing
//     today and would cost a data migration later.
//
// The one place minor units survive is
// `product.metadata.pod.print_areas[side].print_price_minor`, whose `_minor`
// suffix is its contract. DesignPricingService converts it exactly once.
//
// Be careful: this project's `price` table stores MINOR units, contrary to
// Medusa v2's convention, so an un-annotated number really is ambiguous here,
// a 100x defect has already shipped once (src/scripts/fix-gift-card-prices.ts).
// Annotate every money field you add.
//
// -----------------------------------------------------------------------------
// AREA KEY NAMESPACES: two spellings, both correct, do not "unify" them
// -----------------------------------------------------------------------------
//   * design_area.area_type enum below   -> sleeve_left / sleeve_right
//     (also validated by src/api/admin/design-areas/route.ts:97 and
//      src/api/admin/design-areas/[id]/route.ts:49)
//   * product.metadata.pod.print_areas keys -> left_sleeve / right_sleeve
//     (written by src/admin/routes/design/pod/page.tsx, read by the upload
//      pipeline and src/utils/units.ts)
// DesignPricingService normalises inbound submissions across both.
// =============================================================================

// Design Area Configuration Model
// This model stores admin-configurable design areas for products
export const DesignArea = model.define("design_area", {
  id: model.id().primaryKey(),
  name: model.text(),
  product_type_id: model.text().nullable(), // Associated product type
  product_id: model.text().nullable(), // Optional specific product override
  variant_id: model.text().nullable(), // Optional specific variant override
  
  // Area configuration
  // NOTE the spelling: sleeve_left / sleeve_right. The print_areas metadata
  // namespace uses left_sleeve / right_sleeve. See the header.
  area_type: model.enum(["front", "back", "sleeve_left", "sleeve_right", "neck", "pocket", "custom"]),
  is_active: model.boolean().default(true),
  sort_order: model.number().default(0),
  
  // Position and dimensions (normalized 0-1 coordinates)
  position: model.json(), // { x: number, y: number, z?: number }
  dimensions: model.json(), // { width: number, height: number }
  boundaries: model.json(), // { x: number, y: number, w: number, h: number }
  
  // Design constraints
  constraints: model.json(), // { minWidth, minHeight, maxWidth, maxHeight, aspectRatio?, margin, allowRotation, allowResize }
  
  // Print capabilities
  print_methods: model.json(), // ['dtg', 'screen', 'sublimation', 'embroidery']
  techniques: model.json(), // Supported printing techniques
  max_colors: model.number().nullable(),
  
  // Pricing configuration.
  // MAJOR UNITS. { basePrice, colorPrice, layerPrice, setupFee, currency }
  //   basePrice:  per garment, per area
  //   colorPrice: per garment, per verified print colour
  //   layerPrice: per garment, per layer beyond the first
  //   setupFee:   ONCE per order, NOT multiplied by quantity
  //   currency:   3-letter ISO 4217, upper case
  pricing: model.json(),
  
  // Layer support
  layer_support: model.json(), // { maxLayers, supportedTypes, blendModes }
  
  // Validation rules
  validation: model.json(), // { minDPI, recommendedDPI, maxFileSize, supportedFormats, colorModes }
  
  // Mockup configuration
  mockup: model.json(), // { previewScale, overlayUrl?, templateUrl? }
  
  // Metadata for additional configuration
  metadata: model.json().nullable(),
  
  created_at: model.dateTime().default(new Date()),
  updated_at: model.dateTime().default(new Date()),
})

// Design area groups (for bundled pricing like front+back)
export const DesignAreaGroup = model.define("design_area_group", {
  id: model.id().primaryKey(),
  name: model.text(), // e.g., "Front & Back", "Sleeves"
  description: model.text().nullable(),
  product_type_id: model.text().nullable(),
  
  // Group pricing strategy
  pricing_strategy: model.enum(["single_charge", "per_area", "tiered"]).default("single_charge"),
  // MAJOR UNITS, per garment, for the whole group (£5.00 is 5, not 500).
  // CHANGED from minor units, see the MONEY UNITS block in the header.
  // Zero is a legitimate value meaning "free bundle": consumers must test
  // `group_price != null`, never truthiness.
  group_price: model.bigNumber().nullable(),
  currency_code: model.text().default("USD"),
  
  // Area IDs included in this group
  design_area_ids: model.json(), // Array of design area IDs
  
  // Group constraints
  // Both are honoured by DesignPricingService.calculateTierMultiplier:
  //   max_designs_per_group: exceeding it is a validation error, not a deeper
  //                           discount
  //   require_all_areas:     no tier discount until the whole group is used
  max_designs_per_group: model.number().default(1),
  require_all_areas: model.boolean().default(false),
  
  is_active: model.boolean().default(true),
  sort_order: model.number().default(0),

  // Optional shape consumed when pricing_strategy = "tiered":
  //   { tiers: [{ minDesigns: number, multiplier: number }, ...] }
  // Highest matching minDesigns wins; multiplier is clamped to [0, 1]. When
  // absent, the documented default ladder applies (>=4 -> 0.7, >=2 -> 0.85).
  metadata: model.json().nullable(),
  created_at: model.dateTime().default(new Date()),
  updated_at: model.dateTime().default(new Date()),
})

// Design pricing rules (for complex pricing logic)
export const DesignPricingRule = model.define("design_pricing_rule", {
  id: model.id().primaryKey(),
  name: model.text(),
  product_type_id: model.text().nullable(),
  
  // Rule conditions
  conditions: model.json(), // { minQuantity?, maxQuantity?, areaTypes?, printMethods? }
  
  // Pricing modifiers
  pricing_modifiers: model.json(), // { basePriceMultiplier?, colorPriceOverride?, setupFeeOverride? }
  
  // Rule priority (higher number = higher priority)
  priority: model.number().default(0),
  
  is_active: model.boolean().default(true),
  
  created_at: model.dateTime().default(new Date()),
  updated_at: model.dateTime().default(new Date()),
})

export default DesignArea