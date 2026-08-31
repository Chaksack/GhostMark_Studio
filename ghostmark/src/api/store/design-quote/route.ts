import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  DesignPricingService,
  DesignPricingError,
  DesignPricingUnavailableError,
} from "../../../services/design-pricing-service"

// =============================================================================
// POST /store/design-quote: price a set of POD design submissions
// =============================================================================
//
// STATUS: this route has no callers. The storefront's add-to-cart sends no
// price field and never calls it. It exists so that pricing can be reviewed and
// wired up deliberately; it does NOT influence what any customer is charged
// today.
//
// TRUST BOUNDARY: everything in `req.body` is caller-controlled and unverified.
// In particular `files[].metadata` is a claim, not a measurement, so it is
// explicitly NOT trusted for price adjustment, see sanitizeImageMetadata.
// =============================================================================

/** `type` uses the print_areas key namespace: left_sleeve / right_sleeve. */
interface QuoteFile {
  type:
    | "default"
    | "front"
    | "back"
    | "left_sleeve"
    | "right_sleeve"
    | "neck"
    | "pocket"
  url: string
  areaId?: string
  /**
   * Caller-supplied image characteristics. Advisory only. These are echoed for
   * diagnostics but never priced on unless a server-side analyser has verified
   * them, see the note on `verified` in design-pricing-service.ts.
   */
  metadata?: {
    dpi?: number
    qualityScore?: number
    isPrintReady?: boolean
    suggestedUse?: string
    width?: number
    height?: number
    fileSize?: number
    format?: string
  }
}

interface QuoteProduct {
  itemReferenceId: string
  productTypeId: string
  productId?: string
  variantId?: string
  files: QuoteFile[]
  quantity: number
  printMethod?: string
}

interface QuoteRequest {
  quoteReferenceId: string
  currency?: string
  products: QuoteProduct[]
  urgent?: boolean
  /** false (default) => one combined quote. true => one quote per product. */
  allowMultipleQuotes?: boolean
  shipmentMethod?: string
}

interface QuoteProductLine {
  itemReferenceId: string
  productTypeId: string
  quantity: number
  price: number
  currency: string
  breakdown: {
    basePrice: number
    designPrice: number
    setupFees: number
    qualityAdjustments?: number
    groupSavings?: number
  }
}

interface Quote {
  id: string
  itemReferenceIds: string[]
  products: QuoteProductLine[]
  totals: {
    subtotal: number
    setupFees: number
    total: number
    currency: string
    savings?: number
  }
  estimatedFulfillmentDays: { min: number; max: number }
}

interface QuoteResponse {
  quoteReferenceId: string
  quotes: Quote[]
  errors?: string[]
}

const CURRENCY_RE = /^[A-Za-z]{3}$/

/**
 * Strip every field a caller could use to move the price.
 *
 * The previous implementation copied dpi / qualityScore / isPrintReady straight
 * out of the request body into the pricing multiplier chain. A caller claiming
 * {dpi:400, qualityScore:95, isPrintReady:true} for a 72-DPI JPEG took a 23%
 * self-service discount; the inverted claim stacked to 2.4675x on base price
 * and 4.259x on the setup fee.
 *
 * We keep the values for diagnostics but force `verified: false`, which makes
 * the pricing engine apply a neutral 1.0 multiplier. When real server-side
 * analysis exists, it (and only it) may set `verified: true`.
 */
