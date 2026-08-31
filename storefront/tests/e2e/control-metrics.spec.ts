/**
 * Computed-pixel contract for interactive controls, plus the a11y floors.
 *
 * WHY COMPUTED PIXELS AND NOT CLASS NAMES
 * A UNITS lane is converting ~480 arbitrary `rem` values that were
 * authored in a "1rem = 10px" idiom against a 16px root. Every one of
 * those is a silent 1.6x multiplier. That is what produced a 90px-tall,
 * 456px-wide "Add to cart" at 24px type: no rule was violated, no
 * TypeScript complained, the class names all looked plausible, and the
 * button was simply enormous.
 *
 * Nothing in a class name can catch that. `h-[4.8rem]` looks correct
 * and renders at 76.8px. Only the COMPUTED value knows. So this suite
 * reads `getBoundingClientRect()` and `getComputedStyle()` and asserts
 * on the number the user actually gets.
 *
 * The assertions are RANGES, not exact values, and that is deliberate.
 * An exact-match test on a design system under active development is a
 * test that gets deleted the first week. A range catches the 1.6x
 * regression class — which is what this is for — while leaving normal
 * design iteration alone. If a control legitimately leaves its range,
 * widen the range in the same commit as the design change, and say why.
 */
import { test, expect } from '@playwright/test'
import { settlePage } from './helpers/viewport'

const APPAREL_HANDLE = 'studio-tee-charcoal'
const POD_HANDLE = 'cable-organiser'

/** WCAG 2.2 target-size floor for pointer inputs. */
const MIN_TARGET = 24
/** The stricter AAA / mobile-ergonomics floor we hold primary CTAs to. */
const COMFORTABLE_TARGET = 44

