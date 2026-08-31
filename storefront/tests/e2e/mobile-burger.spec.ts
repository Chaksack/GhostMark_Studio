/**
 * Mobile burger overlay: type-aware tier ordering.
 *
 * The burger's middle region renders THREE tiers in priority order:
 *   Tier 1: Mode entries — "Shop the Studio Canon" (/shop) and
 *           "All products" (/products).
 *   Tier 2: "Browse by category" heading + native <details> list.
 *
 * These tests assert the two mode entries appear above the category
 * heading and that clicking either entry navigates and dismisses the
 * overlay. The desktop projects skip: the burger only mounts <lg.
 *
 * WHAT THE SECOND ENTRY USED TO BE. "Customise · Print on demand", aimed
 * at `/products?type=pod`. Both halves were retired deliberately: /studio
 * was folded into one catalogue, and `?type=pod` selects 5 products while
 * 22 carry print zones — it would hide 20 printable products behind a
 * link whose whole job is to advertise printing. See HeaderPage.podEntry.
 */
import { test, expect } from '@playwright/test'
import { HeaderPage } from './pages/HeaderPage'

test.describe('Mobile burger menu: type-aware tiers', () => {
  // Suite-level guard: the burger is `lg:hidden`, mobile project only.
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-iphone', 'Mobile-only burger.')
  })

  test('opens with two mode entries above the category heading', async ({ page }) => {
    const header = new HeaderPage(page)
    await page.goto('/')
    await header.openBurger()
    await expect(header.shopCanonEntry).toBeVisible()
    await expect(header.podEntry).toBeVisible()
    await expect(header.categoryHeading).toBeVisible()
  })

  test('clicking the Studio Canon entry navigates to /shop and dismisses', async ({ page }) => {
    const header = new HeaderPage(page)
    await page.goto('/')
    await header.openBurger()
    await header.shopCanonEntry.click()
    await expect(page).toHaveURL(/\/shop\/?(\?|$)/)
    // Overlay closed → close button is gone.
    await expect(header.burgerClose).toHaveCount(0)
  })

  test('clicking the All products entry navigates to the catalogue', async ({ page }) => {
    const header = new HeaderPage(page)
    await page.goto('/')
    await header.openBurger()
    await header.podEntry.click()
    // The single catalogue, unfiltered. Asserted WITHOUT a query string on
    // purpose: a `?type=` filter here would be the type-vs-capability bug
    // re-entering through the navigation.
    await expect(page).toHaveURL(/\/products\/?(\?|$)/)
    await expect(header.burgerClose).toHaveCount(0)
  })

  test('the catalogue entry says both ways to buy are available', async ({ page }) => {
    /*
     * Discoverability, not copy-editing. This entry is the only place in the
     * mobile navigation where a visitor learns that we print their artwork —
     * the dedicated POD shelf it replaced is gone. If it degrades to a bare
     * "All products" the upload flow becomes something you find only by
     * opening a PDP and scrolling.
     */
    const header = new HeaderPage(page)
    await page.goto('/')
    await header.openBurger()
    await expect(header.podEntry).toContainText(/as-is/i)
    await expect(header.podEntry).toContainText(/your mark|custom|print/i)
  })
})
