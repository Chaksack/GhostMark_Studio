"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Search, X } from "lucide-react"
import { useDebounce } from "@lib/hooks/use-debounce"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

type SearchResult = {
  id: string
  title: string
  handle: string
  description?: string
  thumbnail?: string
  type?: string
}

type SearchSuggestion = {
  text: string
  type: 'product' | 'category' | 'collection' | 'popular'
}

const SearchBox = () => {
  const [query, setQuery] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const pathname = usePathname()
  
  const debouncedQuery = useDebounce(query, 300)

  // Close search when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  // Popular search suggestions
  const popularSuggestions: SearchSuggestion[] = [
    { text: "t-shirts", type: "popular" },
    { text: "hoodies", type: "popular" },
    { text: "mugs", type: "popular" },
    { text: "stickers", type: "popular" },
    { text: "phone cases", type: "popular" },
    { text: "tote bags", type: "popular" },
  ]

  // Search API call
  useEffect(() => {
    const searchProducts = async () => {
      if (!debouncedQuery || debouncedQuery.length < 1) {
        setResults([])
        setSuggestions(debouncedQuery.length === 0 ? popularSuggestions : [])
        return
      }

      if (debouncedQuery.length < 2) {
        // Show filtered popular suggestions for single character
        const filtered = popularSuggestions.filter(s => 
          s.text.toLowerCase().startsWith(debouncedQuery.toLowerCase())
        )
        setSuggestions(filtered)
        setResults([])
        return
      }

      setIsLoading(true)
      try {
        // Following Context7 pattern for product search
        const response = await fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}&limit=6`)
        
        if (response.ok) {
          const data = await response.json()
          setResults(data.products || [])
          
          // Generate suggestions based on search results
          const productSuggestions: SearchSuggestion[] = (data.products || [])
            .slice(0, 3)
            .map((product: SearchResult) => ({
              text: product.title,
              type: 'product' as const
            }))
          
          setSuggestions(productSuggestions)
        } else {
          setResults([])
          setSuggestions([])
        }
      } catch (error) {
        console.error("Search error:", error)
        setResults([])
        setSuggestions([])
      } finally {
        setIsLoading(false)
      }
    }

    if (isOpen) {
      searchProducts()
    }
  }, [debouncedQuery, isOpen])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      setIsOpen(false)
      router.push(`/search?q=${encodeURIComponent(query.trim())}`)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value)
    setIsOpen(true)
  }

  const clearSearch = () => {
    setQuery("")
    setResults([])
    setSuggestions([])
    setIsOpen(false)
    inputRef.current?.focus()
  }

  const handleResultClick = () => {
    setIsOpen(false)
    setQuery("")
    setSuggestions([])
  }

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion)
    setIsOpen(false)
    router.push(`/search?q=${encodeURIComponent(suggestion)}`)
  }

  return (
    <div className="relative w-full max-w-md" ref={searchRef}>
      <form onSubmit={handleSearch} className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder="Search products..."
          className="w-full border border-ui-border-base rounded-md py-2 pl-10 pr-10 focus:outline-none focus:ring-2 focus:ring-ui-fg-base focus:border-ui-fg-base"
          data-testid="search-input"
        />
        {query && (
          <button
            type="button"
            onClick={clearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </form>

      {/* Search Results Dropdown */}
      {isOpen && (debouncedQuery.length >= 0 || isLoading || suggestions.length > 0) && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-ui-border-base rounded-md shadow-lg max-h-96 overflow-y-auto z-50">
          {isLoading ? (
            <div className="p-4 text-center text-ui-fg-subtle">
              Searching...
            </div>
          ) : (
            <>
              {/* Search Suggestions */}
              {suggestions.length > 0 && (
                <div className="border-b border-ui-border-base">
                  <div className="p-2">
                    <p className="text-xs text-ui-fg-subtle font-medium">
                      {debouncedQuery.length === 0 ? "Popular searches" : "Suggestions"}
                    </p>
                  </div>
                  <ul>
                    {suggestions.map((suggestion, index) => (
                      <li key={`${suggestion.text}-${index}`}>
                        <button
                          onClick={() => handleSuggestionClick(suggestion.text)}
                          className="w-full text-left px-4 py-2 hover:bg-ui-bg-subtle transition-colors text-sm text-ui-fg-base"
                        >
                          <Search className="w-3 h-3 inline mr-2 text-ui-fg-muted" />
                          {suggestion.text}
                          {suggestion.type === 'popular' && (
                            <span className="ml-2 text-xs text-ui-fg-muted">Popular</span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Product Results */}
              {results.length > 0 && (
                <>
                  <div className="p-2">
                    <p className="text-xs text-ui-fg-subtle">
                      Products ({results.length} found)
                    </p>
                  </div>
                  <ul>
                    {results.map((product) => (
                      <li key={product.id}>
                        <LocalizedClientLink
                          href={`/products/${product.handle}`}
                          onClick={handleResultClick}
                          className="block px-4 py-3 hover:bg-ui-bg-subtle transition-colors"
                          data-testid={`search-result-${product.id}`}
                        >
                          <div className="flex items-center gap-3">
                            {product.thumbnail && (
                              <img
                                src={product.thumbnail}
                                alt={product.title}
                                className="w-10 h-10 rounded object-cover"
                                loading="lazy"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-medium text-ui-fg-base truncate">
                                {product.title}
                              </h4>
                              {product.type && (
                                <p className="text-xs text-ui-fg-subtle">
                                  {product.type}
                                </p>
                              )}
                              {product.description && (
                                <p className="text-xs text-ui-fg-muted truncate mt-1">
                                  {product.description.slice(0, 100)}...
                                </p>
                              )}
                            </div>
                          </div>
                        </LocalizedClientLink>
                      </li>
                    ))}
                  </ul>
                  {results.length >= 6 && (
                    <div className="p-3 border-t border-ui-border-base">
                      <LocalizedClientLink
                        href={`/search?q=${encodeURIComponent(debouncedQuery)}`}
                        onClick={handleResultClick}
                        className="block text-center text-sm text-ui-fg-base hover:text-ui-fg-subtle font-medium"
                      >
                        View all results →
                      </LocalizedClientLink>
                    </div>
                  )}
                </>
              )}

              {/* No results for search query */}
              {debouncedQuery.length >= 2 && results.length === 0 && suggestions.length === 0 && (
                <div className="p-4 text-center">
                  <p className="text-sm text-ui-fg-subtle">
                    No products found for "{debouncedQuery}"
                  </p>
                  <LocalizedClientLink
                    href={`/search?q=${encodeURIComponent(debouncedQuery)}`}
                    onClick={handleResultClick}
                    className="text-sm text-ui-fg-base hover:text-ui-fg-subtle font-medium mt-2 inline-block"
                  >
                    Search all products →
                  </LocalizedClientLink>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default SearchBox