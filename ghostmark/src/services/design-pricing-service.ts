import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

// =============================================================================
// DesignPricingService: POD print surcharge engine
// =============================================================================
//
// STATUS: NOT WIRED INTO CHECKOUT. Nothing on the live cart/checkout path calls
// this service. POD customers are currently charged the plain garment price.
// This file is the *correct computation*, staged and ready; connecting it to
// the cart is a separate, deliberate change that requires a product decision on
// what print should cost. Do not wire it up incidentally.
//
// -----------------------------------------------------------------------------
// MONEY UNITS: read this before touching any arithmetic
// -----------------------------------------------------------------------------
// This service computes in MAJOR units (pounds / dollars) end to end. Every
// value that crosses this file's boundary in or out is major units.
//
// Conversions happen exactly once, at the edge where a minor-unit source is
// read:
//   * product.metadata.pod.print_areas[side].print_price_minor  -> MINOR.
//     Converted by minorToMajor() in podPrintPriceMajor(). The `_minor` suffix
//     is the contract; honour it.
//   * design_area.pricing.{basePrice,colorPrice,layerPrice,setupFee} -> MAJOR.
//     This matches the two routes that already synthesise this shape:
//       src/api/store/products/[id]/design-areas/route.ts:185
//       src/api/admin/products/[id]/design-areas/route.ts:176
//     both of which do `print_price_minor / 100` to produce basePrice.
//   * design_area_group.group_price -> MAJOR. See the note in
//     src/models/design-area.ts; this was previously commented as minor units
//     and divided by 100 here, which mixed units inside a single subtotal.
//
// Note the wider hazard: this project's *persistence* layer (the `price` table)
// stores minor units, which is a deviation from Medusa v2's documented
// major-unit convention. Because the two disagree, an un-annotated number is
// genuinely ambiguous in this codebase and a 100x defect has already shipped
// once here (see src/scripts/fix-gift-card-prices.ts). Annotate every money
// value you add.
//
// -----------------------------------------------------------------------------
// AREA KEY NAMESPACES: there are two, and they are both correct
// -----------------------------------------------------------------------------
// Do not "unify" these; they name different things and each has its own writers.
//
//   1. PRINT-AREA METADATA KEY: `left_sleeve` / `right_sleeve`
//      Keys of product.metadata.pod.print_areas. Written by the admin POD
//      editor (src/admin/routes/design/pod/page.tsx:20-21,56-57), read by the
//      store/admin design-areas routes and by the upload pipeline
//      (src/api/store/designs/route.ts:9, src/utils/units.ts:23).
//
//   2. DESIGN AREA ROW ENUM: `sleeve_left` / `sleeve_right`
//      The design_area.area_type enum (src/models/design-area.ts:13), validated
//      on write by src/api/admin/design-areas/route.ts:97 and
//      src/api/admin/design-areas/[id]/route.ts:49.
//
// A DesignSubmission.areaType is a free-form string fed from both worlds, so
// this service normalises at the boundary via canonicalAreaKey() /
// canonicalAreaType() rather than assuming a spelling. Before normalisation, a
// submission carrying the enum spelling `sleeve_left` missed both the
// print_areas lookup and the sleeve-pair grouping filter, and silently priced
// at zero.
// =============================================================================

/** Errors that mean "we cannot price this", never "this costs nothing". */
export class DesignPricingError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message)
    this.name = "DesignPricingError"
  }
}

/**
 * Thrown when the design-area module is not available (not registered, tables
 * absent). Callers should surface 503, NEVER a zero-priced quote.
 */
export class DesignPricingUnavailableError extends DesignPricingError {
  readonly statusCode = 503
  constructor(message: string, cause?: unknown) {
    super(message, cause)
    this.name = "DesignPricingUnavailableError"
  }
}

interface DesignArea {
  id: string
  /** design_area.area_type enum spelling, sleeve_left / sleeve_right. */
  area_type:
    | "front"
    | "back"
    | "sleeve_left"
    | "sleeve_right"
    | "neck"
    | "pocket"
    | "custom"
  /** MAJOR units. See the MONEY UNITS block above. */
  pricing: {
    basePrice: number
    colorPrice: number
    layerPrice: number
    setupFee: number
    currency: string
  }
  [key: string]: any
}

