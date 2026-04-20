import LocalizedClientLink from "@modules/common/components/localized-client-link"

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-zinc-200 bg-[#F2E5D9] w-full">
      <div className="mx-auto w-full max-w-screen-2xl px-5 py-10 sm:px-6 lg:px-8">
        <div className="mt-8 border-y border-zinc-200 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Follow us:</span>
              <a href="#" className="text-sm text-zinc-950 hover:underline">Instagram</a>
              <a href="#" className="text-sm text-zinc-950 hover:underline">LinkedIn</a>
            </div>

            <p className="text-sm text-zinc-700">
              Based in <span className="underline decoration-dotted underline-offset-4">London</span>,
              United Kingdom.
            </p>
          </div>
        </div>

        <nav className="mt-7 grid gap-8 sm:grid-cols-2 lg:grid-cols-5" aria-label="Footer">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Company</div>
            <div className="mt-4 grid gap-2 text-sm text-zinc-950">
              <LocalizedClientLink href="/about" className="hover:underline">About us</LocalizedClientLink>
              <a href="#" className="hover:underline">Environmental footprint</a>
              <a href="#" className="hover:underline">Value chain</a>
              <a href="#" className="hover:underline">People &amp; culture</a>
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Services</div>
            <div className="mt-4 grid gap-2 text-sm text-zinc-950">
              <LocalizedClientLink href="/products" className="hover:underline">Shop all</LocalizedClientLink>
              <a href="#" className="hover:underline">Bespoke</a>
              <a href="#" className="hover:underline">Platform</a>
              <a href="#" className="hover:underline">Agencies</a>
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Inspiration</div>
            <div className="mt-4 grid gap-2 text-sm text-zinc-950">
              <LocalizedClientLink href="/blog" className="hover:underline">Blog</LocalizedClientLink>
              <a href="#" className="hover:underline">Cases</a>
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Let us help</div>
            <div className="mt-4 grid gap-2 text-sm text-zinc-950">
              <LocalizedClientLink href="/faq" className="hover:underline">FAQ</LocalizedClientLink>
              <a href="#" className="hover:underline">Terms &amp; conditions</a>
              <a href="#" className="hover:underline">Privacy</a>
              <a href="#" className="hover:underline">Returns</a>
              <LocalizedClientLink href="/contact" className="hover:underline">Contact us</LocalizedClientLink>
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Account</div>
            <div className="mt-4 grid gap-2 text-sm text-zinc-950">
              <LocalizedClientLink href="/account" className="hover:underline">Orders</LocalizedClientLink>
              <a href="#" className="hover:underline">Preferences</a>
              <a href="#" className="hover:underline">Saved projects</a>
              <a href="#" className="hover:underline">Invoices</a>
            </div>
          </div>
        </nav>

        <div className="mt-10 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-center gap-6">
            <div className="grid place-items-center rounded-full border border-zinc-300 bg-white p-3">
              <div className="text-center text-[10px] font-bold leading-none text-zinc-950">
                Certified<br />B
              </div>
            </div>
            <div className="grid place-items-center rounded-full border border-zinc-300 bg-white p-3">
              <div className="text-center text-[10px] font-bold leading-none text-zinc-950">
                1%<br />For the<br />Planet
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-start gap-2 sm:justify-end">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Secure payments:</span>
            <span className="inline-flex items-center rounded border border-zinc-300 bg-white px-2 py-1 text-[11px] font-semibold text-zinc-700">AMEX</span>
            <span className="inline-flex items-center rounded border border-zinc-300 bg-white px-2 py-1 text-[11px] font-semibold text-zinc-700">MC</span>
            <span className="inline-flex items-center rounded border border-zinc-300 bg-white px-2 py-1 text-[11px] font-semibold text-zinc-700">PayPal</span>
            <span className="inline-flex items-center rounded border border-zinc-300 bg-white px-2 py-1 text-[11px] font-semibold text-zinc-700">VISA</span>
          </div>
        </div>

        <div className="mt-8 text-xs text-zinc-500">© {year} GhostMark</div>
      </div>
    </footer>
  )
}
