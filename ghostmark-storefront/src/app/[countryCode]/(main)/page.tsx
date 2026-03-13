import { Metadata } from "next"

import Hero from "@modules/home/components/hero"
import { listCollections } from "@lib/data/collections"
import { getRegion } from "@lib/data/regions"
import FeatureSection from "@modules/home/components/feature-section";
import Section from "@modules/home/components/section";
import Cta from "@modules/home/components/cta";
import { isStrapiEnabled, strapiFetch, StrapiHomepage } from "@lib/strapi";



export const metadata: Metadata = {
  title: "GhostMark Studio",
  description:
    "Global Print on Demand Platform.",
}

export default async function Home(props: {
  params: Promise<{ countryCode: string }>
}) {
  const params = await props.params

  const { countryCode } = params

  const region = await getRegion(countryCode)

  const { collections } = await listCollections({
    fields: "id, handle, title",
  })

  if (!collections || !region) {
    return null
  }

  // Fetch homepage content from Strapi (optional)
  let homepage: StrapiHomepage | null = null
  if (isStrapiEnabled()) {
    try {
      const res = await strapiFetch<StrapiHomepage | { data: StrapiHomepage }>(
        "api/homepage?populate=heroImage"
      )
      // Strapi single types commonly return { data: { id, attributes } }
      const data: any = (res as any)?.data
      if (!res.error && data) {
        homepage = (data?.data ? data.data : data) as StrapiHomepage
      }
    } catch {
      // noop – render with fallbacks
    }
  }

  return (
    <>
      <Hero
        title={homepage?.attributes?.title || undefined}
        subtitle={homepage?.attributes?.subtitle || undefined}
        description={homepage?.attributes?.description || undefined}
        primaryCtaLabel={homepage?.attributes?.primaryCtaLabel || undefined}
        secondaryCtaLabel={homepage?.attributes?.secondaryCtaLabel || undefined}
        imageUrl={homepage?.attributes?.heroImage?.data?.attributes?.url || undefined}
      />
        <div className="py-8 ">
        <FeatureSection />
        </div>
        <div className="py-8 ">
        <Section />
        </div>
      {/*<div>*/}
      {/*  <ul className="flex flex-col gap-x-4">*/}
      {/*    <FeaturedProducts collections={collections} region={region} />*/}
      {/*  </ul>*/}
      {/*</div>*/}
        <div className="bg-gray-200 py-8 ">
        <Cta />
        </div>
    </>
  )
}
