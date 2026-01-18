"use client"

import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { Select, Text } from "@medusajs/ui"

type SearchFiltersProps = {
  query: string
  sortBy: string
}

const SearchFilters = ({ query, sortBy }: SearchFiltersProps) => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const updateSort = (newSortBy: string) => {
    const params = new URLSearchParams(searchParams)
    params.set("sortBy", newSortBy)
    params.set("page", "1") // Reset to first page when sorting changes
    
    router.push(`${pathname}?${params.toString()}`)
  }

  const sortOptions = [
    { value: "relevance", label: "Relevance" },
    { value: "newest", label: "Newest First" },
    { value: "oldest", label: "Oldest First" },
    { value: "name_asc", label: "Name A-Z" },
    { value: "name_desc", label: "Name Z-A" },
    { value: "price_asc", label: "Price Low to High" },
    { value: "price_desc", label: "Price High to Low" },
  ]

  return (
    <div className="space-y-6">
      <div>
        <Text className="font-semibold mb-3 block">Sort by</Text>
        <Select value={sortBy} onValueChange={updateSort}>
          <Select.Trigger className="w-full">
            <Select.Value />
          </Select.Trigger>
          <Select.Content>
            {sortOptions.map((option) => (
              <Select.Item key={option.value} value={option.value}>
                {option.label}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>
      </div>

      {/* Search Tips */}
      <div className="border-t border-ui-border-base pt-4">
        <Text className="font-semibold mb-3 block">Search Tips</Text>
        <div className="space-y-2 text-sm text-ui-fg-muted">
          <p>• Use specific product names</p>
          <p>• Try category names like "shirts" or "mugs"</p>
          <p>• Search by material like "cotton" or "ceramic"</p>
          <p>• Use colors like "black", "white", "red"</p>
        </div>
      </div>
    </div>
  )
}

export default SearchFilters