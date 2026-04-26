# merchery.co tech stack (observed 2026-04-25)

Inspected via Playwright DevTools against https://merchery.co/ (locale `en`, country `GB`).

## Framework
- **Next.js 14/15 App Router** (React Server Components).
  - `<html data-router="app">`, `/_next/static/chunks/main-app-*.js`, `webpack-*.js`.
  - RSC streaming via `self.__next_f.push([...])` inline scripts (48 inline scripts on the homepage).
  - `<next-route-announcer>` custom element present.
  - `<Link>` prefetches RSC payloads with `?_rsc=19zvn` query.
  - **No legacy `#__NEXT_DATA__`** — fully migrated to App Router.
- React version not exposed on `window`.

## CSS
- **Tailwind CSS** (utility-first + JIT arbitrary values).
  - Class samples: `flex bg-offWhite justify-between h-[4.4rem] py-[10px] px-[30px]`, `border-greyLines`.
  - Brand tokens (`offWhite`, `greyLines`, `text-base`) configured in `tailwind.config`.
  - 5 split CSS bundles, total **~29 KB** (largest 24.7 KB).
- No CSS Modules, no styled-components, no Emotion.
- `goober` injects toast keyframes (`#_goober`) — react-hot-toast under the hood.

## Image / CDN
- **Cloudflare Images** transformer at `/cdn-cgi/image/width=N,quality=90,format=auto/...`.
- CMS originals served from **Strapi** convention `/cms/uploads/<filename>_<hash>.<ext>`.
- Uses native `<img srcset sizes loading="lazy" decoding="async">` (no `<picture>` elements, no `next/image` runtime markup).
- 131 `<img>` tags on homepage. Largest: a 4.7 MB hero JPEG at 3840w — opportunity gap.

## Third-party (analytics + CRM + chat + CMP + popup)
| Category | Vendor | ID |
|---|---|---|
| Tag manager | Google Tag Manager + sGTM proxy | `merch.merchery.co` (first-party) |
| Web analytics | GA4 | `G-XHCB5CQSZF` |
| Web analytics | Microsoft Clarity | `wd26bmdtfa` |
| Web analytics | Hotjar | `3733816` |
| Ads | Google Ads | `AW-651094136` |
| Ads | Facebook Pixel | `893704334797703` |
| Ads | AdRoll | `1N5W0H7Z77O5` |
| CRM | HubSpot (hs-scripts, hs-banner, hs-analytics, collectedforms, adspixel) | portal `14517983` |
| Chat | Intercom (launcher gated by display rules) | app `qw6jum5j` |
| Popup | Wisepops | `XDfEAC5Yoi` |
| Reviews | Trustpilot widget v5 | business `5C3WHK2` |
| Auth | Google Identity Services (`accounts.google.com/gsi/client`) | — |
| Errors | Sentry (`window.__SENTRY__`) | — |
| Edge | Cloudflare (Insights beacon, image resizer, Turnstile-ready CSP) | — |

## UI libraries
- **Radix UI** (focus traps, popper containers — see `data-radix-*`).
- **Swiper** (carousels — `swiper-icons` font-face is a tell).
- **Framer Motion** (transform-origin styles on header — `style="transform:translateY(0%) translateZ(0)"`).
- **react-hot-toast** (via goober).
- View Transitions API supported (Chromium engine).
- No Headless UI, GSAP, Lenis, Embla.

## Fonts
- **Self-hosted via `next/font`** under `/_next/static/media/`.
- Two faces only:
  - `Reckless` (Reckless Neue Regular) — 45 KB woff2 — used for h1/h2 (serif display).
  - `Grotesk` (Neue Haas Grotesk) — 25 KB woff2 — body/buttons.
- No Google Fonts request, no preload `<link rel="preload" as="font">` (relies on CSS-discovered loading).

## Bundle size
- 204 requests, **~9.98 MB** total transferred on cold load.
- ~10 MB is dominated by hero imagery (one 4.7 MB JPEG, one 1.6 MB JPEG).
- JS payload alone: ~12 chunks 25–117 KB each + 48 inline RSC payloads.
- Biggest 3rd-party JS: `fbevents.js` 99 KB.

## Security headers
- CSP nonce-based, COEP `require-corp`, COOP/CORP `same-origin`, strict Permissions-Policy, Referrer-Policy `same-origin`, X-Frame `SAMEORIGIN`.
- HTTP/2 via Cloudflare; bot mitigation via Cloudflare challenge (`cf-mitigated: challenge` for non-browser UAs).

## i18n
- Subpath locales: `/de`, `/fr`, `/nl`, `/es`, `/en-GB`.
- Region split: US/CA/AU/NZ/ZA route to `https://us.merchery.co/` subdomain.
- Cookie `did_select_region_v2_EU` records region selection.

---

## Comparison to ours

