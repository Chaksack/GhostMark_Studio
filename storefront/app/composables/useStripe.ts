import type { Stripe } from '@stripe/stripe-js'

/**
 * Phase 7 — Stripe.js loader composable.
 *
 * Why raw @stripe/stripe-js (no Vue wrapper)?
 *  - The Medusa V2 Stripe provider returns a `client_secret` from
 *    `initiatePaymentSession`, which we use directly with
 *    `stripe.confirmCardPayment(client_secret, { payment_method: { card } })`.
 *  - The popular `vue-stripe-js` wrapper is built around the Payment Element
 *    + `confirmPayment({ elements, clientSecret, confirmParams: { return_url } })`
 *    flow, which redirects the customer to a `return_url` for 3DS / off-session
 *    methods. That doesn't fit our single-page checkout.complete() handoff.
 *  - Manual mount + `confirmCardPayment` keeps the lifecycle in our hands and
 *    plays nicely with Headless UI + the existing checkout step machine.
 *
 * Singleton promise: `loadStripe()` injects the Stripe.js <script> on first
 * call and is idempotent on subsequent calls — but we still memoize the
 * promise here so SSR / multiple component mounts don't race.
 *
 * Configured-off contract: when `stripePublishableKey` is empty (e.g. local
 * dev with no .env), the composable returns a resolved-null promise and
 * `isConfigured: false`. Callers MUST honor `isConfigured` and render a
 * "Payment not configured" message instead of trying to `.elements()` on null.
 */

let stripePromise: Promise<Stripe | null> | null = null

export function useStripe() {
  const config = useRuntimeConfig()
  const publishableKey = (config.public.stripePublishableKey as string | undefined) ?? ''
  const isConfigured = Boolean(publishableKey)

  if (isConfigured && !stripePromise && import.meta.client) {
    // Dynamic import keeps Stripe.js out of the SSR bundle and out of the
    // initial JS payload when the user never reaches checkout.
    stripePromise = import('@stripe/stripe-js').then(({ loadStripe }) =>
      loadStripe(publishableKey),
    )
  }

  return {
    stripePromise: stripePromise ?? Promise.resolve<Stripe | null>(null),
    isConfigured,
    publishableKey,
  }
}
