import { Metadata } from "next"
import { notFound } from "next/navigation"

import ProductTemplate from "@modules/products/templates"
import { listProducts } from "@lib/data/products"
import { getRegion } from "@lib/data/regions"
import { HttpTypes } from "@medusajs/types"

type Props = {
  params: Promise<{ handle: string; countryCode: string }>
  searchParams: Promise<{
    v_id?: string
  }>
}

async function getProductByHandle(handle: string, countryCode: string) {
  const {
    response: { products },
  } = await listProducts({
    pageParam: 1,
    countryCode,
    queryParams: {
      handle,
      limit: 1,
      fields:
        "+metadata,+tags,*images,*variants,*variants.options,*options,*variants.images,*type,*collection",
    },
  })

  return products?.[0]
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { handle, countryCode } = await props.params
  const product = await getProductByHandle(handle, countryCode)

  if (!product) {
    return {}
  }

  const title = `${product.title} | Medusa Store`
  const description = product.description || `${product.title} product`

  return {
    title,
    description,
    alternates: { canonical: `/products/${handle}` },
  }
}

function getImagesForVariant(
  product: HttpTypes.StoreProduct | undefined,
  selectedVariantId?: string
) {
  if (!product) return [] as HttpTypes.StoreProductImage[]

  // When no specific variant is selected, show all available images:
  // - product-level images
  // - all variant images (flattened)
  if (!selectedVariantId || !product.variants?.length) {
    const base = product.images ?? []
    const variantImgs = (product.variants || [])
      .flatMap((v: any) => (v?.images as HttpTypes.StoreProductImage[] | undefined) || [])
    // De-duplicate by URL to avoid repeats
    const seen = new Set<string>()
    const all = [...base, ...variantImgs].filter((img) => {
      const key = img?.url || img?.id || ""
      if (!key) return false
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    return all
  }

  const variant = product.variants.find((v) => v.id === selectedVariantId)
  const variantImages = (variant as any)?.images as
    | HttpTypes.StoreProductImage[]
    | undefined

  if (variantImages && variantImages.length > 0) {
    return variantImages
  }

  // Fallback to product-level images when the selected variant has none
  return product.images ?? []
}

export default async function ProductPage(props: Props) {
  const { handle, countryCode } = await props.params
  const { v_id } = await props.searchParams

  const region = await getRegion(countryCode)
  if (!region) {
    notFound()
  }

  const product = await getProductByHandle(handle, countryCode)
  if (!product) {
    notFound()
  }

  const images = getImagesForVariant(product, v_id)

  return (
    <ProductTemplate
      product={product}
      region={region}
      countryCode={countryCode}
      images={images}
    />
  )
}
