/**
 * Cookie-banner pointer-interception suite. (The P0.)
 *
 * WHY THIS EXISTS, AND WHY IT IS NOT A SCREENSHOT TEST
 * The consent banner is `fixed inset-x-0 bottom-0 z-[60]`. Being fixed,
 * it does not participate in layout, so nothing reserves space for it.
 * At 390x844 it measured 309px — 37% of the viewport — and it sat on top
 * of the PDP quantity steppers, "Add to cart", and the footer region
 * trigger. A first-time mobile visitor, which is *precisely* the session
 * in which the banner is guaranteed to render, could not add to cart.
 *
 * This shipped and survived weeks of visual passes. It had to: the
 * pixels are all correct. Every element is painted, in the right place,
 * at the right size. What fails is HIT TESTING — which element receives
 * a pointer event at a given coordinate — and a screenshot contains
 * exactly no information about that. So this suite asserts with
 * `document.elementFromPoint()`, never with an image.
 *
 * The contract under test:
 *   - the banner publishes its measured height on `--consent-height`;
 *   - `body { padding-bottom: var(--consent-height) }` lets ordinary page
 *     content scroll clear of it;
 *   - fixed action bars bind `bottom: var(--consent-height)` so they ride
 *     ABOVE the banner rather than under it.
 * If any of the three regresses, add-to-cart becomes unclickable again.
 *
 * Every test here runs in a FRESH context (Playwright's default per-test
 * isolation), which is what makes it a first visit: no `gms_cookie_consent`
 * key in localStorage means `decided === false` means the banner renders.
 * Do not add a global storageState to this project without exempting this
 * file — it would silently neuter the entire suite by dismissing the
 * banner before the first assertion.
 */
import { test, expect, type Page, type Locator } from '@playwright/test'
import { settlePage } from './helpers/viewport'

const POD_HANDLE = 'studio-sticker-pack'
const APPAREL_HANDLE = 'studio-tee-charcoal'
const CONSENT_KEY = 'gms_cookie_consent'

const banner = (page: Page): Locator => page.locator('.gm-consent')

/**
 * Hit-test the centre of `target` and report what actually receives the
 * pointer there.
 *
 * Returns `intercepted: false` when the element at that coordinate is
 * the target itself or a descendant of it (a label/span inside a button
 * still routes the click to the button, so that is a pass).
 *
 * Returns the interceptor's description otherwise, so the failure names
 * the thing that is in the way.
 */
async function hitTest(target: Locator): Promise<{
  intercepted: boolean
  interceptor: string | null
  point: { x: number; y: number } | null
}> {
  return target.evaluate((el) => {
    const rect = el.getBoundingClientRect()
    const x = Math.round(rect.left + rect.width / 2)
    const y = Math.round(rect.top + rect.height / 2)

    // Off-screen centre: elementFromPoint is viewport-relative and would
    // return null or something unrelated. Report it rather than pass.
    if (
      y < 0 ||
      x < 0 ||
      y > window.innerHeight ||
      x > window.innerWidth
    ) {
      return {
        intercepted: true,
        interceptor: `TARGET CENTRE OFF-SCREEN at (${x}, ${y}); viewport is ${window.innerWidth}x${window.innerHeight}`,
        point: { x, y },
      }
    }

    const hit = document.elementFromPoint(x, y)
    if (!hit) {
      return { intercepted: true, interceptor: 'nothing (elementFromPoint returned null)', point: { x, y } }
    }
    if (hit === el || el.contains(hit)) {
      return { intercepted: false, interceptor: null, point: { x, y } }
    }

    const describe = (n: Element): string => {
      const dt = n.getAttribute('data-test')
      const cls = (n.getAttribute('class') || '').split(/\s+/).filter(Boolean).slice(0, 5).join('.')
      return `${n.tagName.toLowerCase()}${dt ? `[data-test="${dt}"]` : ''}${cls ? `.${cls}` : ''}`
    }
    // Walk up a little so "a span inside the consent banner" reports as
    // the banner, which is the actionable name.
    const chain: string[] = []
    let cur: Element | null = hit
    for (let i = 0; i < 4 && cur; i++) {
      chain.push(describe(cur))
      cur = cur.parentElement
    }
    return { intercepted: true, interceptor: chain.join(' < '), point: { x, y } }
  })
}

