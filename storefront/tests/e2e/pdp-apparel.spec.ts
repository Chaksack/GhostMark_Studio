/**
 * PDP: Apparel (Studio Canon / D2C) flow contract suite.
 *
 * Locks in the chrome the storefront ships when `product.type.value === 'apparel'`:
 *  - Single per-unit price label, NO MOQ wording, NO E-proof copy.
 *  - 2-step layout: variant → quantity stepper (no upload step, no tier ladder).
 *  - ATC enables once a variant is picked and never gates on a design.
 *  - Buy-a-sample / Request-a-quote affordances are absent.
 *
 * Handle: studio-tee-charcoal is part of the 6-piece Studio Canon and a
 * stable seed entry. Substitute via the architect agent on re-seed.
 */
import { test, expect } from '@playwright/test'
import { PdpPage } from './pages/PdpPage'

const APPAREL_HANDLE = 'studio-tee-charcoal'

test.describe('PDP: apparel flow', () => {
  let pdp: PdpPage

  test.beforeEach(async ({ page }) => {
    pdp = new PdpPage(page)
    await pdp.goto(APPAREL_HANDLE)
  })

  test('renders apparel chrome (per-unit price, no MOQ, no design step)', async () => {
    await pdp.expectFlowMode('apparel')
    // The apparel headline must NOT carry B2B vocabulary. We assert the
    // negative because the affirmative ("single per-unit price") is
    // already covered by the visibility check in expectFlowMode.
    await expect(pdp.apparelPrice).not.toContainText(/MOQ/i)
    await expect(pdp.apparelPrice).not.toContainText(/E-proof/i)
    await expect(pdp.apparelPrice).not.toContainText(/per piece/i)
  })

  test('No buy-a-sample / quote-request affordances render', async () => {
    // These two buttons are gated on `isPOD` in the source; their absence
    // is part of the apparel contract.
    await expect(pdp.buySampleButton).toHaveCount(0)
    await expect(
      pdp.page.getByRole('link', { name: /request a quote/i }),
    ).toHaveCount(0)
  })

  test('Add-to-cart without uploading does NOT show upload error', async ({ page }) => {
    // Pick a size if the product carries one: apparel ATC is enabled
    // only once `finalVariantId` resolves.
    const sizePills = pdp.variantSection.getByRole('button').filter({
      hasNotText: /Add|favorit|share|color|customis|sample|details/i,
    })
    if ((await sizePills.count()) > 0) {
      await sizePills.first().click()
    }
    const atc = pdp.apparelAtcCard
      .getByRole('button', { name: /^add to cart/i })
      .first()
    await expect(atc).toBeEnabled()
    await atc.click()
    // The POD-only "upload a design" gate must not fire on apparel.
    // The cart drawer might open on success; we only assert the absence
    // of the upload-required error message.
    await expect(pdp.atcError).toHaveCount(0)
  })

  test('Quantity stepper increments single-unit (no tier ladder)', async () => {
    // The apparel branch uses `data-test="apparel-qty-*"` controls; the
    // POD tier ladder must not render.
    await expect(pdp.tierLadder).toHaveCount(0)
    const incr = pdp.apparelAtcCard.locator('[data-test="apparel-qty-increase"]')
    const input = pdp.apparelAtcCard.locator('[data-test="apparel-qty-input"]')
    await incr.click()
    await incr.click()
    // Default value is 1 and we incremented twice → 3.
    await expect(input).toHaveValue('3')
    const decr = pdp.apparelAtcCard.locator('[data-test="apparel-qty-decrease"]')
    await decr.click()
    await expect(input).toHaveValue('2')
  })

  test('No design editor section rendered', async () => {
    // The customisation chrome (DesignEditor + mobile-upload-trigger +
    // technique row) must be entirely absent on apparel.
    await expect(pdp.designEditorSection).toHaveCount(0)
    await expect(
      pdp.page.locator('[data-test="mobile-upload-trigger"]'),
    ).toHaveCount(0)
  })
})