interface DesignAreaGroup {
  id: string
  name: string
  pricing_strategy: "single_charge" | "per_area" | "tiered"
  /** MAJOR units. Nullable; 0 is a legitimate value meaning "free bundle". */
  group_price: number | null
  currency_code: string
  design_area_ids: string[]
  max_designs_per_group: number
  require_all_areas: boolean
  metadata?: { tiers?: Array<{ minDesigns: number; multiplier: number }> } | null
}

/**
 * Image metadata used for quality-based price adjustment.
 *
 * SECURITY: `verified` gates every multiplier. It may only be set by
 * server-side image analysis. Request handlers MUST NOT copy it from a request
 * body, see the sanitisation in api/store/design-quote/route.ts. Without it,
 * a caller claiming {dpi:400, qualityScore:95, isPrintReady:true} for a 72-DPI
 * JPEG bought itself a 23% discount, and the inverted claim stacked to 2.4675x
 * on base price and 4.259x on setup fee.
 */
interface ImageMetadata {
  dpi: number
  qualityScore: number
  isPrintReady: boolean
  suggestedUse: string
  width: number
  height: number
  fileSize?: number
  format?: string
  /** True only when produced by trusted server-side analysis. */
  verified?: boolean
}

interface DesignSubmission {
  areaId: string
  areaType: string
  layers: number
  /**
   * Number of distinct print colours. Only ever a server-verified count.
   * 0 / undefined means "unknown" and attracts NO colour charge, inventing a
   * count would invent a charge.
   */
  colors?: number
  printMethod?: string
  fileUrl?: string
  /** print_areas key spelling, left_sleeve / right_sleeve. */
  fileType?:
    | "default"
    | "front"
    | "back"
    | "left_sleeve"
    | "right_sleeve"
    | "neck"
    | "pocket"
  imageMetadata?: ImageMetadata
}

interface AreaBreakdownEntry {
  areaId: string
  areaType: string
  groupName?: string
  /** All MAJOR units, quantity-inclusive. */
  basePrice: number
  colorPrice: number
  layerPrice: number
  setupFee: number
  subtotal: number
  isGroupCharge: boolean
  groupId?: string
  qualityAdjustment?: { multiplier: number; reason: string }
}

interface PricingCalculation {
  areaBreakdown: AreaBreakdownEntry[]
  groupCharges: Array<{
    groupId: string
    groupName: string
    price: number
    areasIncluded: string[]
    currency: string
  }>
  /** All MAJOR units. `subtotal` EXCLUDES setup fees; total = subtotal + setupFees. */
  totals: {
    subtotal: number
    setupFees: number
    total: number
    currency: string
    savings?: number
  }
  /** Which price source produced this result, useful when reconciling. */
  source: "pod_metadata" | "design_area_module"
}

const DEFAULT_CURRENCY = "USD"

/** Round a money value to 2dp, once, at an output boundary. */
const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100

/** The single place minor-unit sources become major units. */
const minorToMajor = (minor: number): number => minor / 100

/** Aliases collapsed onto the print_areas metadata key spelling. */
const AREA_KEY_ALIASES: Record<string, string> = {
  default: "front",
  sleeve_left: "left_sleeve",
  sleeve_right: "right_sleeve",
  left_sleeve: "left_sleeve",
  right_sleeve: "right_sleeve",
}

/** Normalise any inbound area spelling to the print_areas key namespace. */
const canonicalAreaKey = (raw: string | undefined | null): string => {
  const key = String(raw ?? "").trim().toLowerCase()
  if (!key) return "front"
  return AREA_KEY_ALIASES[key] ?? key
}

/** Currency codes are 3 ASCII letters, upper-cased. Anything else is rejected. */
const normalizeCurrency = (raw: unknown, fallback: string): string => {
  if (typeof raw !== "string") return fallback
  const trimmed = raw.trim()
  if (!/^[A-Za-z]{3}$/.test(trimmed)) {
    throw new DesignPricingError(
      `Invalid currency code ${JSON.stringify(raw)}; expected a 3-letter ISO 4217 code`
    )
  }
  return trimmed.toUpperCase()
}

