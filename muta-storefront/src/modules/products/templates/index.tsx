import React, { Suspense } from "react"

import ImageGallery from "@modules/products/components/image-gallery"
import ProductActions from "@modules/products/components/product-actions"
import ProductOnboardingCta from "@modules/products/components/product-onboarding-cta"
import ProductTabs from "@modules/products/components/product-tabs"
import RelatedProducts from "@modules/products/components/related-products"
import ProductInfo from "@modules/products/templates/product-info"
import SkeletonRelatedProducts from "@modules/skeletons/templates/skeleton-related-products"
import { notFound } from "next/navigation"
import { HttpTypes } from "@medusajs/types"

import ProductActionsWrapper from "./product-actions-wrapper"

type ProductTemplateProps = {
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
  countryCode: string
  images: HttpTypes.StoreProductImage[]
}

const ProductTemplate: React.FC<ProductTemplateProps> = ({
  product,
  region,
  countryCode,
  images,
}) => {
  if (!product || !product.id) {
    return notFound()
  }

  return (
    <>
      {/* Top section: two-column layout similar to Gelato PDP */}
      <div className="content-container py-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Left: image gallery (sticky on desktop) */}
          <div className="w-3/4 lg:sticky lg:top-32 col-span-2 self-start">
            <ImageGallery images={images} />
          </div>

          {/* Right: product info + actions */}
          <div className="flex flex-col col-span-1 gap-y-6">
            <ProductInfo product={product} />

            {/* Ratings + meta row (placeholder if no real data) */}
            <div className="flex items-center gap-3 text-ui-fg-subtle">
              <div className="flex items-center gap-1 text-emerald-600">
                {/* simple 5-star static indicator to match reference style */}
                <span aria-hidden>★★★★★</span>
              </div>
              <span className="text-sm">4.8 · 611 reviews</span>
            </div>

            {/* Delivery/production note similar to Gelato banner */}
            <div className="rounded-lg border border-ui-border-base bg-ui-bg-subtle px-4 py-3 text-sm">
              Most orders are produced in 24–72 hours. Shipping is calculated at checkout.
            </div>

            <div className="flex flex-col gap-y-8">
              <ProductOnboardingCta />
              <Suspense
                fallback={
                  <ProductActions
                    disabled={true}
                    product={product}
                    region={region}
                  />
                }
              >
                <ProductActionsWrapper id={product.id} region={region} />
              </Suspense>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs section below spanning full width */}
      <div className="content-container my-8">
        <ProductTabs product={product} />
      </div>

      <div
        className="content-container my-16 small:my-32"
        data-testid="related-products-container"
      >
        <Suspense fallback={<SkeletonRelatedProducts />}>
          <RelatedProducts product={product} countryCode={countryCode} />
        </Suspense>
      </div>
    </>
  )
}

export default ProductTemplate
