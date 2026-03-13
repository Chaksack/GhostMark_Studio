<p align="center">
  <a href="https://www.medusajs.com">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://user-images.githubusercontent.com/59018053/229103275-b5e482bb-4601-46e6-8142-244f531cebdb.svg">
    <source media="(prefers-color-scheme: light)" srcset="https://user-images.githubusercontent.com/59018053/229103726-e5b529a3-9b3f-4970-8a1f-c6af37f087bf.svg">
    <img alt="Medusa logo" src="https://user-images.githubusercontent.com/59018053/229103726-e5b529a3-9b3f-4970-8a1f-c6af37f087bf.svg">
    </picture>
  </a>
</p>

<h1 align="center">
  Medusa Next.js Starter Template
</h1>

<p align="center">
Combine Medusa's modules for your commerce backend with the newest Next.js 15 features for a performant storefront.</p>

<p align="center">
  <a href="https://github.com/medusajs/medusa/blob/master/CONTRIBUTING.md">
    <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat" alt="PRs welcome!" />
  </a>
  <a href="https://discord.gg/xpCwq3Kfn8">
    <img src="https://img.shields.io/badge/chat-on%20discord-7289DA.svg" alt="Discord Chat" />
  </a>
  <a href="https://twitter.com/intent/follow?screen_name=medusajs">
    <img src="https://img.shields.io/twitter/follow/medusajs.svg?label=Follow%20@medusajs" alt="Follow @medusajs" />
  </a>
</p>

### Prerequisites

To use the [Next.js Starter Template](https://medusajs.com/nextjs-commerce/), you should have a Medusa server running locally on port 9000.
For a quick setup, run:

```shell
npx create-medusa-app@latest
```

Check out [create-medusa-app docs](https://docs.medusajs.com/learn/installation) for more details and troubleshooting.

# Overview

The Medusa Next.js Starter is built with:

- [Next.js](https://nextjs.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Typescript](https://www.typescriptlang.org/)
- [Medusa](https://medusajs.com/)

Features include:

- Full ecommerce support:
  - Product Detail Page
  - Product Overview Page
  - Product Collections
  - Cart
  - Checkout with Stripe
  - User Accounts
  - Order Details
- Full Next.js 15 support:
  - App Router
  - Next fetching/caching
  - Server Components
  - Server Actions
  - Streaming
  - Static Pre-Rendering

  ## PWA and Push Notifications (Novu)

  This storefront includes minimal Progressive Web App (PWA) support and an in-app notifications bell powered by Novu.
  Notifications are triggered from the backend (Medusa server) and rendered in the client bell.

  ### What was added
  - Web App Manifest exposed at `/manifest.webmanifest` (via `app/manifest.ts`).
  - Basic Service Worker at `public/sw.js` and automatic client-side registration.
  - Novu Notification Center bell (renders only when env is configured).

  ### How to enable
  1. Ensure the app is served over HTTPS and a valid domain (required by PWA and Push APIs).
  2. Set the following environment variable(s) in `.env.local` for the storefront:

  ```
  NEXT_PUBLIC_NOVU_APP_ID=your_novu_application_identifier
  # Optional: Use a stable subscriber id if you have one; otherwise a UUID will be generated and stored in localStorage
  # NEXT_PUBLIC_NOVU_SUBSCRIBER_ID=customer-or-user-id
  ```

  3. In the Novu dashboard, configure your Notification Center and the Web Push provider(s) you plan to use. Follow Novu’s docs to set allowed origins to your domain.
  4. Deploy the site. On first load, the service worker will be registered automatically and the app will request Notification permission when appropriate.
  5. Backend-driven notifications (recommended): In the Medusa server (ghostmark), set these environment variables in `ghostmark/.env` and restart the server:

  ```
  NOVU_API_KEY=your_novu_api_key
  NOVU_APP_ID=your_novu_application_identifier
  # Optional: NOVU_API_URL=https://api.novu.co/v1
  ```

  With these set, the server will upsert Novu subscribers and trigger an in-app event (e.g., `order_placed`) when an order is created/updated. The storefront bell uses a stable subscriber id (customer.id when logged in; otherwise a generated UUID) to display the inbox.

  Notes:
  - The bell will only render when `NEXT_PUBLIC_NOVU_APP_ID` is available at runtime.
  - The current service worker is a minimal pass-through with notification click handling. You can extend it with caching strategies if needed.
  - Icons referenced in the manifest are already present under `public/`.
  - When backend Novu keys are configured, notifications are emitted from the server; the bell is only a UI widget to read them.

# Quickstart

### Setting up the environment variables

Navigate into your project's directory and prepare your environment variables by copying the template:

```shell
cd nextjs-starter-medusa/
mv .env.template .env.local
```

### Install dependencies

Use Yarn to install all dependencies.

```shell
yarn
```

### Start developing

You are now ready to start up your project.

```shell
yarn dev
```

### Open the code and start customizing

Your site is now running at http://localhost:8000!

# Payment integrations

By default this starter supports the following payment integrations

- [Stripe](https://stripe.com/)

To enable Stripe, set the appropriate variables in your `.env.local` file (see `.env.template` for a complete list):

```shell
# Client publishable key (native Stripe) OR Medusa Payments publishable key
NEXT_PUBLIC_STRIPE_KEY=pk_test_...
# or
NEXT_PUBLIC_MEDUSA_PAYMENTS_PUBLISHABLE_KEY=pk_test_...

# Optional but recommended when using the API route that creates Checkout Sessions
STRIPE_SECRET_KEY=sk_test_...
# or
MEDUSA_PAYMENTS_SECRET_KEY=sk_test_...

# Optional: Stripe connected account id if applicable
NEXT_PUBLIC_MEDUSA_PAYMENTS_ACCOUNT_ID=acct_...

# Optional: Use a pre-built Stripe Payment Link instead of programmatic sessions
# When set, the cart's "Go to checkout" button will open this link directly.
NEXT_PUBLIC_STRIPE_PAYMENT_LINK_URL=https://buy.stripe.com/test_...
```

Stripe flow priority in this starter:
- If NEXT_PUBLIC_STRIPE_PAYMENT_LINK_URL is set: redirect directly to that Payment Link.
- Else if publishable key(s) and server secret are set: create a Checkout Session via `/api/stripe/create-checkout-session` and redirect to Stripe Checkout.
- Else: fall back to the in-site checkout with Stripe Elements (requires publishable key) or other configured providers.

You'll also need to setup the integrations in your Medusa server. See the [Medusa documentation](https://docs.medusajs.com) for more information on how to configure [Stripe](https://docs.medusajs.com/resources/commerce-modules/payment/payment-provider/stripe#main).

# Resources

## Learn more about Medusa

- [Website](https://www.medusajs.com/)
- [GitHub](https://github.com/medusajs)
- [Documentation](https://docs.medusajs.com/)

## Learn more about Next.js

- [Website](https://nextjs.org/)
- [GitHub](https://github.com/vercel/next.js)
- [Documentation](https://nextjs.org/docs)
