import { model } from "@medusajs/framework/utils"

// Design Area Configuration Model
// This model stores admin-configurable design areas for products
export const DesignArea = model.define("design_area", {
  id: model.id().primaryKey(),
  name: model.text(),
  product_type_id: model.text().nullable(), // Associated product type
  product_id: model.text().nullable(), // Optional specific product override
  variant_id: model.text().nullable(), // Optional specific variant override
  
  // Area configuration
  area_type: model.enum(["front", "back", "sleeve_left", "sleeve_right", "neck", "pocket", "custom"]),
  is_active: model.boolean().default(true),
  sort_order: model.integer().default(0),
  
  // Position and dimensions (normalized 0-1 coordinates)
  position: model.json(), // { x: number, y: number, z?: number }
  dimensions: model.json(), // { width: number, height: number }
  boundaries: model.json(), // { x: number, y: number, w: number, h: number }
  
  // Design constraints
  constraints: model.json(), // { minWidth, minHeight, maxWidth, maxHeight, aspectRatio?, margin, allowRotation, allowResize }
  
  // Print capabilities
  print_methods: model.json(), // ['dtg', 'screen', 'sublimation', 'embroidery']
  techniques: model.json(), // Supported printing techniques
  max_colors: model.integer().nullable(),
  
  // Pricing configuration
  pricing: model.json(), // { basePrice, colorPrice, layerPrice, setupFee, currency }
  
  // Layer support
  layer_support: model.json(), // { maxLayers, supportedTypes, blendModes }
  
  // Validation rules
  validation: model.json(), // { minDPI, recommendedDPI, maxFileSize, supportedFormats, colorModes }
  
  // Mockup configuration
  mockup: model.json(), // { previewScale, overlayUrl?, templateUrl? }
  
  // Metadata for additional configuration
  metadata: model.json().nullable(),
  
  created_at: model.dateTime().default(() => new Date()),
  updated_at: model.dateTime().default(() => new Date()),
})

// Design area groups (for bundled pricing like front+back)
export const DesignAreaGroup = model.define("design_area_group", {
  id: model.id().primaryKey(),
  name: model.text(), // e.g., "Front & Back", "Sleeves"
  description: model.text().nullable(),
  product_type_id: model.text().nullable(),
  
  // Group pricing strategy
  pricing_strategy: model.enum(["single_charge", "per_area", "tiered"]).default("single_charge"),
  group_price: model.bigint().nullable(), // Price in minor units for the entire group
  currency_code: model.text().default("USD"),
  
  // Area IDs included in this group
  design_area_ids: model.json(), // Array of design area IDs
  
  // Group constraints
  max_designs_per_group: model.integer().default(1), // How many designs can be placed per group
  require_all_areas: model.boolean().default(false), // Must use all areas in group
  
  is_active: model.boolean().default(true),
  sort_order: model.integer().default(0),
  
  metadata: model.json().nullable(),
  created_at: model.dateTime().default(() => new Date()),
  updated_at: model.dateTime().default(() => new Date()),
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
  priority: model.integer().default(0),
  
  is_active: model.boolean().default(true),
  
  created_at: model.dateTime().default(() => new Date()),
  updated_at: model.dateTime().default(() => new Date()),
})

export default DesignArea