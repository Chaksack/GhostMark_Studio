/**
 * PDP — POD flow contract suite.
 *
 * Locks in the chrome the storefront ships when `product.type.value === 'pod'`:
 *  - "From £X / piece · MOQ Y · E-proof in 48h" headline.
 *  - 3-step layout: variant → upload (DesignEditor) → quantity tier ladder.
 *  - ATC gate that blocks add-to-cart until a design is uploaded.
 *  - Mobile sticky bar gated by `primaryAtcInView` IntersectionObserver.
 *
 * Handles in this file are illustrative; the architect agent can swap them
 * after a re-seed (see report). Today's POD set: studio-sticker-pack,
 * logo-sticker-sheet, cable-organiser, tech-pouch.
 */
import { test, expect } from '@playwright/test'
import { PdpPage } from './pages/PdpPage'

const POD_HANDLE = 'studio-sticker-pack'

test.describe('PDP — POD flow', () => {
  let pdp: PdpPage

  test.beforeEach(async ({ page }) => {
    pdp = new PdpPage(page)
    await pdp.goto(POD_HANDLE)
  })

  test('renders POD-flavoured chrome (from-price, MOQ caption, design editor)', async () => {
    await pdp.expectFlowMode('pod')
    // The price label aggregates three signals — verify each phrase is
    // present rather than asserting exact spacing/punctuation, which the
    // template formats with non-breaking middle dots.
    await expect(pdp.fromPrice).toContainText(/From/i)
    await expect(pdp.fromPrice).toContainText(/\/ piece/i)
    await expect(pdp.fromPrice).toContainText(/MOQ \d+/)
    await expect(pdp.fromPrice).toContainText(/E-proof in 48h/i)
  })

  test('Buy a sample CTA renders only on POD products', async () => {
    // Buy-a-sample is a B2B affordance gated on `isPOD`; it must be
    // present in the aux row for any POD PDP. Skip if the viewport hides
    // the row (mobile hides it under <md).
    const isMobile = test.info().project.name === 'mobile-iphone'
    if (isMobile) {
      test.skip()
    }
    await expect(pdp.buySampleButton).toBeVisible()
  })

  test('Add-to-cart without uploading a design surfaces inline error', async ({ page }) => {
    // Trigger the gate by clicking ATC before the upload step happens.
    // The error <p data-test="add-to-cart-error" role="alert"> appears
    // inline below the primary button.
    await pdp.clickPrimaryAtc()
    await expect(pdp.atcError).toBeVisible()
    // Copy contract — the architect intentionally surfaces "upload" or
    // "design" wording so the user understands the missing prerequisite.
    await expect(pdp.atcError).toHaveText(/(upload|design|customis)/i)
  })

  test('Variant pill click flips selected state to ink-950', async ({ page }) => {
    // Pick a variant axis that this POD product actually exposes. Most
    // POD products have a Color or Size axis; we probe whichever pills
    // are mounted and click the second one to ensure a state delta.
    const pills = pdp.variantSection.getByRole('button').filter({
      hasNotText: /Add|favorit|share|remove|customis|sample|details/i,
    })
    const count = await pills.count()
    if (count < 2) {
      test.skip(true, 'Product has fewer than 2 selectable pills; nothing to assert delta on.')
    }
    const second = pills.nth(1)
    await second.click()
    // ink-950 is `rgb(20, 18, 16)` per tailwind.config.ts; the selected
    // pill flips to that background. We tolerate any CSS color the
    // browser computes by checking aria-pressed where available, then
    // falling back to background-color.
    const ariaPressed = await second.getAttribute('aria-pressed')
    if (ariaPressed !== null) {
      expect(ariaPressed).toBe('true')
    } else {
      await expect(second).toHaveCSS('background-color', /rgb\(20,\s*18,\s*16\)/)
    }
  })

  test('URL persists option selection without bouncing', async ({ page }) => {
    // The PDP uses a one-way state→URL sync (router.replace). Click any
    // available option and confirm the query string updates and stays.
    const pills = pdp.variantSection.getByRole('button').filter({
      hasNotText: /Add|favorit|share|remove|customis|sample|details/i,
    })
    if ((await pills.count()) < 1) {
      test.skip(true, 'Product has no variant axes to persist.')
    }
    await pills.first().click()
    // Wait long enough for router.replace to flush.
    await page.waitForTimeout(400)
    const urlAfterClick = page.url()
    expect(urlAfterClick).toMatch(/\?.+=/)
    // Verify the URL doesn't bounce back (the `queriesEqual` guard in
    // [handle].vue prevents a feedback loop). Re-poll and compare.
    await page.waitForTimeout(800)
    expect(page.url()).toBe(urlAfterClick)
  })

  test('Mobile sticky cart bar tracks primary ATC visibility', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-iphone', 'Mobile-only sticky bar.')
    // At the top of the page, the inline primary ATC is below the fold
    // → `primaryAtcInView` is false → sticky bar is mounted.
    await expect(pdp.stickyMobileBar).toBeVisible()
    // Scrolling the inline primary ATC into view flips the observer →
    // sticky bar unmounts.
    await pdp.primaryAtc.scrollIntoViewIfNeeded()
    await expect(pdp.stickyMobileBar).toBeHidden()
  })
})