function sanitizeImageMetadata(raw: QuoteFile["metadata"]) {
  if (!raw || typeof raw !== "object") return undefined
  return {
    dpi: Number(raw.dpi ?? 0),
    qualityScore: Number(raw.qualityScore ?? 0),
    isPrintReady: raw.isPrintReady === true,
    suggestedUse: typeof raw.suggestedUse === "string" ? raw.suggestedUse : "unknown",
    width: Number(raw.width ?? 0),
    height: Number(raw.height ?? 0),
    fileSize: typeof raw.fileSize === "number" ? raw.fileSize : undefined,
    format: typeof raw.format === "string" ? raw.format : undefined,
    // Never honoured from the request body. Hardcoded, not spread.
    verified: false as const,
  }
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger: any = (req.scope as any).resolve?.("logger") ?? console

  try {
    const body = (req.body ?? {}) as QuoteRequest
    const {
      quoteReferenceId,
      products,
      urgent = false,
      allowMultipleQuotes = false,
      shipmentMethod = "standard",
    } = body

    if (
      !quoteReferenceId ||
      !products ||
      !Array.isArray(products) ||
      products.length === 0
    ) {
      return res.status(400).json({
        error: "Missing required fields: quoteReferenceId, products (non-empty array)",
      })
    }

    // Currency is caller-controlled: validate its shape and normalise case
    // before it reaches any lookup. Left undefined when not supplied so the
    // pricing service can fall back to product.metadata.pod.currency, the
    // previous `currency = 'USD'` default was always truthy, which made that
    // fallback unreachable and silently forced USD onto GBP products.
    let currency: string | undefined
    if (body.currency !== undefined) {
      if (typeof body.currency !== "string" || !CURRENCY_RE.test(body.currency.trim())) {
        return res.status(400).json({
          error: "currency must be a 3-letter ISO 4217 code (e.g. GBP)",
        })
      }
      currency = body.currency.trim().toUpperCase()
    }

    for (const product of products) {
      if (
        !product.itemReferenceId ||
        !product.productTypeId ||
        !product.files ||
        !Array.isArray(product.files)
      ) {
        return res.status(400).json({
          error: "Each product must have itemReferenceId, productTypeId, and files array",
        })
      }

      // `product.quantity < 1` is false for undefined, so a missing quantity
      // passed validation and produced {"price": null} (NaN serialised).
      if (!Number.isInteger(product.quantity) || product.quantity < 1) {
        return res.status(400).json({
          error: `Product ${product.itemReferenceId}: quantity must be an integer >= 1`,
        })
      }

      if (product.files.length === 0) {
        return res.status(400).json({
          error: `Product ${product.itemReferenceId}: files must be a non-empty array`,
        })
      }

      for (const file of product.files) {
        if (!file.type || !file.url) {
          return res.status(400).json({ error: "Each file must have type and url" })
        }
      }
    }

    const pricingService = new DesignPricingService(req.scope)
    const quotes: Quote[] = []
    const errors: string[] = []

    for (const product of products) {
      try {
        const designs = product.files.map((file, index) => {
          const areaType = file.type === "default" ? "front" : file.type

          return {
            areaId: file.areaId || `${areaType}_${index}`,
            areaType,
            layers: 1,
            // Colour count is deliberately omitted. The old
            // estimateColorsFromFile() was a stub that returned a constant 3
            // for every file, so every colour charge it produced was fictional.
            // An unknown colour count now attracts no colour charge; when real
            // analysis exists it should populate this with a measured value.
            colors: undefined,
            printMethod: product.printMethod || "digital",
            fileUrl: file.url,
            fileType: file.type,
            imageMetadata: sanitizeImageMetadata(file.metadata),
          }
        })

        const pricing = await pricingService.calculatePricing(
          product.productTypeId,
          designs,
          product.quantity,
          { currency, urgent, shipmentMethod },
          product.productId
        )

        const quoteProduct: QuoteProductLine = {
          itemReferenceId: product.itemReferenceId,
          productTypeId: product.productTypeId,
          quantity: product.quantity,
          price: pricing.totals.total,
          currency: pricing.totals.currency,
          breakdown: {
            // `subtotal` already excludes setup fees, so it is the design
            // price directly. The old `subtotal - setupFees` subtracted them a
            // second time, on top of the engine's own double-count.
            basePrice: pricing.totals.subtotal,
            designPrice: pricing.totals.subtotal,
            setupFees: pricing.totals.setupFees,
            qualityAdjustments: pricing.areaBreakdown.reduce(
              (sum, area) => sum + ((area.qualityAdjustment?.multiplier ?? 1) - 1),
              0
            ),
            groupSavings: pricing.totals.savings,
          },
        }

        // Quote assembly.
        //
        // The old branch was unreachable in both directions: the candidate was
        // selected with `q => q.products.length === 0 || allowMultipleQuotes`
        // and then entered only `if (existingQuote && !allowMultipleQuotes)`.
        // With allowMultipleQuotes=false the predicate only matched quotes with
        // zero products (none ever exist), and with it true the guard rejected
        // the match, so every product always got its own quote and the flag
        // did nothing.
        //
        // Intended semantics, now implemented: false => combine into one quote;
        // true => a separate quote per product.
        const target = allowMultipleQuotes ? undefined : quotes[0]

        if (target) {
          if (target.totals.currency !== pricing.totals.currency) {
            throw new DesignPricingError(
              `Cannot combine ${pricing.totals.currency} into a ` +
                `${target.totals.currency} quote; pass allowMultipleQuotes: true`
            )
          }
          target.products.push(quoteProduct)
          target.itemReferenceIds.push(product.itemReferenceId)
          target.totals.subtotal =
            Math.round((target.totals.subtotal + pricing.totals.subtotal) * 100) / 100
          target.totals.setupFees =
            Math.round((target.totals.setupFees + pricing.totals.setupFees) * 100) / 100
          target.totals.total =
            Math.round((target.totals.total + pricing.totals.total) * 100) / 100
          if (pricing.totals.savings) {
            target.totals.savings =
              Math.round(((target.totals.savings ?? 0) + pricing.totals.savings) * 100) /
              100
          }
        } else {
          quotes.push({
            id: `quote_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
            itemReferenceIds: [product.itemReferenceId],
            products: [quoteProduct],
            totals: {
              subtotal: pricing.totals.subtotal,
              setupFees: pricing.totals.setupFees,
              total: pricing.totals.total,
              currency: pricing.totals.currency,
              savings: pricing.totals.savings,
            },
            estimatedFulfillmentDays: {
              min: urgent ? 1 : 3,
              max: urgent ? 3 : 7,
            },
          })
        }
      } catch (error: any) {
        // A per-product failure must not become a cheap quote for the rest of
        // the basket. Record it and, below, refuse to return a partial quote.
        logger.error?.(
          `[design-quote] pricing failed for item=${product.itemReferenceId} ` +
            `product_type=${product.productTypeId} product_id=${product.productId}: ` +
            `${error?.message ?? error}`
        )
        errors.push(`Product ${product.itemReferenceId}: ${error?.message ?? error}`)
      }
    }

    // If anything failed to price, the quote is incomplete. Returning the
    // priced remainder alongside an `errors` array invites the caller to charge
    // it, which is exactly the failure mode this change set exists to remove.
    if (errors.length > 0) {
      const unavailable = errors.some((e) => e.includes("not registered"))
      return res.status(unavailable ? 503 : 422).json({
        error: "Could not produce a complete quote",
        quoteReferenceId,
        errors,
      })
    }

    const response: QuoteResponse = { quoteReferenceId, quotes }
    return res.json(response)
  } catch (error: any) {
    logger.error?.(`[design-quote] request failed: ${error?.message ?? error}`)

    if (error instanceof DesignPricingUnavailableError) {
      return res.status(503).json({
        error: "Design pricing is unavailable",
        message: error.message,
      })
    }
    if (error instanceof DesignPricingError) {
      return res.status(422).json({
        error: "Could not calculate design quote",
        message: error.message,
      })
    }
    return res.status(500).json({
      error: "Failed to calculate design quote",
      message: error?.message ?? String(error),
    })
  }
}
