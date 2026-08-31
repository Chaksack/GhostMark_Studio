/**
 * Text-contrast regression suite for the grounds that have been fixed.
 *
 * HOW TO USE THIS FILE
 * It is an ALLOWLIST, not an audit. Each entry in `GROUNDS` is a background
 * whose text has been measured and corrected; the suite then guards it. A
 * site-wide probe still finds failures on grounds NOT listed here (see
 * "SCOPE" below) — that is deliberate. Add a ground the day you fix it, not
 * before, because a suite that is red on arrival is one people learn to
 * ignore, and then it guards nothing at all.
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

/**
 * A ground under guard: how to recognise it, where it appears, and what to
 * use on it. `match` receives 0-255 channels of the resolved background.
 */
interface Ground {
  name: string
  /** Recognise the ground from its composited background colour. */
  match: (c: { r: number; g: number; b: number }) => boolean
  /** Routes that actually render it. */
  routes: string[]
  /** Told to the author in the failure message. */
  remedy: string
}

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

/**
 * Dark ink slabs. `/about`'s CTA band shipped `text-ink-600` on `bg-ink-950`
 * at 2.37:1 — dark text on a dark ground. The cause is worth naming because
 * it will recur: the ink ramp runs dark-to-light, so the "muted body" step is
 * ink-600 on a LIGHT ground and its mirror, ink-300, on a dark one. Reaching
 * for the number you know rather than the number for this ground inverts the
 * ramp, and the result looks deliberate in code review.
 */
const DARK_ROUTES = ['/about', '/pricing', '/faq']

/**
 * The cream family, on the three pages that carried the 35 failures fixed on
 * 2026-08-31: the `ink-700/70` logo walls (4.31:1, x24), the `ink-950/40`
 * club numerals (2.56:1) and the `ink-300/80` customer-stories monograms
 * (1.73:1).
 *
 * A tripwire on the surfaces that were fixed, not a site-wide cream audit.
 * Every marketing page has a cream ground somewhere; listing all of them
 * would triple the suite's runtime to re-prove pages that were never
 * implicated.
 *
 * KNOWN BLIND SPOT, so nobody reads a green run as more than it is: the
 * probe resolves a ground from `backgroundColor`, and a GRADIENT is a
 * background-image. The customer-stories tiles are gradients, so their
 * computed backgroundColor is transparent and the probe walks past them to
 * the section behind. It therefore measures those monograms against a
 * ground they never touch. The values shipped there were checked by hand
 * against every gradient stop instead (worst: cream-200, 4.64:1).
 */
const CREAM_ROUTES = ['/platform', '/club', '/customer-stories']

