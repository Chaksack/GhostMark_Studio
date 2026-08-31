/**
 * Horizontal-overflow regression suite.
 *
 * WHY THIS EXISTS
 * Two separate 24px+ horizontal overflows shipped in a single day (the
 * PDP `desktop-sticky-atc` and a page-gutter normalisation), and every
 * one of them survived a full visual pass. That is not a coincidence: a
 * full-page screenshot is rendered at the document's scrollWidth, so a
 * page that overflows produces a screenshot that looks *correct* and
 * merely slightly wider. The defect is invisible to the exact tool that
 * was being used to look for it.
 *
 * `scrollWidth > clientWidth` is not subjective, costs ~2s per route,
 * and would have caught both. It runs in BOTH projects, which gives the
 * 1440 (desktop-chromium) and 390 (mobile-iphone / iPhone 14) coverage
 * the brief asks for without resizing anything — resizing a shared
 * context is what corrupted an earlier lane's measurements.
 *
 * The route list intentionally includes `/design/[handle]`, which landed
 * today and has no other test of any kind.
 */
import { test, expect } from '@playwright/test'
import { settlePage, findOverflowCulprits, overflowAmount } from './helpers/viewport'

/**
 * Representative routes: one per layout archetype, plus every surface
 * that changed today. Not the whole sitemap — this suite is a tripwire,
 * not an audit, and it has to stay fast enough that people keep it in
 * the pre-merge loop.
 */
const ROUTES: { path: string; label: string }[] = [
  { path: '/', label: 'home' },
  { path: '/products', label: 'PLP mixed catalogue' },
  { path: '/products?type=pod', label: 'PLP POD-scoped' },
  { path: '/shop', label: 'PLP Studio Canon' },
  { path: '/products/studio-tee-charcoal', label: 'PDP apparel' },
  { path: '/products/studio-sticker-pack', label: 'PDP POD' },
  { path: '/design/studio-sticker-pack', label: 'design surface (NEW today)' },
  { path: '/cart', label: 'cart' },
  { path: '/checkout', label: 'checkout' },
  { path: '/wishlist', label: 'wishlist' },
  { path: '/collections', label: 'collections index' },
  { path: '/categories', label: 'categories index' },
  { path: '/search', label: 'search' },
  { path: '/about', label: 'about' },
  { path: '/contact', label: 'contact' },
  { path: '/faq', label: 'faq' },
]

test.describe('Horizontal overflow', () => {
  for (const route of ROUTES) {
    test(`${route.label} (${route.path}) does not overflow horizontally`, async ({ page }, testInfo) => {
      await page.goto(route.path)
      // MUST settle before measuring: lazy-loaded cards and imagery are
      // the single most common source of an overflow that only appears
      // after scroll, and an unscrolled page hides it entirely.
      await settlePage(page)

      const amount = await overflowAmount(page)
      if (amount > 1) {
        const culprits = await findOverflowCulprits(page)
        const detail = culprits
          .map((c) => `    ${c.selector}  (right=${c.right}px, width=${c.width}px)`)
          .join('\n')
        // Attach so the HTML report carries the bug report, not just a number.
        await testInfo.attach(`overflow-${route.label}.txt`, {
          body: `${route.path} overflowed by ${amount}px\n${detail}`,
          contentType: 'text/plain',
        })
        throw new Error(
          `${route.path} overflows horizontally by ${amount}px ` +
            `at viewport ${page.viewportSize()?.width}px.\n  Offending elements (narrowest first):\n${detail}`,
        )
      }
      expect(amount).toBeLessThanOrEqual(1)
    })
  }
})
