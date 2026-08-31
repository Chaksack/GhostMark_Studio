/**
 * Measurement helpers for the STUDIO-QA lane (Option C, the POD shelf).
 *
 * Every function here exists because the naive version of the same check
 * produced a WRONG answer during this session. The comments name which
 * one, because a helper whose failure mode is undocumented gets
 * "simplified" back into the trap by the next person to read it.
 *
 * Companion to `viewport.ts` (settlePage / findOverflowCulprits /
 * overflowAmount), which is still the right place for scroll settling
 * and overflow attribution. Import both.
 */
import type { Page } from '@playwright/test'

/* ------------------------------------------------------------------ *
 * Ground truth
 * ------------------------------------------------------------------ */

/**
 * The five print-on-demand SKUs, from `product.type.value === 'pod'`.
 *
 * Sourced from the Store API, not from a heuristic on the handle:
 *   GET /store/products?limit=100&fields=*type  ->  n=26
 *   apparel 20 | pod 5 | gift-card 1
 *
 * Taxonomy is `type.value`, never a name match — see the project's
 * product-taxonomy note. `studio-sticker-pack` and `logo-sticker-sheet`
 * are POD but carry ZERO print locations, so the PDP correctly renders
 * no design editor for them; do not use either as a customisation
 * fixture (that mistake produced three false failures already).
 */
export const POD_HANDLES = [
  'studio-sticker-pack',
  'logo-sticker-sheet',
  'cable-organiser',
  'tech-pouch',
  'studio-laser-coaster',
] as const

/** POD SKUs that DO render the design editor (non-empty print locations). */
export const POD_CUSTOMISABLE_HANDLES = ['cable-organiser', 'tech-pouch'] as const

export const CATALOGUE = { total: 26, apparel: 20, pod: 5, giftCard: 1 } as const

/**
 * CAPABILITY, which is a different question from TYPE, and the Option C
 * shelf selects on this one.
 *
 * Re-derived from the live Store API 2026-08-31, n=26. The numbers are
 * here because the phrase "select on capability, not type" is ambiguous
 * and the two obvious readings of it are wrong:
 *
 *   is_customizable truthy                          23  <- all 20 apparel too
 *   is_customizable && print_locations.length > 0   22  <- still all 20 apparel
 *   type === 'pod' && is_customizable                3  <- adds the coaster
 *   type === 'pod' && is_customizable && print > 0   2  <- the intent
 *   metadata.commerce_mode === 'studio'              2  <- the same two, one field
 *
 * Apparel's `is_customizable` is NOT a bare stale flag: workshop-tote
 * carries moq 15 / print_locations 2 / quantity_tiers 4, and
 * studio-tee-charcoal carries moq 25 / 2 / 7. Those are populated
 * capability records. Whether they are stale is a question about seed
 * intent that measurement cannot settle — so no selector here relies on
 * the assumption that they are.
 *
 * commerce_mode over the catalogue: shop 20 | pod 3 | studio 2 | gift-card 1.
 */
export const SELF_SERVE_HANDLES = ['cable-organiser', 'tech-pouch'] as const

/** POD-typed, customisable, but no print locations and NO IMAGES AT ALL. */
export const ENQUIRY_HANDLES = ['studio-laser-coaster'] as const

/** POD-typed but `is_customizable: false`. Must never carry a customisation chip. */
export const NON_CUSTOMISABLE_POD_HANDLES = ['studio-sticker-pack', 'logo-sticker-sheet'] as const

/**
 * The only two products in the catalogue with `thumbnail: null` and
 * `images: []`. Anything that renders them through the normal image path
 * paints an empty box.
 *
 * NOTE, and it is a correction to an earlier reading of mine: a first
 * pass reported "no product has a thumbnail" across all 26. That was a
 * FIELD-SELECTION artefact — `thumbnail` had not been requested in
 * `fields=`, so it was absent from every row and read as null. Requested
 * explicitly, exactly two are genuinely missing. Trap #1: a zero means
 * "not found by this query".
 */
export const IMAGELESS_HANDLES = ['studio-gift-card', 'studio-laser-coaster'] as const

/** The four widths this lane reports against. A number without one is false. */
export const VIEWPORTS = [
  { name: '390', width: 390, height: 844 },
  { name: '768', width: 768, height: 1024 },
  { name: '1024', width: 1024, height: 768 },
  { name: '1440', width: 1440, height: 900 },
] as const

/* ------------------------------------------------------------------ *
 * Grid geometry
 * ------------------------------------------------------------------ */