test.describe('Cookie banner: pointer interception (first visit)', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      testInfo.project.name !== 'mobile-iphone',
      'The P0 is a small-viewport failure: the banner is proportionally tiny at 1440.',
    )
  })

  test('banner renders on a first visit and publishes --consent-height', async ({ page }) => {
    await page.goto('/')
    await expect(banner(page)).toBeVisible()

    // localStorage must genuinely be empty — if it is not, this whole
    // file is testing a returning visitor and proves nothing.
    const stored = await page.evaluate((k) => window.localStorage.getItem(k), CONSENT_KEY)
    expect(stored, 'first-visit precondition: no persisted consent').toBeNull()

    const published = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--consent-height').trim(),
    )
    const px = parseFloat(published)
    expect(px, `--consent-height must be published while the banner is up (got "${published}")`).toBeGreaterThan(0)

    // It must match the banner's real measured height, or the consumers
    // reserve the wrong amount of space.
    const box = await banner(page).boundingBox()
    expect(box).not.toBeNull()
    expect(Math.abs(px - (box!.height))).toBeLessThanOrEqual(2)
  })

  test('banner does not eat an unreasonable share of a 390px viewport', async ({ page }) => {
    await page.goto('/')
    await expect(banner(page)).toBeVisible()
    const box = await banner(page).boundingBox()
    const vp = page.viewportSize()!
    const share = (box!.height / vp.height) * 100

    // The regression measured 309px / 37%. The rebuild is reported at
    // ~140px. We assert the CLASS of defect (a banner that dominates the
    // viewport), not the exact number, so a legitimate copy change does
    // not fail the suite while a re-regression still does.
    expect(
      share,
      `consent banner is ${Math.round(box!.height)}px = ${share.toFixed(1)}% of a ${vp.height}px viewport`,
    ).toBeLessThan(25)
  })

  test('body reserves the banner height so page content can clear it', async ({ page }) => {
    await page.goto('/')
    await expect(banner(page)).toBeVisible()
    const { bodyPad, consentH } = await page.evaluate(() => ({
      bodyPad: parseFloat(getComputedStyle(document.body).paddingBottom) || 0,
      consentH: parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue('--consent-height'),
      ) || 0,
    }))
    expect(
      bodyPad,
      'body must reserve --consent-height, else the last screenful is unreachable',
    ).toBeGreaterThanOrEqual(consentH - 1)
  })

  for (const [label, handle] of [
    ['POD', POD_HANDLE],
    ['apparel', APPAREL_HANDLE],
  ] as const) {
    test(`${label} PDP: add-to-cart is clickable, not covered by the banner`, async ({ page }) => {
      await page.goto(`/products/${handle}`)
      await expect(banner(page)).toBeVisible()
      await settlePage(page)

      // The mobile sticky bar is the control a first-time visitor
      // actually reaches for; it is also the one that binds
      // `bottom: var(--consent-height)`. Prefer it when mounted, and
      // fall back to the inline primary ATC.
      const sticky = page.locator('[data-test="mobile-sticky-add-to-cart"]').first()
      const stickyAlt = page.locator('[data-test="mobile-sticky-atc"]').first()
      const inline = page.locator('[data-test="primary-add-to-cart"]').first()

      const candidates: { name: string; loc: Locator }[] = []
      if (await sticky.count()) candidates.push({ name: 'mobile-sticky-add-to-cart', loc: sticky })
      if (await stickyAlt.count()) candidates.push({ name: 'mobile-sticky-atc', loc: stickyAlt })
      if (await inline.count()) candidates.push({ name: 'primary-add-to-cart', loc: inline })

      expect(candidates.length, 'PDP must expose at least one add-to-cart control').toBeGreaterThan(0)

      for (const { name, loc } of candidates) {
        if (!(await loc.isVisible())) continue
        await loc.scrollIntoViewIfNeeded()
        await page.waitForTimeout(150)
        const result = await hitTest(loc)
        expect(
          result.intercepted,
          `[${label}] "${name}" is NOT clickable at ${JSON.stringify(result.point)} — ` +
            `the pointer lands on: ${result.interceptor}. ` +
            `This is the cookie-banner P0 class: the pixels look correct, the click does not land.`,
        ).toBe(false)
      }
    })
  }

  test('footer region trigger is reachable with the banner up', async ({ page }) => {
    await page.goto('/')
    await expect(banner(page)).toBeVisible()
    await settlePage(page)
    // Scroll to the very bottom: this is where the banner overlap bites.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await page.waitForTimeout(300)

    const regionTrigger = page
      .getByRole('button', { name: /region|deliver|united kingdom|change country/i })
      .last()
    if ((await regionTrigger.count()) === 0) {
      test.skip(true, 'No region trigger rendered in the footer on this build.')
    }
    if (!(await regionTrigger.isVisible())) {
      test.skip(true, 'Region trigger present but not visible at this viewport.')
    }
    const result = await hitTest(regionTrigger)
    expect(
      result.intercepted,
      `footer region trigger is covered by: ${result.interceptor}`,
    ).toBe(false)
  })

  test('dismissing the banner releases the reserved space', async ({ page }) => {
    await page.goto('/')
    await expect(banner(page)).toBeVisible()
    await page.getByRole('button', { name: /accept all/i }).first().click()
    await expect(banner(page)).toHaveCount(0)

    // The teardown path matters: if --consent-height is not zeroed, every
    // page keeps a dead gutter at the bottom for the rest of the session.
    await expect
      .poll(async () =>
        page.evaluate(
          () =>
            parseFloat(
              getComputedStyle(document.documentElement).getPropertyValue('--consent-height'),
            ) || 0,
        ),
      )
      .toBe(0)
  })
})

