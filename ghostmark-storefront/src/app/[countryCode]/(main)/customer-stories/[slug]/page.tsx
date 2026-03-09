import { Metadata } from "next"
import Image from "next/image"
import { notFound } from "next/navigation"
import { isStrapiEnabled, strapiFetch, StrapiCustomerStory } from "@lib/strapi"

type Props = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { slug } = await props.params
  const title = slug.replace(/-/g, " ")
  return {
    title: `${title} | Customer story`,
  }
}

export default async function CustomerStoryDetail(props: Props) {
  const { slug } = await props.params

  if (!isStrapiEnabled()) {
    notFound()
  }

  // Query by slug; adjust the content-type uid to match your Strapi setup
  const res = await strapiFetch<{ data: StrapiCustomerStory[] }>(
    `api/customer-stories?filters[slug][$eq]=${encodeURIComponent(slug)}&populate=cover`
  )
  const list = (res?.data as any)?.data || (res?.data as any[])
  const story = Array.isArray(list) ? list[0] : null

  if (!story) {
    notFound()
  }

  const cover = story.attributes.cover?.data?.attributes

  return (
    <div className="content-container py-10">
      <article className="prose max-w-3xl">
        <h1 className="mb-4">{story.attributes.title}</h1>
        {cover?.url && (
          <div className="relative w-full aspect-[16/9] mb-4 rounded overflow-hidden">
            <Image
              src={cover.url}
              alt={cover.alternativeText || story.attributes.title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 66vw"
            />
          </div>
        )}
        {story.attributes.content ? (
          <div className="text-base-regular whitespace-pre-line">
            {story.attributes.content}
          </div>
        ) : story.attributes.excerpt ? (
          <p className="text-ui-fg-subtle">{story.attributes.excerpt}</p>
        ) : null}
      </article>
    </div>
  )
}
