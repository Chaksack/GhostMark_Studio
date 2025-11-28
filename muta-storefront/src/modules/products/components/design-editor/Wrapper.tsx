'use client'

import { useCallback, useMemo, useState } from 'react'
import type { HttpTypes } from '@medusajs/types'
import BaseDesignEditor from '.'

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

  const variant = useMemo(() => {
    return product?.variants?.find((v) => v.id === selectedVariantId) || product?.variants?.[0]
  }, [product, selectedVariantId])

  const mockupUrl = useMemo(() => {
    return (
      productMockupUrl ||
      (variant?.images && variant.images[0]?.url) ||
      (product.images && product.images[0]?.url) ||
      '/placeholder.png'
    )
  }, [productMockupUrl, product, variant])

  const handleFinalizeAndAddToCart = useCallback(async () => {
    if (!variant?.id) return

    // In a full implementation, gather the serialized Konva stage JSON and a preview image URL.
    // Here we provide a minimal valid payload structure expected by the backend.
    const designDataJson = JSON.stringify({})
    const previewImageUrl = mockupUrl
    const payload = { designDataJson, previewImageUrl, isCustomized: true as const }

    try {
      setSubmitting(true)
      if (onAddToCart) {
        await onAddToCart(payload)
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
    } finally {
      setSubmitting(false)
    }
  }, [variant?.id, mockupUrl, countryCode, onAddToCart])

  return (
    <div className="relative w-full h-full">
      {/* Render the base editor UI */}
      <BaseDesignEditor />

      {/* Minimal finalize bar */}
      <div className="absolute bottom-4 right-4">
        <button
          onClick={handleFinalizeAndAddToCart}
          disabled={submitting || !variant?.id}
          className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
        >
          {submitting ? 'Adding…' : 'Finalize & Add to cart'}
        </button>
      </div>
    </div>
  )
}