/**
 * THE SAME P0, AT DESKTOP — a gap this file originally created for itself.
 *
 * The mobile suite above skips desktop with the reasoning "the banner is
 * proportionally tiny at 1440". That reasoning was WRONG, and the PDP-BAR
 * lane proved it while this file was being written: at desktop
 * `--consent-height` is ~104px, and the PDP's desktop sticky ATC was
 * `bottom: 0` and 87px tall, so the banner covered it ENTIRELY.
 * `elementFromPoint` at the sticky button's own centre returned the
 * consent banner's button.
 *
 * So the defect is not a small-viewport defect. It is a
 * fixed-element-versus-fixed-banner defect, and it is arguably WORSE at
 * desktop, where a taller banner meets a shorter bar. "Proportionally
 * small" was a plausible-sounding assumption that let a whole viewport
 * class go untested — exactly the failure mode this file exists to
 * prevent, committed inside the file itself.
 *
 * Encoded here so the next person cannot make the same trade.
 */
test.describe('Cookie banner: pointer interception at desktop', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'Desktop projection of the same P0.')
  })

  for (const [label, handle] of [
    ['POD', POD_HANDLE],
    ['apparel', APPAREL_HANDLE],
  ] as const) {
    test(`${label} PDP: every visible add-to-cart survives the banner at 1440`, async ({ page }) => {
      await page.goto(`/products/${handle}`)
      await expect(banner(page)).toBeVisible()
      await settlePage(page)

      /*
       * EACH CONTROL MUST BE HIT-TESTED AT A SCROLL POSITION WHERE IT IS
       * ACTUALLY ON SCREEN — and the two cannot share one.
       *
       * The sticky bar is gated on an IntersectionObserver watching the
       * in-flow buy row, so it exists only while that row is OFF screen.
       * Scrolling to reveal the bar therefore puts the in-flow ATC far
       * above the viewport, and vice versa. A first version of this test
       * scrolled to y=2400 once and then hit-tested both, which reported
       * `primary-add-to-cart` at y=-1421 as "not clickable". That was
       * true and completely uninteresting: I had scrolled it away myself.
       *
       * `elementFromPoint` is viewport-relative, so this is the standing
       * hazard of the technique — it will happily tell you that an
       * off-screen element is unreachable. Position each target first,
       * then ask.
       */
      const deepScroll = ['desktop-sticky-atc', 'sticky-add-to-cart']
      const hooks = ['desktop-sticky-atc', 'sticky-add-to-cart', 'primary-add-to-cart']

      let checked = 0
      for (const hook of hooks) {
        if (deepScroll.includes(hook)) {
          // Push the in-flow row out of view so the observer mounts the bar.
          await page.evaluate(() => window.scrollTo(0, 2400))
        } else {
          await page.evaluate(() => window.scrollTo(0, 0))
        }
        await page.waitForTimeout(600)

        const loc = page.locator(`[data-test="${hook}"]`).first()
        if ((await loc.count()) === 0) continue
        if (!(await loc.isVisible())) continue
        /*
         * Centre it, do not merely bring it "into view".
         *
         * `scrollIntoViewIfNeeded()` does the MINIMUM scroll, which parks
         * the element hard against a viewport edge — and both edges are
         * occupied here: the fixed header owns the top band and the
         * consent banner owns the bottom ~104px. A swept measurement
         * across 21 scroll offsets found the in-flow ATC clickable at 17
         * of them and blocked at 4, all of which are edge positions. So a
         * minimal scroll lands on a blocked offset and reports a defect
         * that a real user would never hit, because a real user is not
         * obliged to stop scrolling at the exact pixel that tucks the
         * button under the banner.
         *
         * Centring asks the question that actually matters: with the
         * banner up, is this control reachable AT ALL? That is the P0.
         * "Is it reachable at every conceivable scroll offset?" is not a
         * defensible bar for any page with a fixed header or footer.
         */
        await loc.evaluate((el) => el.scrollIntoView({ block: 'center' }))
        await page.waitForTimeout(300)
        if (!(await loc.isVisible())) continue

        checked++
        const result = await hitTest(loc)
        expect(
          result.intercepted,
          `[${label} @1440] "${hook}" is NOT clickable at ${JSON.stringify(result.point)} — ` +
            `the pointer lands on: ${result.interceptor}`,
        ).toBe(false)
      }
      expect(checked, 'no add-to-cart control was visible to hit-test at 1440').toBeGreaterThan(0)
    })
  }

  test('the banner reserves space at desktop too', async ({ page }) => {
    await page.goto('/')
    await expect(banner(page)).toBeVisible()
    const { consentH, bodyPad } = await page.evaluate(() => ({
      consentH: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--consent-height')) || 0,
      bodyPad: parseFloat(getComputedStyle(document.body).paddingBottom) || 0,
    }))
    expect(consentH, '--consent-height must be published at desktop as well').toBeGreaterThan(0)
    expect(bodyPad).toBeGreaterThanOrEqual(consentH - 1)
  })
})