/**
 * Heuristic for "the design-area module is not registered / its tables do not
 * exist". Medusa surfaces this as an unknown-entity or missing-relation error
 * rather than a typed exception, so message matching is the available signal.
 */
const looksLikeMissingModule = (error: unknown): boolean => {
  const message = String((error as any)?.message ?? error ?? "").toLowerCase()
  return (
    message.includes("design_area") ||
    message.includes("does not exist") ||
    message.includes("not found") ||
    message.includes("could not find") ||
    message.includes("unknown entity") ||
    message.includes("no such table") ||
    message.includes("relation")
  )
}

export class DesignPricingService {
  private query: any
  private logger: { info: Function; warn: Function; error: Function }

  constructor(container: any) {
    this.query = container.resolve(ContainerRegistrationKeys.QUERY)
    // The container always has a logger in a running Medusa app; fall back to
    // console so unit-testing this class does not require a full container.
    try {
      this.logger = container.resolve(ContainerRegistrationKeys.LOGGER)
    } catch {
      this.logger = console
    }
  }

  /**
   * Compute the print surcharge for a set of design submissions.
   *
   * Throws rather than returning a zero total. A pricing engine that silently
   * returns 0 is worse than one that throws: the bare catches this replaces are
   * precisely why a completely dead engine survived unnoticed.
   */
  async calculatePricing(
    productTypeId: string,
    designs: DesignSubmission[],
    quantity: number = 1,
    options?: {
      currency?: string
      urgent?: boolean
      shipmentMethod?: string
    },
    productId?: string
  ): Promise<PricingCalculation> {
    if (!Number.isFinite(quantity) || quantity < 1) {
      throw new DesignPricingError(
        `quantity must be a finite number >= 1, received ${JSON.stringify(quantity)}`
      )
    }
    if (!Array.isArray(designs) || designs.length === 0) {
      throw new DesignPricingError("designs must be a non-empty array")
    }

    // Source 1: per-product POD metadata. Returns null (not an error) when the
    // product simply has no POD pricing metadata, which is the normal case.
    if (productId) {
      const metaPricing = await this.calculatePodMetadataPricing(
        productId,
        designs,
        quantity,
        options
      )
      if (metaPricing) return metaPricing
    }

    // Source 2: the design-area module. Currently unregistered, these calls
    // will raise DesignPricingUnavailableError until it is registered.
    const [designAreas, designAreaGroups] = await Promise.all([
      this.fetchDesignAreas(productTypeId),
      this.fetchDesignAreaGroups(productTypeId),
    ])

    const areaMap = new Map<string, DesignArea>()
    designAreas.forEach((area) => areaMap.set(area.id, area))

    // Every submission must resolve to a known area, or we are about to price
    // an order at less than it costs. Fail instead.
    const unresolved = designs.filter((d) => !areaMap.has(d.areaId))
    if (unresolved.length > 0) {
      throw new DesignPricingError(
        `No active design_area found for area id(s): ${unresolved
          .map((d) => d.areaId)
          .join(", ")} (product_type_id=${productTypeId}). Refusing to price ` +
          `an unknown print area at zero.`
      )
    }

    const currency = normalizeCurrency(
      options?.currency,
      designAreas[0]?.pricing?.currency ?? DEFAULT_CURRENCY
    )

    const groupedAreas = this.groupDesignsByPricingGroups(designs, designAreaGroups)

    return this.calculateGroupedPricing(
      groupedAreas,
      designAreaGroups,
      areaMap,
      quantity,
      currency
    )
  }

