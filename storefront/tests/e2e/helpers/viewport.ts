/**
 * Shared helpers for the QA-lane regression suites.
 *
 * These exist because three of the four new suites need the same two
 * things and getting either wrong produces a test that passes for the
 * wrong reason:
 *
 *  1. `settlePage` — cards, hero art and section imagery on this
 *     storefront are `loading="lazy"`. A measurement taken on an
 *     unscrolled page reads the pre-layout state: zero cards, collapsed
 *     image boxes, and (worst) NO horizontal overflow, because the
 *     element that overflows has not been laid out yet. Every suite that
 *     measures geometry must scroll the full page first and return to the
 *     top before asserting.
 *
 *  2. `findOverflowCulprits` — `scrollWidth > clientWidth` tells you a
 *     page overflows but not what did it, which makes the failure
 *     un-actionable. This walks the tree and names the offenders so the
 *     failure message is a bug report rather than a riddle.
 */
import type { Page } from '@playwright/test'

/**
 * Scroll the whole page in viewport-sized increments to force every
 * `loading="lazy"` image and IntersectionObserver-gated section to
 * commit its layout, then return to the top.
 *
 * The `waitForTimeout` between steps is deliberate and not a smell: we
 * are waiting on the browser's own lazy-load scheduler, which exposes no
 * event we can await. `networkidle` is not a substitute — it resolves
 * before the observer has fired for content further down the page.
 */
export async function settlePage(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded')
  await page.evaluate(async () => {
    const step = window.innerHeight
    const max = document.documentElement.scrollHeight
    for (let y = 0; y < max; y += step) {
      window.scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 120))
    }
    window.scrollTo(0, 0)
    await new Promise((r) => setTimeout(r, 200))
  })
  // One more beat for any image that decoded after the final scroll.
  await page.waitForTimeout(300)
}

export interface OverflowCulprit {
  selector: string
  right: number
  width: number
}

/**
 * Returns every element whose right edge exceeds the document's client
 * width, deepest-first, capped at `limit` so a single broken wrapper does
 * not produce a thousand-line failure message.
 *
 * Tolerance is 1px: sub-pixel layout rounding routinely produces
 * scrollWidth === clientWidth + 0.5, which is not a bug and must not
 * fail the suite. Anything at or above 2px is real.
 */
export async function findOverflowCulprits(
  page: Page,
  limit = 8,
): Promise<OverflowCulprit[]> {
  return page.evaluate((max) => {
    const docWidth = document.documentElement.clientWidth
    const out: { selector: string; right: number; width: number }[] = []

    const describe = (el: Element): string => {
      const tag = el.tagName.toLowerCase()
      const id = el.id ? `#${el.id}` : ''
      const dt = el.getAttribute('data-test')
      const hook = dt ? `[data-test="${dt}"]` : ''
      const cls = (el.getAttribute('class') || '')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 4)
        .map((c) => `.${c}`)
        .join('')
      return `${tag}${id}${hook}${cls}`
    }

    for (const el of Array.from(document.querySelectorAll('*'))) {
      const style = getComputedStyle(el)
      // Elements the page has deliberately taken out of flow or hidden
      // cannot cause a horizontal scrollbar, so they are noise here.
      if (style.display === 'none' || style.visibility === 'hidden') continue
      if (style.position === 'fixed') continue
      const rect = el.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) continue
      if (rect.right > docWidth + 1) {
        out.push({
          selector: describe(el),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        })
      }
    }
    // Deepest / narrowest first: the innermost offender is the cause,
    // its ancestors are just carrying it.
    out.sort((a, b) => a.width - b.width)
    return out.slice(0, max)
  }, limit)
}

/**
 * Document-level overflow amount in px (0 when clean).
 */
export async function overflowAmount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const d = document.documentElement
    return Math.max(0, d.scrollWidth - d.clientWidth)
  })
}
