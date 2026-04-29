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

    let offers: ProductOffer | ProductAggregateOffer | undefined
    if (isPOD && prices.length > 1 && lowPrice !== null && highPrice !== null) {
      offers = {
        '@type': 'AggregateOffer',
        lowPrice: (lowPrice / 100).toFixed(2),
        highPrice: (highPrice / 100).toFixed(2),
        priceCurrency: currency,
        offerCount: variants.length,
        availability: 'https://schema.org/InStock',
      }
    } else if (prices.length && lowPrice !== null) {
      offers = {
        '@type': 'Offer',
        price: (lowPrice / 100).toFixed(2),
        priceCurrency: currency,
        availability: 'https://schema.org/InStock',
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
