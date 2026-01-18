import { Metadata } from "next"
import SearchTemplate from "@modules/search/templates"

type Props = {
  params: Promise<{ countryCode: string }>
  searchParams: Promise<{
    q?: string
    page?: string
    sortBy?: string
  }>
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const searchParams = await props.searchParams
  const query = searchParams.q || ""
  
  return {
    title: query ? `Search results for "${query}" | GhostMark Studio` : `Search | GhostMark Studio`,
    description: query 
      ? `Find products matching "${query}" at GhostMark Studio` 
      : `Search for products at GhostMark Studio`,
  }
}

export default async function SearchPage(props: Props) {
  const params = await props.params
  const searchParams = await props.searchParams
  
  return (
    <SearchTemplate
      query={searchParams.q}
      page={searchParams.page}
      sortBy={searchParams.sortBy}
      countryCode={params.countryCode}
    />
  )
}