  // ---------------------------------------------------------------------------
  // Source 1: product.metadata.pod.print_areas
  // ---------------------------------------------------------------------------
  private async calculatePodMetadataPricing(
    productId: string,
    designs: DesignSubmission[],
    quantity: number,
    options?: { currency?: string }
  ): Promise<PricingCalculation | null> {
    let products: any[]
    try {
      // query.graph resolves to `{ data, metadata }`, a plain object, not an
      // array and not a chainable builder. The previous
      // `const [products] = await this.query.graph(...)` array-destructured a
      // non-iterable and threw TypeError on the first statement of this
      // method, on 100% of invocations. `fields` is required.
      const { data } = await this.query.graph({
        entity: "product",
        filters: { id: productId },
        fields: ["id", "metadata"],
      })
      products = data ?? []
    } catch (error) {
      // A product lookup failure is infrastructure, not "this product is free".
      this.logger.error(
        `[design-pricing] product lookup failed for product_id=${productId}: ${
          (error as any)?.message ?? error
        }`
      )
      throw new DesignPricingError(
        `Failed to load product ${productId} for POD pricing`,
        error
      )
    }

    if (products.length === 0) {
      throw new DesignPricingError(`Product ${productId} not found`)
    }

    const product = products[0] as any
    const pod = product?.metadata?.pod ?? null
    const printAreas = pod?.print_areas ?? null

    // Genuine "no POD pricing configured on this product", the caller falls
    // through to the design-area module. This is the only legitimate null.
    if (!pod || !printAreas || typeof printAreas !== "object") {
      this.logger.info(
        `[design-pricing] product_id=${productId} has no metadata.pod.print_areas; ` +
          `falling through to the design-area module`
      )
      return null
    }

    const currency = normalizeCurrency(
      options?.currency ?? pod.currency,
      DEFAULT_CURRENCY
    )

    /** Per-side print price in MAJOR units. */
    const podPrintPriceMajor = (side: string): number => {
      const area = (printAreas as any)[side] ?? {}
      const byCurrency = area?.print_price_minor_by_currency
      let minor: number | undefined

      if (byCurrency && typeof byCurrency === "object") {
        // Currency keys in metadata are written upper-case by the admin editor,
        // but accept either casing rather than silently pricing at zero.
        const match =
          byCurrency[currency] ??
          byCurrency[currency.toLowerCase()] ??
          byCurrency[currency.toUpperCase()]
        if (typeof match === "number") minor = match
      }
      if (minor == null && typeof area?.print_price_minor === "number") {
        minor = area.print_price_minor
      }
      if (minor == null) {
        this.logger.warn(
          `[design-pricing] product_id=${productId} print_areas.${side} has no ` +
            `print_price_minor for ${currency}; charging 0 for this area`
        )
        return 0
      }
      return minorToMajor(Math.max(0, Number(minor)))
    }

    const selectedTypes = designs.map((d) =>
      canonicalAreaKey(d.areaType || d.fileType)
    )

    // Grouping rules:
    //  - front/back charged once at max(front, back) if either is selected
    //  - sleeves charged once at max(left, right) if either is selected
    //  - everything else charged per selection at its own price
    const frontMajor = podPrintPriceMajor("front")
    const backMajor = podPrintPriceMajor("back")
    const leftMajor = podPrintPriceMajor("left_sleeve")
    const rightMajor = podPrintPriceMajor("right_sleeve")

    const PAIRED = new Set(["front", "back", "left_sleeve", "right_sleeve"])
    const frontBackSelected = selectedTypes.some((t) => t === "front" || t === "back")
    const sleevesSelected = selectedTypes.some(
      (t) => t === "left_sleeve" || t === "right_sleeve"
    )
    const otherTypes = selectedTypes.filter((t) => !PAIRED.has(t))

    let subtotal = 0
    const areaBreakdown: AreaBreakdownEntry[] = []

    const pushGroup = (
      areaId: string,
      areaType: string,
      groupName: string,
      groupId: string,
      unitMajor: number
    ) => {
      const line = unitMajor * quantity
      subtotal += line
      areaBreakdown.push({
        areaId,
        areaType,
        groupName,
        basePrice: round2(line),
        colorPrice: 0,
        layerPrice: 0,
        setupFee: 0,
        subtotal: round2(line),
        isGroupCharge: true,
        groupId,
      })
    }

    if (frontBackSelected) {
      pushGroup(
        "group_front_back",
        "front_back",
        "Front/Back",
        "front_back",
        Math.max(frontMajor, backMajor)
      )
    }
    if (sleevesSelected) {
      pushGroup(
        "group_sleeves",
        "sleeves",
        "Sleeves",
        "sleeves",
        Math.max(leftMajor, rightMajor)
      )
    }

    otherTypes.forEach((t, idx) => {
      const line = podPrintPriceMajor(t) * quantity
      subtotal += line
      areaBreakdown.push({
        areaId: `${t}_${idx}`,
        areaType: t,
        basePrice: round2(line),
        colorPrice: 0,
        layerPrice: 0,
        setupFee: 0,
        subtotal: round2(line),
        isGroupCharge: false,
      })
    })

    return {
      areaBreakdown,
      groupCharges: [],
      totals: {
        subtotal: round2(subtotal),
        setupFees: 0,
        total: round2(subtotal),
        currency,
      },
      source: "pod_metadata",
    }
  }

