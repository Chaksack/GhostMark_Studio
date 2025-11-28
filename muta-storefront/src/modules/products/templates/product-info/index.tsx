import { HttpTypes } from "@medusajs/types"
import { Heading, Text } from "@medusajs/ui"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

type ProductInfoProps = {
  product: HttpTypes.StoreProduct
}

const ProductInfo = ({ product }: ProductInfoProps) => {
  const subtitleFromMeta = (product as any)?.metadata?.subtitle as
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

  const typeLabel = product.type?.value

  return (
    <div id="product-info">
      <div className="flex flex-col gap-y-4 lg:max-w-[500px] mx-auto">
        {product.collection && (
          <LocalizedClientLink
            href={`/collections/${product.collection.handle}`}
            className="text-medium text-ui-fg-muted hover:text-ui-fg-subtle"
          >
            {product.collection.title}
          </LocalizedClientLink>
        )}
        <Heading
          level="h2"
          className="text-3xl leading-10 text-ui-fg-base"
          data-testid="product-title"
        >
          {product.title}
        </Heading>

        {shortDescription && (
          <Text className="text-ui-fg-subtle">{shortDescription}</Text>
        )}

        {/* Simple meta row to approximate brand/category presentation in the reference */}
        {(typeLabel || product.material) && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-ui-fg-muted">
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

        {/* Quick highlights list – configurable via metadata.highlights (string[]) if provided */}
        {Array.isArray((product as any)?.metadata?.highlights) && (
          <ul className="mt-1 space-y-1 text-sm text-ui-fg-subtle list-disc pl-5">
            {((product as any).metadata.highlights as string[])
              .filter(Boolean)
              .slice(0, 5)
              .map((h, i) => (
                <li key={i}>{h}</li>
              ))}
          </ul>
        )}

        {/* Product tags */}
        {(() => {
          const p: any = product as any
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

        {/* Description remains in tabs below to better match reference PDP layout */}
      </div>
    </div>
  )
}

export default ProductInfo
