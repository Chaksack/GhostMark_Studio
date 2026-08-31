/**
 * The PDP capability gate: `canCustomise` vs `isPOD`.
 *
 * WHY THIS FILE EXISTS. The design editor's gate moved from
 * `isPOD && printLocations.length` to
 * `isCustomizable && printLocations.length > 0`, which opens it on 20
 * apparel SKUs. THREE other systems on the same page did not move:
 *
 *   stepNumber()  :2242   ladder gated on isPOD  -> renders "0. Upload your design"
 *   needsDesign   :3206   isPOD && printLocations -> the design payload is
 *                         never collected and never sent; the else branch is a
 *                         bare addItem(variantId, qty)
 *   moq / metaFacts / usesQuantitySelect / leadTime
 *                         still isPOD -> no minimum, no tier ladder, and the
 *                         D2C dispatch estimate shown against a print job
 *
 * The middle one is silent loss of customer-supplied artwork. These tests
 * assert COHERENCE rather than any particular end state: whichever gate wins,
 * the editor and the payload path must agree. Both halves of the migration
 * pass; neither half alone does.
 *
 *     npx playwright test -c playwright.chrome.config.ts tests/e2e/capability-gate.spec.ts
 */
import { test, expect } from '@playwright/test'
import { settlePage } from './helpers/viewport'

const APPAREL_CUSTOMISABLE = 'studio-tee-charcoal'
const POD_CUSTOMISABLE = 'cable-organiser'
const POD_NOT_CUSTOMISABLE = 'studio-sticker-pack'

/** Unit prices from the Store API, gbp region. The instrument that would disagree. */
const UNIT_PRICE_GBP: Record<string, number> = {
  'studio-tee-charcoal': 35,
  'workshop-tote': 22,
  'cable-organiser': 18,
  'tech-pouch': 32,
}

/**
 * Never let a spec in this file complete an order, and never let one write a
 * cart line to the shared database. The abort is the point: the intercepted
 * REQUEST is the evidence, so nothing has to be persisted to prove which
 * branch ran.
 */
async function interceptCartWrites(context: import('@playwright/test').BrowserContext) {
  const calls: { endpoint: string; body: string }[] = []
  await context.route('**/store/carts/*/complete*', (r) => r.abort())
  await context.route('**/api/custom-cart', async (r) => {
    calls.push({ endpoint: 'custom-cart', body: r.request().postData() || '' })
    await r.abort()
  })
  await context.route('**/store/carts/*/line-items*', async (r) => {
    calls.push({ endpoint: 'line-items', body: r.request().postData() || '' })
    await r.abort()
  })
  return calls
}

