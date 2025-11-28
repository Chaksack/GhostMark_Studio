import { notFound } from "next/navigation"
import { listProducts } from "@lib/data/products"
import { getRegion } from "@lib/data/regions"
import { HttpTypes } from "@medusajs/types"
import DesignEditorWrapper from "@modules/products/components/design-editor/Wrapper"

type Props = {
  params: Promise<{ countryCode: string; productId: string }>
  searchParams: Promise<{ v_id?: string }>
}

async function getProductById(productId: string, countryCode: string) {
  const {
    response: { products },
  } = await listProducts({
    pageParam: 1,
    countryCode,
    queryParams: {
      id: productId,
      limit: 1,
      fields:
        "+metadata,+tags,*images,*variants,*variants.options,*options,*variants.images,*type,*collection",
    },
  })

  return products?.[0]
}

function getImagesForVariant(
  product: HttpTypes.StoreProduct | undefined,
  selectedVariantId?: string
) {
  if (!product) return [] as HttpTypes.StoreProductImage[]

  if (!selectedVariantId || !product.variants?.length) {
    const base = product.images ?? []
    const variantImgs = (product.variants || [])
      .flatMap((v: any) => (v?.images as HttpTypes.StoreProductImage[] | undefined) || [])
    const seen = new Set<string>()
    const all = [...base, ...variantImgs].filter((img) => {
      const key = (img as any)?.url || (img as any)?.id || ""
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

  return product.images ?? []
}

export default async function DesignEditorPage(props: Props) {
  const { countryCode, productId } = await props.params
  const { v_id } = await props.searchParams

  const region = await getRegion(countryCode)
  if (!region) notFound()

  const product = await getProductById(productId, countryCode)
  if (!product) notFound()

  const images = getImagesForVariant(product, v_id)

  return (
    <div className="w-full h-[100svh] bg-gray-50">
      <DesignEditorWrapper
        product={product}
        images={images}
        selectedVariantId={v_id}
        countryCode={countryCode}
      />
    </div>
  )
}
