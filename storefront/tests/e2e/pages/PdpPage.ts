/**
 * PDP page object: encapsulates the two product-type flows (POD vs apparel)
 * the PDP renders. Locators target stable `data-test` hooks the source
 * markup ships in `app/pages/products/[handle].vue`. Anything that is
 * branched at the template level (price label, design editor section,
 * apparel ATC card, etc.) gets its own getter so a single
 * `expectFlowMode('pod' | 'apparel')` assertion can prove the entire
 * chrome flipped correctly.
 *
 * Notes:
 *  - `[data-test="primary-add-to-cart"]` and `[data-test="add-to-cart-error"]`
 *    are duplicated in source across the POD and apparel branches because
 *    only one branch renders at a time. Tests can rely on `.first()`.
 *  - `stickyMobileBar` matches the fixed-position bottom bar that mounts
 *    only when the inline ATC is offscreen. Its escaped `lg\\:hidden` Tailwind
 *    class makes the locator unambiguous on mobile viewports.
 */
import { Page, Locator, expect } from '@playwright/test'

export type FlowMode = 'pod' | 'apparel'

export class PdpPage {
  readonly page: Page
  readonly h1: Locator
  readonly fromPrice: Locator           // POD-only price label
  readonly apparelPrice: Locator        // apparel-only price label
  readonly designEditorSection: Locator // POD-only customisation step
  readonly moqCaption: Locator          // POD-only MOQ caption above tier ladder
  readonly tierLadder: Locator          // POD-only quantity tier ladder
  readonly apparelAtcCard: Locator      // apparel-only quantity + ATC card
  readonly primaryAtc: Locator          // shared selector across flows
  readonly atcError: Locator
  readonly stickyMobileBar: Locator
  readonly desktopStickyAtc: Locator
  readonly buySampleButton: Locator     // POD-only B2B affordance
  readonly variantSection: Locator

  constructor(page: Page) {
    this.page = page
    this.h1 = page.locator('h1').first()
    this.fromPrice = page.locator('[data-test="from-price"]')
    this.apparelPrice = page.locator('[data-test="apparel-price"]')
    this.designEditorSection = page.locator('[data-test="design-editor-section"]')
    this.moqCaption = page.locator('[data-test="moq-caption"]')
    this.tierLadder = page.locator('[data-test="tier-ladder"]')
    this.apparelAtcCard = page.locator('[data-test="apparel-add-to-cart"]')
    // Both branches render the same data-test value; first() picks whichever
    // is mounted at a given moment. We never want both to be visible.
    this.primaryAtc = page.locator('[data-test="primary-add-to-cart"]').first()
    this.atcError = page.locator('[data-test="add-to-cart-error"]').first()
    /*
     * The sticky bar is matched by its `data-test` hook, NOT by its
     * Tailwind classes.
     *
     * The previous locator was `div.fixed.inset-x-0.bottom-0.lg\:hidden`
     * and it stopped matching the moment the cookie-banner P0 was fixed:
     * the bar's `bottom-0` became
     * `bottom-[var(--consent-height,0px)]` so that it rides ABOVE the
     * consent banner instead of underneath it. The bar was still there
     * and still correct; the test was pinned to a class name that was
     * deliberately changed, so it reported a defect that did not exist.
     *
     * Styling classes are presentation and will keep changing. The
     * `data-test` hook is the contract. Match on the contract.
     */
    this.stickyMobileBar = page.locator('[data-test="mobile-sticky-atc"]')
    this.desktopStickyAtc = page.locator('[data-test="desktop-sticky-atc"]')
    this.buySampleButton = page.locator('[data-test="buy-sample"]')
    this.variantSection = page.locator('[data-test="variant-section"]')
  }

  async goto(handle: string): Promise<void> {
    await this.page.goto(`/products/${encodeURIComponent(handle)}`)
    // Wait for the H1 to settle before any assertions: Nuxt SSR hydrates
    // the page-level title immediately, but the right-rail flow chrome
    // lights up after the product fetch resolves.
    await this.h1.waitFor({ state: 'visible' })
  }

  /**
   * Single-shot assertion that the PDP has the chrome of the requested
   * flow and NOTHING from the opposite flow. Use this once at the top of
   * each spec to lock in the binary mode contract.
   */
  async expectFlowMode(mode: FlowMode): Promise<void> {
    if (mode === 'pod') {
      await expect(this.fromPrice).toBeVisible()
      await expect(this.apparelPrice).toHaveCount(0)
      await expect(this.moqCaption).toBeVisible()
      await expect(this.designEditorSection).toBeVisible()
      await expect(this.apparelAtcCard).toHaveCount(0)
    } else {
      await expect(this.apparelPrice).toBeVisible()
      await expect(this.fromPrice).toHaveCount(0)
      await expect(this.moqCaption).toHaveCount(0)
      await expect(this.designEditorSection).toHaveCount(0)
      await expect(this.apparelAtcCard).toBeVisible()
    }
  }

  /**
   * Click a size pill by its visible label (e.g. 'M', 'L'). Falls back to
   * exact match because the chip text is the bare value with no decoration.
   * Scoped to the variant section to avoid colliding with sibling controls
   * (e.g. accordion text that happens to match a size letter).
   */
  async clickSize(size: string): Promise<void> {
    const pill = this.variantSection
      .getByRole('button', { name: new RegExp(`^${size}$`, 'i') })
      .first()
    await pill.click()
  }

  /**
   * Click a color swatch by its accessible name. The source uses
   * `aria-label="Color: <value>"`, which `getByRole('button', { name })`
   * matches via accessible name lookup.
   */
  async clickColor(value: string): Promise<void> {
    await this.variantSection
      .getByRole('button', { name: new RegExp(`^Color: ${value}$`, 'i') })
      .first()
      .click()
  }

  async clickPrimaryAtc(): Promise<void> {
    await this.primaryAtc.click()
  }
}
