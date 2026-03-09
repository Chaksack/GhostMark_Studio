# Strapi CMS Setup for GhostMark Studio Storefront

This guide explains how to install Strapi locally (or use an existing instance), create the required content types, and connect the GhostMark Studio storefront to render CMS content on the homepage, About Us page, Customer Stories, and page banners.

Audience: Developers and content editors setting up CMS for the storefront.


## 1) Install and run Strapi locally

- Prerequisites: Node.js 18+, Yarn or npm
- Create a new Strapi project (SQLite is fine for local dev):

  - With npm: `npx create-strapi-app@latest gms-cms --quickstart`
  - With yarn: `yarn create strapi-app gms-cms --quickstart`

This starts Strapi at http://localhost:1337 and opens the admin to create your first admin user.


## 2) Create an API Token (for private content or convenience)

In Strapi Admin:
- Settings → API Tokens → Create new API token
- Type: Read-only
- Copy the token value for use in the storefront `.env.local` as `STRAPI_API_TOKEN`.

Notes:
- If you plan to make the relevant collection types public for read access, the token is optional. Keeping content protected and using a token is recommended.


## 3) Create the required content types

The storefront expects the following content types and fields. You can adjust names, but keep the field semantics.

Single type: homepage
- title (Text)
- subtitle (Text)
- description (Rich Text or Text)
- primaryCtaLabel (Text)
- secondaryCtaLabel (Text)
- heroImage (Media, Single)

Single type: about
- title (Text)
- content (Rich Text or Text)
- heroImage (Media, Single)

Collection type: customer-stories
- title (Text)
- excerpt (Text)
- slug (UID from field: title) — ensure it is unique
- content (Rich Text or Text)
- cover (Media, Single)
- publishedAt (Date, auto-managed by Strapi when publishing)

Collection type: banners
- title (Text)
- text (Text)
- placement (Text)
  - Supported placements used by the storefront:
    - `all-products`
    - `collection:{handle}` (e.g., `collection:t-shirts`)
- link (Text)
- backgroundColor (Text) — e.g., `#111827`
- image (Media, Single) — optional, not currently displayed in templates

After creating each type, click Save. When adding entries, click Publish so they are available to the storefront.


## 4) Public permissions (optional) or keep token-only access (recommended)

Option A — Token only (recommended):
- Do not enable public permissions. All requests from the storefront use the `Authorization: Bearer <STRAPI_API_TOKEN>` header if `STRAPI_API_TOKEN` is present.

Option B — Public read access:
- Settings → Users & Permissions Plugin → Roles → Public → Permissions
- Under your content types, enable find/findOne as needed (homepage, about, customer-stories, banners) and Save.
- In this case, you may omit the API token in the storefront.


## 5) Configure the storefront environment

Edit ghostmark-storefront/.env.local and set:

```
STRAPI_URL=http://localhost:1337
# Optional if content is public; recommended to keep content private and use a token
STRAPI_API_TOKEN=<your_strapi_readonly_api_token>
```

Notes:
- Rebuild or restart the Next.js dev server if needed so env vars take effect.


## 6) Allow Strapi media host in Next.js Image config (if needed)

If your Strapi serves images from a different host than the storefront already allows, add it to `next.config.js`:

```js
// ghostmark-storefront/next.config.js
module.exports = {
  images: {
    remotePatterns: [
      // Keep any existing patterns and add your Strapi host
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '1337',
        pathname: '/**',
      },
      // Or for production, your domain where Strapi media is served
      // { protocol: 'https', hostname: 'cms.example.com', pathname: '/**' }
    ],
  },
}
```


## 7) What the storefront renders from Strapi

The integration is optional and gracefully disabled if `STRAPI_URL` is not set.

- Homepage hero (optional)
  - Path: `src/app/[countryCode]/(main)/page.tsx`
  - Fetches: `GET /api/homepage?populate=heroImage`

- About Us page
  - Path: `src/app/[countryCode]/(main)/about/page.tsx`
  - Fetches: `GET /api/about?populate=heroImage`

