import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  DesignPricingService,
  DesignPricingError,
  DesignPricingUnavailableError,
} from "../../../services/design-pricing-service"

// =============================================================================
// /store/design-pricing
// =============================================================================
//
// STATUS: no callers. Both handlers depend on the design-area module, which is
// NOT registered and whose tables do not exist, so both currently return 503.
// That is deliberate: the previous implementation swallowed the failure and
// answered 200 with an empty area list and a zero total.
// =============================================================================

interface DesignSubmissionRequest {
  areaId: string
  areaType: string
  layers: number
  /**
   * Verified print-colour count. Optional: an absent count attracts no colour
   * charge rather than a guessed one.
   */
  colors?: number
  printMethod?: string
}

interface PricingRequest {
  productTypeId: string
  variantId?: string
  designs: DesignSubmissionRequest[]
  quantity?: number
  currency?: string
}

const CURRENCY_RE = /^[A-Za-z]{3}$/

/** Map a pricing-engine failure onto an honest HTTP status. Never 200-with-zero. */
function respondToPricingError(
  res: MedusaResponse,
  logger: any,
  context: string,
  error: any
) {
  logger.error?.(`[design-pricing] ${context}: ${error?.message ?? error}`)

  if (error instanceof DesignPricingUnavailableError) {
    return res.status(503).json({
      error: "Design pricing is unavailable",
      message: error.message,
      hint:
        "The design-area module is not registered in medusa-config.ts and its " +
        "tables do not exist. See src/models/design-area.ts for what registering " +
        "it requires.",
    })
  }
  if (error instanceof DesignPricingError) {
    return res.status(422).json({
      error: "Could not calculate design pricing",
      message: error.message,
    })
  }
  return res.status(500).json({
    error: "Failed to calculate design pricing",
    message: error?.message ?? String(error),
  })
}

// POST /store/design-pricing: calculate pricing for design submissions
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger: any = (req.scope as any).resolve?.("logger") ?? console

  try {
    const body = (req.body ?? {}) as PricingRequest
    const { productTypeId, designs, quantity = 1 } = body

    if (!productTypeId || !designs || !Array.isArray(designs) || designs.length === 0) {
      return res.status(400).json({
        error: "Missing required fields: productTypeId, designs (non-empty array)",
      })
    }

    for (const design of designs) {
      if (!design.areaId || !design.areaType || typeof design.layers !== "number") {
        return res.status(400).json({
          error: "Each design must have areaId, areaType and layers (number)",
        })
      }
      if (!Number.isInteger(design.layers) || design.layers < 1) {
        return res.status(400).json({ error: "layers must be an integer >= 1" })
      }
      // colors is optional; when present it must be a sane non-negative count.
      if (design.colors !== undefined) {
        if (!Number.isInteger(design.colors) || design.colors < 0) {
          return res
            .status(400)
            .json({ error: "colors, when supplied, must be an integer >= 0" })
        }
      }
    }

    // `quantity < 1` is false for undefined/NaN; require a real integer.
    if (!Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).json({ error: "quantity must be an integer >= 1" })
    }

    let currency: string | undefined
    if (body.currency !== undefined) {
      if (typeof body.currency !== "string" || !CURRENCY_RE.test(body.currency.trim())) {
        return res
          .status(400)
          .json({ error: "currency must be a 3-letter ISO 4217 code (e.g. GBP)" })
      }
      currency = body.currency.trim().toUpperCase()
    }

    const pricingService = new DesignPricingService(req.scope)
    const pricing = await pricingService.calculatePricing(
      productTypeId,
      designs,
      quantity,
      currency ? { currency } : undefined
    )

    const summary = {
      totalAreas: designs.length,
      totalLayers: designs.reduce((sum, d) => sum + d.layers, 0),
      // Only counts colours that were actually supplied.
      totalColors: designs.reduce((sum, d) => sum + (d.colors ?? 0), 0),
      groupCharges: pricing.groupCharges.length,
      hasGroupSavings: !!pricing.totals.savings && pricing.totals.savings > 0,
      priceSource: pricing.source,
    }

    return res.json({ pricing, summary, success: true })
  } catch (error: any) {
    return respondToPricingError(res, logger, "POST /store/design-pricing", error)
  }
}

// GET /store/design-pricing?productTypeId=...: available design areas
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger: any = (req.scope as any).resolve?.("logger") ?? console

  try {
    const { productTypeId } = req.query as { productTypeId?: string }

    if (!productTypeId) {
      return res.status(400).json({ error: "Missing productTypeId query parameter" })
    }

    const pricingService = new DesignPricingService(req.scope)

    // Reaching through to private members is not great, but these are read-only
    // lookups and the alternative is duplicating the query. Both now throw
    // rather than returning [] when the module is unavailable, so a 503 here is
    // the truthful answer instead of "this product type has no design areas".
    const [designAreas, designAreaGroups] = await Promise.all([
      (pricingService as any).fetchDesignAreas(productTypeId),
      (pricingService as any).fetchDesignAreaGroups(productTypeId),
    ])

    const areaGroupsMap = new Map<string, any>()
    designAreaGroups.forEach((group: any) => {
      ;(Array.isArray(group.design_area_ids) ? group.design_area_ids : []).forEach(
        (areaId: string) => {
          areaGroupsMap.set(areaId, {
            groupId: group.id,
            groupName: group.name,
            pricingStrategy: group.pricing_strategy,
            // MAJOR units, see src/models/design-area.ts.
            groupPrice: group.group_price,
            currency: group.currency_code,
          })
        }
      )
    })

    const enhancedAreas = designAreas.map((area: any) => ({
      ...area,
      groupInfo: areaGroupsMap.get(area.id) ?? null,
    }))

    const areasByType = enhancedAreas.reduce((acc: any, area: any) => {
      ;(acc[area.area_type] ??= []).push(area)
      return acc
    }, {})

    // Math.max(...[]) is -Infinity, which serialises to null. Guard the empty
    // case explicitly.
    const colorCaps = designAreas
      .map((a: any) => Number(a.max_colors))
      .filter((n: number) => Number.isFinite(n) && n > 0)

    return res.json({
      designAreas: enhancedAreas,
      areasByType,
      designAreaGroups,
      pricingInfo: {
        moneyUnits: "major",
        hasGroupPricing: designAreaGroups.length > 0,
        supportedAreaTypes: [...new Set(designAreas.map((a: any) => a.area_type))],
        maxColors: colorCaps.length > 0 ? Math.max(...colorCaps) : null,
        supportedPrintMethods: [
          ...new Set(
            designAreas.flatMap((a: any) =>
              Array.isArray(a.print_methods) ? a.print_methods : []
            )
          ),
        ],
      },
    })
  } catch (error: any) {
    return respondToPricingError(res, logger, "GET /store/design-pricing", error)
  }
}
