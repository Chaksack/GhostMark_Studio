import { HttpTypes } from "@medusajs/types"
import { Heading, Text } from "@medusajs/ui"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import ProductPrice from "@modules/products/components/product-price"
import { listProducts } from "@lib/data/products"

type ProductInfoProps = {
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
}

const ProductInfo = async ({ product, region }: ProductInfoProps) => {
  // Ensure pricing reflects the active region (for correct sale price display)
  // Add defensive check for region based on e-commerce best practices
  const pricedProduct = region?.id ? await listProducts({
    regionId: region.id,
    queryParams: {
      id: [product.id!],
      limit: 1,
      // Include calculated prices and minimal related fields
      fields:
        "*variants.calculated_price,+variants.inventory_quantity,*options,+metadata,+tags",
    },
  })
    .then(({ response }) => response.products?.[0])
    .catch(() => undefined) : undefined

  const productForPricing = pricedProduct || product
  const meta: any = (productForPricing as any)?.metadata || {}
  const subtitleFromMeta = (productForPricing as any)?.metadata?.subtitle as
    | string
    | undefined

  const shortDescription = (() => {
    const raw = subtitleFromMeta || product.description || ""
    if (!raw) return undefined
    // Take the first sentence or clamp to ~140 chars for a neat subtitle
    const firstSentenceMatch = raw.match(/[^.!?\n]+[.!?]?/)
    const first = firstSentenceMatch ? firstSentenceMatch[0] : raw
    return first.length > 160 ? first.slice(0, 157).trim() + "…" : first
  })()

  const typeLabel = productForPricing.type?.value

  // Resolve recommended/target DPI and print area size from metadata if present
  const recommendedDpi = (() => {
    const raw = meta.recommended_dpi ?? meta.print_dpi ?? meta.dpi
    const n = typeof raw === "string" ? parseInt(raw, 10) : typeof raw === "number" ? raw : undefined
    return Number.isFinite(n as number) ? (n as number) : undefined
  })()

  const printAreaInches = (() => {
    const toNum = (v: any) => (typeof v === "number" ? v : v != null ? parseFloat(String(v)) : undefined)
    let wIn: number | undefined
    let hIn: number | undefined
    if (meta.print_area_width_in && meta.print_area_height_in) {
      wIn = toNum(meta.print_area_width_in)
      hIn = toNum(meta.print_area_height_in)
    } else if (meta.print_area_width_cm && meta.print_area_height_cm) {
      const w = toNum(meta.print_area_width_cm)
      const h = toNum(meta.print_area_height_cm)
      if (w != null && h != null) {
        wIn = w / 2.54
        hIn = h / 2.54
      }
    } else if (meta.print_area_width_mm && meta.print_area_height_mm) {
      const w = toNum(meta.print_area_width_mm)
      const h = toNum(meta.print_area_height_mm)
      if (w != null && h != null) {
        wIn = w / 25.4
        hIn = h / 25.4
      }
    } else if (meta.print_area_size_in && (meta.print_area_size_in.width || meta.print_area_size_in.height)) {
      wIn = toNum(meta.print_area_size_in.width)
      hIn = toNum(meta.print_area_size_in.height)
    }
    if (wIn != null && hIn != null) {
      // round to 2 decimals for readability
      return { wIn: Math.round(wIn * 100) / 100, hIn: Math.round(hIn * 100) / 100 }
    }
    return undefined as undefined | { wIn: number; hIn: number }
  })()

  return (
    <div id="product-info">
      <div className="flex flex-col gap-y-4 lg:max-w-[500px] mx-auto">
        {productForPricing.collection && (
          <LocalizedClientLink
            href={`/collections/${productForPricing.collection.handle}`}
            className="text-medium text-ui-fg-muted hover:text-ui-fg-subtle"
          >
            {productForPricing.collection.title}
          </LocalizedClientLink>
        )}
        <Heading
          level="h2"
          className="text-3xl leading-10 text-ui-fg-base"
          data-testid="product-title"
        >
          {productForPricing.title}
        </Heading>

        {shortDescription && (
          <Text className="text-ui-fg-subtle">{shortDescription}</Text>
        )}

        {/* Simple meta row to approximate brand/category presentation in the reference */}
        {(typeLabel || product.material) && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ui-fg-muted">
            {typeLabel && (
              <span>
                <span className="text-ui-fg-subtle">Type:</span> {typeLabel}
              </span>
            )}
            {product.material && (
              <span>
                <span className="text-ui-fg-subtle">Material:</span> {product.material}
              </span>
            )}
          </div>
        )}

        {/* Print details (DPI and area) from metadata when available */}
        {(recommendedDpi || printAreaInches) && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ui-fg-muted">
            {printAreaInches && (
              <span>
                <span className="text-ui-fg-subtle">Print area:</span> {printAreaInches.wIn}×{printAreaInches.hIn} in
              </span>
            )}
            {recommendedDpi && (
              <span>
                <span className="text-ui-fg-subtle">Recommended DPI:</span> {recommendedDpi}
              </span>
            )}
          </div>
        )}

        {/* Quick highlights list – configurable via metadata.highlights (string[]) if provided */}
        {Array.isArray((productForPricing as any)?.metadata?.highlights) && (
          <ul className="mt-1 space-y-1 text-sm text-ui-fg-subtle list-disc pl-5">
            {((productForPricing as any).metadata.highlights as string[])
              .filter(Boolean)
              .slice(0, 5)
              .map((h, i) => (
                <li key={i}>{h}</li>
              ))}
          </ul>
        )}

        {/* Product tags */}
        {(() => {
          const p: any = productForPricing as any
          const tags = Array.isArray(p?.tags) && p.tags.length > 0
            ? p.tags
            : Array.isArray(p?.product_tags) && p.product_tags.length > 0
            ? p.product_tags.map((pt: any) => pt?.tag || pt).filter(Boolean)
            : []
          if (!tags.length) return null
          return (
            <div className="mt-2 flex flex-wrap gap-2" data-testid="product-tags">
              {tags.map((t: any, idx: number) => {
                const label = t?.value || t?.title || t?.name || t?.id || String(idx)
                return (
                  <span
                    key={t?.id || `${label}-${idx}`}
                    className="inline-flex items-center rounded-full border border-ui-border-base bg-ui-bg-subtle px-2 py-0.5 text-[11px] text-ui-fg-subtle"
                  >
                    {label}
                  </span>
                )
              })}
            </div>
          )
        })()}
          {/* Product Price with Sale Display */}
          <div className="">
              <ProductPrice product={productForPricing} />
          </div>
        {/* Description remains in tabs below to better match reference PDP layout */}
      </div>
    </div>
  )
}

export default ProductInfo
