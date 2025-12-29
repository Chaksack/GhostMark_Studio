import { clx } from "@medusajs/ui"

import { getProductPrice } from "@lib/util/get-product-price"
import { HttpTypes } from "@medusajs/types"

export default function ProductPrice({
  product,
  variant,
}: {
  product: HttpTypes.StoreProduct
  variant?: HttpTypes.StoreProductVariant
}) {
  const { cheapestPrice, variantPrice } = getProductPrice({
    product,
    variantId: variant?.id,
  })

  // Always prioritize variant-specific pricing when variant is provided
  // This ensures product-actions shows correct variant pricing including sales
  const selectedPrice = (variant && variantPrice) ? variantPrice : cheapestPrice

  // Debug logging for pricing issues
  if (process.env.NODE_ENV === 'development') {
    console.log('🏷️ ProductPrice Debug:', {
      hasVariant: !!variant,
      variantId: variant?.id,
      cheapestPrice,
      variantPrice,
      selectedPrice,
      priceType: selectedPrice?.price_type
    })
  }

  if (!selectedPrice) {
    return <div className="block w-32 h-9 bg-mono-200 animate-pulse rounded" />
  }

  return (
    <div className="flex flex-col text-mono-1000">
      <span
        className={clx("text-2xl font-bold", {
          "text-black": selectedPrice.price_type === "sale",
          "text-mono-1000": selectedPrice.price_type !== "sale",
        })}
      >
        {!variant && ""}
        <span
          data-testid="product-price"
          data-value={selectedPrice.calculated_price_number}
        >
          {selectedPrice.calculated_price}
        </span>
      </span>
      {selectedPrice.price_type === "sale" && (
        <>
          <div className="flex items-center gap-3 mt-2">
            <span
              className="text-lg line-through text-mono-500"
              data-testid="original-product-price"
              data-value={selectedPrice.original_price_number}
            >
              {selectedPrice.original_price}
            </span>
            <span className="bg-red-600 text-white px-3 py-1 text-sm font-bold rounded-md">
              SAVE {selectedPrice.percentage_diff}%
            </span>
          </div>
        </>
      )}
    </div>
  )
}
