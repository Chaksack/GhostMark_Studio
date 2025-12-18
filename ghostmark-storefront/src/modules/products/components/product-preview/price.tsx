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
    <span className={containerClassName}>
      {price.price_type === "sale" && (
        <Text
          className={clx(
            "line-through text-ui-fg-muted mr-1",
            originalClassName
          )}
          data-testid="original-price"
        >
          {price.original_price}
        </Text>
      )}
      <Text
        className={clx(
          "text-ui-fg-muted",
          {
            "text-ui-fg-interactive": price.price_type === "sale",
          },
          priceClassName
        )}
        data-testid="price"
      >
        {price.calculated_price}
      </Text>
    </span>
  )
}