  // ---------------------------------------------------------------------------
  // Source 2: the design-area module
  // ---------------------------------------------------------------------------

  /**
   * NOTE: the design_area / design_area_group / design_pricing_rule tables do
   * not exist and the module is not registered in medusa-config.ts. Every call
   * here currently raises DesignPricingUnavailableError. See the header of
   * src/models/design-area.ts for what registering it would require and cost.
   */
  private async fetchDesignAreas(productTypeId: string): Promise<DesignArea[]> {
    return this.graphList<DesignArea>("design_area", {
      product_type_id: productTypeId,
      is_active: true,
    })
  }

  private async fetchDesignAreaGroups(
    productTypeId: string
  ): Promise<DesignAreaGroup[]> {
    const groups = await this.graphList<DesignAreaGroup>("design_area_group", {
      product_type_id: productTypeId,
      is_active: true,
    })
    // design_area_ids is a json column; a malformed row must not silently
    // un-group (and therefore over-charge) an order.
    return groups.map((g) => ({
      ...g,
      design_area_ids: Array.isArray(g.design_area_ids) ? g.design_area_ids : [],
    }))
  }

  /**
   * Single correct query.graph call site.
   *
   * `await this.query.graph({...}).find()` invoked .find() on the *Promise*
   * (member access binds tighter than await), so it threw TypeError every time.
   * query.graph has no .find()/.create(), it resolves to `{ data, metadata }`.
   */
  private async graphList<T>(
    entity: string,
    filters: Record<string, unknown>
  ): Promise<T[]> {
    try {
      const { data } = await this.query.graph({
        entity,
        fields: ["*"],
        filters,
        pagination: { order: { sort_order: "ASC" } },
      })
      return (data ?? []) as T[]
    } catch (error) {
      const message = (error as any)?.message ?? String(error)
      if (looksLikeMissingModule(error)) {
        // Degrade honestly: this is "we cannot price", not "print is free".
        this.logger.error(
          `[design-pricing] entity "${entity}" is unavailable, the design-area ` +
            `module is not registered in medusa-config.ts and its tables do not ` +
            `exist. Filters=${JSON.stringify(filters)}. Underlying error: ${message}`
        )
        throw new DesignPricingUnavailableError(
          `Design pricing is unavailable: the "${entity}" module is not registered. ` +
            `No print surcharge can be computed for this product type.`,
          error
        )
      }
      this.logger.error(
        `[design-pricing] query.graph failed for entity="${entity}" ` +
          `filters=${JSON.stringify(filters)}: ${message}`
      )
      throw new DesignPricingError(`Failed to query ${entity}`, error)
    }
  }

  private groupDesignsByPricingGroups(
    designs: DesignSubmission[],
    groups: DesignAreaGroup[]
  ) {
    const result = {
      groupedDesigns: new Map<string, DesignSubmission[]>(),
      ungroupedDesigns: [] as DesignSubmission[],
    }

    const areaToGroupMap = new Map<string, string>()
    groups.forEach((group) => {
      group.design_area_ids.forEach((areaId) => areaToGroupMap.set(areaId, group.id))
    })

    designs.forEach((design) => {
      const groupId = areaToGroupMap.get(design.areaId)
      if (groupId) {
        if (!result.groupedDesigns.has(groupId)) {
          result.groupedDesigns.set(groupId, [])
        }
        result.groupedDesigns.get(groupId)!.push(design)
      } else {
        result.ungroupedDesigns.push(design)
      }
    })

    return result
  }

