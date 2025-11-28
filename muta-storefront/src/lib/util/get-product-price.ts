import { HttpTypes } from "@medusajs/types"
import { getPercentageDiff } from "./get-percentage-diff"
import { convertToLocale } from "./money"

export const getPricesForVariant = (variant: any) => {
  const calc = variant?.calculated_price
  const amount = calc?.calculated_amount
  // Ensure we only compute for variants that truly have a numeric calculated amount
  if (typeof amount !== "number") {
    return null
  }

  return {
    calculated_price_number: amount,
    calculated_price: convertToLocale({
      amount,
      currency_code: calc.currency_code,
    }),
    original_price_number: calc.original_amount,
    original_price: convertToLocale({
      amount: calc.original_amount,
      currency_code: calc.currency_code,
    }),
    currency_code: calc.currency_code,
    price_type: calc.calculated_price?.price_list_type,
    percentage_diff: getPercentageDiff(
      calc.original_amount,
      amount
    ),
  }
}

export function getProductPrice({
  product,
  variantId,
}: {
  product: HttpTypes.StoreProduct
  variantId?: string
}) {
  if (!product || !product.id) {
    throw new Error("No product provided")
  }

  const cheapestPrice = () => {
    if (!product || !product.variants?.length) {
      return null
    }

    const cheapestVariant: any = product.variants
      .filter((v: any) => typeof v?.calculated_price?.calculated_amount === "number")
      .sort((a: any, b: any) => {
        return (
          a.calculated_price.calculated_amount -
          b.calculated_price.calculated_amount
        )
      })[0]

    return getPricesForVariant(cheapestVariant)
  }

  const variantPrice = () => {
    if (!product || !variantId) {
      return null
    }

    const variant: any = product.variants?.find(
      (v) => v.id === variantId || v.sku === variantId
    )

    if (!variant) {
      return null
    }

    return getPricesForVariant(variant)
  }

  return {
    product,
    cheapestPrice: cheapestPrice(),
    variantPrice: variantPrice(),
  }
}
