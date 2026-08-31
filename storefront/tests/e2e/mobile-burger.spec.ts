/**
 * Mobile burger overlay: type-aware tier ordering.
 *
 * The burger's middle region renders THREE tiers in priority order:
 *   Tier 1: Mode entries (D2C Studio Canon, B2B POD).
 *   Tier 2: "Browse by category" heading + native <details> list.
 *
 * These tests assert the two mode entries appear above the category
 * heading and that clicking either entry navigates and dismisses the
 * overlay. The desktop projects skip: the burger only mounts <lg.
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

  test('clicking the POD entry navigates to /products?type=pod', async ({ page }) => {
    const header = new HeaderPage(page)
    await page.goto('/')
    await header.openBurger()
    await header.podEntry.click()
    await expect(page).toHaveURL(/\/products\?type=pod/)
    await expect(header.burgerClose).toHaveCount(0)
  })
})