- Customer Stories (list and detail)
  - List Path: `src/app/[countryCode]/(main)/customer-stories/page.tsx`
  - Fetches: `GET /api/customer-stories?populate=cover`
  - Detail Path: `src/app/[countryCode]/(main)/customer-stories/[slug]/page.tsx`
  - Fetches: `GET /api/customer-stories?filters[slug][$eq]=:slug&populate=cover`

- Banners on products listing pages
  - All Products page banner
    - Path: `src/modules/store/templates/index.tsx`
    - Fetches: `GET /api/banners?filters[placement][$eq]=all-products&populate=image`
  - Per-collection page banner
    - Path: `src/modules/collections/templates/index.tsx`
    - Fetches: `GET /api/banners?filters[placement][$eq]=collection:{handle}&populate=image`


## 8) Quick verification steps

1) Start Strapi (http://localhost:1337) and ensure you have the content types above.
2) Create and publish entries:
   - homepage single type with a title and hero image
   - about single type with title/content and optional image
   - a few customer-stories with cover images and slugs
   - a banners entry with placement `all-products` and some text
3) Set env vars in the storefront `.env.local` and run the storefront:
   - `cd ghostmark-storefront`
   - `yarn dev` (or `npm run dev`)
4) Visit:
   - `http://localhost:8000/[countryCode]` — homepage should show the CMS hero (if filled)
   - `http://localhost:8000/[countryCode]/about` — CMS About Us content
   - `http://localhost:8000/[countryCode]/customer-stories` — list page
   - `http://localhost:8000/[countryCode]/products` — All products page with optional banner


## 9) Example API calls (manual testing)

Replace `<TOKEN>` with your API token if required.

Homepage single type:
```
curl -s \
  -H 'Authorization: Bearer <TOKEN>' \
  http://localhost:1337/api/homepage?populate=heroImage | jq .
```

Customer stories list with cover:
```
curl -s \
  -H 'Authorization: Bearer <TOKEN>' \
  'http://localhost:1337/api/customer-stories?populate=cover' | jq .
```

Banner for all products page:
```
curl -s \
  -H 'Authorization: Bearer <TOKEN>' \
  'http://localhost:1337/api/banners?filters[placement][$eq]=all-products' | jq .
```


## 10) Troubleshooting

- 401 Unauthorized
  - Ensure the API token is valid and included as `Authorization: Bearer <token>`.
  - Or enable public read permissions for the content types in Strapi.

- 403/404 or empty data
  - Ensure entries are Published in Strapi (Draft & Publish system hides drafts from public APIs).
  - Verify the content-type uid and API endpoints match (`customer-stories` vs `customer-stories` spelling).

- CORS errors in browser devtools
  - Strapi v4 includes CORS config. If you proxied or changed domains, adjust Strapi’s CORS settings (config/middlewares.js) to allow your storefront origin, or run both on localhost for dev.

- Images don’t render
  - Add your Strapi media host to Next.js `images.remotePatterns` as shown earlier.

- CMS disabled unexpectedly
  - Check that `STRAPI_URL` is set in `.env.local`. Without it, the storefront intentionally skips CMS calls and renders safe fallbacks.


## Reference (Storefront implementation points)

- CMS client and types: `ghostmark-storefront/src/lib/strapi.ts`
- Homepage: `ghostmark-storefront/src/app/[countryCode]/(main)/page.tsx`
- About Us: `ghostmark-storefront/src/app/[countryCode]/(main)/about/page.tsx`
- Customer Stories (list): `ghostmark-storefront/src/app/[countryCode]/(main)/customer-stories/page.tsx`
- Customer Story (detail): `ghostmark-storefront/src/app/[countryCode]/(main)/customer-stories/[slug]/page.tsx`
- All Products banner: `ghostmark-storefront/src/modules/store/templates/index.tsx`
- Collection banner: `ghostmark-storefront/src/modules/collections/templates/index.tsx`
