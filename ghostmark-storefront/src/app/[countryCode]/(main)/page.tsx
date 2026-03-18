import { Metadata } from "next"

import Hero from "@modules/home/components/hero"
import { listCollections } from "@lib/data/collections"
import { getRegion } from "@lib/data/regions"
import { isStrapiEnabled, strapiFetch, StrapiHomepage } from "@lib/strapi";
import { listProductsWithSort } from "@lib/data/products"
import ProductPreview from "@modules/products/components/product-preview"
import InteractiveLink from "@modules/common/components/interactive-link"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { Button } from "@medusajs/ui"
import SubscribeInline from "@modules/home/components/subscribe-inline"



export const metadata: Metadata = {
  title: "GhostMark Studio",
  description:
    "Global Print on Demand Platform.",
}

export default async function Home(
  props: Readonly<{ params: Promise<{ countryCode: string }> }>
) {
  const params = await props.params

  const { countryCode } = params

  const region = await getRegion(countryCode)

  const { collections } = await listCollections({
    fields: "id, handle, title",
  })

  if (!collections || !region) {
    return null
  }

  const latest = await listProductsWithSort({
    countryCode,
    sortBy: "created_at",
    queryParams: {
      limit: 12,
      fields: "*variants.calculated_price,*images,thumbnail,title,handle,+type.value,+is_giftcard",
    } as any,
  }).catch(() => undefined)

  const latestProducts = latest?.response?.products || []
  const bestSellers = latestProducts.slice(0, 10)
  const recentlyAdded = latestProducts.slice(0, 8)

  // Fetch homepage content from Strapi (optional)
  let homepage: StrapiHomepage | null = null
  if (isStrapiEnabled()) {
    try {
      const res = await strapiFetch<StrapiHomepage | { data: StrapiHomepage }>(
        "api/homepage?populate=heroImage"
      )
      // Strapi single types commonly return { data: { id, attributes } }
      const data: any = (res as any)?.data
      if (!res.error && data) {
        homepage = (data?.data ? data.data : data) as StrapiHomepage
      }
    } catch {
      // noop – render with fallbacks
    }
  }

  return (
    <>
      <Hero
        title={homepage?.attributes?.title || undefined}
        subtitle={homepage?.attributes?.subtitle || undefined}
        description={homepage?.attributes?.description || undefined}
        primaryCtaLabel={homepage?.attributes?.primaryCtaLabel || undefined}
        secondaryCtaLabel={homepage?.attributes?.secondaryCtaLabel || undefined}
        imageUrl={homepage?.attributes?.heroImage?.data?.attributes?.url || undefined}
      />

      <section className="content-container pt-6 small:pt-10">
        <div className="flex flex-col small:flex-row small:items-end justify-between gap-6">
          <h2 className="text-5xl small:text-6xl leading-[1.02] tracking-tight text-mono-1000 max-w-5xl">
            We personalise the most beautiful and premium products for your brand to shine in real life.
          </h2>
          <div className="shrink-0">
            <LocalizedClientLink href="/products">
              <Button
                size="small"
                className="bg-mono-1000 text-mono-0 border border-mono-1000 hover:bg-mono-900"
              >
                View all products
              </Button>
            </LocalizedClientLink>
          </div>
        </div>
      </section>

      <section className="content-container py-8 small:py-10">
        <div className="flex items-end justify-between gap-6 mb-5">
          <h3 className="text-2xl small:text-3xl font-medium tracking-tight text-mono-1000">
            Our best sellers
          </h3>
        </div>

        <ul className="flex gap-6 overflow-x-auto pb-4 no-scrollbar">
          {bestSellers.map((product) => (
            <li
              key={product.id}
              className="w-[240px] small:w-[280px] flex-none"
            >
              <ProductPreview product={product} region={region} />
            </li>
          ))}
        </ul>
      </section>

      <section className="content-container py-10 small:py-16 border-t border-mono-100">
        <div className="flex items-end justify-between gap-6 mb-8">
          <div>
            <h2 className="text-3xl small:text-4xl font-semibold tracking-tight">Our products in real life</h2>
            <p className="text-mono-600 mt-2 max-w-2xl">
              A few examples of what teams create with GhostMark.
            </p>
          </div>
          <div className="hidden small:block">
            <InteractiveLink href="/customer-stories">See customer stories</InteractiveLink>
          </div>
        </div>

        <div className="grid grid-cols-1 small:grid-cols-12 gap-6">
          <LocalizedClientLink
            href="/customer-stories"
            className="group relative overflow-hidden rounded-large border border-mono-200 bg-mono-0 small:col-span-7"
          >
            <div className="aspect-[16/10] bg-mono-50 overflow-hidden">
              <img
                src="/image3.webp"
                alt="Merch in the wild"
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              />
            </div>
            <div className="p-5">
              <div className="text-xs uppercase tracking-wide text-mono-500">Inspiration</div>
              <div className="mt-1 text-lg font-medium text-mono-1000">Merch people actually use</div>
              <p className="mt-2 text-sm text-mono-600">Premium blanks, clean personalization, and thoughtful packaging.</p>
            </div>
          </LocalizedClientLink>

          <div className="small:col-span-5 grid grid-cols-1 gap-6">
            <LocalizedClientLink
              href="/products"
              className="group overflow-hidden rounded-large border border-mono-200 bg-mono-0"
            >
              <div className="aspect-[16/10] bg-mono-50 overflow-hidden">
                <img
                  src="/image1.webp"
                  alt="Custom products"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                />
              </div>
              <div className="p-5">
                <div className="text-xs uppercase tracking-wide text-mono-500">Products</div>
                <div className="mt-1 text-lg font-medium text-mono-1000">Curated catalog</div>
                <p className="mt-2 text-sm text-mono-600">Apparel, drinkware, stationery, and more.</p>
              </div>
            </LocalizedClientLink>

            <LocalizedClientLink
              href="/help-center"
              className="group overflow-hidden rounded-large border border-mono-200 bg-mono-0"
            >
              <div className="aspect-[16/10] bg-mono-50 overflow-hidden">
                <img
                  src="/image4.webp"
                  alt="Shipping and timelines"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                />
              </div>
              <div className="p-5">
                <div className="text-xs uppercase tracking-wide text-mono-500">How it works</div>
                <div className="mt-1 text-lg font-medium text-mono-1000">Fast, trackable delivery</div>
                <p className="mt-2 text-sm text-mono-600">Clear timelines from production to doorstep.</p>
              </div>
            </LocalizedClientLink>
          </div>
        </div>

        <div className="mt-8 small:hidden">
          <InteractiveLink href="/customer-stories">See customer stories</InteractiveLink>
        </div>
      </section>

      <section className="content-container py-10 small:py-16">
        <div className="flex items-end justify-between gap-6 mb-6">
          <div>
            <h2 className="text-3xl small:text-4xl font-semibold tracking-tight">Latest arrivals</h2>
            <p className="text-mono-600 mt-2 max-w-2xl">
              Fresh drops, ready to customize.
            </p>
          </div>
          <div className="hidden small:block">
            <InteractiveLink href="/products">Shop all products</InteractiveLink>
          </div>
        </div>

        <ul className="grid grid-cols-2 small:grid-cols-3 medium:grid-cols-4 gap-x-6 gap-y-10">
          {latestProducts.slice(0, 12).map((product) => (
            <li key={product.id} className="h-full">
              <ProductPreview product={product} region={region} isFeatured />
            </li>
          ))}
        </ul>

        <div className="mt-8 small:hidden">
          <InteractiveLink href="/products">Shop all products</InteractiveLink>
        </div>
      </section>

      <section className="content-container py-10 small:py-16 border-t border-mono-100">
        <div className="flex items-end justify-between gap-6 mb-8">
          <div>
            <h2 className="text-3xl small:text-4xl font-semibold tracking-tight">Discover</h2>
            <p className="text-mono-600 mt-2 max-w-2xl">
              Explore curated picks and inspiration.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 small:grid-cols-3 gap-6">
          <LocalizedClientLink
            href="/products"
            className="group block overflow-hidden rounded-large border border-mono-200 bg-mono-0"
          >
            <div className="aspect-[4/3] bg-mono-50 overflow-hidden">
              <img
                src="/image1.webp"
                alt="Shop all"
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              />
            </div>
            <div className="p-5">
              <div className="text-xs uppercase tracking-wide text-mono-500">Shop</div>
              <div className="mt-1 text-lg font-medium">All products</div>
              <p className="mt-2 text-sm text-mono-600">Browse the full catalog and customize in minutes.</p>
            </div>
          </LocalizedClientLink>

          <LocalizedClientLink
            href="/customer-stories"
            className="group block overflow-hidden rounded-large border border-mono-200 bg-mono-0"
          >
            <div className="aspect-[4/3] bg-mono-50 overflow-hidden">
              <img
                src="/image2.webp"
                alt="Customer stories"
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              />
            </div>
            <div className="p-5">
              <div className="text-xs uppercase tracking-wide text-mono-500">Cases</div>
              <div className="mt-1 text-lg font-medium">Customer stories</div>
              <p className="mt-2 text-sm text-mono-600">See how teams ship merch people actually wear.</p>
            </div>
          </LocalizedClientLink>

          <LocalizedClientLink
            href="/help-center"
            className="group block overflow-hidden rounded-large border border-mono-200 bg-mono-0"
          >
            <div className="aspect-[4/3] bg-mono-50 overflow-hidden">
              <img
                src="/image4.webp"
                alt="Help center"
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              />
            </div>
            <div className="p-5">
              <div className="text-xs uppercase tracking-wide text-mono-500">Learn</div>
              <div className="mt-1 text-lg font-medium">Help center</div>
              <p className="mt-2 text-sm text-mono-600">Answers on shipping, returns, and production timelines.</p>
            </div>
          </LocalizedClientLink>
        </div>
      </section>

      <section className="content-container py-10 small:py-16 border-t border-mono-100">
        <div className="flex items-end justify-between gap-6 mb-8">
          <div>
            <h2 className="text-3xl small:text-4xl font-semibold tracking-tight">Our best selling brands</h2>
            <p className="text-mono-600 mt-2 max-w-2xl">Explore collections teams come back to again and again.</p>
          </div>
        </div>

        <ul className="flex gap-3 overflow-x-auto pb-3 no-scrollbar">
          {collections.slice(0, 12).map((c) => (
            <li key={c.id} className="flex-none">
              <LocalizedClientLink
                href={`/collections/${c.handle}`}
                className="group inline-flex items-center gap-3 rounded-full border border-mono-200 bg-mono-0 px-4 py-2 hover:bg-mono-50"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-mono-200 bg-mono-50 text-xs font-semibold text-mono-800">
                  {c.title
                    ?.split(" ")
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((w) => w[0])
                    .join("")
                    .toUpperCase()}
                </span>
                <span className="text-sm font-medium text-mono-1000 whitespace-nowrap">{c.title}</span>
              </LocalizedClientLink>
            </li>
          ))}
        </ul>
      </section>

      <section className="content-container py-10 small:py-16 border-t border-mono-100">
        <div className="mb-8">
          <h2 className="text-3xl small:text-4xl font-semibold tracking-tight">What teams say</h2>
          <p className="text-mono-600 mt-2 max-w-2xl">A few highlights from recent projects.</p>
        </div>

        <div className="grid grid-cols-1 small:grid-cols-3 gap-6">
          {[
            {
              quote:
                "The quality is consistent and the process is simple — we can launch new merch without a full-time ops person.",
              name: "Operations lead",
              company: "Community team",
            },
            {
              quote:
                "Packaging looked premium and delivery was on time. Our team actually wears the items — that’s the real win.",
              name: "People manager",
              company: "Remote-first startup",
            },
            {
              quote:
                "Great product range and fast iteration. We shipped a branded kit to new hires in under two weeks.",
              name: "Brand designer",
              company: "SaaS",
            },
          ].map((t) => (
            <div
              key={t.quote}
              className="rounded-large border border-mono-200 bg-mono-0 p-6"
            >
              <p className="text-mono-900 leading-relaxed">“{t.quote}”</p>
              <div className="mt-4 text-sm text-mono-600">
                <span className="font-medium text-mono-900">{t.name}</span> · {t.company}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="content-container py-10 small:py-16 border-t border-mono-100">
        <div className="flex items-end justify-between gap-6 mb-6">
          <div>
            <h2 className="text-3xl small:text-4xl font-semibold tracking-tight">Recently added</h2>
            <p className="text-mono-600 mt-2 max-w-2xl">New products ready for your next drop.</p>
          </div>
          <div className="hidden small:block">
            <InteractiveLink href="/products">Browse products</InteractiveLink>
          </div>
        </div>

        <ul className="flex gap-6 overflow-x-auto pb-4 no-scrollbar">
          {recentlyAdded.map((product) => (
            <li key={product.id} className="w-[240px] small:w-[280px] flex-none">
              <ProductPreview product={product} region={region} />
            </li>
          ))}
        </ul>

        <div className="mt-8 small:hidden">
          <InteractiveLink href="/products">Browse products</InteractiveLink>
        </div>
      </section>

      <section className="content-container py-10 small:py-16 border-t border-mono-100">
        <div className="mb-8">
          <h2 className="text-3xl small:text-4xl font-semibold tracking-tight">Frequently asked questions</h2>
          <p className="text-mono-600 mt-2 max-w-2xl">Quick answers before you get started.</p>
        </div>

        <div className="max-w-3xl">
          {[
            {
              q: "What’s the minimum order quantity?",
              a: "Many items can be produced in small batches. Exact minimums depend on the product and personalization method.",
            },
            {
              q: "How long does production and shipping take?",
              a: "Timelines vary by product, but we aim to keep lead times predictable. Check the Help Center for typical ranges.",
            },
            {
              q: "Can I ship to multiple addresses?",
              a: "Yes — you can place a single order and send items to multiple recipients when supported by the product and region.",
            },
            {
              q: "Do you support custom packaging?",
              a: "We can support branded touches depending on the project scope. Reach out via Support to discuss options.",
            },
            {
              q: "Can I order samples?",
              a: "For many products, samples are possible so you can validate quality before a larger rollout.",
            },
          ].map((item) => (
            <details
              key={item.q}
              className="group border-t border-mono-200 py-4 last:border-b"
            >
              <summary className="cursor-pointer list-none select-none text-mono-1000 font-medium flex items-center justify-between gap-4">
                <span>{item.q}</span>
                <span className="text-mono-500 group-open:text-mono-800">+</span>
              </summary>
              <div className="mt-3 text-sm leading-relaxed text-mono-600">
                {item.a} <LocalizedClientLink href="/help-center" className="underline underline-offset-4">Learn more</LocalizedClientLink>.
              </div>
            </details>
          ))}
        </div>
      </section>

      <section className="content-container py-10 small:py-16 border-t border-mono-100">
        <div className="grid grid-cols-1 small:grid-cols-12 gap-6 items-start">
          <div className="small:col-span-6">
            <h2 className="text-3xl small:text-4xl font-semibold tracking-tight">Subscribe</h2>
            <p className="text-mono-600 mt-2 max-w-md">
              Get product drops, production tips, and occasional discounts.
            </p>
          </div>
          <div className="small:col-span-6">
            <SubscribeInline />
          </div>
        </div>
      </section>
    </>
  )
}
