'use client'

import { useCallback, useMemo, useState, useEffect } from 'react'
import type { HttpTypes } from '@medusajs/types'
import dynamic from 'next/dynamic'
import { getProductPrice } from '@lib/util/get-product-price'
import { useRouter } from 'next/navigation'
import { convertToLocale } from '@lib/util/money'

// Critical: react-konva/konva pulls in the Node canvas package during SSR.
// Disabling SSR for the editor ensures it only renders on the client,
// preventing "Module not found: Can't resolve 'canvas'" during build.
const BaseDesignEditor = dynamic(() => import('.'), { ssr: false })

type Props = {
  product: HttpTypes.StoreProduct
  images: HttpTypes.StoreProductImage[]
  selectedVariantId?: string
  countryCode: string
  productMockupUrl?: string
  onAddToCart?: (payload: {
    designDataJson: string
    previewImageUrl: string
    isCustomized: true
  }) => Promise<void> | void
}

export default function DesignEditorWrapper(props: Props) {
  const { product, images, selectedVariantId, countryCode, productMockupUrl, onAddToCart } = props
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exporter, setExporter] = useState<(() => Promise<{ designDataJson: string; previewDataUrl: string; designOnlyDataUrl: string }>) | null>(null)
  const [selectedVariantIdState, setSelectedVariantIdState] = useState<string | undefined>(selectedVariantId || product?.variants?.[0]?.id)
  const router = useRouter()
  // Fallback pricing fetch state (used when calculated_price is missing on the selected variant)
  const [priceLoading, setPriceLoading] = useState(false)
  const [priceError, setPriceError] = useState<string | null>(null)
  const [fetchedPriceString, setFetchedPriceString] = useState<string | null>(null)

  const variant = useMemo(() => {
    return (
      product?.variants?.find((v) => v.id === selectedVariantIdState) ||
      product?.variants?.[0]
    )
  }, [product, selectedVariantIdState])

  const priceInfo = useMemo(() => {
    try {
      const { variantPrice } = getProductPrice({ product, variantId: variant?.id })
      return variantPrice
    } catch {
      return null
    }
  }, [product, variant?.id])

  // If the selected variant has no calculated_price in the server-fetched product payload,
  // fetch a fresh price for the current region via a lightweight API route.
  // This runs when the selected variant changes or when local priceInfo is missing.
  // Note: we reset fetchedPrice when a valid local price becomes available.
  const variantIdForPricing = variant?.id
  useEffect(() => {
    let cancelled = false
    // Reset remote price if local computed price exists
    if (priceInfo?.calculated_price && fetchedPriceString) {
      setFetchedPriceString(null)
      setPriceError(null)
    }
    if (!variantIdForPricing) return
    if (priceInfo?.calculated_price) return

    ;(async () => {
      try {
        setPriceLoading(true)
        setPriceError(null)
        const res = await fetch(`/api/variants/${variantIdForPricing}?countryCode=${encodeURIComponent(countryCode)}`, { cache: 'no-store' })
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          throw new Error(j?.message || `Failed to fetch variant price (${res.status})`)
        }
        const data = await res.json()
        if (cancelled) return
        const formatted: string | null = data?.price?.formatted ?? null
        setFetchedPriceString(formatted)
      } catch (e: any) {
        if (cancelled) return
        setPriceError(e?.message || 'Failed to fetch price')
        setFetchedPriceString(null)
      } finally {
        if (!cancelled) setPriceLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variantIdForPricing, countryCode, !!priceInfo?.calculated_price])

  const mockupUrl = useMemo(() => {
    // Prefer explicitly provided mockupUrl, then currently selected variant image,
    // then the images prop (may be variant-aware from initial page load), then product images, then placeholder
    const firstFromImagesProp = (images && images.length > 0) ? images[0]?.url : undefined
    return (
      productMockupUrl ||
      (variant?.images && variant.images[0]?.url) ||
      firstFromImagesProp ||
      (product.images && product.images[0]?.url)
    )
  }, [productMockupUrl, images, product, variant])

  // State for enhanced design areas from variant API
  const [designAreasData, setDesignAreasData] = useState<{
    designAreas: any[]
    productTypeDesignAreas: any[]
    designCapabilities: any
  } | null>(null)
  
  // State for design cost
  const [designCost, setDesignCost] = useState(0)

  // Fetch enhanced design areas when variant changes
  useEffect(() => {
    if (!variant?.id || !countryCode) return
    
    const fetchDesignAreas = async () => {
      try {
        // First try the variant API
        const response = await fetch(`/api/variants/${variant.id}?countryCode=${countryCode}`)
        if (response.ok) {
          const data = await response.json()
          setDesignAreasData({
            designAreas: data.designAreas || [],
            productTypeDesignAreas: data.productTypeDesignAreas || [],
            designCapabilities: data.designCapabilities || {}
          })
        } else {
          // Fallback: try to get design areas from product type if available
          console.log('Variant API failed, falling back to product type detection')
          if (product?.type_id) {
            try {
              const productTypeResponse = await fetch(`/api/store/product-types/${product.type_id}/design-areas`)
              if (productTypeResponse.ok) {
                const productTypeData = await productTypeResponse.json()
                setDesignAreasData({
                  designAreas: productTypeData.designAreas || [],
                  productTypeDesignAreas: productTypeData.designAreas || [],
                  designCapabilities: productTypeData.capabilities || {}
                })
              }
            } catch (fallbackError) {
              console.warn('Product type fallback also failed:', fallbackError)
            }
          }
        }
      } catch (error) {
        console.warn('Failed to fetch design areas:', error)
      }
    }
    
    fetchDesignAreas()
  }, [variant?.id, countryCode, product?.type_id])

  // Resolve mockup zones from variant or product metadata. Expect either an object or a JSON string.
  const mockupZones = useMemo(() => {
    const metaVariant = (variant as any)?.metadata
    const metaProduct = (product as any)?.metadata
    const zonesRaw = (metaVariant && (metaVariant.mockup_zones || metaVariant.mockupZones))
      || (metaProduct && (metaProduct.mockup_zones || metaProduct.mockupZones))
    if (!zonesRaw) return undefined as undefined | Record<string, { x: number; y: number; w: number; h: number }>
    try {
      const parsed = typeof zonesRaw === 'string' ? JSON.parse(zonesRaw) : zonesRaw
      if (parsed && typeof parsed === 'object') return parsed
    } catch {}
    return undefined
  }, [variant, product])

  // Enhanced mockup zones that can use design areas if legacy zones aren't available
  const enhancedMockupZones = useMemo(() => {
    // Prefer existing mockup zones for backward compatibility
    if (mockupZones) return mockupZones
    
    // Fall back to design areas from product type if available
    if (designAreasData?.designAreas?.length) {
      const zones: Record<string, { x: number; y: number; w: number; h: number }> = {}
      
      designAreasData.designAreas.forEach((area: any) => {
        // Convert design area boundaries to mockup zone format (normalized 0-1 coordinates)
        // Assuming mockup image dimensions for normalization - this should be adjusted based on actual mockup size
        const mockupWidth = 500 // Default mockup width - should be dynamic
        const mockupHeight = 600 // Default mockup height - should be dynamic
        
        zones[area.type || 'default'] = {
          x: (area.boundaries?.x || area.position?.x || 0) / mockupWidth,
          y: (area.boundaries?.y || area.position?.y || 0) / mockupHeight,
          w: (area.boundaries?.w || area.dimensions?.width || 200) / mockupWidth,
          h: (area.boundaries?.h || area.dimensions?.height || 200) / mockupHeight
        }
      })
      
      return Object.keys(zones).length > 0 ? zones : undefined
    }
    
    return undefined
  }, [mockupZones, designAreasData])

  const handleFinalizeAndAddToCart = useCallback(async () => {
    if (!variant?.id) return

    // Gather the serialized Konva stage JSON and a preview image (data URL)
    let designDataJson = JSON.stringify({})
    let previewImageUrl = mockupUrl
    let designOnlyDataUrl: string | undefined
    if (exporter) {
      try {
        const { designDataJson: ddj, previewDataUrl, designOnlyDataUrl: dOnly } = await exporter()
        if (ddj) designDataJson = ddj
        if (previewDataUrl) previewImageUrl = previewDataUrl
        if (dOnly) designOnlyDataUrl = dOnly
      } catch (_) {
        // fall back to defaults
      }
    }
    // Optionally upload the raw design-only PNG to obtain a stable URL
    let rawDesignImageUrl: string | undefined
    if (designOnlyDataUrl && designOnlyDataUrl.startsWith('data:')) {
      try {
        const up = await fetch('/api/uploads/image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dataUrl: designOnlyDataUrl, filename: `design-${variant?.id || 'unknown'}.png` }),
        })
        if (up.ok) {
          const j = await up.json()
          rawDesignImageUrl = j?.url || undefined
        }
      } catch {}
    }
    const payload = {
      designDataJson,
      previewImageUrl,
      isCustomized: true as const,
      rawDesignImageUrl: rawDesignImageUrl || null,
      mockupImageUrl: mockupUrl || null,
      mockupZones: enhancedMockupZones || null,
      designAreas: designAreasData?.designAreas || null,
      designCapabilities: designAreasData?.designCapabilities || null,
      designCost: 0, // Will be calculated in the design editor
    }

    try {
      setSubmitting(true)
      setError(null)
      if (onAddToCart) {
        await onAddToCart(payload)
        // After successful add, redirect to checkout
        router.push(`/${countryCode}/checkout`)
        return
      }

      await fetch('/api/custom-cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variantId: variant.id,
          designMetadata: payload,
          countryCode,
          quantity: 1,
        }),
      }).then(async (r) => {
        if (!r.ok) {
          const j = await r.json().catch(() => ({}))
          throw new Error(j?.message || `Failed to add to cart (${r.status})`)
        }
      })
      // Redirect to checkout after successful add
      router.push(`/${countryCode}/checkout`)
    } catch (e: any) {
      setError(e?.message || 'Failed to add customized item to cart')
    } finally {
      setSubmitting(false)
    }
  }, [variant?.id, mockupUrl, countryCode, onAddToCart, exporter])

  const priceDisplay = priceLoading
    ? '…'
    : (fetchedPriceString || priceInfo?.calculated_price || null)

  // Price breakdown for dropdown: show product cost (variant price), print cost, and total
  // Minimal implementation: use a flat print cost of 5.00 in the product's currency when available
  const priceBreakdown = useMemo(() => {
    const amountNumber = priceInfo?.calculated_price_number
    const currency = priceInfo?.currency_code
    // Default print cost flat value
    const printCostNumber = typeof amountNumber === 'number' ? 5_00 / 100 : null // will correct scaling below

    if (typeof amountNumber === 'number' && currency) {
      // amountNumber is already in minor units according to convertToLocale usage in get-product-price
      const productFormatted = convertToLocale({ amount: amountNumber, currency_code: currency })
      // Set a flat print cost of 500 minor units (i.e., 5.00 in the currency)
      const printMinor = 50
      const printFormatted = convertToLocale({ amount: printMinor, currency_code: currency })
      const totalFormatted = convertToLocale({ amount: amountNumber + printMinor, currency_code: currency })
      return {
        currency,
        productAmountMinor: amountNumber,
        printAmountMinor: printMinor,
        totalAmountMinor: amountNumber + printMinor,
        productFormatted,
        printFormatted,
        totalFormatted,
      }
    }

    // Fallback when numbers are not available: keep strings where possible
    return {
      currency: priceInfo?.currency_code || null,
      productAmountMinor: null as unknown as number | null,
      printAmountMinor: null as unknown as number | null,
      totalAmountMinor: null as unknown as number | null,
      productFormatted: priceDisplay || null,
      printFormatted: priceInfo?.currency_code
        ? convertToLocale({ amount: 50, currency_code: priceInfo.currency_code })
        : null,
      totalFormatted: null,
    }
  }, [priceInfo, priceDisplay])

  // Show the TOTAL in the top price button if available; otherwise fall back to the base priceDisplay
  const topPriceDisplay = useMemo(() => {
    return priceBreakdown?.totalFormatted || priceDisplay
  }, [priceBreakdown?.totalFormatted, priceDisplay])

  return (
    <div className="relative w-full h-full">
      {/* Render the base editor UI */}
      <BaseDesignEditor
        mockupUrl={mockupUrl}
        mockupZones={enhancedMockupZones}
        designAreas={designAreasData?.designAreas}
        designCapabilities={designAreasData?.designCapabilities}
        onDesignCostChange={setDesignCost}
        onRegisterExporter={setExporter}
        variants={(product?.variants || []).map((v: any) => ({ id: v.id, title: v.title || v.sku || v.id }))}
        selectedVariantId={variant?.id}
        onSelectVariant={setSelectedVariantIdState}
        priceString={topPriceDisplay}
        priceDetails={priceBreakdown}
        onFinalize={handleFinalizeAndAddToCart}
        submitting={submitting}
        errorMessage={error}
        priceWarning={priceError}
        product={product}
      />
    </div>
  )
}
