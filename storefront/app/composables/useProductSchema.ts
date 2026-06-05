// app/composables/useProductSchema.ts
//
// Builds a schema.org Product JSON-LD payload from a Medusa product, with
// mode-specific `offers` shape:
//   - apparel (single Offer)         — one calculated_price per variant,
//                                      a single `Offer` with `price`.
//   - pod (AggregateOffer + range)   — multi-tier MOQ pricing, emit
//                                      `AggregateOffer` with lowPrice/highPrice
//                                      and `offerCount`.
//
// Branching follows the canonical taxonomy: `product.type.value === 'pod'`
// (NEVER infer from title or category — backend owns the source of truth).
//
// Prices come from `variant.calculated_price.calculated_amount`, which
// Medusa returns in the smallest currency unit (pence/cents). We divide by
// 100 and format to 2dp for schema compliance.
//
// Schema spec coverage (verified against schema.org 2025 + Google rich
// results requirements):
//   - `name`, `description`, `image[]` — REQUIRED. `image` is always emitted
//     as an array even if the product only has a `thumbnail`, because
//     Google's product snippet validator silently degrades a string-typed
//     `image` to "not eligible for rich results".
//   - `sku` — REQUIRED. Falls back to handle when no variant SKU exists.
//   - `brand: { @type: 'Brand', name }` — REQUIRED. Brand-as-Organization is
//     also valid per schema.org but Brand is the recommended shape for retail.
//   - `offers.priceCurrency` — REQUIRED and must be ISO 4217 (uppercased).
//   - `offers.price` (Offer) / `offers.lowPrice` + `highPrice` (AggregateOffer)
//     — REQUIRED, two decimal places, currency-unit (not minor unit).
//   - `offers.availability` — REQUIRED. Mapped inventory-aware:
//     any variant with `inventory_quantity > 0` OR `allow_backorder` =>
//     InStock, otherwise OutOfStock. If inventory data isn't expanded on
//     the product payload we default to InStock — Google prefers this to
//     an omitted property and the PDP CTA already gates real availability.
//   - `aggregateRating` / `review` — intentionally omitted until ratings
//     ship from the backend; Google treats them as optional.
//
// Empty/edge cases
//   - no variants or no prices  → emit Product without `offers`
//   - single price + isPOD       → still single Offer (AggregateOffer needs ≥2)
//   - missing description        → fall back to subtitle, then '' (capped 1000ch)

import { computed, type ComputedRef } from 'vue'

export interface UseProductSchemaInput {
  product: any
  url: string
}

export interface ProductOffer {
  '@type': 'Offer'
  price: string
  priceCurrency: string
  availability: string
  url: string
}

export interface ProductAggregateOffer {
  '@type': 'AggregateOffer'
  lowPrice: string
  highPrice: string
  priceCurrency: string
  offerCount: number
  availability: string
}

export interface ProductSchema {
  '@context': 'https://schema.org'
  '@type': 'Product'
  name: string
  description: string
  sku: string
  brand: { '@type': 'Brand'; name: string }
  image: string[]
  offers?: ProductOffer | ProductAggregateOffer
  url?: string
}

export function useProductSchema(input: UseProductSchemaInput): {
  schema: ComputedRef<ProductSchema | null>
} {
  const schema = computed<ProductSchema | null>(() => {
    const product = input.product
    if (!product) return null

    const isPOD = ((product?.type?.value as string) || '').toLowerCase() === 'pod'
    const variants: any[] = Array.isArray(product?.variants) ? product.variants : []

    const prices: number[] = variants
      .map((v) => v?.calculated_price?.calculated_amount)
      .filter((n): n is number => typeof n === 'number' && Number.isFinite(n))

    const lowPrice = prices.length ? Math.min(...prices) : null
    const highPrice = prices.length ? Math.max(...prices) : null
    const currency = (
      (variants[0]?.calculated_price?.currency_code as string) || 'GBP'
    ).toUpperCase()

    // Inventory-aware availability. Schema.org requires one of InStock /
    // OutOfStock / PreOrder / BackOrder. We treat any variant with positive
    // inventory OR `allow_backorder` as in-stock. POD products without
    // inventory tracking (manage_inventory === false) are always considered
    // in-stock because supply is made-to-order. If the payload doesn't carry
    // inventory fields at all we optimistically return InStock — omitting
    // the field disqualifies the product from Google's rich snippet.
    const anyVariantAvailable = variants.length === 0
      ? true
      : variants.some((v: any) => {
        if (v?.allow_backorder === true) return true
        if (v?.manage_inventory === false) return true
        const qty = v?.inventory_quantity
        return typeof qty === 'number' ? qty > 0 : true
      })
    const availability = anyVariantAvailable
      ? 'https://schema.org/InStock'
      : 'https://schema.org/OutOfStock'

    let offers: ProductOffer | ProductAggregateOffer | undefined
    if (isPOD && prices.length > 1 && lowPrice !== null && highPrice !== null) {
      offers = {
        '@type': 'AggregateOffer',
        lowPrice: (lowPrice / 100).toFixed(2),
        highPrice: (highPrice / 100).toFixed(2),
        priceCurrency: currency,
        offerCount: variants.length,
        availability,
      }
    } else if (prices.length && lowPrice !== null) {
      offers = {
        '@type': 'Offer',
        price: (lowPrice / 100).toFixed(2),
        priceCurrency: currency,
        availability,
        url: input.url,
      }
    }

    const images: string[] = (
      Array.isArray(product?.images)
        ? product.images.map((i: any) => i?.url).filter(Boolean)
        : []
    ) as string[]
    if (!images.length && product?.thumbnail) images.push(product.thumbnail)

    const description: string = (product?.description || product?.subtitle || '')
      .toString()
      .slice(0, 1000)

    const schemaObj: ProductSchema = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: String(product?.title || ''),
      description,
      sku: String(variants[0]?.sku || product?.handle || ''),
      brand: { '@type': 'Brand', name: 'GhostMark Studio' },
      image: images,
    }

    if (offers) schemaObj.offers = offers
    if (product?.handle) schemaObj.url = input.url

    return schemaObj
  })

  return { schema }
}