test.describe('Control metrics: computed px', () => {
  test('primary add-to-cart is a sane height and type size, not a rem-multiplied slab', async ({ page }) => {
    await page.goto(`/products/${APPAREL_HANDLE}`)
    await settlePage(page)

    const atc = page.locator('[data-test="primary-add-to-cart"]').first()
    await expect(atc).toBeVisible()

    const m = await atc.evaluate((el) => {
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      return {
        h: r.height,
        w: r.width,
        fontSize: parseFloat(cs.fontSize),
      }
    })

    /*
     * The regression shipped at 90px tall / 456px wide / 24px type.
     * The corrected control measures 48px tall at 14px type (verified
     * 2026-08-30 at both 1440 and 390).
     *
     * Height: a button taller than 64px is not a design choice on this
     * storefront, it is a unit bug. Floor at 44 for touch ergonomics.
     */
    expect(m.h, `add-to-cart height ${m.h}px — 90px was the rem-multiplier bug`).toBeGreaterThanOrEqual(COMFORTABLE_TARGET)
    expect(m.h, `add-to-cart height ${m.h}px is slab-sized; suspect a 1rem=10px conversion`).toBeLessThanOrEqual(64)

    /*
     * Type size: 24px was the bug, 14px is correct. Anything at or above
     * 20px on a button label on this storefront means the rem value was
     * multiplied.
     */
    expect(m.fontSize, `add-to-cart font-size ${m.fontSize}px — 24px was the bug`).toBeGreaterThanOrEqual(12)
    expect(m.fontSize, `add-to-cart font-size ${m.fontSize}px is display-sized for a button label`).toBeLessThan(20)
  })

  test('add-to-cart never exceeds its container', async ({ page }) => {
    // The 456px-wide regression was only visible because it burst its
    // column. Width is layout-dependent so we assert containment rather
    // than an absolute number: 564px at 1440 is correct, 234px at 390 is
    // correct, and neither is a magic constant worth pinning.
    await page.goto(`/products/${APPAREL_HANDLE}`)
    await settlePage(page)
    const overhang = await page
      .locator('[data-test="primary-add-to-cart"]')
      .first()
      .evaluate((el) => {
        const r = el.getBoundingClientRect()
        const p = el.parentElement!.getBoundingClientRect()
        return Math.round(r.right - p.right)
      })
    expect(overhang, 'add-to-cart overflows its parent').toBeLessThanOrEqual(1)
  })

  test('PDP desktop sticky ATC stays inside the viewport', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'Desktop-only chrome.')
    // This overflowed by 24px earlier today. It is a fixed-position bar,
    // so a document-level overflow check does NOT catch it — fixed
    // elements do not extend scrollWidth. It needs its own assertion.
    //
    // The bar is now REVEALED ON SCROLL (`v-if="!desktopAtcInView"`), not
    // present from load. Without the scroll below this test would find zero
    // elements and silently skip, which is worse than not having it: the
    // 24px-overflow regression it exists to catch would sail straight
    // through a green run. Scroll far enough that the in-flow buy card has
    // cleared the fixed header band, then wait for the bar to actually
    // attach rather than assuming the observer has fired.
    await page.goto(`/products/${POD_HANDLE}`)
    await settlePage(page)
    // CONSEQUENCE, BY DESIGN: this now FAILS rather than skips if the bar is
    // absent. That is the point — but it means deleting the desktop bar and
    // deleting this test have to happen in the SAME commit, or the suite goes
    // red for a deliberate design decision.
    await page.evaluate(() => scrollTo(0, 2400))
    const bar = page.locator('[data-test="desktop-sticky-atc"]')
    await bar.waitFor({ state: 'visible', timeout: 5000 })

    const m = await bar.evaluate((el) => {
      const r = el.getBoundingClientRect()
      return {
        beyondViewport: Math.round(r.right - document.documentElement.clientWidth),
        leftOfViewport: Math.round(r.left),
        width: Math.round(r.width),
      }
    })
    expect(m.beyondViewport, `desktop-sticky-atc extends ${m.beyondViewport}px past the viewport`).toBeLessThanOrEqual(1)
    expect(m.leftOfViewport, 'desktop-sticky-atc starts left of the viewport').toBeGreaterThanOrEqual(-1)
  })

  test('quantity stepper controls meet the target-size floor', async ({ page }) => {
    await page.goto(`/products/${APPAREL_HANDLE}`)
    await settlePage(page)
    for (const hook of ['apparel-qty-increase', 'apparel-qty-decrease']) {
      const el = page.locator(`[data-test="${hook}"]`).first()
      if ((await el.count()) === 0) continue
      const box = await el.boundingBox()
      expect(box, `${hook} has no box`).not.toBeNull()
      expect(box!.height, `${hook} is ${box!.height}px tall, below the ${MIN_TARGET}px target floor`).toBeGreaterThanOrEqual(MIN_TARGET)
      expect(box!.width, `${hook} is ${box!.width}px wide, below the ${MIN_TARGET}px target floor`).toBeGreaterThanOrEqual(MIN_TARGET)
    }
  })
})

test.describe('Type scale floor', () => {
  const ROUTES = ['/', '/shop', '/products', `/products/${APPAREL_HANDLE}`, `/products/${POD_HANDLE}`, '/cart', '/checkout']

  for (const route of ROUTES) {
    test(`no visible text below 12px on ${route}`, async ({ page }) => {
      await page.goto(route)
      await settlePage(page)

      const offenders = await page.evaluate(() => {
        const bad: { size: number; sel: string; text: string }[] = []
        const seen = new Set<string>()
        for (const el of Array.from(document.querySelectorAll('*'))) {
          const cs = getComputedStyle(el)
          if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') continue
          // Only elements that render their OWN text — otherwise every
          // ancestor inherits the blame for one small <span>.
          const ownText = Array.from(el.childNodes).some(
            (n) => n.nodeType === Node.TEXT_NODE && (n.textContent || '').trim().length > 0,
          )
          if (!ownText) continue
          const r = el.getBoundingClientRect()
          if (r.width === 0 || r.height === 0) continue
          const size = parseFloat(cs.fontSize)
          if (size > 0 && size < 12) {
            const sel = `${el.tagName.toLowerCase()}.${(el.getAttribute('class') || '')
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 3)
              .join('.')}`
            const key = `${size}|${sel}`
            if (seen.has(key)) continue
            seen.add(key)
            bad.push({ size, sel, text: (el.textContent || '').trim().slice(0, 40) })
          }
        }
        return bad.slice(0, 12)
      })

      expect(
        offenders,
        `text below 12px is unreadable on mobile:\n${offenders
          .map((o) => `  ${o.size}px  ${o.sel}  "${o.text}"`)
          .join('\n')}`,
      ).toEqual([])
    })
  }
})

