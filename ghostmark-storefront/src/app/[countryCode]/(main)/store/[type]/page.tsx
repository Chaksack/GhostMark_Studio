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
  const raw = decodeURIComponent(params.type || "")

  // Normalize incoming slug to a canonical product type value
  const normalizeType = (slug: string): { value: string; label: string } => {
    const s = slug.toLowerCase().trim()
    // Common aliases/misspellings mapped to canonical values used in the backend
    const map: Record<string, string> = {
      pod: "pod",
      "print-on-demand": "pod",
      "print_on_demand": "pod",
      apparel: "apparel",
      appaerl: "apparel", // tolerate the typo from current links
      apparels: "apparel",
    }
    const value = map[s] || s
    const label = value === "pod" ? "POD" : value.charAt(0).toUpperCase() + value.slice(1)
    return { value, label }
  }

  const { label } = normalizeType(raw)
  const title = label ? `Store · ${label}` : "Store by type"
  return {
    title,
    description: `Explore our ${label || "product"} catalog.`,
  }
}

export default async function StoreByTypeAtStoreRoutePage(props: Params) {
  const params = await props.params
  const searchParams = await props.searchParams
  const { sortBy, page } = searchParams

  const raw = decodeURIComponent(params.type || "")
  const normalizeType = (slug: string): { value: string; label: string } => {
    const s = slug.toLowerCase().trim()
    const map: Record<string, string> = {
      pod: "pod",
      "print-on-demand": "pod",
      "print_on_demand": "pod",
      apparel: "apparel",
      appaerl: "apparel",
      apparels: "apparel",
    }
    const value = map[s] || s
    const label = value === "pod" ? "POD" : value.charAt(0).toUpperCase() + value.slice(1)
    return { value, label }
  }

  const { value: typeValue, label } = normalizeType(raw)

  return (
    <StoreTemplate
      sortBy={sortBy}
      page={page}
      countryCode={params.countryCode}
      productType={typeValue}
      titleOverride={`All ${label}`}
    />
  )
}
