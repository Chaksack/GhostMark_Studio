import { Metadata } from "next"
import Image from "next/image"
import { isStrapiEnabled, strapiFetch, StrapiAbout } from "@lib/strapi"

export const metadata: Metadata = {
  title: "About Us | GhostMark Studio",
  description: "Learn more about GhostMark Studio and our mission.",
}

export default async function AboutPage() {
  let about: StrapiAbout | null = null
  if (isStrapiEnabled()) {
    try {
      const res = await strapiFetch<StrapiAbout>("api/about?populate=heroImage")
      // Strapi single types usually return { data: { id, attributes } }
      const data: any = (res as any)?.data || res
      about = (data?.data ? data.data : data) as StrapiAbout
    } catch (e) {
      // noop – render fallback
    }
  }

  const title = about?.attributes?.title || "About GhostMark Studio"
  const content = about?.attributes?.content ||
    "We are a global print-on-demand platform focused on quality, speed, and sustainability."
  const image = about?.attributes?.heroImage?.data?.attributes

  return (
    <div className="content-container py-8 md:py-12">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        <div>
          <h1 className="text-3xl-semi mb-4">{title}</h1>
          {/* If your Strapi 'content' is HTML, you may switch to dangerouslySetInnerHTML */}
          <p className="text-base-regular whitespace-pre-line">{content}</p>
        </div>
        {image?.url && (
          <div className="relative w-full aspect-[16/10] rounded overflow-hidden bg-ui-bg-subtle">
            <Image
              src={image.url}
              alt={image.alternativeText || "About image"}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          </div>
        )}
      </div>
    </div>
  )
}
