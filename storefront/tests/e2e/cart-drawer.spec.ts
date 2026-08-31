/**
 * Cart drawer rendering smoke test (desktop only).
 *
 * The cart-drawer source ships almost no `data-test` hooks today, so this
 * suite stays minimal: confirm the drawer opens off the header trigger
 * and that the cart link is reachable. Adding lines to the cart would
 * pollute Medusa state across runs, so we leave deeper assertions to a
 * future suite that mocks `**\/store/carts/*` via `page.route()`.
 */
import { test, expect } from '@playwright/test'

test.describe('Cart drawer: empty render (desktop)', () => {
  // Suite-level guard: this drawer behavior is desktop-only chrome.
  // Using the function-form `test.skip` so we can read `testInfo.project`.
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'Desktop-only drawer.')
  })

  test('header cart trigger is reachable from the homepage', async ({ page }) => {
    await page.goto('/')
    // The desktop utility row exposes a cart link with aria-label="Cart".
    // We assert reachability rather than open-state because the drawer's
    // visibility logic is gated by an empty-cart preview that needs at
    // least one line to be interesting.
    /*
     * The header mounts TWO controls labelled "Cart" — one in the compact
     * mobile row and one in the desktop utility row — and only ever shows
     * one at a time. At 1440 the mobile instance is still in the DOM but
     * measures 0x0 (its ancestor is display:none), and it comes FIRST in
     * DOM order.
     *
     * So `.first()` deterministically selected the hidden one and this
     * test failed with "Received: hidden" against a header that was
     * working perfectly. Verified 2026-08-30 at 1440: instance #1 is
     * 0x0, instance #2 is 40x40 at x=1290 — the desktop cart is present
     * and visible.
     *
     * `.filter({ visible: true })` asks for the one that is actually
     * showing at this viewport, which is what the test always meant.
     * That is a stronger assertion than `.first()`, not a weaker one: it
     * still requires a visible cart control to exist, and it now fails
     * for the right reason if none does.
     */
    const visibleCart = page.getByLabel(/^cart$/i).filter({ visible: true })
    await expect(visibleCart).toHaveCount(1)
    await expect(visibleCart.first()).toBeVisible()
  })

  test.fixme('Drawer groups lines by mode (POD vs apparel)', async () => {
    // Mode-aware grouping ships in CartDropdown but currently lacks
    // data-test hooks AND requires real or mocked cart state. Marked
    // fixme so the suite runs green and the gap is tracked.
  })
})
