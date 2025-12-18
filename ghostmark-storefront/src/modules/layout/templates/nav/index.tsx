import { Suspense } from "react"

import { listRegions } from "@lib/data/regions"
import { listCollections } from "@lib/data/collections"
import { listCategories } from "@lib/data/categories"
import { listTypes } from "@lib/data/types"
import { StoreRegion } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import CartButton from "@modules/layout/components/cart-button"
import WishlistButton from "@modules/layout/components/wishlist-button"
import { Search } from "lucide-react"
import { DropdownMenu } from "./dropdown-menu"
import { Ghost } from 'lucide-react';


export default async function Nav() {
  const regions = await listRegions().then((regions: StoreRegion[]) => regions)

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
    startSelling: ['Shopify', 'Etsy', 'WooCommerce', 'BigCommerce', 'Custom store'],
    toolsAndApps: ['Design maker', 'Product creator', 'Mockup studio', 'Personalization studio'],
    pricing: ['Pricing overview', 'Shipping rates', 'Product catalog'],
    resources: ['Blog', 'Customer stories', 'Help center', 'Webinars', 'Guides'],
    gelatoConnect: ['API', 'Integrations', 'Partners']
  }

  return (
    <div className="sticky top-0 inset-x-0 z-50 group">
      {/* Top banner */}
      {/*<div className="bg-black text-white py-1 px-4 text-center text-sm">*/}
      {/*  <span className="font-medium"> Industry-leading Print on Demand Platform </span>*/}
      {/*</div>*/}

      <header className="relative h-14 mx-auto duration-200 py-2 bg-white border-ui-border-base">
        <nav className="content-container txt-xsmall-plus text-ui-fg-subtle flex items-center justify-between w-full h-full text-small-regular">
          <div className="flex items-center h-full">
              <img src={"/ghostmark-logo-icon.png"} alt="GhostMark Logo" className="h-12" />
              <LocalizedClientLink
              href="/"
              className="txt-compact-xlarge-plus hover:text-ui-fg-base font-bold uppercase"
              data-testid="nav-store-link"
            >
            GhostMark <span className="font-medium text-sm">Studio </span>
            </LocalizedClientLink>
          </div>

          <div className="flex items-center gap-x-6 h-full flex-1 basis-0 justify-end">
            <div className="relative w-1/2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search products..."
                className="w-full border border-ui-border-base rounded-md py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-ui-fg-base focus:border-ui-fg-base"
              />
            </div>
            <div className="hidden small:flex items-center gap-x-6 h-full">
              <LocalizedClientLink
                className="hover:text-ui-fg-base"
                href="/account"
                data-testid="nav-account-link"
              >
                Account
              </LocalizedClientLink>
            </div>
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
        </nav>
      </header>

      <nav className="content-container w-full flex items-center space-x-6 py-3 text-sm border-t border-gray-100 bg-white">
        {/* Products dropdown shows Collections and Categories with links */}
        <DropdownMenu label="Products" sections={productSections} />
        <DropdownMenu label="Start selling" items={menuItems.startSelling} />
        <DropdownMenu  label="Tools and apps" items={menuItems.toolsAndApps} />
        <DropdownMenu label="Pricing" items={menuItems.pricing} />
        <DropdownMenu label="Resources" items={menuItems.resources} />
        <DropdownMenu label="GelatoConnect" items={menuItems.gelatoConnect} />
      </nav>
    </div>
  )
}