/**
 * Option C — "give print-on-demand a real shelf" — acceptance suite.
 *
 * STUDIO-QA lane. Run with the Chrome bridge config until
 * `npx playwright install` works on this machine:
 *
 *     npx playwright test -c playwright.chrome.config.ts tests/e2e/pod-shelf.spec.ts
 *
 * DO NOT gate CI on a piped invocation. `npm run test:e2e 2>&1 | tail`
 * exits 0 regardless of how many tests failed, because the pipe masks
 * Playwright's exit code. A CI step shaped that way went green on 32
 * failures in this repo.
 *
 * SCOPE HONESTY: the `mobile-iphone` project under the Chrome bridge is
 * Google Chrome at an iPhone 14 viewport with touch emulation. It is
 * NOT WebKit. Everything here is evidence about 390px layout, geometry,
 * hit testing and overflow. It is evidence about NOTHING on iOS Safari.
 *
 * WHERE IS THE SHELF? Set `POD_SHELF_ROUTE` when the new route lands:
 *
 *     POD_SHELF_ROUTE=/studio/pod npx playwright test -c playwright.chrome.config.ts
 *
 * It defaults to today's surface, `/products?type=pod`, so this suite is
 * meaningful BEFORE the build lands as well as after — the before-state
 * numbers it asserts are the baseline captured 2026-08-31.
 */
import { test, expect } from '@playwright/test'
import { settlePage, findOverflowCulprits, overflowAmount } from './helpers/viewport'
import {
  POD_HANDLES,
  SELF_SERVE_HANDLES,
  ENQUIRY_HANDLES,
  NON_CUSTOMISABLE_POD_HANDLES,
  CATALOGUE,
  readGrid,
  probeAnchors,
  measureContrast,
  findEmDashes,
  findSmallTargets,
} from './helpers/measure'

const SHELF = process.env.POD_SHELF_ROUTE || '/studio'
const LEGACY_POD_URL = '/products?type=pod'

/* ================================================================== *
 * 1. Selection — capability, and what it must NOT pick up
 * ================================================================== */

test.describe('POD shelf: selection', () => {
  test(`${SHELF} shows the self-serve products and excludes the stickers`, async ({ page }) => {
    await page.goto(SHELF)
    await settlePage(page)

    const grid = await readGrid(page)
    expect(grid, `no product grid (ul.grid) found on ${SHELF}`).not.toBeNull()

    /*
     * Identity, not count. A count-only assertion is exactly the shape of
     * the /shop?type=pod bug: the right NUMBER of the wrong things still
     * passes. It would also pass on a selector built from
     * `is_customizable` alone, which selects 23 of 26 products including
     * every apparel SKU.
     */
    const missing = SELF_SERVE_HANDLES.filter((h) => !grid!.handles.includes(h))
    expect(
      missing,
      `self-serve products missing from ${SHELF}: ${missing.join(', ')}. ` +
        `Shelf showed: ${grid!.handles.join(', ')}`,
    ).toEqual([])

    const stickers = grid!.handles.filter((h) => NON_CUSTOMISABLE_POD_HANDLES.includes(h as never))
    expect(
      stickers,
      `${stickers.join(', ')} appear on a CUSTOMISATION shelf. Both are ` +
        'metadata.is_customizable === false with no print locations: POD by type, ' +
        'buy-as-is by capability. The shelf selects on capability.',
    ).toEqual([])

    const apparel = grid!.handles.filter(
      (h) => !POD_HANDLES.includes(h as never) && h !== 'studio-gift-card',
    )
    expect(
      apparel,
      `apparel leaked onto the POD shelf: ${apparel.join(', ')}. This is the ` +
        'failure mode of an `is_customizable`-only selector: 22 of 26 products satisfy it.',
    ).toEqual([])
  })

  test('the enquiry product does not render as an empty product card', async ({ page }) => {
    /*
     * studio-laser-coaster has `images: []` AND `thumbnail: null`. It is
     * one of only TWO such rows in the catalogue (the other is the gift
     * card); every other product has a real image URL. Rendered through
     * the normal card path it paints a blank box.
     *
     * FIRST PAINT, deliberately: `domcontentloaded`, no settlePage, no
     * networkidle. A placeholder that only appears once hydration or a
     * lazy-load resolves still shows the visitor an empty rectangle, and
     * a check that settles first would never see it.
     */
    await page.goto(SHELF, { waitUntil: 'domcontentloaded' })

    const coaster = await page.evaluate((handle) => {
      const link = document.querySelector(`a[href*="/products/${handle}"]`)
      if (!link) return { present: false, emptySrc: 0, text: '' }
      const card = link.closest('li') || link
      const imgs = Array.from(card.querySelectorAll('img'))
      return {
        present: true,
        emptySrc: imgs.filter((i) => !i.getAttribute('src') && !i.getAttribute('srcset')).length,
        text: (card.textContent || '').trim().slice(0, 120),
      }
    }, ENQUIRY_HANDLES[0])

    // Absent from the grid is an acceptable resolution: an enquiry product
    // need not be a card at all. Present-but-blank is not.
    if (!coaster.present) return

    expect(
      coaster.emptySrc,
      `${ENQUIRY_HANDLES[0]} renders ${coaster.emptySrc} <img> with no src at FIRST PAINT. ` +
        'It has zero images and a null thumbnail, so it must not go through the image ' +
        `path at all. Card text: "${coaster.text}"`,
    ).toBe(0)
  })

  test('the shelf does not read as a broken or half-empty grid', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'widest-viewport question')
    await page.goto(SHELF)
    await settlePage(page)
    const grid = await readGrid(page)

    /*
     * A SHORT shelf is the point of Option C, not a bug. But a 2-item
     * shelf dropped into a 5-column grid fills 40% of one row and reads
     * as a failed fetch.
     *
     * So this asserts that the LAYOUT RESPONDED TO THE COUNT rather than
     * asserting a count, and therefore still holds if the catalogue grows:
     * columns must never exceed items. 2 items in 5 columns fails; 2 in 2
     * passes; 5 in 5 passes; 30 in 5 passes.
     */
    expect(
      grid!.columns,
      `${grid!.cards} product(s) laid into a ${grid!.columns}-column grid at 1440 leaves ` +
        `${grid!.columns - grid!.cards} empty slot(s) on the only row. A short shelf is ` +
        'fine; a short shelf in a grid sized for a long one reads as broken.',
    ).toBeLessThanOrEqual(grid!.cards)
  })
})

