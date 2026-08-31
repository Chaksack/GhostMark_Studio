import type { Config } from 'tailwindcss'
import plugin from 'tailwindcss/plugin'

/**
 * Tailwind config: GhostMark Studio editorial design system.
 *
 * Tokens here mirror the merchery.co reference palette + typography rhythm
 * used across /about, /sustainability, /platform and friends. Page templates
 * lean on the names below (`bg-merchery-sage`, `text-display-md`, `py-section`,
 * `px-gutter`, …) as their canonical surface / type / spacing language.
 * Keeping them in one place means we never reach for a `bg-[#hex]` literal
 * or a one-off `text-[2.4rem]` size in a page.
 */
export default {
  // Belt-and-braces content globs: cover both project-root-relative and
  // srcDir-relative paths so the JIT scanner finds every Vue file regardless
  // of which cwd the @nuxtjs/tailwindcss module resolves from. Nuxt 4 puts
  // components under `app/components/...` (srcDir = `app/`), but a plain
  // `./components/**` glob still gets shipped for any legacy / future move.
  content: [
    './app/**/*.{vue,js,ts}',
    './components/**/*.{vue,js,ts}',
    './layouts/**/*.{vue,js,ts}',
    './pages/**/*.{vue,js,ts}',
    './plugins/**/*.{js,ts}',
    './app/components/**/*.{vue,js,ts}',
    './app/layouts/**/*.{vue,js,ts}',
    './app/pages/**/*.{vue,js,ts}',
    './app/composables/**/*.{js,ts}',
    './app/utils/**/*.{js,ts}',
  ],
  corePlugins: {
    container: false,
  },
  theme: {
    extend: {
      fontFamily: {
        // Editorial Reckless-class wedge serif. Fraunces (Google Fonts,
        // variable axes opsz/wght/SOFT/WONK) gives us the high-x-height,
        // low-contrast wedge serif silhouette merchery.co reaches for with
        // Reckless. We dial opsz down via the optical-sizing token (see
        // tokens.css) so headings read as a contemporary wedge serif rather
        // than a Didone like Playfair.
        //
        // `font-serif` is aliased to the same stack so legacy callers keep
        // rendering Fraunces with no markup migration. Playfair stays as a
        // last-resort fallback for the (vanishing) chance Fraunces fails to
        // load. Georgia and the generic `serif` keyword cover everything
        // after that.
        serif: ['"Fraunces"', '"GT Sectra"', '"Playfair Display"', 'Georgia', 'serif'],
        display: ['"Fraunces"', '"GT Sectra"', '"Playfair Display"', 'Georgia', 'serif'],
        // Inter Tight is the body workhorse, a slightly tighter cut of
        // Inter that matches the merchery.co rhythm. We mirror it onto
        // `font-sans` so the default sans utility resolves to the same
        // family, meaning unstyled paragraphs inherit the editorial body
        // type without needing an explicit `font-body` class.
        sans: [
          '"Inter Tight"',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'system-ui',
          'sans-serif',
        ],
        body: [
          '"Inter Tight"',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'system-ui',
          'sans-serif',
        ],
        // Merchery `font-accent` alias: same Fraunces wedge serif used for
        // serif accents on tiles ("Cabas bag", "Kaweco pen") and the PDP
        // "About this product" prose block. Aliased to the existing display
        // stack so any utility `font-accent` resolves to the same font.
        accent: ['"Fraunces"', '"GT Sectra"', '"Playfair Display"', 'Georgia', 'serif'],
      },
      colors: {
        // ------------------------------------------------------------------
        // Merchery palette: flat top-level keys so utilities resolve as
        // `bg-offWhite`, `text-greyText`, `border-greyLines` etc., matching
        // the verbatim class strings extracted from merchery.co's live DOM.
        // ------------------------------------------------------------------
        offWhite: '#F1EEE9',         // soft warm off-white: image wells, FAQ panel
        offWhiteLight: '#F8F6F2',    // even lighter: header search input chrome
        warmGrey: '#E5DFD6',         // desktop fixed header band
        uiHighlight: '#EFE9DF',      // PDP reassurance strip (slightly warmer than offWhite)
        uiGrey: '#EAE6DF',           // neutral chip / button bg
        // Muted breadcrumb / caption text. Darkened from #7A7268, which
        // failed AA on every warm ground it actually sits on, and it sits on
        // roughly 500 of them:
        //
        //   on white       4.74  pass   <- the only ground it passed
        //   on cream-50    4.44  FAIL
        //   on cream-tile  4.20  FAIL
        //   on offWhite    4.09  FAIL   <- this is the <body> background
        //   on uiHighlight 3.92  FAIL
        //   on warmGrey    3.58  FAIL   <- fixed header band
        //
        // The reported case was 4.44:1 on cream-50 at 12px on the PDP sticky
        // bar, but the token almost never renders on white, so in practice it
        // was failing nearly everywhere it was used.
        //
        // #6A6258 holds the original hue (73.5) and chroma (1.8) exactly and
        // only drops lightness 55.6 → 50.1, so it reads as the same grey
        // rather than a new one. It now clears 4.5:1 on all six grounds, the
        // worst being 4.53:1 on warmGrey.
        greyText: '#6A6258',
        greyLines: '#D9D2C5',        // borders, filter pill outlines, header bottom border
        pistacho: '#C7D5A8',         // newsletter band (calm pistachio, NOT mint)
        neonGreen: '#B7E861',        // sale/promo accent

        // Sage family: promoted from a flat string to a full ramp.
        //
        // It was previously `sage: '#c5c99b'`, which meant every `sage-50`,
        // `sage-100`, `sage-200`, `sage-600` reference in the app emitted no
        // CSS at all (UiBadge success, account/profile.vue:123,
        // customer-stories.vue:105). `DEFAULT` preserves the original flat
        // value verbatim so the existing bare `text-sage` in about/index.vue
        // renders exactly as before.
        //
        // The ramp is built in OKLCh at hue ~118 and passes *through* the
        // brand value rather than around it: step 300 (#C3CB9D) is within
        // 1 ΔL of the old #C5C99B. Measured: sage-600 on sage-50 = 5.64:1
        // (the old sage-600-on-sage ground measured 1.59:1, i.e. invisible).
        sage: {
          DEFAULT: '#C5C99B',
          50: '#F1F5E6',
          100: '#E6ECD3',
          200: '#D6DEB9',
          300: '#C3CB9D',
          400: '#A5AE77',
          500: '#818D50',
          600: '#59662B',
          700: '#414E1E',
          800: '#2D3814',
          900: '#1C250D',
        },

        // Cream surface family: warm off-whites used for hero tiles,
        // alternating bands and trust strips.
        cream: {
          50: '#FBF7F1',
          100: '#F5EFE6',
          200: '#EDE3D2',
          tile: '#F4F1EB', // canonical hero / portrait tile, cooled toward neutral so products carry color (was #EFEAE2 / #F2E5D9)
          warm: '#EDE0D1', // alternating section band
        },

        // Ink family: typographic and neutral surfaces. `ink-950` is the
        // headline color, `ink-700` the body, `ink-500` the eyebrow,
        // `ink-400` the dashed-underline + placeholder caption tint.
        //
        // 100 / 300 / 600 / 800 were missing, which meant a handful of
        // classes already shipped in components emitted no CSS: `bg-ink-100`
        // (UiBadge neutral: the *default* badge had no background),
        // `border-ink-100` (UiSheet + AppMobileNav dividers),
        // `ring-ink-300` (UiInput focus ring, silently falling back to
        // Tailwind's stock blue), `hover:border-ink-300` (UiButton outline),
        // `text-ink-800` (UiField label, GeoModal:251) and
        // `hover:bg-ink-800` (search.vue:214).
        //
        // The four new steps are interpolated in OKLCh between their existing
        // neighbours, holding the ramp's warm hue (~80) and its low chroma
        // (0.5–1.8), so they read as the same neutral rather than as a
        // second grey that happens to sit nearby. Filling the ramp in full
        // rather than patching the two reported gaps is deliberate: a
        // discontinuous scale is what produced this bug class in the first
        // place.
        ink: {
          50: '#F5F4F2',
          100: '#EBE9E5',
          200: '#D8D4CC',
          300: '#B0ABA1',
          400: '#8A8378',
          // Darkened from #6E6A60 on 2026-08-31. The old value passed on
          // white, cream-50, cream-tile and offWhite, which is exactly the
          // set someone measured, and failed the 4.5:1 body-text floor on
          // every WARM BAND ground, which nobody measured:
          //   cream-warm 4.16   cream-200 4.24   merchery-tile 4.36
          // This value clears all three and improves every other ground:
          //   white 5.90  cream-50 5.53  cream-100 5.16  cream-tile 5.23
          //   cream-warm 4.55  cream-200 4.64  merchery-tile 4.77
          // Chosen as the LIGHTEST value that passes, so the 400/500/600
          // ramp keeps a real luminance gap (500 = 0.128, 600 = 0.083).
          //
          // DOES NOT PASS ON `merchery-sage` (3.76:1), and cannot be made
          // to. For ink-500 to clear 4.5:1 the ground needs relative
          // luminance >= 0.751; sage is 0.618. Lifting it there would put
          // sage ABOVE cream-warm (0.759 is effectively the same value), so
          // the darker alternating slab would stop reading as a different
          // band at all. The slab is load-bearing; the eyebrow tint is not.
          //
          // So on sage, and only on sage, use `ink-600` (5.01:1). The nine
          // call sites that needed it were changed on 2026-08-31 and each
          // carries a comment saying why, because the obvious "tidy-up" is
          // to put them back on the ink-500 eyebrow default.
          // `tests/e2e/contrast-sage.spec.ts` fails if any regress, or if
          // a new band repeats the mistake.
          500: '#68645A',
          600: '#565149',
          700: '#3F3A33',
          800: '#2E2A25',
          900: '#1F1C18',
          950: '#141210',
        },

        // Editorial accents: flat slabs used on commitments and CTA bands.
        merchery: {
          tile: '#F2E5D9',
          sage: '#C8D2B8',
          ink: '#1F1C18',
          cta: '#FBF7F1',
        },
        accent: {
          terracotta: '#C46B4F',
        },

        // ------------------------------------------------------------------
        // Semantic layer: status roles, defined once.
        //
        // Before this existed every component invented its own vocabulary and
        // they disagreed with each other. Success had three (`merchery-sage`,
        // raw `emerald-500/700`, and the dead `sage-50/600`); danger had
        // three (raw `red-*`, `accent-terracotta`, and (the sharp one)
        // UiButton.danger shipping `bg-red-600` while UiBadge.danger shipped
        // `accent-terracotta/15`. The two primitives literally disagreed
        // about what danger looks like.) Both now point here.
        //
        // Steps are ROLE-NAMED, not numbered. `bg-semantic-danger-solid` says
        // what it is for; `bg-semantic-danger-600` would just move the
        // guessing game one level down. The four steps compose into two
        // recipes and only two:
        //
        //   tinted (badge, inline alert, empty state):
        //     bg-semantic-{role}-surface
        //     text-semantic-{role}-fg
        //     border border-semantic-{role}-border
        //
        //   solid (destructive button, filled pill):
        //     bg-semantic-{role}-solid text-cream-50
        //
        // Hues are pulled from the warm palette rather than Tailwind's stock
        // ramps: success carries the sage hue, warning and danger sit on the
        // terracotta side of the wheel (~74 / ~40). `info` is the one
        // deliberate outsider: the palette has no cool anchor at all, and an
        // informational note has to be distinguishable from a neutral one, so
        // it is a low-chroma denim (C 2.0–8.6) that reads as ink-with-a-hint
        // rather than as #3B82F6.
        //
        // Every value below is measured, not eyeballed:
        //   fg on its own surface   6.61 – 7.82:1   (AA at 13px, most AAA)
        //   fg on cream-50          7.27 – 8.44:1
        //   fg on offWhite          6.71 – 7.78:1
        //   cream-50 on solid       5.62 – 6.20:1
        //
        // Constraint honoured: `semantic-success-surface` is ~10 OKLab-L
        // points lighter than the decorative `merchery-sage` marketing slab
        // (1.42:1 apart). A colour cannot be both brand furniture and a
        // status signal without the signal eroding, so the confirmation tint
        // and the full-bleed slab are kept visibly distinct.
        semantic: {
          success: {
            surface: '#EDF1DE',
            border: '#D3DBB3',
            fg: '#414E1D',
            solid: '#59662B',
          },
          warning: {
            surface: '#FEE9CF',
            border: '#F4CB99',
            fg: '#6A4312',
            solid: '#7E541B',
          },
          danger: {
            surface: '#FFE5DB',
            border: '#FDC1AE',
            fg: '#812E19',
            solid: '#A53D1A',
          },
          info: {
            surface: '#E3EEFA',
            border: '#BDD6F0',
            fg: '#30557A',
            solid: '#3B6692',
          },
          // Canonical focus-ring ink. Deliberately NOT `ink-300`: that step
          // measures 2.29:1 on white, which fails WCAG 2.2 SC 1.4.11
          // (non-text contrast, 3:1) for a focus indicator. Pointing the
          // default ring at it would trade a blue accessibility bug for a
          // warm one. This value is `ink-500`, which after the 2026-08-31
          // darkening measures 5.90:1 on white, 5.53:1 on cream-50 and
          // 5.23:1 on cream-tile: warm, in-palette, and actually passing.
          //
          // NOTE ON THIS LIST. It originally cited white, cream-50, offWhite
          // and uiGrey only, and that omission is how a body-text failure
          // survived on four warm band grounds. A focus ring answers to the
          // 3:1 non-text floor, but the same token is used as body and
          // eyebrow text at the 4.5:1 floor, so it must be measured on every
          // ground it is PAINTED on, not on the ones convenient to test.
          //
          // ⚠️ USE THE WHOLE RECIPE OR NONE OF IT:
          //   focus-visible:outline-none
          //   focus-visible:ring-2
          //   focus-visible:ring-semantic-focus
          //   focus-visible:ring-offset-2
          //   focus-visible:ring-offset-cream-50
          //
          // The offset is not decoration: it is what makes the ring legal.
          // The ring is only comfortably conformant because the 2px offset
          // lifts it off the control and onto the page ground, where it
          // measures 5.05:1 on cream-50 and 4.66:1 on offWhite.
          //
          // Measured directly against dark controls it is marginal, not
          // comfortable: 3.46:1 on ink-950 and 3.15:1 on ink-900. Those do
          // technically clear SC 1.4.11's 3:1, but with ~0.15 of headroom on
          // ink-900: one nudge to either value and it fails. So treat dark
          // surfaces as out of scope for this token and use `focus-inverse`.
          //
          // (An earlier report put the ink-950 pairing at ~2.5:1. I measured
          // 3.46:1 and could not reproduce 2.5, recording both so the next
          // person re-measures rather than trusting either number blind.)
          focus: '#6E6A60',

          // Focus ink for dark surfaces (ink-900 / ink-950 slabs, the
          // merchery CTA band, image overlays) where `focus` cannot reach
          // 3:1. This is `ink-50`; it measures ~16:1 on ink-950 and 14.6:1
          // on ink-900. Pair with `ring-offset-ink-950` (or whatever the
          // slab actually is) rather than the cream offset.
          'focus-inverse': '#F5F4F2',
        },
      },
      fontSize: {
        // Editorial type ramp. Each entry is [size, lineHeight].
        //
        // `micro` and `eyebrow` are both 12px and that is intentional: they
        // are not interchangeable. `eyebrow` carries 0.08em tracking and 1.2
        // leading: it is an UPPERCASE LABEL token. `micro` is normal tracking
        // at 1.45 leading: it is a sentence token (field help text, error
        // copy, card meta). Reaching for `eyebrow` to set a 12px sentence is
        // what pushed the app to 41 ad-hoc `text-[Npx]` literals against 6
        // declared sizes: the label token simply did not fit, so people
        // bracket-escaped instead of adding the missing step.
        micro: ['12px', { lineHeight: '1.45' }],
        eyebrow: ['12px', { lineHeight: '1.2', letterSpacing: '0.08em' }],
        caption: ['13px', { lineHeight: '1.5' }],
        // `lead` replaces the `text-[15px]` literals in UiButton/UiInput.
        // Leading is tight (1.2) because it is only ever used on controls,
        // never on prose.
        lead: ['15px', { lineHeight: '1.2' }],
        body: ['16px', { lineHeight: '1.6' }],
        'display-sm': ['1.5rem', { lineHeight: '1.2', letterSpacing: '-0.01em' }],
        'display-md': ['clamp(1.75rem, 1.2rem + 1.6vw, 2.5rem)', { lineHeight: '1.15', letterSpacing: '-0.015em' }],
        'display-lg': ['clamp(2.25rem, 1.6rem + 2.4vw, 3.5rem)', { lineHeight: '1.05', letterSpacing: '-0.02em' }],
      },
      spacing: {
        // Editorial section + gutter rhythm. `py-section` is the canonical
        // vertical breathing room for a page band; `px-gutter` is the
        // horizontal page margin that keeps the 1320px content rail off the
        // viewport edge.
        section: 'clamp(3.5rem, 2rem + 4vw, 6rem)',
        // Delegated to the token so the gutter has ONE definition. It was
        // `clamp(1.25rem, 0.5rem + 2vw, 2.5rem)` (20px -> 40px), which no
        // other container system in the app agreed with; see the long note
        // on --gm-gutter in app/assets/css/tokens.css for the five systems
        // this replaced and why the ramp lands on 20 / 24 / 48.
        gutter: 'var(--gm-gutter)',
      },
      maxWidth: {
        // The page rail. This is the OUTER box (content + both gutters), so
        // `max-w-rail px-gutter` yields a content column of exactly
        // var(--gm-rail) = 1320px with the gutter as a true page margin.
        //
        // Pair it ONLY with `px-gutter`. `max-w-rail px-8` gives a 1320px
        // column with a 32px margin and no longer lines up with anything
        // else on the page, which is precisely the failure being removed.
        rail: 'var(--gm-rail-outer)',
      },
      transitionDuration: {
        fast: '120ms',
      },
      transitionTimingFunction: {
        emphasis: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      // Ring colour used when a `ring-*` utility names no colour, and (more
      // importantly) the fallback baked into `--tw-ring-color` on the
      // preflight `*` rule. Previously this was Tailwind's stock
      // `rgb(59 130 246 / 0.5)`, so any focus ring whose colour token was
      // missing (which `ring-ink-300` was, in UiInput) silently rendered
      // BLUE in an otherwise entirely warm palette. Pointing it at the
      // semantic focus ink means a future missing token degrades warm and
      // still clears the 3:1 non-text contrast floor.
      ringColor: {
        DEFAULT: '#6E6A60',
      },

      // Stacking order, named. `z-modal` and `z-drawer` were already
      // referenced by UiModal and UiSheet but had never been declared, so
      // both overlays shipped with NO z-index at all and relied entirely on
      // portal paint order to land above the page. Values are spaced by 100
      // so a future layer can slot between two without a renumber.
      //
      // ⚠️ `z-dropdown` is for a panel that renders INSIDE the header's own
      // stacking context. A panel that is `Teleport`ed to <body> (which the
      // desktop mega-menu is, because it has to escape an ancestor's
      // `overflow` clip) leaves that context entirely and is then competing
      // with `z-header` directly. At 1000 it would paint BEHIND the header.
      // Teleported header panels want `z-popover` (1500).
      //
      // This is the trap in the scale: `dropdown` is the name the next
      // person reaches for, and it is the wrong one the moment the panel
      // teleports. Pick by where the element ends up in the DOM, not by what
      // it looks like.
      zIndex: {
        dropdown: '1000',   // in-context menu, still inside the header
        sticky: '1100',
        header: '1200',
        drawer: '1300',
        modal: '1400',
        popover: '1500',    // teleported panels, incl. the mega-menu
        toast: '1600',
      },

      boxShadow: {
        // Merchery PDP step-card elevation: a hairline 1px outline plus a
        // soft drop, used on every numbered customisation card.
        custom: '0 0 0 1px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)',

        // Elevation ramp. `shadow-elev-3` was referenced by both overlay
        // primitives and had never been declared: the modal and the sheet
        // were rendering completely flat against the page. Shadows are tinted
        // with the ink hue rather than pure black so they sit on cream
        // without going grey.
        'elev-1': '0 1px 2px rgba(31,28,24,0.05), 0 1px 3px rgba(31,28,24,0.06)',
        'elev-2': '0 2px 4px rgba(31,28,24,0.05), 0 4px 12px rgba(31,28,24,0.08)',
        'elev-3': '0 4px 8px rgba(31,28,24,0.06), 0 16px 40px rgba(31,28,24,0.14)',
      },
    },
  },
  // Token classes are referenced dynamically (commitment.surface,
  // commitment.ink, etc.). Keep them safelisted so JIT doesn't tree-shake
  // them out of the production CSS.
  safelist: [
    'bg-cream-50',
    'bg-cream-100',
    'bg-cream-tile',
    'bg-cream-warm',
    'bg-merchery-tile',
    'bg-merchery-sage',
    'bg-merchery-ink',
    'bg-accent-terracotta',
    'text-cream-50',
    'text-cream-50/90',
    'text-cream-50/70',
    'text-ink-200',
    'text-ink-400',
    'text-ink-500',
    'text-ink-700',
    'text-ink-950',
    // Merchery palette: referenced both statically and via dynamic class
    // bindings (e.g. PDP card highlight states); safelist guarantees JIT
    // ships them even if a class string is built at runtime.
    'bg-offWhite',
    'bg-offWhiteLight',
    'bg-warmGrey',
    'bg-uiHighlight',
    'bg-uiGrey',
    'bg-pistacho',
    'bg-neonGreen',
    'bg-greyText',
    'bg-greyLines',
    'text-greyText',
    'text-warmGrey',
    'text-offWhite',
    'placeholder:text-greyText',
    'border-greyLines',
    'border-t-greyLines',
    'ring-greyLines',
    'divide-greyLines',
    'from-warmGrey',
    'to-offWhite',
    'hover:bg-warmGrey',
    'hover:bg-uiGrey',
    'hover:bg-offWhite',
    'shadow-custom',
    'font-accent',

    // Semantic status roles. Safelisted because status is very often applied
    // from a lookup map keyed on a server enum (order status, fulfillment
    // state, stock state): the class string is assembled at runtime and the
    // JIT scanner cannot see it. Without this a badge variant that only ever
    // appears for, say, a cancelled order would ship with no CSS, which is
    // exactly the failure mode this whole change exists to remove.
    ...['success', 'warning', 'danger', 'info'].flatMap(role => [
      `bg-semantic-${role}-surface`,
      `bg-semantic-${role}-solid`,
      `text-semantic-${role}-fg`,
      `border-semantic-${role}-border`,
    ]),
    'ring-semantic-focus',
  ],
  plugins: [
    // Tailwind 3.4 has no pointer-modality variants (they landed in v4), so
    // we add the one we need. `pointer-coarse:` scopes a utility to
    // touch-primary devices.
    //
    // This exists so the small button can meet a 44px touch target on touch
    // without inflating to 44px on a mouse, where 36px is correct and where
    // inflating it would visibly break the control rhythm the design already
    // has. See UiButton for how it is applied.
    plugin(({ addVariant }) => {
      addVariant('pointer-coarse', '@media (pointer: coarse)')
      addVariant('pointer-fine', '@media (pointer: fine)')
    }),
  ],
} satisfies Config
