import { Metadata } from "next"

import FeaturedProducts from "@modules/home/components/featured-products"
import Hero from "@modules/home/components/hero"
import { listCollections } from "@lib/data/collections"
import { getRegion } from "@lib/data/regions"
import FeatureSection from "@modules/home/components/feature-section";
import Section from "@modules/home/components/section";
import {Heading} from "@medusajs/ui";
import Cta from "@modules/home/components/cta";



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

  return (
    <>
      <Hero />
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
