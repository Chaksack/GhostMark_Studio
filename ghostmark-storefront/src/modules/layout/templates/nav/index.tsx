import { Suspense } from "react"

import { listRegions } from "@lib/data/regions"
import { listCollections } from "@lib/data/collections"
import { listCategories } from "@lib/data/categories"
import { listTypes } from "@lib/data/types"
import { StoreRegion } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import CartButton from "@modules/layout/components/cart-button"
import WishlistButton from "@modules/layout/components/wishlist-button"
import { DropdownMenu } from "./dropdown-menu"
import { Ghost } from 'lucide-react';
import { retrieveCustomer } from "@lib/data/customer"
import SearchBox from "@modules/layout/components/search"


export default async function Nav() {
  const regions = await listRegions().then((regions: StoreRegion[]) => regions)
  const customer = await retrieveCustomer().catch(() => null)

  // Fetch collections and categories to populate the Products dropdown
  const [{ collections }, { types }, categories] = await Promise.all([
    listCollections({ limit: "200", fields: "id,handle,title" }).catch(() => ({ collections: [] })),
      listTypes({ limit: 200 }).catch(() => ({ types: [] })),
      listCategories({ limit: 200 }).catch(() => []),
  ])

  // Map to menu sections with direct hrefs
  const productSections = [

      {
          title: "Types",
          items: (types || []).map((c) => ({
              label: c.title || c.handle || "Types",
              href: `/store/${c.handle}`,
          })),
      },
    {
      title: "Collections",
      items: (collections || []).map((c) => ({
        label: c.title || c.handle || "Collection",
        href: `/collections/${c.handle}`,
      })),
    },
    {
      title: "Categories",
      items: (categories || []).map((cat: any) => ({
        label: cat.name || cat.handle || "Category",
        href: `/categories/${cat.handle}`,
      })),
    },
  ]

  const menuItems = {
    resources: ['Customer stories', 'Help center'],
    categories: ['Design', 'Print', 'Shipping'],
      collections: ['Custom products', 'Custom designs', 'Custom prints']
  }

  return (
    <div className="sticky top-0 inset-x-0 z-50 group">
      {/* Top banner */}
      {/*<div className="bg-black text-white py-1 px-4 text-center text-sm">*/}
      {/*  <span className="font-medium"> Industry-leading Print on Demand Platform </span>*/}
      {/*</div>*/}

      <header className="relative h-14 mx-auto duration-200 py-2 bg-white border-b border-mono-200">
        <nav className="content-container flex items-center justify-between w-full h-full text-small-regular">
          <div className="flex items-center h-full">
              <img src={"/ghostmark-logo-icon.png"} alt="GhostMark Logo" className="h-12" />
              <LocalizedClientLink
              href="/"
              className="text-mono-1000 hover:text-mono-800 font-bold uppercase transition-colors"
              data-testid="nav-store-link"
            >
            GhostMark <span className="font-medium text-sm">Studio </span>
            </LocalizedClientLink>
          </div>

          <div className="flex items-center gap-x-3 h-full flex-1 basis-0 justify-end">
            <div className="w-1/2">
              <SearchBox />
            </div>
            <div className="flex items-center gap-x-1">
              <Suspense
                fallback={
                  <LocalizedClientLink
                    className="hover:text-ui-fg-base flex gap-2"
                    href="/wishlist"
                    data-testid="nav-wishlist-link"
                  >
                    Wishlist (0)
                  </LocalizedClientLink>
                }
              >
                <WishlistButton />
              </Suspense>
              <Suspense
                fallback={
                  <LocalizedClientLink
                    className="hover:text-ui-fg-base flex gap-2"
                    href="/cart"
                    data-testid="nav-cart-link"
                  >
                    Cart (0)
                  </LocalizedClientLink>
                }
              >
                <CartButton />
              </Suspense>
            </div>
              <div className="hidden small:flex items-center gap-x-1 h-full">
                  <LocalizedClientLink
                      className="bg-black text-white hover:bg-black/90 text-sm max-w-[180px] inline-flex items-center justify-center px-4 py-2 rounded"
                      href="/account"
                      data-testid="nav-account-link"
                      aria-label={customer ? `Account (${[
                        (customer as any)?.first_name,
                        (customer as any)?.last_name,
                      ]
                        .filter(Boolean)
                        .join(" ") || (customer as any)?.email || "Account"})` : "Account"}
                  >
                      <span className="truncate">
                        {(() => {
                          if (!customer) return "Account"
                          const first = (customer as any)?.first_name as string | undefined
                          const last = (customer as any)?.last_name as string | undefined
                          const email = (customer as any)?.email as string | undefined
                          const full = [first, last].filter(Boolean).join(" ").trim()
                          if (full) return full
                          if (email) return email.split("@")[0] || "Account"
                          return "Account"
                        })()}
                      </span>
                  </LocalizedClientLink>
              </div>
          </div>
        </nav>
      </header>

      <nav className="content-container w-full flex items-center py-1 text-sm bg-white">
        {/* Products dropdown shows Types, Collections, and Categories with direct links */}
        <DropdownMenu label="Products" sections={productSections} />

        {/* Dedicated Categories menu linking to category pages */}
        <DropdownMenu
          label="Categories"
          sections={[
            {
              title: "Categories",
              items: (categories || []).map((cat: any) => ({
                label: cat.name || cat.handle || "Category",
                href: `/categories/${cat.handle}`,
              })),
            },
          ]}
        />

        {/* Dedicated Collections menu linking to collection pages */}
        <DropdownMenu
          label="Collections"
          sections={[
            {
              title: "Collections",
              items: (collections || []).map((c) => ({
                label: c.title || c.handle || "Collection",
                href: `/collections/${c.handle}`,
              })),
            },
          ]}
        />

        {/* Resources menu now links to Help Center and Customer Stories */}
        <DropdownMenu
          label="Resources"
          sections={[
            {
              title: "Resources",
              items: [
                { label: "Support", href: "/support" },
                { label: "Help center", href: "/help-center" },
                { label: "Customer stories", href: "/customer-stories" },
              ],
            },
          ]}
        />
      </nav>
    </div>
  )
}