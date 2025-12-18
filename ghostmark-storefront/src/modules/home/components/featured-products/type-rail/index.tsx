import { listProducts } from "@lib/data/products"
import { HttpTypes } from "@medusajs/types"
import { Text } from "@medusajs/ui"
import InteractiveLink from "@modules/common/components/interactive-link"
import ProductPreview from "@modules/products/components/product-preview"

type TypeLite = {
  id?: string
  handle: string
  title: string
}

function normalize(val: unknown): string {
  if (val == null) return ""
  try {
    return String(val).toLowerCase()
  } catch {
    return ""
  }
}

function slugify(str: string): string {
  return (str || "")
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function matchesType(p: any, needle: string): boolean {
  const fields: string[] = []
  fields.push(normalize(p?.title))
  fields.push(normalize(p?.description))
  fields.push(normalize((p as any)?.handle))
  fields.push(normalize((p as any)?.subtitle))

  const t = (p as any)?.type ?? (p as any)?.product_type
  if (t && typeof t === "object") {
    fields.push(normalize((t as any)?.value))
    fields.push(normalize((t as any)?.name))
    fields.push(normalize((t as any)?.title))
    fields.push(normalize((t as any)?.handle))
  } else if (t) {
    fields.push(normalize(t))
  }

  const variants = Array.isArray((p as any)?.variants) ? (p as any).variants : []
  for (const v of variants) {
    fields.push(normalize((v as any)?.title))
    fields.push(normalize((v as any)?.sku))
    const options = Array.isArray((v as any)?.options) ? (v as any).options : []
    for (const opt of options) {
      fields.push(normalize((opt as any)?.value))
      fields.push(normalize((opt as any)?.title))
    }
  }

  const tags = Array.isArray(p?.tags) ? p.tags : []
  for (const tg of tags) {
    fields.push(normalize((tg as any)?.value))
    fields.push(normalize((tg as any)?.name))
  }

  const productTags = Array.isArray((p as any)?.product_tags)
    ? (p as any).product_tags
    : []
  for (const pt of productTags) {
    fields.push(normalize((pt as any)?.value))
    fields.push(normalize((pt as any)?.name))
    fields.push(normalize((pt as any)?.tag?.value))
    fields.push(normalize((pt as any)?.tag?.name))
  }

  const metadata = (p as any)?.metadata || {}
  if (metadata && typeof metadata === "object") {
    for (const key of Object.keys(metadata)) {
      fields.push(normalize(key))
      fields.push(normalize((metadata as any)[key]))
    }
  }

  const fieldSlugs = fields.map((f) => slugify(f))
  const needleSlug = slugify(needle)

  const variantsToTry = new Set<string>([needle])
  if (needle.endsWith("s")) variantsToTry.add(needle.slice(0, -1))
  else variantsToTry.add(`${needle}s`)
  const slugVariants = Array.from(variantsToTry).map((n) => slugify(n))

  return (
    fields.some((f) => f && Array.from(variantsToTry).some((n) => f.includes(n))) ||
    fieldSlugs.some((fs) => fs && slugVariants.some((sn) => fs.includes(sn))) ||
    fieldSlugs.some((fs) => fs === needleSlug)
  )
}

export default async function TypeProductRail({
  type,
  region,
}: {
  type: TypeLite
  region: HttpTypes.StoreRegion
}) {
  // Determine if this rail is for Apparel – we will load ALL matching products (within a safe cap)
  const typeLabel = (type?.handle || type?.title || "").toString().trim().toLowerCase()
  const isApparel = typeLabel === "apparel"

  // Broaden matching for common synonyms so we don't miss items due to wording differences
  const typeNeedles = (() => {
    const base = new Set<string>([typeLabel])
    if (isApparel) {
      ;[
        "apparel",
        "clothes",
        "clothing",
        "garment",
        "garments",
        "wear",
        "tshirt",
        "t-shirt",
        "tee",
        "tees",
        "hoodie",
        "hoodies",
        "sweatshirt",
        "sweatshirts",
        "sweater",
        "sweaters",
        "jacket",
        "jackets",
        "cap",
        "caps",
        "hat",
        "hats",
      ].forEach((s) => base.add(s))
    }
    return Array.from(base)
  })()

  // Use paginated aggregation to avoid relying on backend type filters
  const PAGE_LIMIT = 60
  const AGG_MAX = isApparel ? 600 : 180 // cap total fetched to protect homepage

  let aggregated: HttpTypes.StoreProduct[] = []
  let pageParam = 1
  let nextPage: number | null = 1

  while (nextPage) {
    const res = await listProducts({
      pageParam,
      regionId: region.id,
      queryParams: {
        limit: PAGE_LIMIT,
        // Request minimal but useful fields to keep cards rich without heavy joins
        fields:
          "*variants.calculated_price,thumbnail,title,handle,*images,+metadata,+tags,*type",
      } as any,
    }).catch(() => undefined)

    const pageProducts: HttpTypes.StoreProduct[] = (res?.response?.products as any[]) || []
    aggregated = aggregated.concat(pageProducts)
    nextPage = res?.nextPage ?? null
    pageParam = nextPage || 0
    if (!nextPage || aggregated.length >= AGG_MAX) break
  }

  // Filter by type using tolerant matcher
  const filteredAll = aggregated.filter((p) =>
    typeNeedles.some((needle) => matchesType(p, needle))
  )

  // For Apparel: render all matches. For other types: show a curated slice of 8
  const toRender = isApparel ? filteredAll : filteredAll.slice(0, 8)

  if (!toRender.length) {
    return null
  }

  return (
    <div className="content-container py-12 small:py-24">
      <div className="flex justify-between mb-8">
        <Text className="txt-xlarge">{type.title}</Text>
        <InteractiveLink href={`/store/${type.handle}`}>View all</InteractiveLink>
      </div>
      <ul className="grid grid-cols-2 small:grid-cols-3 medium:grid-cols-4 gap-x-6 gap-y-24 small:gap-y-36">
        {toRender.map((product) => (
          <li key={product.id}>
            <ProductPreview product={product} region={region} isFeatured />
          </li>
        ))}
      </ul>
    </div>
  )
}