/**
 * Consent-choice parity.
 *
 * WHY THIS IS SEPARATE FROM THE CONTRAST SUITE
 * `contrast.spec.ts` measures TEXT against its ground (SC 1.4.3). What
 * failed here was not text: the "Reject non-essential" label was perfectly
 * legible at 14.4:1. What was invisible was the button's BOUNDARY — a
 * `border-ink-200` hairline measuring 1.14:1 against the banner's
 * cream-warm ground, on a control whose fill is white on cream. A text
 * probe cannot see that, and neither can a screenshot pass, because every
 * pixel is painted exactly as specified.
 *
 * WHY IT IS AN ASSERTION AND NOT A NOTE
 * Reject sat beside a solid ink "Accept all" slab. So the two consent
 * choices were not merely unequal, they were unequal in the direction that
 * benefits the site: the louder control was the one that grants consent.
 * That is the shape of a steered choice regardless of intent, and it is
 * the kind of styling that gets "tidied" back toward a quieter secondary
 * button by anyone who does not know why it is loud.
 *
 * So this asserts the property, not the implementation: reject must have a
 * perceivable boundary (3:1, SC 1.4.11) and must not be physically smaller
 * than accept. It says nothing about which variant delivers that.
 */
test.describe('Cookie banner: consent choice parity', () => {
  test('reject is as perceivable and as large as accept', async ({ page }) => {
    await page.goto('/')
    await expect(banner(page)).toBeVisible()

    const measured = await page.evaluate(() => {
      const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
      const parse = (s: string) => {
        const m = s.match(/rgba?\(([^)]+)\)/)
        if (!m) return null
        const q = m[1].split(/[,\s/]+/).filter(Boolean).map(Number)
        return { r: q[0], g: q[1], b: q[2], a: q.length > 3 ? q[3] : 1 }
      }
      type RGBA = { r: number; g: number; b: number; a: number }
      const L = ({ r, g, b }: RGBA) => {
        const [R, G, B] = [r, g, b].map(v => lin(v / 255))
        return 0.2126 * R + 0.7152 * G + 0.0722 * B
      }
      const ratio = (x: RGBA, y: RGBA) => {
        const l1 = L(x)
        const l2 = L(y)
        const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1]
        return (hi + 0.05) / (lo + 0.05)
      }
      const bgOf = (el: Element | null): RGBA => {
        let n = el
        while (n && n !== document.documentElement) {
          const c = parse(getComputedStyle(n).backgroundColor)
          if (c && c.a > 0.01) return c
          n = n.parentElement
        }
        return { r: 255, g: 255, b: 255, a: 1 }
      }

      const root = document.querySelector('.gm-consent')
      if (!root) return null
      const ground = bgOf(root)

      const find = (needle: string) =>
        [...root.querySelectorAll('button')].find(b =>
          (b.textContent || '').toLowerCase().includes(needle),
        )

      /**
       * How strongly a control separates itself from the banner: whichever
       * of its fill or its border does the most work. A filled button needs
       * no border; a ghost-filled button is carried entirely by its border.
       */
      const perceivability = (el: HTMLElement) => {
        const cs = getComputedStyle(el)
        const fill = parse(cs.backgroundColor)
        const border = parse(cs.borderTopColor)
        const hasBorder = (parseFloat(cs.borderTopWidth) || 0) > 0 && cs.borderTopStyle !== 'none'
        const fromFill = fill && fill.a > 0.01 ? ratio(fill, ground) : 1
        const fromBorder = hasBorder && border && border.a > 0.01 ? ratio(border, ground) : 1
        return Math.max(fromFill, fromBorder)
      }

      const reject = find('reject')
      const accept = find('accept')
      if (!reject || !accept) return null
      const rb = reject.getBoundingClientRect()
      const ab = accept.getBoundingClientRect()
      return {
        reject: { edge: +perceivability(reject).toFixed(2), w: rb.width, h: rb.height },
        accept: { edge: +perceivability(accept).toFixed(2), w: ab.width, h: ab.height },
      }
    })

    expect(measured, 'banner must expose a reject and an accept control').not.toBeNull()
    const { reject, accept } = measured!

    // (1) The accessibility floor. SC 1.4.11 asks 3:1 of a control boundary.
    expect(
      reject.edge,
      `The reject control has no perceivable boundary: it measures ${reject.edge}:1 ` +
        `against the banner ground, under SC 1.4.11's 3:1. Both its fill and its ` +
        `border are too close to the banner, so the control has no visible extent.`,
    ).toBeGreaterThanOrEqual(3)

    // (2) Parity, which is a stricter and separate bar. Clearing 3:1 makes
    // reject VISIBLE; it does not make it EQUAL. A grey outline at 4.55:1
    // beside a solid ink slab at 13.08:1 is legal and still visibly the
    // quieter of the two choices, which is the whole failure mode here.
    // Half of accept's edge contrast is the line: it admits a genuine
    // outline-vs-fill pair of the same ink, and rejects the "tidy it into a
    // soft secondary button" change that started this.
    expect(
      reject.edge,
      `Reject (${reject.edge}:1) is visibly weaker than accept (${accept.edge}:1). ` +
        `Clearing 3:1 makes a control visible, not equal — and a consent choice ` +
        `that is quieter than its opposite is a steered one. Give reject an edge ` +
        `of the same ink as the accept slab (variant="outlineStrong"), not a ` +
        `softer grey outline.`,
    ).toBeGreaterThanOrEqual(accept.edge * 0.5)

    expect(
      reject.h,
      `Reject (${reject.h}px tall) must not be smaller than accept (${accept.h}px): ` +
        `a consent choice that is harder to see or hit than its opposite is a steered one.`,
    ).toBeGreaterThanOrEqual(accept.h)

    // Not an equality assertion on width — the labels differ in length, so
    // the boxes legitimately differ. Prominence is carried by height, edge
    // contrast and adjacency, all of which are asserted above.
  })
})
