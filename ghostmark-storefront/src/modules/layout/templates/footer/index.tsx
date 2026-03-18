import { listCategories } from "@lib/data/categories"
import { listCollections } from "@lib/data/collections"
import { Text, clx } from "@medusajs/ui"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import MedusaCTA from "@modules/layout/components/medusa-cta"

export default async function Footer() {
  const { collections } = await listCollections({
    fields: "*products",
  })
  const productCategories = await listCategories()

  return (
    <footer className="border-t bg-mono-0 text-mono-1000 border-mono-200 w-full">
      <div className="content-container flex flex-col w-full">
        <div className="flex flex-col gap-y-10 xsmall:flex-row items-start justify-between py-12">
          <div>
            <div className="flex items-center">
              <LocalizedClientLink
                href="/"
                className="txt-compact-xlarge-plus hover:text-mono-700 transition-colors"
                data-testid="nav-store-link"
              >
                <img
                  src={"/ghostmark-logo-icon.png"}
                  alt="GhostMark Logo"
                  className="h-12 w-auto"
                />
              </LocalizedClientLink>
            </div>
            <p className="text-sm mt-4 text-mono-600 max-w-sm">
              Premium print-on-demand for teams and brands — design, print, and ship worldwide.
            </p>
          </div>
          
          <div className="text-small-regular gap-10 md:gap-x-16 grid sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {productCategories && productCategories?.length > 0 && (
              <div className="flex flex-col gap-y-2">
                <span className="txt-small-plus text-mono-1000">Categories</span>
                <ul
                  className="grid grid-cols-1 gap-2"
                  data-testid="footer-categories"
                >
                  {productCategories?.slice(0, 6).map((c) => {
                    if (c.parent_category) {
                      return
                    }

                    const children =
                      c.category_children?.map((child) => ({
                        name: child.name,
                        handle: child.handle,
                        id: child.id,
                      })) || null

                    return (
                      <li
                        className="flex flex-col gap-2 text-mono-600 txt-small"
                        key={c.id}
                      >
                        <LocalizedClientLink
                          className={clx(
                            "hover:text-mono-1000 transition-colors",
                            children && "txt-small-plus"
                          )}
                          href={`/categories/${c.handle}`}
                          data-testid="category-link"
                        >
                          {c.name}
                        </LocalizedClientLink>
                        {children && (
                          <ul className="grid grid-cols-1 ml-3 gap-2">
                            {children &&
                              children.map((child) => (
                                <li key={child.id}>
                                  <LocalizedClientLink
                                    className="hover:text-mono-1000 transition-colors"
                                    href={`/categories/${child.handle}`}
                                    data-testid="category-link"
                                  >
                                    {child.name}
                                  </LocalizedClientLink>
                                </li>
                              ))}
                          </ul>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
            {collections && collections.length > 0 && (
              <div className="flex flex-col gap-y-2">
                <span className="txt-small-plus text-mono-1000">Collections</span>
                <ul
                  className={clx(
                    "grid grid-cols-1 gap-2 text-mono-600 txt-small",
                    {
                      "grid-cols-2": (collections?.length || 0) > 3,
                    }
                  )}
                >
                  {collections?.slice(0, 6).map((c) => (
                    <li key={c.id} className="flex flex-col gap-2" >
                      <LocalizedClientLink
                        className="hover:text-mono-1000 transition-colors"
                        href={`/collections/${c.handle}`}
                      >
                        {c.title}
                      </LocalizedClientLink>
                    </li>
                  ))}
                </ul>
              </div>
            )}
              <div className="flex flex-col gap-y-2">
                  <span className="txt-small-plus text-mono-1000">Resources</span>
                  <ul className="grid grid-cols-1 gap-y-2 text-mono-600 txt-small">
                      <li>
                          <a
                              href="/support"
                              target="_blank"
                              rel="noreferrer"
                              className="hover:text-mono-1000 transition-colors"
                          >
                              Support
                          </a>
                      </li>
                      <li>
                          <a
                              href="/help-center"
                              target="_blank"
                              rel="noreferrer"
                              className="hover:text-mono-1000 transition-colors"
                          >
                              Help center
                          </a>
                      </li>
                      <li>
                          <a
                              href="/customer-stories"
                              target="_blank"
                              rel="noreferrer"
                              className="hover:text-mono-1000 transition-colors"
                          >
                              Customer Stories
                          </a>
                      </li>
                  </ul>
              </div>

              <div className="flex flex-col gap-y-2">
              <span className="txt-small-plus text-mono-1000">Company</span>
              <ul className="grid grid-cols-1 gap-y-2 text-mono-600 txt-small">
                <li>
                  <LocalizedClientLink
                    href="/about"
                    className="hover:text-mono-1000 transition-colors"
                  >
                    About GhostMark Studio
                  </LocalizedClientLink>
                </li>
                <li>
                  <a
                    href="https://docs.medusajs.com"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-mono-1000 transition-colors"
                  >
                    Leadership Team
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div className="flex w-full mb-12 justify-between text-mono-500 border-t border-mono-100 pt-6">
          <Text className="txt-compact-small text-mono-500">© 2026 GhostMark Studio. All rights reserved.</Text>
          <MedusaCTA />
        </div>
      </div>
    </footer>
  )
}
