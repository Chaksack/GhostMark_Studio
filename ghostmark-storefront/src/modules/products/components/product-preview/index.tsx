import { Text } from "@medusajs/ui"
import { listProducts } from "@lib/data/products"
import { getProductPrice } from "@lib/util/get-product-price"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Thumbnail from "../thumbnail"
import PreviewPrice from "./price"
import QuickAddButton from "./quick-add-button"
import QuickWishlistButton from "./quick-wishlist-button"

export default async function ProductPreview({
  product,
  isFeatured,
  region,
}: {
  readonly product: HttpTypes.StoreProduct
  readonly isFeatured?: boolean
  readonly region: HttpTypes.StoreRegion
}) {
  if (!product?.id) {
    return null
  }

  const hasCalculatedPrice = (() => {
    const variants: any[] = (product as any)?.variants || []
    return variants.some((v) => {
      const cp = v?.calculated_price
      return cp && (typeof cp?.calculated_amount === "number" || typeof cp?.original_amount === "number")
    })
  })()

  // Ensure we have pricing computed for the current region.
  // Avoid an extra request when calculated prices are already present.
  let pricedProduct: HttpTypes.StoreProduct | undefined
  if (!hasCalculatedPrice) {
    pricedProduct = await listProducts({
      regionId: region.id,
      queryParams: { id: [product.id], limit: 1 },
    })
      .then(({ response }) => response.products?.[0])
      .catch(() => undefined)
  }

  const sourceForPrice = pricedProduct || product

  const { cheapestPrice } = getProductPrice({
    product: sourceForPrice,
  })

  const meta = (product as any)?.metadata || {}
  // Prefer tags coming from a freshly fetched (priced) product to ensure we read backend data
  const productWithFreshData = pricedProduct || product
  // Normalize tags from either product.tags (expanded) or product.product_tags (join table) if present
  const tags = (() => {
    const p: any = productWithFreshData as any
    if (Array.isArray(p?.tags) && p.tags.length > 0) return p.tags
    if (Array.isArray(p?.product_tags) && p.product_tags.length > 0) {
      return p.product_tags
        .map((pt: any) => pt?.tag || pt)
        .filter(Boolean)
    }
    return [] as any[]
  })()
  const embroideryAvailable: boolean =
    Boolean(meta.embroidery_available) ||
    Boolean(tags.some((t: any) => /embroider/i.test(String(t?.value || t?.title || t?.name || t?.id || ""))))

  const colorOption = product.options?.find((o) => /color/i.test(o.title || ""))
  const sizeOption = product.options?.find((o) => /size/i.test(o.title || ""))
  const colorsCount = colorOption?.values?.length || 0
  const sizesCount = sizeOption?.values?.length || 0

  // Determine if product is apparel based on type label
  const isApparel: boolean = (() => {
    const p: any = productWithFreshData as any
    const t = p?.type ?? p?.product_type
    const typeStr = (
      typeof t === "string" ? t : (t?.value || t?.title || t?.name || t?.handle || "")
    )
      .toString()
      .trim()
      .toLowerCase()
    return typeStr === "apparel"
  })()

  // Detect gift card products either by explicit flag or product type value "gift-card"
  const isGiftCard: boolean = (() => {
    const p: any = productWithFreshData as any
    const byFlag = p?.is_giftcard === true
    const t = p?.type ?? p?.product_type
    const byType = typeof t === "object" && (t?.value || t?.title || t?.name || t?.handle)?.toString?.().toLowerCase?.() === "gift-card"
    return Boolean(byFlag || byType)
  })()

  // Pick a reasonable default variant for quick add on cards
  const pickVariantId = (): string | undefined => {
    const variants = productWithFreshData.variants || []
    if (!variants.length) return undefined

    // Helper: has price for region
    const hasVariantPrice = (v: any): boolean => {
      try {
        const { variantPrice } = getProductPrice({ product: productWithFreshData, variantId: v?.id })
        return !!variantPrice
      } catch {
        return false
      }
    }

    // Helper: stock logic similar to ProductActions
    const inStock = (v: any): boolean => {
      if (!v) return false
      if (!v.manage_inventory) return true
      if (v.allow_backorder) return true
      return (v.inventory_quantity || 0) > 0
    }

    // 1) priced and in stock
    const v1 = (variants as any[]).find((v) => hasVariantPrice(v) && inStock(v))
    if (v1?.id) return v1.id

    // 2) priced
    const v2 = (variants as any[]).find((v) => hasVariantPrice(v))
    if (v2?.id) return v2.id

    // 3) fallback first
    return (variants[0] as any)?.id
  }

  const quickVariantId = pickVariantId()
  // We want direct add-to-cart for gift cards; reuse QuickAdd for apparel or gift cards
  const showQuickAdd = isApparel || isGiftCard

  // Shared card content
  const CardInner = (
    <div data-testid="product-wrapper" className="h-full flex flex-col">
      <div className="relative">
        <div className="relative bg-mono-50 overflow-hidden aspect-square rounded-large border border-mono-200">
          <Thumbnail
            thumbnail={product.thumbnail}
            images={product.images}
            size="square"
            isFeatured={false}
            className="rounded-none shadow-none w-full h-full transition-transform duration-300 group-hover:scale-[1.02]"
          />
        </div>

        <div className="absolute right-3 top-3 z-10">
          <QuickWishlistButton productId={product.id} />
        </div>
      </div>

      <div className="mt-4 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-4">
          <Text
            className="text-mono-1000 text-sm font-medium leading-tight line-clamp-2"
            data-testid="product-title"
          >
            {product.title}
          </Text>
        </div>

        {cheapestPrice && (
          <div className="mt-2">
            <PreviewPrice
              price={cheapestPrice}
              containerClassName="text-left"
              priceClassName={`text-sm ${cheapestPrice.price_type === "sale" ? "font-semibold" : "font-medium"} text-mono-700`}
            />
          </div>
        )}

        {(embroideryAvailable || colorsCount > 0 || sizesCount > 0) && (
          <div className="mt-2 text-xs text-mono-500">
            {embroideryAvailable ? "Embroidery available" : null}
            {!embroideryAvailable && colorsCount > 0 ? `${colorsCount} colors` : null}
            {!embroideryAvailable && colorsCount === 0 && sizesCount > 0 ? `${sizesCount} sizes` : null}
          </div>
        )}

        {showQuickAdd && (
          <div className="mt-4">
            <QuickAddButton isApparel={showQuickAdd} variantId={quickVariantId} className="w-full" />
          </div>
        )}
      </div>
    </div>
  )
  // Render without navigation for gift cards to enforce direct add-to-cart UX
  if (isGiftCard) {
    return (
      <div className="group block h-full" aria-label={`${product.title} (Gift Card)`}>
        {CardInner}
      </div>
    )
  }

  // Default: link to PDP for non-gift-card products
  return (
    <LocalizedClientLink href={`/products/${product.handle}`} className="group block h-full">
      {CardInner}
    </LocalizedClientLink>
  )
}
