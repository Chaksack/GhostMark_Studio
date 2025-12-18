import { Metadata } from "next"

import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import StoreTemplate from "@modules/store/templates"

type Params = {
  searchParams: Promise<{
    sortBy?: SortOptions
    page?: string
  }>
  params: Promise<{
    countryCode: string
    type: string
  }>
}

export async function generateMetadata(props: Params): Promise<Metadata> {
  const params = await props.params
  const type = decodeURIComponent(params.type || "")
  const title = type ? `Store · ${type}` : "Store by type"
  return {
    title,
    description: `Explore our ${type || "product"} catalog.`,
  }
}

export default async function StoreByTypeAtStoreRoutePage(props: Params) {
  const params = await props.params
  const searchParams = await props.searchParams
  const { sortBy, page } = searchParams

  const type = decodeURIComponent(params.type || "")

  return (
    <StoreTemplate
      sortBy={sortBy}
      page={page}
      countryCode={params.countryCode}
      productType={type}
      titleOverride={`All ${type}`}
    />
  )
}
