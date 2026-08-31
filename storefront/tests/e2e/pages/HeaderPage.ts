/**
 * Mobile burger overlay interactions. Desktop header chrome is not
 * exercised here; the mega-menu hover behavior lives in another suite if
 * we add it later.
 *
 * The compact mobile row at <md exposes a single `aria-label="Open menu"`
 * burger button; tapping it opens MobileNav, which carries
 * `aria-label="Close menu"` on its dismiss button. Both mode-tier
 * entries (D2C Studio Canon, B2B POD) live above the category list.
 */
import { Page, Locator, expect } from '@playwright/test'

export class HeaderPage {
  readonly page: Page
  readonly burgerOpen: Locator
  readonly burgerClose: Locator
  readonly overlay: Locator
  readonly shopCanonEntry: Locator
  readonly podEntry: Locator
  readonly categoryHeading: Locator

  constructor(page: Page) {
    this.page = page
    this.burgerOpen = page.getByRole('button', { name: /open menu/i }).first()
    this.burgerClose = page.getByRole('button', { name: /close menu/i }).first()

    /*
     * SCOPE EVERY OVERLAY LOCATOR TO THE DIALOG.
     *
     * These three used to be page-wide, and all three broke with a strict
     * mode violation the first time this suite ever executed: the
     * HOMEPAGE ships hero CTAs whose accessible names are
     * "Shop the Studio Canon, apparel sold as-is" and
     * "Customise and print on demand: upload your artwork", which match
     * the same regexes as the burger's tier-1 entries. Two matches, and
     * Playwright refuses to guess.
     *
     * Note what the page-wide locator would have done if `.first()` had
     * been bolted on to silence it: DOM order puts the burger entry
     * first, so the tests would have gone green — but the suite would
     * then have been one homepage re-order away from silently asserting
     * against a hero CTA instead of the burger. Scoping to the dialog is
     * the fix; `.first()` would have been a coin flip.
     *
     * MobileNav renders the overlay with role="dialog" + aria-modal,
     * which is a semantic contract we already depend on for a11y, so it
     * is a safe anchor.
     */
    this.overlay = page.getByRole('dialog')
    this.shopCanonEntry = this.overlay.getByRole('link', { name: /shop the studio canon/i })
    /*
     * The burger's second mode entry. It used to read "Customise · Print on
     * demand" and point at `/products?type=pod`; it now reads "All products"
     * and points at the whole catalogue.
     *
     * That is not drift, it is two decisions landing:
     *   1. /studio was folded back into a single catalogue — there is one
     *      shelf and two ways to buy from it, as-is or customised.
     *   2. `?type=pod` stopped being a meaningful selector for "can be
     *      printed". Measured: 22 of 26 products carry print zones, while
     *      only 5 are typed 'pod' — and 3 of those 5 cannot be customised
     *      at all. Pointing a "Print on demand" entry at that filter would
     *      show 5 printable products and hide 20, which is the same
     *      type-vs-capability bug that hid the upload flow on every apparel
     *      PDP. Do not restore it without a capability-based filter to aim
     *      it at.
     */
    this.podEntry = this.overlay.getByRole('link', { name: /all products/i })
    this.categoryHeading = this.overlay.getByText(/browse by category/i)
  }

  async openBurger(): Promise<void> {
    await this.burgerOpen.click()
    // The overlay mounts the close button; once it's visible we can
    // consider the drawer ready.
    await expect(this.burgerClose).toBeVisible()
  }
}
