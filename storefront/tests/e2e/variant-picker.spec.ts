/**
 * Every option button in "Pick a product variant" must select when clicked.
 *
 * The URL → selection sync used to run on every selection change and force
 * each group back to the URL's value. The URL is written after the click,
 * so once any option was in the query string every later click was reverted
 * before it landed: the second pick in a group worked and every pick after
 * it did nothing. On atelier-hoodie (Gender x Color x Size) the first pick
 * wrote all three axes to the URL and froze the other two groups.
 *
 * Clicks in DOM order, which is exactly the sequence that used to jam.
 */
import { test, expect } from '@playwright/test'

for (const handle of ['atelier-hoodie', 'studio-tee-charcoal']) {
  test(`${handle}: every variant button selects when clicked`, async ({ page }) => {
    await page.goto(`/products/${handle}`)
    await page.waitForLoadState('networkidle').catch(() => {})

    const options = page.locator('[data-test="variant-section"] [role="radio"]')
    const count = await options.count()
    expect(count, 'variant section rendered no options').toBeGreaterThan(1)

    for (let i = 0; i < count; i++) {
      const option = options.nth(i)
      const label = await option.getAttribute('aria-label')
      await option.click()
      await expect(option, `${label} did not select`).toHaveAttribute('aria-checked', 'true')
    }
  })
}
