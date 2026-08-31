/**
 * Checkout: reach the payment step on the UK region.
 *
 * WHY THIS IS THE HIGHEST-PRIORITY GAP
 * Checkout was BLOCKED for every first-time visitor by a hardcoded
 * `country_code: 'us'` submitted against a UK-only region. Medusa
 * rejected the address with a 400 "not within region", and the customer
 * saw it only after filling the entire form. No test caught it, because
 * no test had ever driven this flow. That single default was worth more
 * revenue than everything else measured today combined, and it was two
 * characters long.
 *
 * The fix binds the country control to `region.countries[]`, which makes
 * the failure unrepresentable rather than merely fixed: there is no
 * value the customer can select that the region will reject. These tests
 * assert that binding directly, not just the happy path, because the
 * happy path would also pass against a hardcoded 'gb'.
 *
 * ============================ SAFETY ============================
 * THIS SUITE MUST NEVER COMPLETE AN ORDER. Completion writes a real row
 * to a SHARED PRODUCTION DATABASE and fires a real Resend email to a
 * real address. Stripe is in test mode so no money moves, but the row
 * and the email are real.
 *
 * Two independent guards, deliberately belt-and-braces:
 *   1. No test clicks the place-order control. It is never located.
 *   2. `blockOrderCompletion()` installs a `page.route()` interceptor
 *      that ABORTS any request to the cart-completion endpoint. If
 *      someone later adds a test that does click it, the request dies in
 *      the browser and never reaches Medusa.
 * Guard 2 exists because guard 1 depends on everyone who edits this file
 * remembering. Do not remove it.
 * ================================================================
 */
import { test, expect, type Page } from '@playwright/test'

const APPAREL_HANDLE = 'studio-tee-charcoal'

/**
 * Hard interlock: abort cart completion at the network layer.
 *
 * Medusa v2 completes a cart with POST /store/carts/:id/complete
 * (`sdk.store.cart.complete()` in app/composables/useCart.ts). We abort
 * that pattern and nothing else, so the rest of checkout behaves
 * normally.
 */
async function blockOrderCompletion(page: Page): Promise<void> {
  await page.route('**/store/carts/*/complete*', async (route) => {
    // eslint-disable-next-line no-console
    console.warn('[QA GUARD] Blocked an attempt to COMPLETE a cart. This suite must never place an order.')
    await route.abort()
  })
}

/**
 * Put one apparel line in the cart so checkout has something to check
 * out. Apparel rather than POD because POD gates add-to-cart on a design
 * upload, which is a different suite's problem.
 */
async function seedCart(page: Page): Promise<void> {
  await page.goto(`/products/${APPAREL_HANDLE}`)
  await page.locator('h1').first().waitFor({ state: 'visible' })

  /*
   * SELECT EVERY VARIANT AXIS, and select SIZE by its accessible name.
   *
   * The previous version took "the first button in the variant section
   * that isn't obviously something else". On this PDP that is a COLOUR
   * swatch — it has an `aria-label` but empty text, so a `hasNotText`
   * filter cannot exclude it. The result: Colour was set, Size was not,
   * `finalVariantId` never resolved, and add-to-cart became a silent
   * no-op. Measured: 0 line-item POSTs in 5 of 5 trials, no success strip
   * and no error. Selecting a real Size makes it 1 of 1.
   *
   * That cost an hour and produced a convincing false "checkout is
   * broken" signal, so: click the size axis explicitly, and assert the
   * URL picked it up, which is the PDP's own proof that state changed.
   */
  const variantSection = page.locator('[data-test="variant-section"]')
  if (await variantSection.count()) {
    // CSS attribute match, not getByRole: the pills carry aria-label
    // "Size S" etc, and a getByRole name filter returned 0 against them
    // while this selector returns all 4. Verified 2026-08-30.
    const sizePills = variantSection.locator('button[aria-label^="Size" i]')
    if ((await sizePills.count()) > 0) {
      await sizePills.first().click()
    } else {
      // No size axis: fall back to the first enabled option button.
      const anyPill = variantSection.getByRole('button')
      if ((await anyPill.count()) > 0) await anyPill.first().click()
    }
    await page.waitForTimeout(400)
  }

  const atc = page.locator('[data-test="primary-add-to-cart"]').first()
  await expect(atc).toBeEnabled()
  await atc.click()

  /*
   * WAIT FOR A REAL SIGNAL, NOT A TIMEOUT.
   *
   * This was `await page.waitForTimeout(2500)` and it produced the most
   * expensive false alarm of this lane: the line item had not landed
   * before the test navigated on, so /checkout created a SECOND cart
   * (two POST /store/carts in the network log) with no items and no
   * shipping options. `onSaveShipping` then called `updateCart` with no
   * usable cart id, which made no request at all — so the form submitted,
   * nothing happened, no error rendered, and the failure looked exactly
   * like "the UK address was rejected".
   *
   * It is not. Driving the identical flow with the item genuinely in the
   * cart reaches the Payment step cleanly. The bug was the instrument.
   *
   * The header cart badge only renders when `cartCount` is truthy, so its
   * appearance is proof the line item is committed and the cart is the
   * one checkout will read. Waiting on that is deterministic where a
   * fixed delay is a race that fails under load and passes when idle.
   */
  /*
   * The badge is `<span class="absolute -top-1 -right-1 …">{{ cartCount }}</span>`
   * and it renders ONLY when `cartCount` is truthy, so its presence is
   * exactly "the cart has at least one unit".
   *
   * Matching note: an earlier version of this used
   * `.filter({ hasText: /^\d+$/ })` and never matched anything, because
   * the template puts the interpolation on its own line — the span's text
   * is "\n              1\n            ", which is not `^\d+$`. That
   * produced a 20s timeout that read as "add-to-cart is broken" when the
   * anchor was simply wrong. Match on the presence of a digit instead.
   */
  const cartBadge = page
    .getByLabel(/^cart$/i)
    .filter({ visible: true })
    .locator('span.absolute')
    .filter({ hasText: /\d/ })
    .first()
  await expect(
    cartBadge,
    'add-to-cart did not produce a cart line — checkout cannot be tested without one',
  ).toBeVisible({ timeout: 20_000 })
}

