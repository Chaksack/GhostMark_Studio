/**
 * PDP: Apparel (Studio Canon / D2C) flow contract suite.
 *
 * Locks in the chrome the storefront ships when `product.type.value === 'apparel'`:
 * Locks in the AS-IS DEFAULT, which is the mode an apparel page opens in:
 *  - Single per-unit price label, NO MOQ wording, NO E-proof copy.
 *  - No tier ladder; the quantity stepper moves in single units.
 *  - ATC enables once a variant is picked and never gates on a design.
 *  - Buy-a-sample / Request-a-quote affordances are absent.
 *
 * It does NOT lock the absence of the design editor any more, and that
 * change is the point rather than an accommodation. Uploading artwork for us
 * to print is the product; all 20 apparel SKUs carry print zones, a minimum
 * and a tier ladder. The editor was gated on `type.value === 'pod'`, which
 * hid it on every apparel page, and this suite asserted that absence — so
 * the tests were holding the defect in place. The editor is now OFFERED
 * here; attaching artwork is what moves the order into print mode, and
 * `capability-gate.spec.ts` covers that transition.
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

  test('renders as-is apparel chrome (per-unit price, no MOQ, editor offered)', async () => {
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

  test('the design editor is offered, and states its terms before the upload', async () => {
    // The inverse of what this test used to assert. An apparel page that
    // cannot take artwork is the bug the customer reported.
    await expect(pdp.designEditorSection).toBeVisible()

    // And it must say what a printed order costs in time and volume BEFORE
    // any artwork is attached. Discovering a minimum of 25 and a three-week
    // lead time after uploading is the same defect as never stating them.
    const terms = pdp.page.locator('[data-test="custom-production-terms"]')
    await expect(terms).toBeVisible()
    await expect(terms).toContainText(/printed to order/i)
    await expect(terms).toContainText(/working days/i)
    await expect(terms).toContainText(/minimum \d+/i)
  })
})