const GROUNDS: Ground[] = [
  {
    name: 'merchery-sage',
    // #C8D2B8, tolerance 2/255 so an engine rounding difference cannot
    // silently skip the ground this suite exists to check.
    match: c => Math.abs(c.r - 200) < 3 && Math.abs(c.g - 210) < 3 && Math.abs(c.b - 184) < 3,
    routes: SAGE_ROUTES,
    remedy: 'use text-ink-600 (5.01:1) on sage, not the ink-500 eyebrow default',
  },
  {
    name: 'cream family',
    // cream-50 FBF7F1, cream-100 F5EFE6, cream-200 EDE3D2, cream-tile
    // F4F1EB, cream-warm EDE0D1, and plain white. Matched by explicit
    // value rather than by "is it light", so a new tint has to be added
    // deliberately and cannot drift in unmeasured.
    match: c =>
      [
        [251, 247, 241],
        [245, 239, 230],
        [237, 227, 210],
        [244, 241, 235],
        [237, 224, 209],
        [255, 255, 255],
      ].some(([r, g, b]) => Math.abs(c.r - r) < 3 && Math.abs(c.g - g) < 3 && Math.abs(c.b - b) < 3),
    routes: CREAM_ROUTES,
    remedy:
      'prefer a solid ramp step over an alpha (an alpha has to be re-derived ' +
      'for every ground); ink-500 is 5.23:1 on cream-tile, ink-600 is 6.98:1',
  },
  {
    name: 'dark ink slab',
    // ink-800 #2E2A25 through ink-950 #141210 and merchery-ink #1F1C18:
    // any near-neutral dark. Matched by luminance rather than by exact
    // value so a new dark slab is covered the day it lands.
    match: c => c.r < 60 && c.g < 60 && c.b < 60,
    routes: DARK_ROUTES,
    remedy:
      'the ink ramp mirrors on dark grounds: use ink-300 (8.17:1 on ink-950) ' +
      'or lighter, not the ink-600 you would use on cream',
  },
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
 * function source, so it cannot close over anything in this module; the
 * ground test arrives as a stringified predicate and is rebuilt here.
 */
const probeContrast = (matchSrc: string): Failure[] => {
  // eslint-disable-next-line no-new-func
  const matchesGround = new Function(`return (${matchSrc})`)() as (c: {
    r: number
    g: number
    b: number
  }) => boolean
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
    if (!matchesGround(bg)) continue

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

for (const ground of GROUNDS) {
  test.describe(`Contrast on ${ground.name}`, () => {
    for (const route of ground.routes) {
      test(`${route} — all text on ${ground.name} meets WCAG AA`, async ({ page }, testInfo) => {
        // Skipped inside the body rather than via a describe-level
        // `test.skip(fn)`: that callback receives fixtures only, not
        // testInfo, so `testInfo.project.name` there throws on every test
        // and reads as a suite of real failures.
        test.skip(
          testInfo.project.name !== 'desktop-chromium',
          'Colour does not vary by viewport; the desktop run is sufficient.',
        )

        await page.goto(route, { waitUntil: 'networkidle' })

        // These bands sit low on the page and several are behind a
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

        const failures = await page.evaluate(probeContrast, ground.match.toString())

        expect(
          failures,
          failures.length
            ? `Text below WCAG AA on ${ground.name}:\n${failures
                .map(
                  f =>
                    `  ${f.ratio}:1 (needs ${f.floor}:1) ${f.color} ${f.px}px/${f.weight}` +
                    ` <${f.tag}> "${f.text}"\n    class: ${f.cls}` +
                    `\n    fix: ${ground.remedy}`,
                )
                .join('\n')}`
            : undefined,
        ).toEqual([])
      })
    }
  })
}

/**
 * Image placeholders.
 *
 * WHAT CHANGED, AND WHY THIS BLOCK STILL EXISTS
 * These were text captions reading "Image: replace with real photography" —
 * an instruction to the team, rendered to customers on live marketing pages.
 * They shipped at ink-400 (2.89:1 on cream-warm) and the first fix simply
 * raised the contrast, which made the wrong thing easier to read. They are
 * now the `image-placeholder` Icon the codebase already used for a missing
 * product thumbnail, decorative (aria-hidden), at ink-500.
 *
 * The previous version of this block asserted `span[role="img"]` and its
 * zero-nodes guard is what caught the swap — it failed with "listed as
 * carrying placeholder captions but none were found" rather than passing
 * green on an empty selector. Keeping that property here: a route listed
 * below must actually render a placeholder, or the test says so.
 *
 * FLOOR: 3:1, not 4.5:1. This is now a graphic, not text. It is also
 * aria-hidden, which would arguably exempt it entirely — held to the
 * non-text floor anyway, on the same reasoning as the club numerals: hiding
 * something from the accessibility tree does not make it invisible to a
 * sighted low-vision reader.
 *
 * These grounds cannot join the `GROUNDS` allowlist above, because that
 * probe reads TEXT and there is no longer any text here to read.
 */
const PLACEHOLDER_ROUTES = [
  '/sustainability',
  '/swatches',
  '/press',
  '/about/value-chain',
  '/about/environmental-footprint',
  '/about/people-and-culture',
]

test.describe('Image placeholders', () => {
  for (const route of PLACEHOLDER_ROUTES) {
    test(`${route} — placeholder graphics clear 3:1`, async ({ page }, testInfo) => {
      test.skip(
        testInfo.project.name !== 'desktop-chromium',
        'Colour does not vary by viewport; the desktop run is sufficient.',
      )

      await page.goto(route, { waitUntil: 'networkidle' })
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 700) {
          window.scrollTo(0, y)
          await new Promise(r => setTimeout(r, 60))
        }
        window.scrollTo(0, 0)
      })
      await page.waitForTimeout(300)

      const result = await page.evaluate(() => {
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
        const ratio = (f: RGBA, b: RGBA) => {
          const l1 = L(f)
          const l2 = L(b)
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

        // Identify the placeholder by its path data rather than by a class,
        // so a restyle cannot silently drop it out of this suite. These are
        // the three primitives Icon's `image-placeholder` registry entry
        // draws: frame, lens, horizon.
        const nodes = [...document.querySelectorAll('svg')].filter(
          sv => sv.querySelector('rect[width="18"]') && sv.querySelector('circle[r="1.5"]'),
        )

        return {
          seen: nodes.length,
          exposed: nodes.filter(n => n.getAttribute('aria-hidden') !== 'true').length,
          failures: nodes
            .map(el => ({
              ratio: Number(ratio(parse(getComputedStyle(el).color)!, bgOf(el)).toFixed(2)),
              color: getComputedStyle(el).color,
            }))
            .filter(f => f.ratio < 3),
        }
      })

      expect(
        result.seen,
        `${route} is listed as rendering image placeholders but none were found. ` +
          `Either the markup changed (update PLACEHOLDER_ROUTES) or real imagery ` +
          `landed here — in which case drop the route rather than leaving a test ` +
          `that asserts nothing.`,
      ).toBeGreaterThan(0)

      expect(
        result.exposed,
        `${result.exposed} placeholder graphic(s) on ${route} are exposed to the ` +
          `accessibility tree. A placeholder announces the ABSENCE of content, ` +
          `which is noise; pass no ariaLabel to Icon so it stays aria-hidden.`,
      ).toBe(0)

      expect(
        result.failures,
        result.failures.length
          ? `Placeholder graphics below the 3:1 non-text floor:\n${result.failures
              .map(f => `  ${f.ratio}:1 ${f.color}`)
              .join('\n')}\n  fix: ink-500 (4.55:1 on cream-warm, 5.23:1 on cream-tile, 3.76:1 on sage)`
          : undefined,
      ).toEqual([])
    })
  }
})