  private calculateGroupedPricing(
    groupedAreas: {
      groupedDesigns: Map<string, DesignSubmission[]>
      ungroupedDesigns: DesignSubmission[]
    },
    groups: DesignAreaGroup[],
    areaMap: Map<string, DesignArea>,
    quantity: number,
    currency: string
  ): PricingCalculation {
    const areaBreakdown: AreaBreakdownEntry[] = []
    const groupCharges: PricingCalculation["groupCharges"] = []
    let subtotal = 0
    let setupFees = 0
    let savings = 0

    const pushPriced = (
      design: DesignSubmission,
      area: DesignArea,
      tierMultiplier: number,
      group?: DesignAreaGroup
    ) => {
      const pricing = this.calculateIndividualAreaPrice(
        design,
        area,
        quantity,
        tierMultiplier
      )
      areaBreakdown.push({
        areaId: design.areaId,
        areaType: canonicalAreaType(design.areaType, area),
        groupName: group?.name,
        groupId: group?.id,
        basePrice: round2(pricing.basePrice),
        colorPrice: round2(pricing.colorPrice),
        layerPrice: round2(pricing.layerPrice),
        setupFee: round2(pricing.setupFee),
        // subtotal is the LINE subtotal and EXCLUDES setupFee. Setup fees are
        // accumulated separately and added once, in totals. Returning
        // `subtotal + setupFee` here while the caller also accumulated
        // setupFee is what double-counted every setup fee (setupFee 15,
        // basePrice 10, qty 25 produced 280 instead of 265).
        subtotal: round2(pricing.subtotal),
        isGroupCharge: false,
        qualityAdjustment: pricing.qualityAdjustment,
      })
      subtotal += pricing.subtotal
      setupFees += pricing.setupFee
      return pricing
    }

    groupedAreas.groupedDesigns.forEach((designs, groupId) => {
      const group = groups.find((g) => g.id === groupId)
      if (!group) {
        throw new DesignPricingError(
          `Design(s) mapped to unknown group ${groupId}; refusing to price`
        )
      }

      // `group.group_price` of 0 is a legitimate free bundle. The previous
      // truthiness test (`&& group.group_price`) sent it down the tiered branch
      // and charged for it.
      if (group.pricing_strategy === "single_charge" && group.group_price != null) {
        // MAJOR units, no /100. See the MONEY UNITS block.
        const groupLine = Number(group.group_price) * quantity
        const groupCurrency = normalizeCurrency(group.currency_code, currency)
        if (groupCurrency !== currency) {
          throw new DesignPricingError(
            `Group ${group.id} is priced in ${groupCurrency} but the quote is in ` +
              `${currency}; refusing to add mismatched currencies`
          )
        }

        groupCharges.push({
          groupId: group.id,
          groupName: group.name,
          price: round2(groupLine),
          areasIncluded: designs.map((d) => d.areaId),
          currency: groupCurrency,
        })

        // Per-area transparency rows, plus the counterfactual used for savings.
        let counterfactual = 0
        designs.forEach((design) => {
          const area = areaMap.get(design.areaId)!
          const individual = this.calculateIndividualAreaPrice(design, area, quantity)
          counterfactual += individual.subtotal + individual.setupFee

          areaBreakdown.push({
            areaId: design.areaId,
            areaType: canonicalAreaType(design.areaType, area),
            groupName: group.name,
            groupId: group.id,
            basePrice: 0,
            colorPrice: 0,
            layerPrice: 0,
            setupFee: 0,
            subtotal: 0,
            isGroupCharge: true,
          })
        })

        subtotal += groupLine
        // Savings are per-group: what these areas would have cost individually
        // minus what the bundle actually charges. Comparing the counterfactual
        // against the whole-order total (the old `potentialSavings > actualTotal`
        // test) reported 0 savings whenever other ungrouped areas were present.
        if (counterfactual > groupLine) savings += counterfactual - groupLine
        return
      }

      if (group.pricing_strategy === "per_area") {
        designs.forEach((design) =>
          pushPriced(design, areaMap.get(design.areaId)!, 1, group)
        )
        return
      }

      // Tiered
      const tierMultiplier = this.calculateTierMultiplier(designs.length, group)
      designs.forEach((design) => {
        const area = areaMap.get(design.areaId)!
        const undiscounted = this.calculateIndividualAreaPrice(design, area, quantity)
        const priced = pushPriced(design, area, tierMultiplier, group)
        const delta =
          undiscounted.subtotal + undiscounted.setupFee - (priced.subtotal + priced.setupFee)
        if (delta > 0) savings += delta
      })
    })

    groupedAreas.ungroupedDesigns.forEach((design) =>
      pushPriced(design, areaMap.get(design.areaId)!, 1)
    )

    const total = subtotal + setupFees

    return {
      areaBreakdown,
      groupCharges,
      totals: {
        subtotal: round2(subtotal),
        setupFees: round2(setupFees),
        total: round2(total),
        currency,
        savings: savings > 0 ? round2(savings) : undefined,
      },
      source: "design_area_module",
    }
  }

