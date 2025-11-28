import Image from "next/image"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { Heading, Text } from "@medusajs/ui"
import { listCollections } from "@lib/data/collections"

// Server component: lists a handful of collections as tiles
export default async function CollectionsTiles() {
  const { collections } = await listCollections({
    limit: "12",
    fields: "id,title,handle,*products",
  })

  if (!collections || collections.length === 0) {
    return null
  }

  return (
    <section aria-labelledby="collections-heading" className="w-full">
      <div className="mb-6">
        <Heading id="collections-heading" level="h2" className="text-2xl md:text-3xl">
          Shop by category
        </Heading>
        <Text className="text-ui-fg-subtle mt-2">
          Explore popular categories and find the perfect product to customize.
        </Text>
      </div>

      <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
        {collections.map((c) => {
          // Try to pick a representative image: product thumbnail first, then first image
          const firstProduct = c.products?.[0]
          const imgSrc =
            firstProduct?.thumbnail || firstProduct?.images?.[0]?.url || undefined

          return (
            <li key={c.id} className="group">
              <LocalizedClientLink
                href={`/collections/${c.handle}`}
                className="block rounded-lg overflow-hidden border border-ui-border-base hover:border-ui-fg-muted transition-colors"
              >
                <div className="relative aspect-[4/3] bg-ui-bg-subtle">
                  {imgSrc ? (
                    <Image
                      src={imgSrc}
                      alt={c.title}
                      fill
                      sizes="(max-width: 1024px) 33vw, 16vw"
                      className="object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-ui-fg-muted text-xs">
                      No image
                    </div>
                  )}
                </div>
                <div className="p-2 md:p-3">
                  <Text className="truncate group-hover:text-ui-fg-base">{c.title}</Text>
                </div>
              </LocalizedClientLink>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
