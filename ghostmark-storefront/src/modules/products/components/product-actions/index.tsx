"use client"
import { useIntersection } from "@lib/hooks/use-in-view"
import { HttpTypes } from "@medusajs/types"
import { Button } from "@medusajs/ui"
import Divider from "@modules/common/components/divider"
import OptionSelect from "@modules/products/components/product-actions/option-select"
import { isEqual } from "lodash"
import { useParams, usePathname, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import ProductPrice from "../product-price"
import MobileActions from "./mobile-actions"
import { useRouter } from "next/navigation"
import { getProductPrice } from "@lib/util/get-product-price"

type ProductActionsProps = {
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
  disabled?: boolean
}

const optionsAsKeymap = (
  variantOptions: HttpTypes.StoreProductVariant["options"]
) => {
  return variantOptions?.reduce((acc: Record<string, string>, varopt: any) => {
    acc[varopt.option_id] = varopt.value
    return acc
  }, {})
}

export default function ProductActions({
  product,
  disabled,
}: ProductActionsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [options, setOptions] = useState<Record<string, string | undefined>>({})
  const [isAdding, setIsAdding] = useState(false)
  const countryCode = useParams().countryCode as string

  // Default selection strategy
  // 1) If URL contains v_id and matches a variant, select it
  // 2) Else select the first variant that is purchasable in the region (has price)
  //    AND effectively in stock (manage_inventory=false OR allow_backorder OR inventory_quantity>0)
  // 3) Fallback to the first variant that has a price
  // 4) Final fallback: the first variant
  useEffect(() => {
    // Only initialize when we have variants and no options have been chosen yet
    if (!product?.variants?.length) return
    const hasAnyOptionSet = Object.values(options).some((v) => typeof v !== 'undefined')
    if (hasAnyOptionSet) return

    const allVariants = product.variants as any[]

    // Helper: stock status mirroring the inStock logic below
    const isVariantInStock = (v: any) => {
      if (!v) return false
      if (!v.manage_inventory) return true
      if (v.allow_backorder) return true
      return (v.inventory_quantity || 0) > 0
    }

    // Helper: price availability for region
    const hasVariantPrice = (v: any) => {
      try {
        const { variantPrice } = getProductPrice({ product, variantId: v?.id })
        return !!variantPrice
      } catch {
        return false
      }
    }

    // 1) Honor v_id from URL if present and valid
    const vIdFromUrl = searchParams?.get('v_id') || undefined
    const variantFromUrl = vIdFromUrl
      ? allVariants.find((v) => v.id === vIdFromUrl)
      : undefined
    if (variantFromUrl) {
      const variantOptions = optionsAsKeymap(variantFromUrl.options)
      setOptions(variantOptions ?? {})
      return
    }

    // 2) Pick first priced AND in-stock variant
    const pricedAndStocked = allVariants.find(
      (v) => hasVariantPrice(v) && isVariantInStock(v)
    )
    if (pricedAndStocked) {
      const variantOptions = optionsAsKeymap(pricedAndStocked.options)
      setOptions(variantOptions ?? {})
      return
    }

    // 3) Pick first priced variant
    const priced = allVariants.find((v) => hasVariantPrice(v))
    if (priced) {
      const variantOptions = optionsAsKeymap(priced.options)
      setOptions(variantOptions ?? {})
      return
    }

    // 4) Fallback to first variant
    const first = allVariants[0]
    if (first) {
      const variantOptions = optionsAsKeymap(first.options)
      setOptions(variantOptions ?? {})
    }
  }, [product?.variants, searchParams, product])

  const selectedVariant = useMemo(() => {
    if (!product.variants || product.variants.length === 0) {
      return
    }

    return product.variants.find((v) => {
      const variantOptions = optionsAsKeymap(v.options)
      return isEqual(variantOptions, options)
    })
  }, [product.variants, options])

  // update the options when a variant is selected
  const setOptionValue = (optionId: string, value: string) => {
    setOptions((prev) => ({
      ...prev,
      [optionId]: value,
    }))
  }

  //check if the selected options produce a valid variant
  const isValidVariant = useMemo(() => {
    return product.variants?.some((v) => {
      const variantOptions = optionsAsKeymap(v.options)
      return isEqual(variantOptions, options)
    })
  }, [product.variants, options])

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString())
    const value = isValidVariant ? selectedVariant?.id : null

    if (params.get("v_id") === value) {
      return
    }

    if (value) {
      params.set("v_id", value)
    } else {
      params.delete("v_id")
    }

    router.replace(pathname + "?" + params.toString())
  }, [selectedVariant, isValidVariant])

  // check if the selected variant is in stock
  const inStock = useMemo(() => {
    // If we don't manage inventory, we can always add to cart
    if (selectedVariant && !selectedVariant.manage_inventory) {
      return true
    }

    // If we allow back orders on the variant, we can add to cart
    if (selectedVariant?.allow_backorder) {
      return true
    }

    // If there is inventory available, we can add to cart
    if (
      selectedVariant?.manage_inventory &&
      (selectedVariant?.inventory_quantity || 0) > 0
    ) {
      return true
    }

    // Otherwise, we can't add to cart
    return false
  }, [selectedVariant])

  // Determine if the selected variant has a calculable price for current region
  const hasPrice = useMemo(() => {
    try {
      const { variantPrice } = getProductPrice({
        product,
        variantId: selectedVariant?.id,
      })
      return !!variantPrice
    } catch {
      return false
    }
  }, [product, selectedVariant?.id])

  const actionsRef = useRef<HTMLDivElement>(null)

  const inView = useIntersection(actionsRef, "0px")

  // Helper to extract a normalized product type string
  const productType = useMemo(() => {
    const p: any = product as any
    const t = p?.type ?? p?.product_type
    let raw: string | undefined
    if (!t) raw = undefined
    else if (typeof t === "string") raw = t
    else raw = t?.value || t?.title || t?.name || t?.handle
    return (raw || "").toString().trim().toLowerCase()
  }, [product])

  // Route behavior by type:
  // - POD: go to design/customize page
  // - APPAREL: add to cart and go straight to checkout
  const handleAddToCart = async () => {
    if (!selectedVariant?.id) return null

    setIsAdding(true)

    try {
      if (productType === "pod") {
        const params = new URLSearchParams()
        params.set("v_id", selectedVariant.id)
        router.push(`/${countryCode}/design/${product.id}?${params.toString()}`)
        return
      }

      // Default (including apparel): add to cart then go to checkout
      // We use a lightweight API route to perform server-side addToCart logic safely
      const resp = await fetch("/api/cart/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variantId: selectedVariant.id,
          quantity: 1,
          countryCode,
        }),
      })
      if (!resp.ok) {
        // If the API fails, stay on page and surface a console error
        try {
          const j = await resp.json()
          // eslint-disable-next-line no-console
          console.error("Failed to add to cart:", j?.message || resp.statusText)
        } catch {
          // eslint-disable-next-line no-console
          console.error("Failed to add to cart:", resp.status)
        }
        return
      }
      // Redirect to checkout
      router.push(`/${countryCode}/checkout`)
    } finally {
      // Reset loading state in case navigation is blocked
      setIsAdding(false)
    }
  }

  return (
    <>
      <div className="flex flex-col gap-y-2" ref={actionsRef}>
        <div>
          {(product.variants?.length ?? 0) > 1 && (
            <div className="flex flex-col gap-y-4">
              {(product.options || []).map((option) => {
                return (
                  <div key={option.id}>
                    <OptionSelect
                      option={option}
                      current={options[option.id]}
                      updateOption={setOptionValue}
                      title={option.title ?? ""}
                      data-testid="product-options"
                      disabled={!!disabled || isAdding}
                    />
                  </div>
                )
              })}
              <Divider />
            </div>
          )}
        </div>

        <ProductPrice product={product} variant={selectedVariant} />

        <Button
          onClick={handleAddToCart}
          disabled={
            !inStock ||
            !selectedVariant ||
            !!disabled ||
            isAdding ||
            !isValidVariant ||
            !hasPrice
          }
          variant="primary"
          className="w-full h-10"
          isLoading={isAdding}
          data-testid="add-product-button"
        >
          {!selectedVariant && !options
            ? "Select variant"
            : !hasPrice
            ? "Out of stock"
            : !inStock || !isValidVariant
            ? "Out of stock"
            : productType === "pod"
            ? "Customize & Order"
            : "Buy now"}
        </Button>
        {!hasPrice && selectedVariant && (
          <p className="text-xs text-ui-fg-muted">
            This variant is not available for purchase in your selected region.
          </p>
        )}
        <MobileActions
          product={product}
          variant={selectedVariant}
          options={options}
          updateOptions={setOptionValue}
          inStock={inStock}
          handleAddToCart={handleAddToCart}
          isAdding={isAdding}
          show={!inView}
          optionsDisabled={!!disabled || isAdding}
        />
      </div>
    </>
  )
}