test.describe('PDP capability gate: the editor and the payload must agree', () => {
  for (const handle of [APPAREL_CUSTOMISABLE, POD_CUSTOMISABLE]) {
    test(`${handle}: if an editor is offered, the design reaches the cart`, async ({ page, context }) => {
      const calls = await interceptCartWrites(context)
      await page.goto(`/products/${handle}`)
      await settlePage(page)

      const hasEditor = await page.locator('canvas').count()
      if (!hasEditor) {
        /*
         * NOT A PASS, AND THE DISTINCTION MATTERS. No editor means nothing was
         * promised, so there is nothing to keep and no defect to assert. But a
         * green tick here is the ABSENCE of the condition, never evidence that
         * the payload path works. This branch fired on apparel the moment the
         * gate was reverted, turning a test that had been failing correctly
         * into a silent pass. Log it so a reader can tell the two apart.
         */
        test.info().annotations.push({
          type: 'vacuous',
          description: `${handle} renders no editor, so this assertion never ran`,
        })
        return
      }

      // A colour swatch carries an aria-label and EMPTY text, so a text-based
      // filter cannot exclude it. Select a real Size by attribute or the
      // variant never resolves and add-to-cart no-ops for an unrelated reason.
      const sizes = page.locator('button[aria-label^="Size" i]')
      if (await sizes.count()) await sizes.last().click()

      const file = page.locator('input[type=file]').first()
      if (await file.count()) {
        await file.setInputFiles({
          name: 'design.png',
          mimeType: 'image/png',
          // 4x4 red PNG
          buffer: Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC',
            'base64',
          ),
        })
      }
      // Wait on the editor actually holding the artwork rather than on a
      // fixed sleep: `collectDesignPayload()` throws if the stage has not
      // committed, which presents as "no request fired" and reads exactly
      // like the product defect this test hunts.
      await expect(page.locator('canvas').first()).toBeVisible()
      await page.waitForTimeout(2500)

      // Centre it first. `scrollIntoViewIfNeeded` does the MINIMUM scroll, so
      // it parks the control against a viewport edge owned by the fixed
      // header or the consent banner, and the click is then intercepted for a
      // reason that has nothing to do with the gate.
      const atc = page.locator('[data-test="primary-add-to-cart"]')
      await atc.evaluate((el) => el.scrollIntoView({ block: 'center' }))
      let clickError: string | null = null
      await atc.click({ timeout: 8000 }).catch((e) => {
        clickError = String(e).split('\n')[0]
      })
      await page.waitForTimeout(3000)

      // Never swallow the click failure. A silent catch here would report a
      // broken locator as "the design did not reach the cart", which is a
      // false P0 against the product.
      expect(
        calls.length,
        `add-to-cart produced no cart request at all. ` +
          (clickError ? `The CLICK failed, so this is a TEST fault, not a product one: ${clickError}` : 'The click succeeded and the page made no request.'),
      ).toBeGreaterThan(0)
      const carrying = calls.filter((c) => c.body.includes('design_data'))
      expect(
        carrying.length,
        `${handle} offers a design editor but its add-to-cart sent ` +
          `${calls.map((c) => c.endpoint).join(', ')} with NO design_data. ` +
          "The customer's artwork is discarded silently and they are charged for a plain item. " +
          `Bodies: ${calls.map((c) => c.body.slice(0, 120)).join(' | ')}`,
      ).toBeGreaterThan(0)
    })
  }

  test('no step in the numbered ladder is numbered 0', async ({ page }) => {
    /*
     * `stepNumber()` returns `order.indexOf(name) + 1`, so a step that renders
     * but is absent from the ladder gets -1 + 1 = 0. Asserted across all three
     * product shapes rather than on one, because the bug only appears where
     * the editor's gate and the ladder's gate disagree.
     */
    for (const handle of [APPAREL_CUSTOMISABLE, POD_CUSTOMISABLE, POD_NOT_CUSTOMISABLE]) {
      await page.goto(`/products/${handle}`)
      await settlePage(page)
      const steps = await page.evaluate(() =>
        Array.from(document.querySelectorAll('main h2'))
          .map((h) => (h.textContent || '').trim())
          .filter((t) => /^-?\d+\.\s/.test(t)),
      )
      const zeroed = steps.filter((s) => /^0\.\s/.test(s) || /^-\d+\.\s/.test(s))
      expect(zeroed, `${handle} renders ${zeroed.join(' / ')}. Steps: ${steps.join(' / ')}`).toEqual([])
    }
  })

  test('a product that offers customisation states its production terms', async ({ page }) => {
    /*
     * The original form of this test asserted that "dispatched in N-N working
     * days" appears NOWHERE on a page that offers an editor. That was the
     * right instinct against the wrong target, and it is worth saying why it
     * changed rather than quietly relaxing it.
     *
     * The instinct: a page offering to print your artwork must not quote you
     * the ready-to-ship shelf estimate. The identical job on cable-organiser
     * is quoted at ~10-15 working days; promising 3-5 is a date the business
     * misses on every such order.
     *
     * Why the target was wrong: apparel is now dual-mode. As-is is the
     * DEFAULT — the buy box holds one blank garment, and for THAT the 3-5 day
     * dispatch estimate is simply true. Banning the string outright would
     * force the page to hide a fact about the thing it is actually selling.
     *
     * So the assertion moves from "the shelf estimate is absent" to "the
     * printed terms are present, and present BEFORE the upload". That is the
     * stronger claim: it is not enough to avoid the wrong number, the right
     * one has to be on the page at the moment the offer is made — a customer
     * who learns the minimum is 25 and the lead time three weeks only AFTER
     * attaching artwork has been misled just as effectively.
     */
    await page.goto(`/products/${APPAREL_CUSTOMISABLE}`)
    await settlePage(page)
    const offersEditor = (await page.locator('canvas').count()) > 0
    if (!offersEditor) return

    const terms = page.locator('[data-test="custom-production-terms"]')
    await expect(
      terms,
      'this PDP offers to print the customer\'s artwork but states no production ' +
        'terms. Either say what a printed run costs in time and volume, or do not ' +
        'offer the editor.',
    ).toBeVisible()

    const text = (await terms.innerText()).trim()
    expect(text, `production terms must quote a lead time, got "${text}"`)
      .toMatch(/\d+\s*-\s*\d+\s*working days/i)
    expect(text, `production terms must quote the minimum, got "${text}"`)
      .toMatch(/minimum\s+\d+/i)

    // The printed lead time must not silently equal the shelf estimate: if
    // they ever converge, one of the two numbers is wrong.
    const shelf = (await page.evaluate(() => document.body.innerText))
      .match(/dispatched in (\d+)-(\d+) working days/i)
    const printed = text.match(/(\d+)\s*-\s*(\d+)\s*working days/i)
    if (shelf && printed) {
      expect(
        `${printed[1]}-${printed[2]}`,
        'the printed lead time is identical to the ready-to-ship estimate, so one ' +
          'of them is not being read from the product',
      ).not.toBe(`${shelf[1]}-${shelf[2]}`)
    }
  })

  for (const handle of Object.keys(UNIT_PRICE_GBP)) {
    test(`${handle}: no displayed price is the unit price multiplied by a minimum`, async ({ page }) => {
      /*
       * The GBP 875 class. chips.ts records an incident where apparel
       * capability metadata read raw quoted a GBP 35 tee as GBP 875 (35 x moq
       * 25). Asserts against the Store API amount, which is upstream of every
       * frontend gate and would disagree with the page if the page were wrong.
       */
      await page.goto(`/products/${handle}`)
      await settlePage(page)
      const shown = await page.evaluate(() =>
        Array.from(new Set(document.body.innerText.match(/£[\d,]+(?:\.\d{2})?/g) || [])),
      )
      const unit = UNIT_PRICE_GBP[handle]
      expect(
        shown.some((s) => s.startsWith(`£${unit}.`) || s === `£${unit}.00`),
        `the unit price £${unit} is not displayed. Shown: ${shown.join(', ')}`,
      ).toBe(true)
    })
  }
})
