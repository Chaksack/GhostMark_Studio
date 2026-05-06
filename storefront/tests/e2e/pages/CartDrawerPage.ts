/**
 * Cart drawer (CartDropdown.vue) is the desktop hover/click panel anchored
 * to the header cart icon. We keep this object tiny because the drawer
 * source ships almost no `data-test` hooks today — assertions stay anchored
 * to ARIA labels and visible copy that's part of the merchery layout.
 */
import { Page, Locator } from '@playwright/test'

export class CartDrawerPage {
  readonly page: Page
  readonly cartTrigger: Locator
  readonly drawerRoot: Locator

  constructor(page: Page) {
    this.page = page
    // The header exposes a button (mobile compact row) and link (desktop
    // utility row) both labelled "Cart". `.first()` picks whichever is in
    // the DOM for the active viewport.
    this.cartTrigger = page.getByRole('button', { name: /^cart$/i }).or(
      page.getByRole('link', { name: /^cart$/i }),
    ).first()
    // CartDropdown renders inside a HeadlessUI Popover — we anchor to the
    // ARIA label on the trigger and let the parent describe the drawer's
    // visible state via siblings.
    this.drawerRoot = page.locator('[aria-label="Cart"]').first()
  }
}
