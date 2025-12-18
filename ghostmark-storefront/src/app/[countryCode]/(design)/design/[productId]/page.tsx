import { notFound } from "next/navigation"
import { getRegion } from "@lib/data/regions"
import { HttpTypes } from "@medusajs/types"
import DesignEditorWrapper from "@modules/products/components/design-editor/Wrapper"
import { sdk } from "@lib/config"
import { getAuthHeaders, getCacheOptions } from "@lib/data/cookies"

type Props = {
  params: Promise<{ countryCode: string; productId: string }>
  searchParams: Promise<{ v_id?: string }>
}

// Use direct product retrieval by ID to ensure variants are present consistently
async function getProductById(productId: string, regionId: string) {
  try {
    const headers = {
      ...(await getAuthHeaders()),
    }
    const next = {
      ...(await getCacheOptions("products")),
    }
    const fields = (
      "+metadata,+tags,*images,*variants,*variants.options,*options,*variants.images," +
      "+variants.calculated_price,+variants.calculated_price.calculated_amount," +
      "+variants.calculated_price.original_amount,+variants.calculated_price.currency_code," +
      "*type,*collection"
    )

    const { product }: { product: HttpTypes.StoreProduct } = await sdk.client.fetch(
      `/store/products/${productId}`,
      {
        method: "GET",
        query: {
          fields,
          region_id: regionId,
        },
        headers,
        next,
        cache: "force-cache",
      }
    )

    return product
  } catch {
    return undefined
  }
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

  const product = await getProductById(productId, region.id)
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