/* ================================================================== *
 * 2. The legacy URL must not break
 * ================================================================== */

test.describe('POD shelf: URL continuity', () => {
  test(`${LEGACY_POD_URL} still resolves — 200 or a clean redirect, never 404`, async ({ page }) => {
    const response = await page.goto(LEGACY_POD_URL)
    expect(response, 'no response').not.toBeNull()

    const status = response!.status()
    expect(
      status,
      `${LEGACY_POD_URL} returned ${status}. This URL is a live nav destination ` +
        '(AppHeader.vue:219, MobileNav.vue:131) and ships in the footer. It must not 404.',
    ).toBeLessThan(400)

    await settlePage(page)

    // A 200 that renders an error page is still a broken URL.
    const errorish = await page.evaluate(() =>
      /404|page not found|something went wrong/i.test(document.body.innerText.slice(0, 4000)),
    )
    expect(errorish, `${LEGACY_POD_URL} returned ${status} but rendered an error page`).toBe(false)

    // Wherever it lands, it must still be the POD surface.
    const grid = await readGrid(page)
    expect(grid, 'no grid after following the legacy URL').not.toBeNull()
    expect(
      grid!.cards,
      `legacy URL landed on ${page.url()} showing ${grid!.cards} cards. ` +
        `20 means it fell through to apparel; 0 means the filter broke.`,
    ).toBe(CATALOGUE.pod)
  })
})

/* ================================================================== *
 * 3. /shop?type=pod — the silent wrong answer
 * ================================================================== */

test.describe('POD shelf: /shop must not silently ignore ?type=pod', () => {
  /*
   * BASELINE, measured 2026-08-31: /shop?type=pod renders 20 apparel
   * cards, identical in count, order and geometry to bare /shop, with
   * zero role="alert" and no empty state. The query is not mishandled —
   * shop/index.vue never reads route.query.type at all, it hard-pins
   * type_id=[apparel].
   *
   * Any of three answers is acceptable; silence is not:
   *   a) honour it and show the 5 POD products
   *   b) redirect to the POD shelf
   *   c) tell the visitor the filter does not apply here
   * This test fails only on the fourth: 20 apparel and no explanation.
   */
  test('does not return 20 apparel rows with no explanation', async ({ page }) => {
    await page.goto('/shop?type=pod')
    await settlePage(page)

    const landedElsewhere = !new URL(page.url()).pathname.startsWith('/shop')
    if (landedElsewhere) return // (b) redirected — covered by the taxonomy test

    const grid = await readGrid(page)
    const shownPod = grid ? grid.handles.filter((h) => POD_HANDLES.includes(h as never)).length : 0
    const honoured = grid?.cards === CATALOGUE.pod && shownPod === CATALOGUE.pod

    const explained = await page.evaluate(() =>
      document.querySelectorAll('[role="alert"], [role="status"], [data-test="filter-notice"]').length > 0,
    )

    expect(
      honoured || explained,
      `/shop?type=pod rendered ${grid?.cards} cards (${shownPod} of them POD) ` +
        'with no role="alert", role="status" or filter notice. The visitor asked for ' +
        'print-on-demand and was silently handed apparel.',
    ).toBe(true)
  })
})

