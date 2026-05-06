/**
 * Mobile burger overlay interactions. Desktop header chrome is not
 * exercised here — the mega-menu hover behavior lives in another suite if
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
  readonly shopCanonEntry: Locator
  readonly podEntry: Locator
  readonly categoryHeading: Locator

  constructor(page: Page) {
    this.page = page
    this.burgerOpen = page.getByRole('button', { name: /open menu/i }).first()
    this.burgerClose = page.getByRole('button', { name: /close menu/i }).first()
    // Tier 1 mode entries inside the burger overlay. Use the headline copy
    // since each <NuxtLink> wraps eyebrow + heading + caption — getByRole
    // matches the accessible name accumulated from those children.
    this.shopCanonEntry = page.getByRole('link', { name: /shop the studio canon/i })
    this.podEntry = page.getByRole('link', { name: /customise.*print on demand/i })
    this.categoryHeading = page.getByText(/browse by category/i)
  }

  async openBurger(): Promise<void> {
    await this.burgerOpen.click()
    // The overlay mounts the close button; once it's visible we can
    // consider the drawer ready.
    await expect(this.burgerClose).toBeVisible()
  }
}
