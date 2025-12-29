import { notFound } from "next/navigation"
import { Metadata } from "next"

import { HttpTypes } from "@medusajs/types"
import ProductTemplate from "@modules/products/templates"
import { getRegion } from "@lib/data/regions"
import { listProducts } from "@lib/data/products"
import { sdk } from "@lib/config"
import { getAuthHeaders, getCacheOptions } from "@lib/data/cookies"

type Props = {
  params: Promise<{ countryCode: string; handle: string }>
  searchParams: Promise<{ v_id?: string }>
}

async function getById(productId: string, regionId: string) {
  try {
    const headers = { ...(await getAuthHeaders()) }
    const next = { ...(await getCacheOptions("products")) }
    const fields = (
      "+description,+metadata,+tags,*images,*variants,*variants.options,*variants.images,*options," +
      "+variants.calculated_price,+variants.calculated_price.calculated_amount," +
      "+variants.calculated_price.original_amount,+variants.calculated_price.currency_code," +
      "+variants.calculated_price.is_calculated_price_price_list," +
      "+variants.calculated_price.calculated_price," +
      "+variants.calculated_price.calculated_price.price_list_type," +
      "+type_id,+collection_id"
    )
    const { product }: { product: HttpTypes.StoreProduct } = await sdk.client.fetch(
      `/store/products/${productId}`,
      {
        method: "GET",
        query: { fields, region_id: regionId },
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

async function getProductByHandle(handle: string, regionId: string) {
  // 1) Try strict handle filter if backend supports it
  const FIELDS =
    "+description,+metadata,+tags,*images,*variants,*variants.options,*variants.images,*options," +
    "+variants.calculated_price,+variants.calculated_price.calculated_amount," +
    "+variants.calculated_price.original_amount,+variants.calculated_price.currency_code," +
    "+variants.calculated_price.is_calculated_price_price_list," +
    "+variants.calculated_price.calculated_price," +
    "+variants.calculated_price.calculated_price.price_list_type," +
    "+type_id,+collection_id"

  // Try via listProducts with handle filter (some Medusa backends support handle[])
  const tryStrict = await listProducts({
    regionId,
    queryParams: {
      // @ts-ignore – allow handle filter; gracefully ignored if unsupported
      handle: [handle] as any,
      limit: 1,
      fields: FIELDS,
    },
  }).catch(() => undefined)

  const strictHit = tryStrict?.response?.products?.[0]
  if (strictHit) return strictHit

  // 2) Fallback: search by q and pick exact handle match
  const searched = await listProducts({
    regionId,
    queryParams: {
      q: handle,
      limit: 24,
      fields: FIELDS,
    },
  }).catch(() => undefined)

  const byHandle = searched?.response?.products?.find(
    (p) => (p as any)?.handle?.toLowerCase() === handle.toLowerCase()
  )
  if (byHandle) return byHandle

  // 3) Still nothing: try getting all minimal and pick by handle (last resort small page)
  const fallback = await listProducts({
    regionId,
    queryParams: { limit: 24 },
  }).catch(() => undefined)
  return fallback?.response?.products?.find(
    (p) => (p as any)?.handle?.toLowerCase() === handle.toLowerCase()
  )
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

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { countryCode, handle } = await props.params
  const region = await getRegion(countryCode)
  if (!region) return { title: "Product" }

  const product = await getProductByHandle(handle, region.id)
  if (!product) return { title: "Product" }

  const title = `${product.title} | GhostMark Store`
  const description = product.description?.slice(0, 160) || `Buy ${product.title}`
  return { title, description }
}

export default async function ProductPage(props: Props) {
  const { countryCode, handle } = await props.params
  const { v_id } = await props.searchParams

  const region = await getRegion(countryCode)
  if (!region) notFound()

  const product = await getProductByHandle(handle, region.id)
  if (!product) notFound()

  // Ensure we have a fully hydrated product for actions by reloading by ID (consistent fields)
  const hydrated = await getById(product.id!, region.id)
  const finalProduct = hydrated || product

  const images = getImagesForVariant(finalProduct, v_id)

  return (
    <ProductTemplate
      product={finalProduct}
      region={region}
      countryCode={countryCode}
      images={images}
    />
  )
}
