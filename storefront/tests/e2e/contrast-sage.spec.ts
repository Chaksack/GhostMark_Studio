/**
 * Text-contrast regression suite for the `merchery-sage` ground.
 *
 * WHY THIS EXISTS
 * `merchery-sage` (#C8D2B8) is the darkest of the decorative slabs, and it
 * is the one nobody measured. The `ink-500` eyebrow tint — correct on every
 * cream ground in the system — renders at 3.76:1 on it, under the 4.5:1
 * floor for body-sized text. Nine live call sites shipped that way across
 * six marketing pages before anyone checked.
 *
 * It cannot be fixed in the palette. For `ink-500` to clear 4.5:1 the ground
 * needs relative luminance >= 0.751; sage sits at 0.618. Lifting it that far
 * puts sage at or above `cream-warm` (0.759), at which point the darker
 * alternating band stops reading as a different band at all. So the fix is
 * per-call-site (`ink-600`, 5.01:1) — and a per-call-site fix is exactly the
 * kind that gets quietly undone by the next person tidying an inconsistent
 * eyebrow colour. Hence a test rather than a comment.
 *
 * WHAT IT MEASURES
 * The real thing, in a real browser: computed `color` against the nearest
 * ancestor with a non-transparent `background-color`, alpha composited, at
 * the WCAG 2.1 1.4.3 thresholds (4.5:1, or 3:1 for text >=24px, or >=18.66px
 * at weight 700+). It only inspects elements whose OWN text nodes are
 * non-empty, so a coloured wrapper is not blamed for its children.
 *
 * SCOPE, STATED PLAINLY
 * This asserts on sage grounds ONLY. A site-wide run of the same probe on
 * 2026-08-31 found 73 further failures on other grounds — mostly `ink-400`
 * "Image: ..." placeholder captions, the `ink-700/70` logo bar at 4.31:1,
 * and one real one at 2.37:1 (`/about`, `text-ink-600` on an `ink-950`
 * slab). Those are NOT fixed and NOT asserted here; widening this file
 * before fixing them would just produce a red suite people learn to ignore.
 * Widen it as they get fixed.
 *
 * Desktop only: this measures colour, not layout, and colour does not
 * change with viewport. Running it in both projects would double the cost
 * for identical results.
 */
import { test, expect } from '@playwright/test'

/** Every route that renders a `bg-merchery-sage` block. */
const SAGE_ROUTES = [
  '/returns',
  '/shipping',
  '/platform',
  '/customer-stories',
  '/sustainability',
  '/help',
  '/club',
  '/swatches',
  '/press',
  '/about/environmental-footprint',
  '/about/people-and-culture',
  '/categories',
]

interface Failure {
  text: string
  tag: string
  cls: string
  color: string
  px: number
  weight: number
  ratio: number
  floor: number
}

/**
 * Runs in the page. Self-contained on purpose — Playwright serialises the
 * function source, so it cannot close over anything in this module.
 */
const probeSageContrast = (): Failure[] => {
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))

  const parse = (s: string) => {
    const m = s.match(/rgba?\(([^)]+)\)/)
    if (!m) return null
    const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number)
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }
  }

  type RGBA = { r: number; g: number; b: number; a: number }
  const L = ({ r, g, b }: RGBA) => {
    const [R, G, B] = [r, g, b].map(v => lin(v / 255))
    return 0.2126 * R + 0.7152 * G + 0.0722 * B
  }
  const ratio = (f: RGBA, b: RGBA) => {
    const l1 = L(f)
    const l2 = L(b)
    const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1]
    return (hi + 0.05) / (lo + 0.05)
  }
  /** Composite a translucent foreground over its ground before measuring. */
  const over = (fg: RGBA, bg: RGBA): RGBA =>
    fg.a >= 1
      ? fg
      : {
          r: fg.r * fg.a + bg.r * (1 - fg.a),
          g: fg.g * fg.a + bg.g * (1 - fg.a),
          b: fg.b * fg.a + bg.b * (1 - fg.a),
          a: 1,
        }

  /** Nearest ancestor that actually paints a background. */
  const effectiveBg = (el: Element): RGBA => {
    let n: Element | null = el
    while (n && n !== document.documentElement) {
      const c = parse(getComputedStyle(n).backgroundColor)
      if (c && c.a > 0.01) return c
      n = n.parentElement
    }
    return { r: 255, g: 255, b: 255, a: 1 }
  }

  // merchery-sage #C8D2B8. Exact-match with a tolerance of 2/255 so a
  // rounding difference in the engine does not silently skip the ground
  // this whole suite exists to check.
  const isSage = (c: RGBA) =>
    Math.abs(c.r - 200) < 3 && Math.abs(c.g - 210) < 3 && Math.abs(c.b - 184) < 3

  const failures: Failure[] = []

  for (const el of Array.from(document.querySelectorAll('*'))) {
    const own = Array.from(el.childNodes)
      .filter(n => n.nodeType === Node.TEXT_NODE && n.textContent!.trim())
      .map(n => n.textContent!.trim())
      .join(' ')
    if (!own) continue

    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) continue

    const box = el.getBoundingClientRect()
    if (box.width < 1 || box.height < 1) continue

    const bg = effectiveBg(el)
    if (!isSage(bg)) continue

    const fgRaw = parse(cs.color)
    if (!fgRaw) continue

    const cr = ratio(over(fgRaw, bg), bg)
    const px = parseFloat(cs.fontSize)
    const weight = parseInt(cs.fontWeight, 10) || 400
    // WCAG "large scale": 24px, or 18.66px at bold.
    const isLarge = px >= 24 || (px >= 18.66 && weight >= 700)
    const floor = isLarge ? 3 : 4.5
    if (cr >= floor) continue

    failures.push({
      text: own.slice(0, 60),
      tag: el.tagName.toLowerCase(),
      cls: String((el as HTMLElement).className || '').slice(0, 140),
      color: cs.color,
      px,
      weight,
      ratio: Number(cr.toFixed(2)),
      floor,
    })
  }

  return failures
}

test.describe('Contrast on merchery-sage', () => {
  for (const route of SAGE_ROUTES) {
    test(`${route} — all text on sage meets WCAG AA`, async ({ page }, testInfo) => {
      // Skipped inside the body rather than via a describe-level
      // `test.skip(fn)`: that callback receives fixtures only, not
      // testInfo, so `testInfo.project.name` there throws on every test
      // and reads as 12 real failures.
      test.skip(
        testInfo.project.name !== 'desktop-chromium',
        'Colour does not vary by viewport; the desktop run is sufficient.',
      )

      await page.goto(route, { waitUntil: 'networkidle' })

      // Sage bands sit low on these pages and several are behind a
      // scroll-reveal, which starts at opacity 0. An unscrolled page
      // reports zero failures because it has rendered almost nothing.
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 700) {
          window.scrollTo(0, y)
          await new Promise(r => setTimeout(r, 60))
        }
        window.scrollTo(0, 0)
      })
      await page.waitForTimeout(300)

      const failures = await page.evaluate(probeSageContrast)

      expect(
        failures,
        failures.length
          ? `Text below WCAG AA on merchery-sage:\n${failures
              .map(
                f =>
                  `  ${f.ratio}:1 (needs ${f.floor}:1) ${f.color} ${f.px}px/${f.weight}` +
                  ` <${f.tag}> "${f.text}"\n    class: ${f.cls}` +
                  `\n    fix: use text-ink-600 (5.01:1) on sage, not the ink-500 eyebrow default`,
              )
              .join('\n')}`
          : undefined,
      ).toEqual([])
    })
  }
})
