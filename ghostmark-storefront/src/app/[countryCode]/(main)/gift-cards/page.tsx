import { Metadata } from "next"
import { Suspense } from "react"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import PaginatedProducts from "@modules/store/templates/paginated-products"
import SkeletonProductGrid from "@modules/skeletons/templates/skeleton-product-grid"

export const metadata: Metadata = {
  title: "Gift Cards | GhostMark Studio",
  description: "Send the perfect gift. Purchase and redeem GhostMark Studio gift cards.",
}

type Props = {
  params: Promise<{ countryCode: string }>
  searchParams: Promise<{ sortBy?: SortOptions; page?: string }>
}

export default async function GiftCardsPage(props: Props) {
  const { countryCode } = await props.params
  const { sortBy, page } = await props.searchParams
  const pageNumber = page ? parseInt(page) : 1

  return (
    <div className="content-container py-10">
      <h1 className="text-3xl font-bold mb-4">Gift Cards</h1>
      <p className="text-base text-gray-700 mb-6">
        Explore our gift-card products. Choose a denomination and add to cart.
      </p>

      <div className="mb-6 rounded-lg border border-gray-200 p-4 bg-white">
        <ol className="list-decimal list-inside text-gray-700 space-y-1">
          <li>Select a gift-card product below.</li>
          <li>Complete checkout to receive a unique code.</li>
          <li>Redeem the code later in Cart or Checkout.</li>
        </ol>
      </div>

      <Suspense fallback={<SkeletonProductGrid numberOfProducts={12} />}>        
        <PaginatedProducts
          sortBy={sortBy}
          page={pageNumber}
          countryCode={countryCode}
          productType="gift-card"
        />
      </Suspense>
    </div>
  )
}