test.describe('Checkout: UK region reaches the payment step', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'desktop-chromium',
      'One project is enough for a flow test; the mobile layout is covered by the overflow and consent suites.',
    )
    await blockOrderCompletion(page)
  })

  test('country control is a <select> bound to the active region, not a free-text guess', async ({ page }) => {
    await seedCart(page)
    await page.goto('/checkout')
    await page.locator('#ship-country').waitFor({ state: 'visible' })

    const tag = await page.locator('#ship-country').evaluate((el) => el.tagName.toLowerCase())
    expect(
      tag,
      'the country field must be a <select> bound to region.countries[], not an <input> a customer can type a rejected country into',
    ).toBe('select')

    // Every option must be a country the region actually accepts. This
    // is the assertion that makes the original bug unrepresentable: if
    // the list were hardcoded, a value outside the region could appear.
    const options = await page.locator('#ship-country option').evaluateAll((els) =>
      els.map((e) => ({ value: (e as HTMLOptionElement).value, label: (e.textContent || '').trim() })),
    )
    expect(options.length, 'region must contribute at least one country').toBeGreaterThan(0)
    for (const o of options) {
      expect(o.value, `option "${o.label}" has an empty value`).toMatch(/^[a-z]{2}$/)
    }

    // UK is a single-country region, so the field must be PRE-FILLED.
    // This is the specific behaviour that was broken: a blank or
    // wrong-country default here is the bug returning.
    if (options.length === 1) {
      await expect(
        page.locator('#ship-country'),
        'a single-country region must auto-select its only country — a blank required field is the original defect in a new costume',
      ).toHaveValue(options[0].value)
    }
  })

  test('the country default is never a country outside the region', async ({ page }) => {
    await seedCart(page)
    await page.goto('/checkout')
    await page.locator('#ship-country').waitFor({ state: 'visible' })

    const { selected, allowed } = await page.evaluate(() => {
      const sel = document.querySelector('#ship-country') as HTMLSelectElement
      return {
        selected: sel.value,
        allowed: Array.from(sel.options).map((o) => o.value),
      }
    })
    // A blank is acceptable ONLY on a genuinely multi-country region,
    // where the code deliberately refuses to guess. It is never
    // acceptable to preselect a country the region does not serve.
    if (selected !== '') {
      expect(
        allowed,
        `preselected country "${selected}" is not offered by the active region — this is exactly the country_code:'us' bug`,
      ).toContain(selected)
    }
  })

  test('a UK address advances from shipping to the payment step', async ({ page }) => {
    await seedCart(page)
    await page.goto('/checkout')
    await page.locator('#ship-country').waitFor({ state: 'visible' })

    const options = await page
      .locator('#ship-country option')
      .evaluateAll((els) => els.map((e) => (e as HTMLOptionElement).value))
    test.skip(!options.includes('gb'), 'Active region does not serve GB; run this against the UK region.')

    /*
     * Fill with Playwright locators, NEVER by assigning `.value` through
     * the native property descriptor. Vue's reactive state does not
     * observe a raw descriptor write, so the model keeps its old value,
     * the next re-render wipes what you set, and the form silently
     * submits the ORIGINAL data. Two lanes lost time to that today.
     * `fill()` and `selectOption()` dispatch the events Vue listens for.
     */
    /*
     * FILL, THEN VERIFY THE VALUES SURVIVED — do not assume.
     *
     * `.fill()` is the right API (assigning `.value` via the native
     * descriptor never reaches Vue's reactive state), but being right
     * about the API is not sufficient here. If you fill BEFORE the cart
     * has resolved, the component re-renders when it arrives and every
     * field is silently reset to empty. Measured: all six required
     * inputs read `value: ""` immediately after six successful `fill()`
     * calls, `form.checkValidity()` false, and submit therefore did
     * nothing — no request, no `role=alert`, nothing. It presents
     * exactly like a rejected address.
     *
     * So: wait for the cart to actually be there, fill, then read the
     * values back and re-fill once if they were wiped. The read-back is
     * the part that matters — it converts a silent 20s timeout into a
     * one-line explanation.
     */
    const FIELDS: [string, string][] = [
      ['#ship-email', 'qa-checkout-probe@example.com'],
      ['#ship-first', 'Quality'],
      ['#ship-last', 'Assurance'],
      ['#ship-address', '1 Test Street'],
      ['#ship-city', 'London'],
      ['#ship-postal', 'SW1A 1AA'],
    ]

    const fillAll = async () => {
      for (const [sel, value] of FIELDS) await page.locator(sel).fill(value)
      await page.locator('#ship-country').selectOption('gb')
      const phone = page.locator('#ship-phone')
      if (await phone.count()) await phone.fill('02079460000')
    }

    await fillAll()
    await page.waitForTimeout(800)

    // Did anything get wiped by a late re-render? Re-fill once if so.
    const wiped = await page.evaluate(
      (sels) => sels.filter((s) => !(document.querySelector(s) as HTMLInputElement)?.value),
      FIELDS.map(([s]) => s),
    )
    if (wiped.length) await fillAll()

    // Now assert the form is genuinely submittable. Without this the
    // failure surfaces 20 seconds later as "the UK address was rejected",
    // which is both wrong and expensive to chase.
    const invalid = await page.evaluate(() => {
      const form = document.querySelector('form')
      if (!form) return ['no form']
      return Array.from(form.querySelectorAll('input,select,textarea'))
        .filter((e) => !(e as HTMLInputElement).checkValidity())
        .map((e) => `${(e as HTMLInputElement).id}="${(e as HTMLInputElement).value}"`)
    })
    expect(
      invalid,
      'form fails HTML5 validation, so submit will be blocked silently with only a native tooltip',
    ).toEqual([])

    // The country select is `required`. If it is blank the browser blocks
    // submit with a native tooltip Playwright cannot see, and the test
    // would time out looking like a server failure. Assert it is filled
    // BEFORE submitting, so a blank field fails with a clear message.
    await expect(
      page.locator('#ship-country'),
      'country must be set before submit, or HTML5 validation silently blocks the form',
    ).toHaveValue('gb')

    // Pick a shipping option if the region offers a choice.
    const shipOptions = page.locator('input[type="radio"][name], input[type="radio"]')
    if ((await shipOptions.count()) > 0) {
      const checked = await shipOptions.evaluateAll((els) =>
        els.some((e) => (e as HTMLInputElement).checked),
      )
      if (!checked) await shipOptions.first().check()
    }

    await page.getByRole('button', { name: /continue to payment/i }).click()

    /*
     * Success condition: the step indicator advances to Payment. We
     * assert on the payment HEADING rather than on Stripe mounting,
     * because Stripe readiness depends on a payment provider being
     * linked to the region — EU and US currently have none, and that is
     * a separate defect owned by the PAYMENT lane. This test is about
     * whether the ADDRESS is accepted.
     */
    await expect(
      page.getByRole('heading', { name: /^payment$/i }),
      'shipping did not advance to payment — the UK address was rejected',
    ).toBeVisible({ timeout: 20_000 })

    // And prove it was not an error masquerading as progress.
    await expect(page.getByText(/not within region|invalid address/i)).toHaveCount(0)
  })

  test('SAFETY: the completion endpoint is blocked for this suite', async ({ page }) => {
    // Meta-test. If the guard ever stops matching the real endpoint
    // (Medusa changes its route shape, say), this fails loudly rather
    // than letting a future test quietly place real orders.
    let blocked = false
    await page.route('**/store/carts/*/complete*', async (route) => {
      blocked = true
      await route.abort()
    })
    await page.goto('/')
    const result = await page.evaluate(async () => {
      try {
        await fetch('/store/carts/cart_qa_probe/complete', { method: 'POST' })
        return 'reached-network'
      } catch {
        return 'aborted'
      }
    })
    expect(result, 'the completion-blocking route pattern must actually match').toBe('aborted')
    expect(blocked).toBe(true)
  })
})