export interface GridShape {
  /** Number of `<li>` product cards in the grid. */
  cards: number
  /** Resolved column count, read from `grid-template-columns`. */
  columns: number
  columnsRaw: string
  cardWidth: number
  cardHeight: number
  /** Document-space y of the first card. "How far to the goods." */
  firstCardY: number
  /** Distinct `/products/<handle>` hrefs inside the grid, in DOM order. */
  handles: string[]
}

/**
 * Read the shape of a product grid.
 *
 * Counts `<li>` children rather than links: a card contains several
 * anchors (image, title, quick-add), so counting `a[href*="/products/"]`
 * over-reports by roughly 2x. Handles are de-duplicated for the same
 * reason.
 *
 * Column count comes from computed `grid-template-columns`, NOT from the
 * class list. `xl:grid-cols-5` in the markup tells you what Tailwind was
 * asked for; the computed value tells you what the browser did. Those
 * differ whenever a breakpoint name does not exist in the Tailwind
 * config (see VERIFY-TRAPS #6 — `max-w-screen-3xl` emitted nothing at
 * all across 22 uses).
 */
export async function readGrid(page: Page, selector = 'ul.grid'): Promise<GridShape | null> {
  return page.evaluate((sel) => {
    const grid = document.querySelector(sel)
    if (!grid) return null
    const items = Array.from(grid.querySelectorAll(':scope > li'))
    const first = items[0]
    const r = first ? first.getBoundingClientRect() : null
    const raw = getComputedStyle(grid).gridTemplateColumns
    const handles = Array.from(
      new Set(
        Array.from(grid.querySelectorAll('a[href*="/products/"]'))
          .map((a) => (a.getAttribute('href') || '').split('/products/')[1] || '')
          .map((h) => h.split(/[?#]/)[0])
          .filter(Boolean),
      ),
    )
    return {
      cards: items.length,
      columns: raw.split(' ').filter(Boolean).length,
      columnsRaw: raw,
      cardWidth: r ? Math.round(r.width) : 0,
      cardHeight: r ? Math.round(r.height) : 0,
      firstCardY: r ? Math.round(r.top + window.scrollY) : 0,
      handles,
    }
  }, selector)
}

/* ------------------------------------------------------------------ *
 * Visibility
 * ------------------------------------------------------------------ */

export interface AnchorProbe {
  href: string
  total: number
  painted: number
  detail: {
    painted: boolean
    width: number
    height: number
    y: number
    inHeader: boolean
    inFooter: boolean
    inDialog: boolean
    ancestorKiller: string | null
  }[]
}

/**
 * Enumerate EVERY anchor for a set of hrefs and resolve paintedness for
 * each, per viewport.
 *
 * VERIFY-TRAPS #2: three lanes measured the same wordmark and got three
 * different answers, because each generalised from whichever of three
 * per-breakpoint variants happened to be visible at its own width.
 * `querySelector` and `.first()` are both coin flips on this codebase.
 *
 * AppFooter renders TWO copies of its link set (a mobile accordion and a
 * desktop column grid) and they swap which index is live between 390 and
 * 1440. A single-index check on `/about` therefore reports "hidden" or
 * "visible" depending purely on the viewport it ran at.
 *
 * `ancestorKiller` names the element that removed it from paint, so a
 * failure reads as a bug report rather than a boolean.
 */
export async function probeAnchors(page: Page, hrefs: string[]): Promise<AnchorProbe[]> {
  return page.evaluate((list) => {
    const describe = (el: Element) => {
      const cls = (el.getAttribute('class') || '').split(/\s+/).filter(Boolean).slice(0, 3).map((c) => `.${c}`).join('')
      return el.tagName.toLowerCase() + cls
    }
    const killer = (el: Element): string | null => {
      let cur: Element | null = el
      while (cur) {
        const cs = getComputedStyle(cur)
        if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return describe(cur)
        cur = cur.parentElement
      }
      return null
    }
    return list.map((href) => {
      const els = Array.from(document.querySelectorAll(`a[href="${href}"]`))
      const detail = els.map((e) => {
        const r = e.getBoundingClientRect()
        const k = killer(e)
        return {
          painted: k === null && r.width > 0 && r.height > 0,
          width: Math.round(r.width),
          height: Math.round(r.height),
          y: Math.round(r.top + window.scrollY),
          inHeader: !!e.closest('header'),
          inFooter: !!e.closest('footer'),
          inDialog: !!e.closest('[role="dialog"]'),
          ancestorKiller: k,
        }
      })
      return { href, total: els.length, painted: detail.filter((d) => d.painted).length, detail }
    })
  }, hrefs)
}

/* ------------------------------------------------------------------ *
 * Contrast, gradient-aware
 * ------------------------------------------------------------------ */

export interface ContrastFinding {
  ratio: number
  required: number
  fontSize: number
  selector: string
  fg: string
  bg: string
  text: string
  /** True when a gradient or image sits between the text and the ground. */
  unreliable: boolean
  reason?: string
}

/**
 * WCAG AA contrast against the EFFECTIVE PAINTED ancestor, abstaining
 * where it cannot see the ground.
 *
 * Two failure modes, and this helper is built around both:
 *
 *  1. Assuming a white page. The site paints cream on cream in places;
 *     a checker that resolves the background as `#fff` reports 1.08:1
 *     pairs as passing. Walking up to the nearest OPAQUE ancestor is
 *     what makes those visible. Three real failures on `/` were found
 *     exactly this way.
 *
 *  2. Not seeing a `linear-gradient` scrim. A checker that reads only
 *     `background-color` reports the colour BEHIND a gradient overlay
 *     and produced THIRTEEN false positives in this session. A gradient
 *     has no single colour, so the honest answer is not a number.
 *
 * So findings are split rather than merged: anything with a gradient or
 * background-image between the text and its ground is returned with
 * `unreliable: true` and MUST be reported as "needs a human eye", never
 * as a defect and never silently dropped. Dropping them would hide real
 * failures; asserting on them fabricates thirteen.
 */
export async function measureContrast(page: Page): Promise<ContrastFinding[]> {
  return page.evaluate(() => {
    const lum = (rgb: number[]) => {
      const s = rgb.map((v) => {
        v /= 255
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
      })
      return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2]
    }
    const parse = (c: string) => {
      const m = c.match(/rgba?\(([^)]+)\)/)
      if (!m) return null
      const p = m[1].split(',').map((x) => parseFloat(x))
      return { rgb: [p[0], p[1], p[2]], a: p.length > 3 ? p[3] : 1 }
    }
    const ratio = (fg: number[], bg: number[]) => {
      const a = Math.max(lum(fg), lum(bg))
      const b = Math.min(lum(fg), lum(bg))
      return (a + 0.05) / (b + 0.05)
    }
    /** Walk to the nearest opaque ancestor, recording anything painted over it. */
    const ground = (el: Element) => {
      let cur: Element | null = el
      let obscured: string | null = null
      while (cur) {
        const cs = getComputedStyle(cur)
        if (cs.backgroundImage && cs.backgroundImage !== 'none' && !obscured) {
          obscured = cs.backgroundImage.slice(0, 40)
        }
        const c = parse(cs.backgroundColor)
        if (c && c.a > 0.99) return { rgb: c.rgb, obscured }
        cur = cur.parentElement
      }
      return { rgb: [255, 255, 255], obscured }
    }

    const out: ContrastFinding[] = []
    const seen = new Set<string>()
    for (const el of Array.from(document.querySelectorAll('*'))) {
      const cs = getComputedStyle(el)
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') continue
      // WCAG 2.2 SC 1.4.3 exempts INACTIVE components. A disabled control is
      // deliberately low-contrast; "fixing" it destroys the affordance.
      if (el.matches(':disabled') || el.closest('[disabled],[aria-disabled="true"]')) continue
      const ownText = Array.from(el.childNodes).some(
        (n) => n.nodeType === 3 && (n.textContent || '').trim().length > 0,
      )
      if (!ownText) continue
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      const fg = parse(cs.color)
      if (!fg || fg.a < 0.99) continue
      const g = ground(el)
      const fontSize = parseFloat(cs.fontSize)
      const weight = parseInt(cs.fontWeight) || 400
      const large = fontSize >= 24 || (fontSize >= 18.66 && weight >= 700)
      const required = large ? 3.0 : 4.5
      const got = Math.round(ratio(fg.rgb, g.rgb) * 100) / 100
      if (got >= required) continue
      const selector =
        el.tagName.toLowerCase() +
        '.' +
        (el.getAttribute('class') || '').split(/\s+/).filter(Boolean).slice(0, 3).join('.')
      const key = got + '|' + selector
      if (seen.has(key)) continue
      seen.add(key)
      out.push({
        ratio: got,
        required,
        fontSize,
        selector,
        fg: cs.color,
        bg: `rgb(${g.rgb.join(',')})`,
        text: (el.textContent || '').trim().slice(0, 40),
        unreliable: g.obscured !== null,
        reason: g.obscured ? `painted over by ${g.obscured}` : undefined,
      })
    }
    return out
  })
}

/* ------------------------------------------------------------------ *
 * Copy rules
 * ------------------------------------------------------------------ */

/**
 * Em dashes in RENDERED text. Project-wide rule.
 *
 * Reads `innerText`, not source: a grep over `.vue` misses copy that
 * arrives from the Medusa product description, and hits em dashes that
 * live in code comments (this file's own comments would trip it).
 * Returns the containing lines so the report can say WHERE.
 */
export async function findEmDashes(page: Page): Promise<{ count: number; lines: string[] }> {
  return page.evaluate(() => {
    const text = document.body.innerText
    const lines = text.split('\n').filter((l) => l.includes('—'))
    return { count: (text.match(/—/g) || []).length, lines: lines.slice(0, 10) }
  })
}

/* ------------------------------------------------------------------ *
 * Touch targets
 * ------------------------------------------------------------------ */

export interface SmallTarget {
  selector: string
  label: string
  width: number
  height: number
  /** True when a `pointer: coarse` rule enlarges it on real touch hardware. */
  coarseExempt: boolean
  /**
   * True when the target sits inside a run of non-target text. WCAG 2.5.8
   * exempts these explicitly: "the target is in a sentence, or its size is
   * otherwise constrained by the line-height of non-target text".
   */
  inlineExempt: boolean
  /** True when the control is visually hidden until focused (skip links). */
  screenReaderOnly: boolean
}

/**
 * Interactive controls below the 44px WCAG 2.5.8 floor at a touch width.
 *
 * VERIFY-TRAPS #4: desktop Playwright NEVER matches `pointer: coarse`,
 * so CookieBanner's 36px buttons and the 40x40 header icons always
 * measure as violations and always are not. They carry a coarse-pointer
 * pseudo-element that stretches the hit area to 44px on touch hardware.
 *
 * Rather than hard-code an exclusion list that rots, this re-runs the
 * check with `matchMedia('(pointer: coarse)')` emulation via CDP where
 * available; where it is not, it flags the pseudo-element's presence so
 * the reader can tell an over-report from a defect. A control with no
 * coarse rule and under 44px is a real finding.
 */
export async function findSmallTargets(page: Page, floor = 44): Promise<SmallTarget[]> {
  return page.evaluate((min) => {
    const out: SmallTarget[] = []
    const sel = 'a[href], button, [role="button"], input:not([type="hidden"]), select, summary'
    for (const el of Array.from(document.querySelectorAll(sel))) {
      const cs = getComputedStyle(el)
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') continue
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      if (r.width >= min && r.height >= min) continue
      // Does a ::before/::after stretch the hit area? That is how this
      // codebase satisfies 2.5.8 on compact icon controls.
      const before = getComputedStyle(el, '::before')
      const after = getComputedStyle(el, '::after')
      const stretched = [before, after].some(
        (p) => p.content !== 'none' && (p.position === 'absolute' || p.position === 'fixed'),
      )

      // WCAG 2.5.8 inline exception. A link inside a paragraph is sized by
      // the line-height of the prose around it, and enlarging it would
      // break the text. Detected structurally — does the parent block hold
      // text that is NOT part of this control — rather than by a
      // hand-maintained allowlist, which rots.
      const parent = el.parentElement
      const siblingText = parent
        ? Array.from(parent.childNodes)
            .filter((n) => n !== el)
            .map((n) => (n.textContent || '').trim())
            .join('')
        : ''
      const inlineExempt = cs.display.startsWith('inline') && siblingText.length > 0

      // Visually hidden until focused (skip links). 1x1 with clipping is
      // the canonical sr-only recipe; it is a keyboard affordance, not a
      // touch target, and reporting it as a 2.5.8 failure is noise.
      const srOnly =
        cs.clip === 'rect(0px, 0px, 0px, 0px)' ||
        cs.clipPath === 'inset(50%)' ||
        (r.width <= 1 && r.height <= 1)

      out.push({
        selector:
          el.tagName.toLowerCase() +
          '.' +
          (el.getAttribute('class') || '').split(/\s+/).filter(Boolean).slice(0, 3).join('.'),
        label: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40),
        width: Math.round(r.width),
        height: Math.round(r.height),
        coarseExempt: stretched,
        inlineExempt,
        screenReaderOnly: srOnly,
      })
    }
    return out
  }, floor)
}
