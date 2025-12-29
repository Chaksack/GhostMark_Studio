import { Text, clx } from "@medusajs/ui"
import { VariantPrice } from "types/global"

type Props = {
  price: VariantPrice
  // Optional class overrides to better match different card designs
  priceClassName?: string
  originalClassName?: string
  containerClassName?: string
}

export default async function PreviewPrice({
  price,
  priceClassName,
  originalClassName,
  containerClassName,
}: Props) {
  if (!price) {
    return null
  }

  return (
    <div className={clx("flex flex-col", containerClassName)}>
      <div className="flex items-center gap-2">
        <Text
          className={clx(
            {
              "font-bold text-mono-1000": price.price_type === "sale",
              "font-medium text-mono-1000": price.price_type !== "sale",
            },
            priceClassName
          )}
          data-testid="price"
        >
          {price.calculated_price}
        </Text>
        {price.price_type === "sale" && (
          <span className="bg-red-600 text-white px-1 py-0.5 text-xs font-bold rounded">
            SALE
          </span>
        )}
      </div>
      {price.price_type === "sale" && (
        <div className="flex items-center gap-1">
          <Text
            className={clx(
              "line-through text-mono-500 text-sm",
              originalClassName
            )}
            data-testid="original-price"
          >
            {price.original_price}
          </Text>
          <Text className="text-mono-700 text-xs font-medium">
            Save {price.percentage_diff}%
          </Text>
        </div>
      )}
    </div>
  )
}
