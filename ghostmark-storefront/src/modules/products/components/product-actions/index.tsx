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
    // Quantity must be declared before any hooks that read it (e.g., inStock useMemo)
    // to avoid temporal dead zone errors when React evaluates dependency arrays.
    const [quantity, setQuantity] = useState(1)
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
            
            const availableQty = v.inventory_quantity
            // If inventory_quantity is null or undefined, treat as unlimited stock
            if (availableQty == null) {
                return true
            }
            
            // If inventory_quantity is 0, the item is out of stock
            if (availableQty === 0) {
                return false
            }
            
            // For initial selection, just check if we have any stock (quantity = 1)
            return availableQty >= 1
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

    // Enhanced stock check based on e-commerce inventory management patterns
    const inStock = useMemo(() => {
        // Early return if no variant selected
        if (!selectedVariant) {
            return false
        }

        // Debug logging for inventory issues
        if (process.env.NODE_ENV === 'development') {
            console.log('📦 Inventory Check Debug:', {
                variantId: selectedVariant.id,
                manage_inventory: selectedVariant.manage_inventory,
                allow_backorder: selectedVariant.allow_backorder,
                inventory_quantity: selectedVariant.inventory_quantity,
                quantity: quantity
            })
        }

        // If we don't manage inventory, we can always add to cart
        if (!selectedVariant.manage_inventory) {
            return true
        }

        // If we allow back orders on the variant, we can add to cart
        if (selectedVariant.allow_backorder) {
            return true
        }

        // Check if there's enough inventory for the requested quantity
        const availableQty = selectedVariant.inventory_quantity
        
        // If inventory management is enabled, check availability
        if (selectedVariant.manage_inventory) {
            // If inventory_quantity is null or undefined, treat as unlimited stock
            // This handles cases where inventory tracking is enabled but quantity is not properly set
            if (availableQty == null) {
                return true
            }
            
            // If inventory_quantity is 0, the item is out of stock
            if (availableQty === 0) {
                return false
            }
            
            // Check if we have enough stock for the requested quantity
            return availableQty >= quantity
        }

        // If we reach here, inventory management is disabled, so it should be available
        return true
    }, [selectedVariant, quantity])

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

    // Explicit flag for POD products (print-on-demand)
    const isPOD = useMemo(() => {
        const p: any = product as any
        
        // Always log the full product object to understand its structure
        console.log('🔍 POD Detection - Full Product Debug:', {
            productId: p?.id,
            title: p?.title,
            handle: p?.handle,
            productType: p?.type,
            metadata: p?.metadata,
            tags: p?.tags,
            options: p?.options,
            variants: p?.variants?.map((v: any) => ({
                id: v.id,
                title: v.title,
                options: v.options,
                metadata: v.metadata
            })),
            fullProduct: p
        })
        
        // Check product metadata for POD indicators (primary method now)
        const productMetadata = p?.metadata || {}
        const isPODProductMetadata = productMetadata?.is_pod === true ||
                                   productMetadata?.print_method === 'print-on-demand' ||
                                   productMetadata?.product_category === 'pod' ||
                                   productMetadata?.type === 'pod' ||
                                   productMetadata?.product_type === 'pod'
        
        // Check product type directly
        const productTypeValue = p?.type?.value || p?.type?.title || p?.type?.name || p?.type || ''
        const isProductTypePOD = (productTypeValue.toString().toLowerCase()).includes('pod')
        
        // Check product title and handle for POD keywords
        const productTitle = (p?.title || '').toLowerCase()
        const productHandle = (p?.handle || '').toLowerCase()
        const podKeywords = ['pod', 'print-on-demand', 'custom', 'personalized', 'customizable', 'design']
        const hasPODInTitle = podKeywords.some(keyword => 
            productTitle.includes(keyword) || productHandle.includes(keyword)
        )
        
        // Check if any variants have customization options
        const hasCustomizationVariants = p?.variants?.some((variant: any) => {
            const variantOptions = variant?.options || []
            return variantOptions.some((option: any) => {
                const optionValue = (option?.value || '').toLowerCase()
                const optionTitle = (option?.title || '').toLowerCase()
                return optionValue.includes('custom') || 
                       optionValue.includes('design') ||
                       optionTitle.includes('custom') || 
                       optionTitle.includes('design')
            })
        })
        
        // Also check product options for customization
        const hasCustomizationOptions = p?.options?.some((option: any) => {
            const optionTitle = (option?.title || '').toLowerCase()
            return optionTitle.includes('custom') || 
                   optionTitle.includes('design') ||
                   optionTitle.includes('personalization')
        })
        
        // Check for specific tags that indicate POD
        const hasPODTags = p?.tags?.some((tag: any) => {
            const tagValue = (tag?.value || tag?.name || tag || '').toLowerCase()
            return podKeywords.some(keyword => tagValue.includes(keyword))
        })
        
        // TEMPORARY: Force POD for testing if product title contains specific keywords
        const forceTestPOD = productTitle.includes('t-shirt') || 
                            productTitle.includes('hoodie') || 
                            productTitle.includes('shirt') ||
                            productTitle.includes('mug') ||
                            productTitle.includes('poster') ||
                            productTitle.includes('print') ||
                            productTitle.includes('custom')
        
        const result = isPODProductMetadata || 
                      isProductTypePOD || 
                      hasPODInTitle || 
                      hasCustomizationVariants || 
                      hasCustomizationOptions || 
                      hasPODTags || 
                      forceTestPOD
        
        // Enhanced debug logging
        console.log('🎯 POD Detection Result for:', p?.title || p?.id, {
            productTitle,
            productHandle,
            productType: productTypeValue,
            productMetadata,
            tags: p?.tags,
            options: p?.options,
            // Detection flags
            isPODProductMetadata,
            isProductTypePOD,
            hasPODInTitle,
            hasCustomizationVariants,
            hasCustomizationOptions,
            hasPODTags,
            forceTestPOD,
            // Final result
            finalResult: result
        })
        
        return result
    }, [product])

    // Check if product is apparel type (clothes2order.com-style)
    const isApparelProduct = useMemo(() => {
        const p: any = product as any
        const typeObj = p?.type ?? p?.product_type
        
        // Check metadata for apparel category
        const hasApparelMetadata = typeObj?.metadata?.category === 'clothing' || 
                                  typeObj?.metadata?.parent_type === 'apparel'
        
        // Check product type value
        const apparelTypes = ['apparel', 'clothing', 'shirt', 'tshirt', 't-shirt', 'hoodie', 'jacket', 'pants', 'dress', 'polo', 'tank', 'sweater']
        const hasApparelType = apparelTypes.some(type => productType.includes(type))
        
        return hasApparelMetadata || hasApparelType
    }, [product, productType])

    // Check if corporate features are available for this apparel product
    const hasCorporateFeatures = useMemo(() => {
        const p: any = product as any
        const typeObj = p?.type ?? p?.product_type
        
        return isApparelProduct && (
            typeObj?.metadata?.target_market === 'both' || 
            typeObj?.metadata?.target_market === 'corporate' ||
            typeObj?.metadata?.bulk_available === true
        )
    }, [product, isApparelProduct])

    // Enhanced quantity selector state for bulk orders (moved above to prevent TDZ)
    const [showBulkPricing, setShowBulkPricing] = useState(false)
    const [bulkPricing, setBulkPricing] = useState<any>(null)
    const [customerType, setCustomerType] = useState<'individual' | 'corporate'>('individual')

    // Check if current variant is a "technology blank" variant (for Buy Now button)
    const isTechnologyBlankVariant = useMemo(() => {
        if (!selectedVariant) return false
        
        // Check variant metadata first (most explicit)
        const variantMetadata = selectedVariant.metadata || {}
        const hasTechnologyBlankMetadata = variantMetadata?.variant_type === 'technology_blank' ||
                                           variantMetadata?.variant_type === 'blank' ||
                                           variantMetadata?.is_blank === true ||
                                           (variantMetadata?.is_technology === true && variantMetadata?.is_blank === true)
        
        // Check variant title for blank indicators
        const variantTitle = (selectedVariant.title || '').toLowerCase()
        const blankKeywords = ['blank', 'technology', 'unprinted', 'plain', 'no design', 'without design']
        const hasBlankTitle = blankKeywords.some(keyword => variantTitle.includes(keyword))
        
        // Check if variant has options that indicate it's a blank product
        const variantOptions = selectedVariant.options || []
        const hasBlankOption = variantOptions.some((option: any) => {
            const optionValue = (option?.value || '').toLowerCase()
            const optionTitle = (option?.title || '').toLowerCase()
            return blankKeywords.some(keyword => 
                optionValue.includes(keyword) || optionTitle.includes(keyword)
            )
        })
        
        // For POD products, if no specific customization is selected, treat as blank
        // This happens when the product type is POD but no design options are chosen
        const isPODWithoutDesign = isPOD && !variantOptions.some((option: any) => {
            const optionValue = (option?.value || '').toLowerCase()
            const optionTitle = (option?.title || '').toLowerCase()
            return optionValue.includes('custom') || 
                   optionValue.includes('design') ||
                   optionTitle.includes('custom') || 
                   optionTitle.includes('design')
        })
        
        const result = hasTechnologyBlankMetadata || hasBlankTitle || hasBlankOption || isPODWithoutDesign
        
        // Debug logging for technology blank detection
        if (process.env.NODE_ENV === 'development' && selectedVariant) {
            console.log('Technology Blank Detection Debug for variant:', selectedVariant?.title || selectedVariant?.id, {
                variantTitle: selectedVariant.title,
                variantMetadata: selectedVariant.metadata,
                hasTechnologyBlankMetadata,
                hasBlankTitle,
                hasBlankOption,
                isPODWithoutDesign,
                isPOD,
                finalResult: result
            })
        }
        
        return result
    }, [selectedVariant, isPOD])

    // Fetch bulk pricing when quantity changes
    useEffect(() => {
        if (selectedVariant?.id && quantity >= 1) {
            fetchBulkPricing()
        }
    }, [selectedVariant?.id, quantity, customerType])

    const fetchBulkPricing = async () => {
        if (!selectedVariant?.id) return

        try {
            const params = new URLSearchParams({
                productId: product.id,
                variantId: selectedVariant.id,
                quantity: quantity.toString(),
                customerType
            })
            
            const response = await fetch(`/store/products/bulk-pricing?${params}`)
            if (response.ok) {
                const result = await response.json()
                setBulkPricing(result.data)
                setShowBulkPricing(quantity >= 10 || customerType === 'corporate')
            }
        } catch (error) {
            console.error('Failed to fetch bulk pricing:', error)
        }
    }

    // Route behavior by type - enhanced for clothes2order.com style
    // - POD: go to design/customize page with quantity
    // - Others: show bulk pricing options then proceed to cart/checkout
    const handleAddToCart = async () => {
        if (!selectedVariant?.id) return null

        setIsAdding(true)

        try {
            if (isPOD) {
                const params = new URLSearchParams()
                params.set("v_id", selectedVariant.id)
                params.set("quantity", quantity.toString())
                router.push(`/${countryCode}/design/${product.id}?${params.toString()}`)
                return
            }

            // Enhanced cart logic with bulk pricing support
            const resp = await fetch("/api/cart/add", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    variantId: selectedVariant.id,
                    quantity,
                    bulkPricing: bulkPricing,
                    countryCode,
                }),
            })
            
            if (!resp.ok) {
                try {
                    const j = await resp.json()
                    console.error("Failed to add to cart:", j?.message || resp.statusText)
                } catch {
                    console.error("Failed to add to cart:", resp.status)
                }
                return
            }

            // Trigger background page refresh to update cart
            router.refresh()

            // For bulk orders (25+), go to quote page, otherwise checkout
            if (quantity >= 25) {
                router.push(`/${countryCode}/quote`)
            } else {
                router.push(`/${countryCode}/checkout`)
            }
        } finally {
            setIsAdding(false)
        }
    }

    // Handle direct purchase for blank POD products (skip design dashboard)
    const handleBuyNow = async () => {
        if (!selectedVariant?.id) return null

        setIsAdding(true)

        try {
            // Add blank product directly to cart without customization
            const resp = await fetch("/api/cart/add", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    variantId: selectedVariant.id,
                    quantity,
                    bulkPricing: bulkPricing,
                    countryCode,
                    isBlankProduct: true, // Flag to indicate this is a blank product purchase
                }),
            })
            
            if (!resp.ok) {
                try {
                    const j = await resp.json()
                    console.error("Failed to add to cart:", j?.message || resp.statusText)
                } catch {
                    console.error("Failed to add to cart:", resp.status)
                }
                return
            }

            // Trigger background page refresh to update cart
            router.refresh()

            // For bulk orders (25+), go to quote page, otherwise checkout
            if (quantity >= 25) {
                router.push(`/${countryCode}/quote`)
            } else {
                router.push(`/${countryCode}/checkout`)
            }
        } finally {
            setIsAdding(false)
        }
    }

    return (
        <>
            <div className="flex flex-col gap-y-2" ref={actionsRef}>
                <div>
                    {/* Show options when they exist */}
                    {(product.options?.length ?? 0) > 0 && (
                        <div className="flex flex-col gap-y-4">
                            <div className="mb-2">
                                <span className="text-sm font-medium text-mono-1000">Product Options</span>
                                <p className="text-xs text-ui-fg-muted mt-1">
                                    Select your preferred options for this {isPOD ? 'print-on-demand' : isApparelProduct ? 'apparel' : ''} product
                                </p>
                            </div>
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
                    
                    {/* Fallback: Show variant selection when no options but multiple variants exist */}
                    {(product.options?.length ?? 0) === 0 && (product.variants?.length ?? 0) > 1 && (
                        <div className="flex flex-col gap-y-4">
                            <div className="mb-2">
                                <span className="text-sm font-medium text-mono-1000">Available Variants</span>
                                <p className="text-xs text-ui-fg-muted mt-1">
                                    Choose from available {isPOD ? 'print-on-demand' : isApparelProduct ? 'apparel' : 'product'} variants
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {product.variants?.map((variant) => {
                                    const isSelected = selectedVariant?.id === variant.id
                                    const variantTitle = variant.title || `Variant ${variant.sku || variant.id}`
                                    return (
                                        <button
                                            key={variant.id}
                                            onClick={() => {
                                                const variantOptions = optionsAsKeymap(variant.options)
                                                setOptions(variantOptions ?? {})
                                            }}
                                            className={clx(
                                                "border rounded-md px-3 py-2 h-10 inline-flex items-center justify-center text-sm whitespace-nowrap",
                                                isSelected 
                                                    ? "bg-black text-white border-ui-border-interactive"
                                                    : "border-ui-border-base bg-ui-bg-subtle hover:shadow-elevation-card-rest transition-shadow ease-in-out duration-150"
                                            )}
                                            disabled={!!disabled || isAdding}
                                            data-testid="variant-button"
                                        >
                                            {variantTitle}
                                        </button>
                                    )
                                })}
                            </div>
                            <Divider />
                        </div>
                    )}
                </div>


                {/* Quantity Selector */}
                <div className="mb-4">
                    <label className="block text-sm font-medium text-mono-1000 mb-2">
                        Quantity
                    </label>
                    <div className="flex items-center space-x-3">
                        <button
                            onClick={() => setQuantity(Math.max(1, quantity - 1))}
                            className="w-8 h-8 rounded border border-mono-300 flex items-center justify-center hover:bg-mono-100 text-mono-1000 transition-colors"
                            disabled={quantity <= 1}
                        >
                            -
                        </button>
                        <input
                            type="number"
                            min="1"
                            value={quantity}
                            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-20 text-center border border-mono-300 rounded px-2 py-1 text-mono-1000 bg-mono-0 focus:border-mono-1000 focus:outline-none"
                        />
                        <button
                            onClick={() => setQuantity(quantity + 1)}
                            className="w-8 h-8 rounded border border-mono-300 flex items-center justify-center hover:bg-mono-100 text-mono-1000 transition-colors"
                        >
                            +
                        </button>
                        <div className="flex gap-2 ml-4">
                            {[10, 25, 50, 100].map((qty) => (
                                <button
                                    key={qty}
                                    onClick={() => setQuantity(qty)}
                                    className="px-3 py-1 text-xs border border-mono-300 rounded hover:bg-mono-100 text-mono-1000 transition-colors"
                                >
                                    {qty}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Enhanced Price Display with Sale Information */}
                <div className="mb-4">
                    {selectedVariant && (() => {
                        try {
                            const priceInfo = getProductPrice({ product, variantId: selectedVariant.id })
                            const variantPrice = priceInfo?.variantPrice
                            
                            // Debug logging
                            if (process.env.NODE_ENV === 'development') {
                                console.log('💰 Price Debug Info:', {
                                    selectedVariantId: selectedVariant.id,
                                    priceInfo,
                                    variantPrice,
                                    calculated_price_number: variantPrice?.calculated_price_number,
                                    original_price_number: variantPrice?.original_price_number,
                                    price_type: variantPrice?.price_type,
                                    percentage_diff: variantPrice?.percentage_diff
                                })
                            }
                            
                            if (!variantPrice) {
                                return <div className="block w-32 h-9 bg-mono-200 animate-pulse rounded" />
                            }
                            
                            const isSale = variantPrice.price_type === "sale"
                            
                            return (
                                <div className="flex flex-col">
                                    {/* Product Price with Sale Display */}
                                    <div className="">
                                        <ProductPrice product={product} variant={selectedVariant} />
                                    </div>
                                </div>
                            )
                        } catch (error) {
                            console.error('Error calculating price:', error)
                            return (
                                <div className="flex flex-col text-mono-1000">
                                    <span className="text-2xl font-bold">Price Unavailable</span>
                                </div>
                            )
                        }
                    })()}
                </div>

                {/* Bulk Pricing Display */}
                {showBulkPricing && bulkPricing && (
                    <div className="bg-mono-50 border border-mono-300 rounded-lg p-4 mb-4">
                        <h4 className="font-medium text-mono-1000 mb-2">
                            Bulk Pricing Applied
                        </h4>
                        <div className="text-sm text-mono-700 space-y-1">
                            <div className="flex justify-between">
                                <span>Unit Price:</span>
                                <span>${bulkPricing.pricing.unitPrice.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Setup Fee:</span>
                                <span>${bulkPricing.pricing.setupFee.toFixed(2)}</span>
                            </div>
                            {bulkPricing.pricing.discounts.total > 0 && (
                                <div className="flex justify-between font-medium">
                                    <span>Total Discount:</span>
                                    <span>-{bulkPricing.pricing.discounts.total}%</span>
                                </div>
                            )}
                            <div className="flex justify-between font-bold text-lg border-t border-mono-300 pt-2 text-mono-1000">
                                <span>Total:</span>
                                <span>${bulkPricing.pricing.total.toFixed(2)}</span>
                            </div>
                            {bulkPricing.pricing.savings > 0 && (
                                <div className="text-center text-mono-800 font-medium">
                                    You save ${bulkPricing.pricing.savings.toFixed(2)}!
                                </div>
                            )}
                        </div>
                        
                        {/* Next Tier Upsell */}
                        {bulkPricing.nextTierDiscount && (
                            <div className="mt-3 text-xs text-mono-600">
                                Order {bulkPricing.nextTierDiscount.quantity} or more to save an additional 
                                ${bulkPricing.nextTierDiscount.savings.toFixed(2)}
                            </div>
                        )}
                    </div>
                )}

                {isPOD ? (
                    // For POD products, always show both Customise and Buy Now buttons
                    <div className="flex gap-2">
                        <Button
                            onClick={handleAddToCart}
                            disabled={
                                !inStock ||
                                !selectedVariant ||
                                !!disabled ||
                                isAdding ||
                                !isValidVariant ||
                                !hasPrice ||
                                quantity < 1
                            }
                            variant="primary"
                            className="flex-1 h-10"
                            isLoading={isAdding}
                            data-testid="customize-product-button"
                        >
                            {!selectedVariant && !options
                                ? "Select variant"
                                : !hasPrice
                                    ? "Out of stock"
                                    : !inStock || !isValidVariant
                                        ? "Out of stock"
                                        : quantity >= 25
                                            ? "Get Quote & Customise"
                                            : "Customise & Checkout"}
                        </Button>
                        <Button
                            onClick={handleBuyNow}
                            disabled={
                                !isTechnologyBlankVariant ||
                                !inStock ||
                                !selectedVariant ||
                                !!disabled ||
                                isAdding ||
                                !isValidVariant ||
                                !hasPrice ||
                                quantity < 1
                            }
                            variant="secondary"
                            className="flex-1 h-10"
                            isLoading={isAdding}
                            data-testid="buy-now-button"
                        >
                            {!selectedVariant && !options
                                ? "Select variant"
                                : !hasPrice
                                    ? "Out of stock"
                                    : !inStock || !isValidVariant
                                        ? "Out of stock"
                                        : !isTechnologyBlankVariant
                                            ? "Select Blank Technology"
                                            : quantity >= 25
                                                ? "Get Quote (Blank)"
                                                : "Buy Now (Blank)"}
                        </Button>
                    </div>
                ) : (
                    // For non-POD products, show single button
                    <Button
                        onClick={handleAddToCart}
                        disabled={
                            !inStock ||
                            !selectedVariant ||
                            !!disabled ||
                            isAdding ||
                            !isValidVariant ||
                            !hasPrice ||
                            quantity < 1
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
                                    : quantity >= 25
                                        ? "Get Quote"
                                        : "Add to Cart"}
                    </Button>
                )}
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
                    handleBuyNow={handleBuyNow}
                    isPODProduct={isPOD}
                    isTechnologyBlankVariant={isTechnologyBlankVariant}
                    isAdding={isAdding}
                    show={!inView}
                    optionsDisabled={!!disabled || isAdding}
                />
            </div>
        </>
    )
}