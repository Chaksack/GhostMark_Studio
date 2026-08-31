// https://nuxt.com/docs/api/configuration/nuxt-config
/// <reference types="node" />

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxtjs/tailwindcss', '@nuxtjs/medusa', '@nuxt/image'],

  css: ['~/assets/tailwind.css', '~/assets/css/tokens.css'],

  // Explicit Tailwind wiring for Nuxt 4 + @nuxtjs/tailwindcss 6.14. Without
  // an explicit `configPath`, the module resolves config relative to its own
  // expectations and our merchery palette tokens (bg-offWhite, bg-warmGrey,
  // text-greyText, …) silently fail to JIT-compile: they're declared and
  // safelisted in tailwind.config.ts but never reach the emitted CSS, leaving
  // every section that paints itself with a merchery class transparent.
  // `~~` resolves to the Nuxt project root (where this file lives), `~`
  // resolves to srcDir (`app/`), so this points the module at the canonical
  // root config and our base layer stylesheet.
  tailwindcss: {
    configPath: '~~/tailwind.config.ts',
    cssPath: '~/assets/tailwind.css',
    viewer: false,
    // `exposeConfig` is what makes @nuxtjs/tailwindcss 6.14 WATCH the config
    // file. Without it the module reads tailwind.config.ts once at boot and
    // never again, so editing a colour/token there appears to do nothing:
    // `touch`, a config edit and a forced Vite re-transform all fail, and the
    // only way to see a change is a full dev-server restart. That cost us a
    // ~3s outage mid-session when an agent restarted the server to get a
    // token change to appear. Turning it on trades a small dev-time bundle of
    // resolved-config modules for working hot-reload on design tokens.
    exposeConfig: true,
  },

  // @nuxt/image: whitelist Unsplash so IPX will optimise editorial hero
  // photography pulled from images.unsplash.com. Without the domain entry
  // IPX returns IPX_FORBIDDEN_HOST and the hero <img> never paints. The
  // `hero` preset is referenced by `<NuxtPicture preset="hero">` in
  // HeroSection.vue: it locks in WebP + a generous quality budget so the
  // LCP image stays sharp on retina without re-encoding artifacts.
  image: {
    quality: 85,
    format: ['avif', 'webp'],
    domains: ['images.unsplash.com'],
    screens: {
      xs: 320,
      sm: 640,
      md: 768,
      lg: 1024,
      xl: 1280,
      '2xl': 1536,
      '3xl': 1920,
    },
    presets: {
      hero: {
        modifiers: {
          format: 'webp',
          quality: 85,
          fit: 'cover',
        },
      },
    },
  },

  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      link: [
        {
          rel: 'preconnect',
          href: 'https://fonts.googleapis.com',
        },
        {
          rel: 'preconnect',
          href: 'https://fonts.gstatic.com',
          crossorigin: '',
        },
        {
          // Editorial type stack:
          //   - Fraunces (variable opsz, wght axes): the wedge-serif display
          //     face used everywhere `font-display` / `font-serif` resolves.
          //     Specifying `opsz,wght@9..144,300;…;9..144,600` requests the
          //     full optical-size range so we can dial it down at headline
          //     sizes via `font-optical-sizing` in tokens.css to get the
          //     low-contrast Reckless-ish silhouette.
          //   - Inter Tight (static weights 400-700): the body workhorse
          //     resolved by `font-sans` and `font-body`.
          // `display=swap` keeps the FOUT short so we never render system
          // fallback for more than the time it takes the woff2 to land.
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500;9..144,600&family=Inter+Tight:wght@400;500;600;700&display=swap',
        },
      ],
    },
  },

  // Security headers: the half that server middleware cannot deliver.
  //
  // Most of the header set is applied per-request in
  // `server/middleware/security-headers.ts` (it needs runtime knowledge: HSTS
  // only over TLS, CSP sources resolved from runtime env). But Nitro
  // *unshifts* its static-asset handler in front of all user middleware
  // (nitropack/dist/rollup/index.mjs:1003), so anything served straight out of
  // `public/` (including customer artwork under /uploads/designs/) never
  // reaches that middleware. Route rules are installed ahead of every handler
  // (`h3App.use(createRouteRulesHandler(...))`, nitropack app.mjs:115), so
  // they are the only mechanism that covers static files.
  //
  // Deliberately NOT here: `Cross-Origin-Resource-Policy`. The Medusa admin
  // runs on a different origin and embeds these uploads as <img>; a
  // `same-origin` CORP would break the "Download original" widget.
  routeRules: {
    '/**': {
      headers: {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
      },
    },
    // Customer artwork. This CSP is ENFORCING (not report-only) and it costs
    // nothing: CSP only applies to responses treated as documents, so loading
    // an upload via <img src> is unaffected. It bites only when someone
    // navigates directly at the file (which is exactly the stored-XSS case)
    // and neuters any HTML polyglot that ever slipped past the magic-byte
    // check in server/api/uploads/image.post.ts.
    '/uploads/**': {
      headers: {
        'Content-Security-Policy':
          "default-src 'none'; sandbox; frame-ancestors 'none'; base-uri 'none'",
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'no-referrer',
      },
    },
  },

  runtimeConfig: {
    cmsToken: process.env.STRAPI_TOKEN || '',
    public: {
      cmsBaseUrl: (process.env.STRAPI_URL || 'http://localhost:1337').replace(/\/$/, ''),
      stripePublishableKey: process.env.NUXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
    },
  },

  // Pre-bundle CommonJS deps so Vite's ESM analyser correctly surfaces
  // named exports (e.g. `qs.stringify`) at runtime. Without this, the
  // `@nuxtjs/medusa` module crashes the client SDK with
  //   "does not provide an export named 'stringify'"
  // and every SDK call fails silently, which strips every product price
  // from every consumer (PDP, BestSellers, RecentlyAdded, search results).
  // `vue-konva` is the canvas runtime for the PDP design editor.
  // Note: Do not list packages here unless they are direct dependencies,
  // otherwise Vite will warn that the entry is unresolvable during prebundle.
  vite: {
    optimizeDeps: {
      include: ['qs', 'vue-konva'],
    },
  },

  medusa: {
    baseUrl: (process.env.MEDUSA_URL || 'http://localhost:9000').replace(/\/$/, ''),
    publishableKey: process.env.MEDUSA_PUBLISHABLE_KEY || '',
    debug: process.env.NODE_ENV === 'development',
    global: true,
    server: true,
    auth: {
      type: 'jwt',
      jwtTokenStorageKey: 'gms_auth_token',
      // 'memory' is SSR-safe (only touches an in-instance field; SDK guards
      // localStorage/sessionStorage access). 'nostore' makes setToken a no-op:
      // every authenticated call goes out as guest, breaking the register
      // flow. The medusa-token-cookie plugin layers cookie-backed persistence
      // on top of memory storage so reloads keep the user logged in.
      jwtTokenStorageMethod: 'memory',
      fetchCredentials: 'include',
    },
  },
})