| Layer | Merchery | Ours | Notes |
|---|---|---|---|
| Framework | Next.js App Router (React 19 / RSC) | **Nuxt 4.4.2 + Vue 3.5** | Both modern SSR/streaming. Different DX & ecosystem. |
| CSS | Tailwind (utility + arbitrary values, brand tokens) | **Tailwind 3** | Same approach. Their tokens are minimal (`offWhite`, `greyLines`); ours can stay token-led. |
| Image CDN | Cloudflare Images (`/cdn-cgi/image`) on Strapi originals | **`@nuxt/image` (IPX) on Unsplash + Strapi/Medusa** | They get free Cloudflare network on every image; we self-host IPX. |
| CMS | Strapi (`/cms/uploads/*`) | Strapi (per env) | Aligned. |
| Carousel | Swiper | none yet | Need a primitive — Embla or Swiper. |
| Animations | Framer Motion | none formalized | Header reveal-on-scroll uses Framer. |
| Headless components | Radix UI | none yet | We could adopt Radix Vue (`reka-ui`) for menus / dialogs. |
| Toast | react-hot-toast (goober) | none | Add a toast primitive. |
| Fonts | Self-hosted via `next/font` (Reckless + Neue Haas Grotesk) | Google Fonts CDN (Fraunces + Inter Tight) | They self-host for COEP + speed. We could move to `@nuxtjs/google-fonts` with download or Fontsource. |
| Tag manager | GTM + first-party sGTM proxy `merch.merchery.co` | none | Big gap. Server-side GTM dodges ITP. |
| Analytics | GA4 + Clarity + Hotjar | none | Triple-stack analytics — heavy but expected. |
| Ads | Meta Pixel + Google Ads + AdRoll | none | Ad ecosystem fully wired. |
| CRM | HubSpot (5 scripts loaded) | none | Lead capture / nurture. |
| Chat | Intercom | none | Sales chat. |
| Popup | Wisepops | none | Email capture / promos. |
| Reviews | Trustpilot widget | none | Social proof. |
| Auth | Google Identity Services | Medusa email | They support Google one-tap. |
| Errors | Sentry | none yet | Observability gap. |
| Edge | Cloudflare (CSP, Insights, image resizer, sGTM) | none | Cloudflare in front of everything. |
| i18n | Subpath + US subdomain (5+ locales, hreflang) | en only | Need locale strategy if we go EU/US. |
| CMP | Custom (`cookie_confirm_date`, `consent` cookies) | none | Need a consent banner before pixels can fire. |

## Surprising findings
1. **No `next/image` runtime** — they use plain `<img>` tags piped through Cloudflare's `cdn-cgi/image` resizer. Simpler markup, edge-cached, but they ship a 4.7 MB hero (under-tuned `sizes` for the largest viewport).
2. **First-party tagging proxy `merch.merchery.co`** — they run sGTM (server-side Google Tag Manager) so analytics requests look first-party and survive Safari ITP / ad blockers.
3. **Cloudflare COEP `require-corp` + nonce CSP** is unusually strict for an e-commerce site (forces every cross-origin embed to opt-in). They wear it because they front-load all third-parties intentionally.
4. **48 inline `<script>` tags** — RSC flight payloads streamed; explains how the page hydrates without a giant `__NEXT_DATA__` JSON.
5. **react-hot-toast** is still leaving its goober keyframes in the head even when no toast is showing.
6. **Two custom self-hosted fonts only** (Reckless Neue + Neue Haas Grotesk) — premium brand pairing, no Google Fonts roundtrip.
7. **Wisepops loader currently returns 401** — silent third-party failure on the homepage.

## What we should consider adding
1. **Cloudflare in front of the storefront** — gives us the `cdn-cgi/image` resizer, CSP/COEP delivery, cf-insights, and the foundation for sGTM.
2. **Server-side GTM (sGTM)** at `tag.ghostmark.studio` once we wire any analytics — same first-party trick, dodges ITP.
3. **Consent banner before any pixel fires** (Klaro / cookie-consent / our own) — Merchery's pattern: `cookie_confirm_date` + `consent` cookies gate everything.
4. **Trustpilot or equivalent reviews widget** in the navigation — they put the score above the nav, not below the fold.
5. **Toast primitive** (sonner for Vue or vue-sonner) for cart / form feedback.
6. **Carousel primitive** — Embla (accessible, tiny) or Swiper if we need feature parity.
7. **Headless component layer** — `reka-ui` (Radix Vue) for menus, dialogs, popovers.
8. **Self-host the brand fonts** instead of Google Fonts CDN — lets us add COEP later and cuts a round trip.
9. **Sentry SDK** for both server + client — they're tracking errors, we should too before launch.
10. **i18n strategy** — even if we ship en only, decide subpath vs subdomain now (Merchery does both: `/de` for EU locales, `us.` for North America).
11. **`<link rel="preconnect">`** for any third-party we adopt — Merchery has none and pays a TLS roundtrip per vendor; we can do better.
12. **Tighter security headers** — match their CSP nonce + Permissions-Policy strictness; cheap wins for security audits.