test.describe('Contrast: both grounds', () => {
  /*
   * Measured against the EFFECTIVE background — the nearest opaque
   * ancestor — not against an assumed page colour.
   *
   * That distinction is the whole point of this suite. A token can pass
   * on the default ground and fail on `warmGrey`, which BestSellers
   * paints: the same colour pair measured 3.24:1 on one and 2.83:1 on
   * the other. A checker that assumes a white page background reports
   * the first number and misses the failure entirely. Walking up to the
   * real painted ancestor is what makes the second number visible.
   */
  const CONTRAST_HELPERS = `
    const lum = (rgb) => {
      const s = rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) })
      return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2]
    }
    const parse = (c) => {
      const m = c.match(/rgba?\\(([^)]+)\\)/); if (!m) return null
      const p = m[1].split(',').map((x) => parseFloat(x))
      return { rgb: [p[0], p[1], p[2]], a: p.length > 3 ? p[3] : 1 }
    }
    const ratio = (fg, bg) => {
      const a = Math.max(lum(fg), lum(bg)), b = Math.min(lum(fg), lum(bg))
      return (a + 0.05) / (b + 0.05)
    }
    const effBg = (el) => {
      let cur = el
      while (cur) { const c = parse(getComputedStyle(cur).backgroundColor); if (c && c.a > 0.99) return c.rgb; cur = cur.parentElement }
      return [255, 255, 255]
    }
  `

  for (const route of ['/', '/shop', `/products/${POD_HANDLE}`, '/checkout']) {
    test(`text meets WCAG AA on ${route}`, async ({ page }) => {
      await page.goto(route)
      await settlePage(page)

      const failures = await page.evaluate(
        new Function(`
        ${CONTRAST_HELPERS}
        const out = []; const seen = new Set()
        for (const el of Array.from(document.querySelectorAll('*'))) {
          const cs = getComputedStyle(el)
          if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') continue
          // WCAG 2.2 SC 1.4.3 explicitly exempts INACTIVE user interface
          // components. A disabled control is deliberately low-contrast to
          // signal that it is unavailable, and "fixing" it would destroy the
          // affordance the greying-out exists to provide. Without this, the
          // disabled quantity stepper's minus glyph reports 2.14:1 and reads
          // as a defect. This is a correctness exclusion required by the
          // spec being tested, not a relaxation of it.
          if (el.matches(':disabled') || el.closest('[disabled],[aria-disabled="true"]')) continue
          const ownText = Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent || '').trim().length > 0)
          if (!ownText) continue
          const r = el.getBoundingClientRect(); if (r.width === 0 || r.height === 0) continue
          const fg = parse(cs.color); if (!fg || fg.a < 0.99) continue
          const bg = effBg(el)
          const fs = parseFloat(cs.fontSize); const fw = parseInt(cs.fontWeight) || 400
          const large = fs >= 24 || (fs >= 18.66 && fw >= 700)
          const need = large ? 3.0 : 4.5
          const got = Math.round(ratio(fg.rgb, bg) * 100) / 100
          if (got < need) {
            const sel = el.tagName.toLowerCase() + '.' + (el.getAttribute('class') || '').split(/\\s+/).filter(Boolean).slice(0, 3).join('.')
            const key = got + '|' + sel
            if (seen.has(key)) continue
            seen.add(key)
            out.push({ got, need, fs, sel, fg: cs.color, bg: 'rgb(' + bg.join(',') + ')', text: (el.textContent || '').trim().slice(0, 40) })
          }
        }
        return out.slice(0, 15)
      `) as () => unknown[],
      )

      expect(
        failures,
        `WCAG AA contrast failures (measured against the effective painted background):\n${(failures as any[])
          .map((f) => `  ${f.got}:1 (needs ${f.need}:1) ${f.fs}px ${f.sel}\n      fg ${f.fg} on bg ${f.bg}  "${f.text}"`)
          .join('\n')}`,
      ).toEqual([])
    })
  }
})