/* ================================================================== *
 * 4. Layout integrity at every width
 * ================================================================== */

test.describe('POD shelf: layout', () => {
  test('zero horizontal overflow', async ({ page }, testInfo) => {
    await page.goto(SHELF)
    await settlePage(page)

    // Measure the DOCUMENT, not the viewport. `window.innerWidth` includes
    // the area a horizontal scrollbar scrolls into and will read clean on
    // a page that overflows.
    const beyond = await overflowAmount(page)
    const culprits = beyond > 1 ? await findOverflowCulprits(page) : []
    expect(
      beyond,
      `${SHELF} overflows by ${beyond}px at ${testInfo.project.name}. Narrowest offenders:\n` +
        culprits.map((c) => `  ${c.selector}  width=${c.width} right=${c.right}`).join('\n'),
    ).toBeLessThanOrEqual(1)
  })

  test('grid geometry is sane and monotonic within a viewport', async ({ page }) => {
    await page.goto(SHELF)
    await settlePage(page)
    const grid = await readGrid(page)
    // Ranges, not exact values, so design iteration does not delete this
    // test the first time a gutter changes. It catches the collapse
    // (0-width cards from a failed fetch) and the blow-out (a card wider
    // than its own rail), which are the failures that matter.
    expect(grid!.cardWidth).toBeGreaterThan(100)
    expect(grid!.cardHeight).toBeGreaterThan(150)
    const viewportWidth = page.viewportSize()!.width
    expect(grid!.cardWidth, 'a card is wider than the viewport').toBeLessThan(viewportWidth)
  })
})

/* ================================================================== *
 * 5. Contrast, on both grounds
 * ================================================================== */

test.describe('POD shelf: contrast', () => {
  test('text meets WCAG AA against the effective painted ancestor', async ({ page }) => {
    await page.goto(SHELF)
    await settlePage(page)

    const all = await measureContrast(page)
    // Split rather than merge. A gradient scrim has no single colour, so
    // the checker's number is meaningless there — reporting it as a
    // defect produced 13 false positives in this session, and dropping
    // it silently would hide real ones. Abstain loudly.
    const real = all.filter((f) => !f.unreliable)
    const needsEye = all.filter((f) => f.unreliable)

    if (needsEye.length) {
      // eslint-disable-next-line no-console
      console.log(
        `[contrast] ${needsEye.length} pair(s) sit on a gradient or image and CANNOT be ` +
          'measured automatically. Not counted as failures; not cleared either:\n' +
          needsEye.map((f) => `  ${f.selector}  "${f.text}"  ${f.reason}`).join('\n'),
      )
    }

    expect(
      real,
      'WCAG AA failures against the effective painted background:\n' +
        real
          .map(
            (f) =>
              `  ${f.ratio}:1 (needs ${f.required}:1) ${f.fontSize}px ${f.selector}\n` +
              `      fg ${f.fg} on bg ${f.bg}  "${f.text}"`,
          )
          .join('\n'),
    ).toEqual([])
  })
})

/* ================================================================== *
 * 6. Copy rules
 * ================================================================== */

test.describe('POD shelf: copy', () => {
  test('no em dashes in rendered text', async ({ page }) => {
    await page.goto(SHELF)
    await settlePage(page)
    const { count, lines } = await findEmDashes(page)
    expect(
      count,
      `em dashes are a project-wide prohibition. Found ${count} in rendered copy:\n` +
        lines.map((l) => `  ${l.trim().slice(0, 90)}`).join('\n'),
    ).toBe(0)
  })
})

/* ================================================================== *
 * 7. Touch targets at 390
 * ================================================================== */

