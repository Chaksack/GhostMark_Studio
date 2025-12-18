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
  product: HttpTypes.StoreProduct
  isFeatured?: boolean
  region: HttpTypes.StoreRegion
}) {
  // Ensure we have pricing computed for the current region.
  // Some callers might pass products without calculated prices populated.
  // In that case, fetch a priced copy by ID for this region.
  const pricedProduct = await listProducts({
    regionId: region.id,
    queryParams: { id: [product.id!], limit: 1 },
  })
    .then(({ response }) => response.products?.[0])
    .catch(() => undefined)

  const sourceForPrice = pricedProduct || product

  const { cheapestPrice } = getProductPrice({
    product: sourceForPrice,
  })

  // Derive small bits used in the card, falling back gracefully when data is missing
  const meta = (product as any)?.metadata || {}
  // Prefer tags coming from a freshly fetched (priced) product to ensure we read backend data
  const productWithFreshData = pricedProduct || product
  // Derive a human-readable product type label from common shapes
  const productTypeLabel = (() => {
    const p: any = productWithFreshData as any
    const t = p?.type ?? p?.product_type
    if (!t) return undefined
    if (typeof t === "string") return t
    // Try common fields on Medusa or custom backends
    return (
      t?.value || t?.title || t?.name || t?.handle || undefined
    ) as string | undefined
  })()
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
  const firstTagLabel = (() => {
    const t: any = Array.isArray(tags) && tags.length > 0 ? tags[0] : undefined
    if (!t) return undefined
    return (
      t?.value || t?.title || t?.name || t?.id || undefined
    ) as string | undefined
  })()
  const badge: string | undefined = meta.badge || firstTagLabel
  const embroideryAvailable: boolean =
    Boolean(meta.embroidery_available) ||
    Boolean(tags?.some((t: any) => /embroider/i.test(String(t?.value || t?.title || t?.name || t?.id || ""))))

  const colorOption = product.options?.find((o) => /color/i.test(o.title || ""))
  const sizeOption = product.options?.find((o) => /size/i.test(o.title || ""))
  const colorsCount = colorOption?.values?.length || 0
  const sizesCount = sizeOption?.values?.length || 0
  const locationsCount: number | undefined = typeof meta.locations_count === "number" ? meta.locations_count : undefined
  const shippingRegion: string | undefined = meta.shipping_region || undefined

  // Determine if product is apparel based on type label
  const isApparel: boolean = (() => {
    const typeStr = (productTypeLabel || "").toString().trim().toLowerCase()
    return typeStr === "apparel"
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

  return (
    <LocalizedClientLink href={`/products/${product.handle}`} className="group block">
      <div
        data-testid="product-wrapper"
        className="rounded-xl border border-ui-border-base hover:border-ui-fg-muted transition-colors bg-ui-bg-base overflow-hidden"
      >
        <div className="relative p-0">
          <Thumbnail
            thumbnail={product.thumbnail}
            images={product.images}
            size="square"
            isFeatured={isFeatured}
            className="rounded-none shadow-none"
          />
          {badge && (
            <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-black text-white text-xs font-medium px-3 py-1">
              {badge}
            </span>
          )}
        </div>
        <div className="px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <Text className="text-ui-fg-base text-[18px] font-semibold leading-snug line-clamp-2" data-testid="product-title">
              {product.title}
            </Text>
            <div className="flex items-center gap-x-1 whitespace-nowrap">
              {cheapestPrice && (
                <span className="text-xs text-ui-fg-subtle">From</span>
              )}
              {cheapestPrice && (
                <PreviewPrice
                  price={cheapestPrice}
                  priceClassName="text-ui-fg-base font-semibold"
                  containerClassName="flex items-baseline gap-1"
                />
              )}
            </div>
          </div>
          {/* Product type + tags row */}
          {(productTypeLabel || tags.length > 0) && (
            <div className="mt-2 flex flex-wrap gap-1" data-testid="product-preview-tags">
              {productTypeLabel && (
                <span
                  className="inline-flex items-center rounded-full border border-ui-border-base bg-ui-bg-subtle px-2 py-0.5 text-[10px] text-ui-fg-subtle"
                  data-testid="product-type-chip"
                >
                  {productTypeLabel}
                </span>
              )}
              {tags
                .filter((t, idx) => {
                  // Avoid duplicating the type label if it matches first tag
                  const label = (t as any)?.value || (t as any)?.title || (t as any)?.name || (t as any)?.id || String(idx)
                  return !productTypeLabel || String(label).toLowerCase() !== String(productTypeLabel).toLowerCase()
                })
                .slice(0, 4)
                .map((t, idx) => {
                  const label = (t as any)?.value || (t as any)?.title || (t as any)?.name || (t as any)?.id || String(idx)
                  return (
                    <span
                      key={(t as any)?.id || `${label}-${idx}`}
                      className="inline-flex items-center rounded-full border border-ui-border-base bg-ui-bg-subtle px-2 py-0.5 text-[10px] text-ui-fg-subtle"
                    >
                      {label}
                    </span>
                  )
                })}
            </div>
          )}
          {/* Secondary price line e.g. with Gelato+ */}
          {cheapestPrice && (
            <div className="mt-1 flex items-center gap-1 text-[13px]">
              <span className="text-green-500 font-medium">{cheapestPrice.calculated_price}</span>
              <span className="text-[12px] text-green-700">with GHOSTMARK+ </span>
            </div>
          )}
          {/* Compact price summary to mirror Gelato-style cards */}
          <div className="mt-1 leading-snug">
            <p className="text-[11px] text-ui-fg-muted">
              Excl. shipping & taxes
            </p>
            <p className="text-[11px] text-ui-fg-muted">Produced in 24–72h</p>
          </div>
          {/* Capability line */}
          {embroideryAvailable && (
            <p className="mt-2 text-[13px] text-ui-fg-base flex items-center gap-1">
              <span className="inline-block h-4 w-4 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[10px] leading-4 text-center">i</span>
              Embroidery available
            </p>
          )}
          {/* Meta bullets row */}
          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-ui-fg-muted">
            {[
              typeof locationsCount === "number" && locationsCount > 0
                ? `${locationsCount} locations`
                : null,
              shippingRegion
                ? `Shipping in <b>${shippingRegion}</b>`
                : null,
              colorsCount > 0 ? `${colorsCount} colors` : null,
              sizesCount > 0 ? `${sizesCount} sizes` : null,
            ]
              .filter(Boolean)
              .map((content, idx, arr) => (
                <span key={idx} className="flex items-center gap-2">
                  {/* render item with optional bold inner part for region */}
                  {typeof content === "string" && /<b>/.test(content) ? (
                    <span dangerouslySetInnerHTML={{ __html: content }} />
                  ) : (
                    <span>{content as any}</span>
                  )}
                  {idx < arr.length - 1 && (
                    <span className="h-1 w-1 rounded-full bg-ui-fg-muted/60 inline-block align-middle" />
                  )}
                </span>
              ))}
          </div>
        </div>
          {/* Quick actions row */}
          <div className="px-4 pb-4 pt-0">
            <div className="flex items-center gap-2">
              {/* Wishlist icon button (apparel only) */}
              <QuickWishlistButton isApparel={isApparel} productId={product.id} />
              {/* Add to cart fills remaining space */}
              <QuickAddButton
                isApparel={isApparel}
                variantId={quickVariantId}
                className="flex-1"
              />
            </div>
          </div>
      </div>

    </LocalizedClientLink>
  )
}