  /**
   * Price one design on one area.
   *
   * Returns MAJOR units, quantity-inclusive, with `subtotal` EXCLUDING
   * `setupFee`. Callers add the two exactly once.
   */
  private calculateIndividualAreaPrice(
    design: DesignSubmission,
    area: DesignArea,
    quantity: number,
    tierMultiplier: number = 1
  ): {
    basePrice: number
    colorPrice: number
    layerPrice: number
    setupFee: number
    subtotal: number
    qualityAdjustment?: { multiplier: number; reason: string }
  } {
    const pricing = area.pricing ?? ({} as DesignArea["pricing"])

    const base = Number(pricing.basePrice ?? 0) * tierMultiplier
    // colors is a verified count or nothing. An unknown count charges nothing
    // rather than charging for a fabricated one.
    const colorCount = Number.isFinite(design.colors) ? Math.max(0, design.colors!) : 0
    const color = Number(pricing.colorPrice ?? 0) * colorCount * tierMultiplier
    const layerCount = Math.max(0, Number(design.layers ?? 1) - 1)
    const layer = Number(pricing.layerPrice ?? 0) * layerCount * tierMultiplier

    let setupFee = Number(pricing.setupFee ?? 0)

    const { multiplier: qualityMultiplier, reason } = this.qualityAdjustment(
      design.imageMetadata
    )
    // Setup-fee surcharges ride the same verified gate as the base multiplier.
    if (qualityMultiplier > 1) {
      setupFee = setupFee * qualityMultiplier
    }

    const unit = (base + color + layer) * qualityMultiplier
    const subtotal = unit * quantity

    return {
      basePrice: base * qualityMultiplier * quantity,
      colorPrice: color * qualityMultiplier * quantity,
      layerPrice: layer * qualityMultiplier * quantity,
      setupFee,
      subtotal,
      qualityAdjustment:
        qualityMultiplier !== 1 ? { multiplier: qualityMultiplier, reason } : undefined,
    }
  }

  /**
   * Quality-based price adjustment.
   *
   * Applies ONLY to server-verified image metadata. Unverified metadata yields
   * a neutral 1.0 in both directions: an unverified discount is a self-service
   * price cut, and an unverified surcharge is an overcharge on an unproven
   * claim. Neither is defensible, so neither is applied.
   *
   * Multipliers are also clamped, so a future combination of rules can never
   * again compound into a 2.47x base / 4.26x setup-fee stack unnoticed.
   */
  private qualityAdjustment(metadata?: ImageMetadata): {
    multiplier: number
    reason: string
  } {
    if (!metadata) return { multiplier: 1, reason: "No image metadata" }
    if (metadata.verified !== true) {
      return {
        multiplier: 1,
        reason:
          "Image metadata not server-verified, no quality adjustment applied",
      }
    }

    const { dpi, qualityScore, isPrintReady, suggestedUse, fileSize, format } = metadata
    let multiplier = 1
    const reasons: string[] = []

    if (Number.isFinite(dpi) && dpi < 150) {
      multiplier *= 1.2
      reasons.push("low DPI: additional processing required")
    }
    if (typeof fileSize === "number" && fileSize > 50 * 1024 * 1024) {
      multiplier *= 1.1
      reasons.push("large file: additional processing")
    }
    if (format) {
      const f = format.toUpperCase()
      if (f === "SVG") {
        multiplier *= 0.9
        reasons.push("vector source")
      } else if (f === "PDF") {
        multiplier *= 0.95
        reasons.push("PDF source")
      } else if (["WEBP", "GIF"].includes(f)) {
        multiplier *= 1.15
        reasons.push("non-standard format")
      }
    }
    if (Number.isFinite(qualityScore)) {
      if (qualityScore < 40) {
        multiplier *= 1.25
        reasons.push("poor image quality: enhancement needed")
      } else if (qualityScore >= 80 && isPrintReady) {
        multiplier *= 0.95
        reasons.push("print-ready: quality discount")
      }
    }
    switch (suggestedUse) {
      case "commercial-print":
        multiplier *= 0.9
        reasons.push("commercial-ready")
        break
      case "web-only":
        multiplier *= 1.3
        reasons.push("web-only quality: print optimisation required")
        break
      case "small-print":
        multiplier *= 1.1
        reasons.push("small-print source")
        break
    }

    // Hard bounds. Any single order's quality adjustment stays within
    // -25%..+50% no matter how the rules combine.
    const clamped = Math.min(1.5, Math.max(0.75, multiplier))
    if (clamped !== multiplier) {
      reasons.push(`clamped from ${round2(multiplier)}x`)
    }

    return {
      multiplier: clamped,
      reason: reasons.length ? reasons.join("; ") : "Quality-based adjustment",
    }
  }