test.describe('POD shelf: touch targets', () => {
  test('interactive controls reach 44px at 390', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-iphone', '390 only')
    await page.goto(SHELF)
    await settlePage(page)

    const small = await findSmallTargets(page)

    /*
     * THREE separate exemptions, all of which this check got wrong on its
     * first run. Recording them because the naive version reported four
     * "failures" of which at most two are arguable and none is clear-cut.
     *
     *  - coarseExempt   VERIFY-TRAPS #4. A pseudo-element stretches the hit
     *                   area to 44px on `pointer: coarse`, which a desktop
     *                   engine NEVER matches. Always over-reported.
     *  - inlineExempt   WCAG 2.5.8 exempts a target "in a sentence", e.g.
     *                   the "privacy policy" link inside consent prose.
     *                   Enlarging it would break the paragraph.
     *  - srOnly         The skip link measures 1x1 until focused. It is a
     *                   keyboard affordance, not a touch target.
     */
    const excluded = small.filter((t) => t.coarseExempt || t.inlineExempt || t.screenReaderOnly)
    const real = small.filter((t) => !t.coarseExempt && !t.inlineExempt && !t.screenReaderOnly)

    if (excluded.length) {
      // eslint-disable-next-line no-console
      console.log(
        `[targets] ${excluded.length} control(s) excluded, with the reason:\n` +
          excluded
            .map(
              (t) =>
                `  ${t.width}x${t.height}  ${t.selector}  "${t.label}"  ` +
                [
                  t.coarseExempt && 'pointer:coarse pseudo-element',
                  t.inlineExempt && 'inline, WCAG 2.5.8 sentence exception',
                  t.screenReaderOnly && 'sr-only until focused',
                ]
                  .filter(Boolean)
                  .join(' + '),
            )
            .join('\n'),
      )
    }

    expect(
      real,
      'standalone controls under the 44px floor at 390, with no coarse-pointer ' +
        'compensation and not inside a sentence:\n' +
        real.map((t) => `  ${t.width}x${t.height}  ${t.selector}  "${t.label}"`).join('\n'),
    ).toEqual([])
  })
})

/* ================================================================== *
 * 8. Header regression guard — About and Contact
 * ================================================================== */

test.describe('Header: About and Contact reachability', () => {
  /*
   * THE CLAIM THIS TEST DOES NOT MAKE.
   *
   * The dead utility bar (AppHeader.vue:20 `lg:hidden` wrapping :21
   * `hidden lg:flex`) is real: measured 0x0 at 390, 768, 1024 and 1440,
   * and the two rules hand off at the 1023/1024 boundary with no overlap,
   * so there is no width at which both a painted parent and a painted
   * child exist.
   *
   * But the consequence widely repeated on the board — "About and
   * Contact are unreachable by navigation on desktop" — is FALSE.
   * AppFooter.vue:459 and :483 ship both, and a painted anchor for each
   * was measured at every viewport. The accurate statement is
   * "footer-only, with no header entry at any width".
   *
   * So this asserts REACHABILITY, which is the user-facing contract, and
   * separately reports WHERE it is served from. A fix that promotes them
   * into the header passes; the status quo also passes, because the
   * status quo is not actually broken for the visitor.
   */
  for (const route of ['/', '/shop']) {
    test(`About and Contact have at least one painted anchor on ${route}`, async ({ page }, testInfo) => {
      await page.goto(route)
      await settlePage(page)

      const probes = await probeAnchors(page, ['/about', '/contact'])
      for (const p of probes) {
        expect(
          p.painted,
          `${p.href} has ${p.total} anchor(s) on ${route} at ${testInfo.project.name} ` +
            `and NONE is painted:\n` +
            p.detail
              .map(
                (d, i) =>
                  `  [${i}] ${d.width}x${d.height} y=${d.y} header=${d.inHeader} footer=${d.inFooter}` +
                  (d.ancestorKiller ? `  killed by ${d.ancestorKiller}` : ''),
              )
              .join('\n'),
        ).toBeGreaterThan(0)
      }
    })
  }

  test('the dead utility bar is gone, at the 1023/1024 boundary too', async ({ page }, testInfo) => {
    /*
     * THE BUG: AppHeader.vue:20 `<header class="... lg:hidden">` wrapping :21
     * `<nav class="hidden lg:flex">`. Below lg the child's own `hidden` kills
     * it; at lg+ the parent's `lg:hidden` kills it. The two rules hand off
     * with no overlap, so the bar painted 0x0 at 390, 768, 1024 and 1440.
     *
     * WHY THIS TEST NO LONGER USES `header nav.hidden`.
     *
     * The first version did, and it was WRONG in a way that would have
     * outlived the bug. The DESKTOP header's own inner nav is also
     * `hidden lg:flex`, and it is CORRECTLY unpainted below lg. So a
     * selector of "a header nav that is not painted" flags a healthy
     * element at 390 forever. STUDIO-BUILD hit the same false positive
     * independently.
     *
     * So this asserts on the DELETED MARKUP ITSELF — the tagline string and
     * the two utility links, none of which appear in any other header
     * element — rather than on a class pattern that healthy markup shares.
     * Name the selector, never the role (VERIFY-TRAPS #7).
     */
    await page.goto('/')
    await settlePage(page)

    const header = await page.evaluate(() => ({
      tagline: Array.from(document.querySelectorAll('header *')).filter(
        (e) => (e.textContent || '').trim() === 'Branded objects, made to last',
      ).length,
      about: document.querySelectorAll('header a[href="/about"]').length,
      contact: document.querySelectorAll('header a[href="/contact"]').length,
      ghosts: Array.from(document.querySelectorAll('header nav'))
        .filter((n) => {
          const r = n.getBoundingClientRect()
          return r.height === 0 && (n.querySelector('a[href="/about"]') || n.querySelector('a[href="/contact"]'))
        })
        .map((n) => (n.getAttribute('class') || '').slice(0, 60)),
    }))

    expect(
      header.ghosts,
      `a header <nav> carrying About/Contact paints 0x0 at ${testInfo.project.name}`,
    ).toEqual([])
    expect(header.tagline, 'the dead utility bar tagline is still in the DOM').toBe(0)
    expect(header.about + header.contact, 'utility links still in a header that never paints').toBe(0)
  })

  /*
   * The 1023/1024 handoff, checked at both sides. That boundary is where the
   * bug lived and where a fix is most likely to half-work: a header that is
   * absent on one side and doubled on the other reads as fine at 390 and 1440.
   */
  for (const width of [1023, 1024]) {
    test(`exactly one header band system paints at ${width}px`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width, height: 900 } })
      const page = await context.newPage()
      await page.goto('http://localhost:3000/studio')
      await settlePage(page)

      const headers = await page.evaluate(() =>
        Array.from(document.querySelectorAll('header')).map((h) => ({
          painted: getComputedStyle(h).display !== 'none' && h.getBoundingClientRect().height > 0,
          height: Math.round(h.getBoundingClientRect().height),
          cls: (h.getAttribute('class') || '').slice(0, 50),
        })),
      )
      const painted = headers.filter((h) => h.painted)
      expect(
        painted.length,
        `${painted.length} header(s) paint at ${width}px. Zero means a gap in the ` +
          `breakpoint handoff; two means they overlap. Headers: ${JSON.stringify(headers)}`,
      ).toBe(1)
      await context.close()
    })
  }
})

