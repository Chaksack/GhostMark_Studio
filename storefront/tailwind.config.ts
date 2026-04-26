import type { Config } from 'tailwindcss'

/**
 * Tailwind config — GhostMark Studio editorial design system.
 *
 * Tokens here mirror the merchery.co reference palette + typography rhythm
 * used across /about, /sustainability, /platform and friends. Page templates
 * lean on the names below (`bg-merchery-sage`, `text-display-md`, `py-section`,
 * `px-gutter`, …) as their canonical surface / type / spacing language —
 * keeping them in one place means we never reach for a `bg-[#hex]` literal
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
        // load — Georgia and the generic `serif` keyword cover everything
        // after that.
        serif: ['"Fraunces"', '"GT Sectra"', '"Playfair Display"', 'Georgia', 'serif'],
        display: ['"Fraunces"', '"GT Sectra"', '"Playfair Display"', 'Georgia', 'serif'],
        // Inter Tight is the body workhorse — a slightly tighter cut of
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
        // Merchery `font-accent` alias — same Fraunces wedge serif used for
        // serif accents on tiles ("Cabas bag", "Kaweco pen") and the PDP
        // "About this product" prose block. Aliased to the existing display
        // stack so any utility `font-accent` resolves to the same font.
        accent: ['"Fraunces"', '"GT Sectra"', '"Playfair Display"', 'Georgia', 'serif'],
      },
      colors: {
        // ------------------------------------------------------------------
        // Merchery palette — flat top-level keys so utilities resolve as
        // `bg-offWhite`, `text-greyText`, `border-greyLines` etc., matching
        // the verbatim class strings extracted from merchery.co's live DOM.
        // ------------------------------------------------------------------
        offWhite: '#F1EEE9',         // soft warm off-white — image wells, FAQ panel
        offWhiteLight: '#F8F6F2',    // even lighter — header search input chrome
        warmGrey: '#E5DFD6',         // desktop fixed header band
        uiHighlight: '#EFE9DF',      // PDP reassurance strip (slightly warmer than offWhite)
        uiGrey: '#EAE6DF',           // neutral chip / button bg
        greyText: '#7A7268',         // muted breadcrumb / caption text
        greyLines: '#D9D2C5',        // borders, filter pill outlines, header bottom border
        pistacho: '#C7D5A8',         // newsletter band (calm pistachio, NOT mint)
        neonGreen: '#B7E861',        // sale/promo accent

        sage: '#c5c99b',

        // Cream surface family — warm off-whites used for hero tiles,
        // alternating bands and trust strips.
        cream: {
          50: '#FBF7F1',
          100: '#F5EFE6',
          200: '#EDE3D2',
          tile: '#F4F1EB', // canonical hero / portrait tile — cooled toward neutral so products carry color (was #EFEAE2 / #F2E5D9)
          warm: '#EDE0D1', // alternating section band
        },

        // Ink family — typographic and neutral surfaces. `ink-950` is the
        // headline color, `ink-700` the body, `ink-500` the eyebrow,
        // `ink-400` the dashed-underline + placeholder caption tint.
        ink: {
          50: '#F5F4F2',
          200: '#D8D4CC',
          400: '#8A8378',
          500: '#6E6A60',
          700: '#3F3A33',
          900: '#1F1C18',
          950: '#141210',
        },

        // Editorial accents — flat slabs used on commitments and CTA bands.
        merchery: {
          tile: '#F2E5D9',
          sage: '#C8D2B8',
          ink: '#1F1C18',
          cta: '#FBF7F1',
        },
        accent: {
          terracotta: '#C46B4F',
        },
      },
      fontSize: {
        // Editorial type ramp. Each entry is [size, lineHeight].
        eyebrow: ['12px', { lineHeight: '1.2', letterSpacing: '0.08em' }],
        caption: ['13px', { lineHeight: '1.5' }],
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
        gutter: 'clamp(1.25rem, 0.5rem + 2vw, 2.5rem)',
      },
      transitionDuration: {
        fast: '120ms',
      },
      transitionTimingFunction: {
        emphasis: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      boxShadow: {
        // Merchery PDP step-card elevation — a hairline 1px outline plus a
        // soft drop, used on every numbered customisation card.
        custom: '0 0 0 1px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)',
      },
    },
  },
  // Token classes are referenced dynamically (commitment.surface,
  // commitment.ink, etc.) — keep them safelisted so JIT doesn't tree-shake
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
    // Merchery palette — referenced both statically and via dynamic class
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
  ],
} satisfies Config
