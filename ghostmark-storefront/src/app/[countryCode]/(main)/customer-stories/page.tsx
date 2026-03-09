import { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { isStrapiEnabled, strapiFetch, StrapiCustomerStory } from "@lib/strapi"

export const metadata: Metadata = {
  title: "Customer stories",
  description: "Read how creators and brands succeed with GhostMark Studio.",
}

export default async function CustomerStoriesPage() {
  let stories: StrapiCustomerStory[] = []

  if (isStrapiEnabled()) {
    const res = await strapiFetch<{ data: StrapiCustomerStory[] }>(
      "api/customer-stories?populate=cover"
    )
    const list = (res?.data as any)?.data || (res?.data as any[])
    if (!res.error && Array.isArray(list)) {
      stories = list
    }
  }

  return (
    <div className="content-container py-10">
      <h1 className="text-3xl font-semibold mb-3">Customer stories</h1>
      <p className="text-ui-fg-subtle max-w-2xl mb-8">
        Explore real-world stories and case studies from our customers.
      </p>

      {stories.length === 0 ? (
        <p className="text-ui-fg-muted">
          CMS is not configured yet. Set STRAPI_URL (and STRAPI_API_TOKEN if protected) to display stories from Strapi.
        </p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {stories.map((item) => {
            const cover = item.attributes.cover?.data?.attributes
            const imgUrl = cover?.url
            return (
              <li key={item.id} className="border rounded-lg p-4">
                {imgUrl ? (
                  <div className="relative w-full h-40 mb-3 overflow-hidden rounded-md">
                    <Image
                      src={imgUrl}
                      alt={cover?.alternativeText || item.attributes.title}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      className="object-cover"
                    />
                  </div>
                ) : null}
                <h3 className="text-lg font-medium leading-snug">
                  {item.attributes.slug ? (
                    <Link href={`./customer-stories/${item.attributes.slug}`} className="underline-offset-4 hover:underline">
                      {item.attributes.title}
                    </Link>
                  ) : (
                    item.attributes.title
                  )}
                </h3>
                {item.attributes.excerpt ? (
                  <p className="text-sm text-ui-fg-subtle mt-1 line-clamp-3">{item.attributes.excerpt}</p>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