  /**
   * Tier multiplier for a `tiered` group.
   *
   * This previously ignored its `group` argument entirely and hardcoded
   * 0.7/0.85/1.0, which made max_designs_per_group, require_all_areas and every
   * other group setting inert. It now reads the ladder from
   * `group.metadata.tiers` when configured, and honours the two structural
   * constraints on the model.
   */
  private calculateTierMultiplier(designCount: number, group: DesignAreaGroup): number {
    const groupSize = group.design_area_ids.length

    // A group that must be used in full earns no discount until it is.
    if (group.require_all_areas && groupSize > 0 && designCount < groupSize) {
      return 1.0
    }

    // Exceeding the configured cap is a configuration/validation failure, not
    // an opportunity for a deeper discount.
    const cap = Number(group.max_designs_per_group ?? 0)
    if (cap > 0 && designCount > cap) {
      throw new DesignPricingError(
        `Group ${group.id} ("${group.name}") allows at most ${cap} design(s) but ` +
          `${designCount} were submitted`
      )
    }

    const configured = group.metadata?.tiers
    if (Array.isArray(configured) && configured.length > 0) {
      const applicable = configured
        .filter(
          (t) =>
            Number.isFinite(t?.minDesigns) &&
            Number.isFinite(t?.multiplier) &&
            designCount >= t.minDesigns
        )
        .sort((a, b) => b.minDesigns - a.minDesigns)[0]
      if (applicable) {
        return Math.min(1, Math.max(0, applicable.multiplier))
      }
      return 1.0
    }

    // Documented default ladder, used only when the group configures no tiers.
    if (designCount >= 4) return 0.7
    if (designCount >= 2) return 0.85
    return 1.0
  }

  /**
   * Seed the default bundled-pricing groups for a product type.
   *
   * NOT IMPLEMENTED, deliberately. The previous body called
   * `await this.query.graph({...}).create()`, which is doubly wrong:
   * query.graph resolves to `{ data, metadata }` and has no `.create()` at all,
   * and the whole call was wrapped in a catch that logged and continued, so
   * this method has never created anything and never reported that it hadn't.
   *
   * Writing rows requires the design-area module to be registered and its
   * migrations run, then `container.resolve(DESIGN_AREA_MODULE)
   * .createDesignAreaGroups(...)`. Until that decision is made this throws,
   * because returning void from a create that created nothing is exactly the
   * silence this change set exists to remove.
   */
  async createDefaultGroups(productTypeId: string): Promise<void> {
    throw new DesignPricingUnavailableError(
      `createDefaultGroups(${productTypeId}) is not implemented: the design-area ` +
        `module is not registered, so there is no module service to write ` +
        `design_area_group rows with, and the table does not exist. See the ` +
        `header of src/models/design-area.ts for the registration steps.`
    )
  }
}

/**
 * Best-effort area-type label for output rows: prefer the persisted enum value
 * from the design_area row, fall back to the normalised submission spelling.
 */
function canonicalAreaType(raw: string | undefined, area?: DesignArea): string {
  return area?.area_type ?? canonicalAreaKey(raw)
}