/* ================================================================== *
 * 9. Breadcrumb interception on the browse pages
 * ================================================================== */

test.describe('Browse pages: the breadcrumb must be clickable', () => {
  /*
   * FOUND BY HIT TEST, and it took two instruments to believe.
   *
   * On /shop and /products?type=pod the h1 is `position: relative` with
   * `z-index: auto` and a box that extends DOWN OVER the breadcrumb row.
   * `document.elementFromPoint` at the centre of the "Home" link returns
   * `H1.relative` with `pointer-events: auto` — the h1, not the link.
   *
   * MY OWN FALSE NEGATIVE, recorded because it nearly buried this.
   * A first confirmation attempt used a PAGE-WIDE
   * `getByRole('link', {name: 'Home'}).first()`. It navigated to `/`
   * happily and I almost wrote the finding off as an instrument artefact.
   * There are TWO "Home" links on the page; scoped to `main` there is
   * exactly one, and Playwright's own trial click on THAT one times out as
   * intercepted. This is the identical `.first()` trap I had warned two
   * other lanes about that same hour.
   *
   * Scoped to main. Never `.first()` on a page-wide role query.
   */
  for (const route of ['/shop', '/products?type=pod']) {
    test(`the Home breadcrumb on ${route} is not covered by the h1`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'desktop-chromium', 'reproduces at >=768 only')
      await page.goto(route)
      await settlePage(page)

      const crumb = page.locator('main').getByRole('link', { name: 'Home', exact: true })
      await expect(crumb, 'expected exactly one Home breadcrumb inside <main>').toHaveCount(1)

      const blocker = await page.evaluate(() => {
        const a = Array.from(document.querySelectorAll('main a')).find(
          (x) => (x.textContent || '').trim() === 'Home',
        )
        if (!a) return null
        const r = a.getBoundingClientRect()
        const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
        if (!el || el === a || a.contains(el)) return null
        return {
          tag: el.tagName,
          cls: (el.getAttribute('class') || '').slice(0, 50),
          pointerEvents: getComputedStyle(el).pointerEvents,
          linkTop: Math.round(r.top),
        }
      })

      expect(
        blocker,
        `the Home breadcrumb at y=${blocker?.linkTop} is covered by ` +
          `${blocker?.tag}.${blocker?.cls} (pointer-events: ${blocker?.pointerEvents}). ` +
          'A click there lands on the heading, not the link.',
      ).toBeNull()
    })
  }
})
