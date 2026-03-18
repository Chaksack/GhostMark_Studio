import { Suspense } from "react"

import { listCollections } from "@lib/data/collections"
import { listTypes } from "@lib/data/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import CartButton from "@modules/layout/components/cart-button"
import WishlistButton from "@modules/layout/components/wishlist-button"
import { DropdownMenu } from "./dropdown-menu"
import { retrieveCustomer } from "@lib/data/customer"
import SearchBox from "@modules/layout/components/search"
import { User } from "lucide-react"


export default async function Nav() {
  const customer = await retrieveCustomer().catch(() => null)

  // Fetch collections/types to populate navbar links/menus
  const [{ collections }, { types }] = await Promise.all([
    listCollections({ limit: "200", fields: "id,handle,title" }).catch(() => ({ collections: [] })),
      listTypes({ limit: 200 }).catch(() => ({ types: [] })),
  ])

  const findTypeHref = (label: string) => {
    const normalized = label.toLowerCase().trim()
    const type = (types || []).find((t) => {
      const title = (t?.title || "").toLowerCase().trim()
      const handle = (t?.handle || "").toLowerCase().trim()
      return title === normalized || handle === normalized
    })

    return type?.handle ? `/store/${type.handle}` : "/store"
  }

  const primaryLinks: { label: string; href: string }[] = [
    { label: "Apparel", href: findTypeHref("Apparel") },
    { label: "Bags", href: findTypeHref("Bags") },
    { label: "Headwear", href: findTypeHref("Headwear") },
    { label: "Office", href: findTypeHref("Office") },
    { label: "Drinkware", href: findTypeHref("Drinkware") },
    { label: "Home", href: findTypeHref("Home") },
    { label: "Wellness", href: findTypeHref("Wellness") },
    { label: "Others", href: "/store" },
  ]

  const brandSections = [
    {
      title: "Brands",
      items: (collections || [])
        .filter((c) => Boolean(c?.handle))
        .map((c) => ({
          label: c.title || c.handle || "Brand",
          href: `/collections/${c.handle}`,
        })),
    },
  ]

  const discoverSections = [
    {
      title: "Discover",
      items: [
        { label: "Customer stories", href: "/customer-stories" },
        { label: "Help center", href: "/help-center" },
        { label: "Support", href: "/support" },
      ],
    },
  ]

  return (
    <div className="sticky top-0 inset-x-0 z-50 bg-mono-0 border-b border-mono-200">
      <header className="mx-auto duration-200">
        <div className="content-container py-4">
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4">
            <LocalizedClientLink
              href="/"
              className="flex items-center gap-3"
              data-testid="nav-store-link"
            >
              <img
                src={"/ghostmark-logo-icon.png"}
                alt="GhostMark"
                className="h-10 w-auto"
              />
              <span className="text-2xl font-semibold tracking-tight text-mono-1000">
                GhostMark
              </span>
            </LocalizedClientLink>

            <div className="hidden medium:flex justify-center">
              <div className="w-full max-w-[640px]">
                <SearchBox />
              </div>
            </div>

            <div className="flex items-center justify-end gap-1">
              <LocalizedClientLink
                href="/account"
                data-testid="nav-account-link"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-mono-50"
                aria-label={
                  customer
                    ? `Account (${[
                        (customer as any)?.first_name,
                        (customer as any)?.last_name,
                      ]
                        .filter(Boolean)
                        .join(" ") || (customer as any)?.email || "Account"})`
                    : "Account"
                }
                title="Account"
              >
                <User className="h-5 w-5" />
              </LocalizedClientLink>

              <Suspense
                fallback={
                  <LocalizedClientLink
                    className="relative inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-mono-50"
                    href="/wishlist"
                    data-testid="nav-wishlist-link"
                    aria-label="Wishlist"
                  >
                    Wishlist
                  </LocalizedClientLink>
                }
              >
                <WishlistButton />
              </Suspense>

              <Suspense
                fallback={
                  <LocalizedClientLink
                    className="relative inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-mono-50"
                    href="/cart"
                    data-testid="nav-cart-link"
                    aria-label="Cart"
                  >
                    Cart
                  </LocalizedClientLink>
                }
              >
                <CartButton />
              </Suspense>
            </div>
          </div>

          <nav className="mt-3 hidden medium:flex items-center justify-center gap-7 text-sm">
            {primaryLinks.map((l) => (
              <LocalizedClientLink
                key={l.label}
                href={l.href}
                className="font-medium text-mono-900 hover:text-mono-700 transition-colors"
              >
                {l.label}
              </LocalizedClientLink>
            ))}

            <DropdownMenu label="Discover" sections={discoverSections} />

            <span className="h-4 w-px bg-mono-200" aria-hidden="true" />

            <DropdownMenu label="Brands" sections={brandSections} />
          </nav>

          <div className="mt-3 medium:hidden">
            <SearchBox />
          </div>
        </div>
      </header>
    </div>
  )
}