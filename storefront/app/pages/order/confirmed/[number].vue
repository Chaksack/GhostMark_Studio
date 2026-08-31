<script setup lang="ts">
import { computed, ref } from 'vue'
import { formatMoney as formatMoneyShared } from '~/utils/money'
import { parseOrderNumber, formatOrderNumber } from '~/utils/orderNumber'
import { inferCartMode, needsEProof } from '~/utils/cartMode'

/**
 * =============================================================================
 * /order/confirmed/<GMS-ULID> — the order confirmation page.
 * =============================================================================
 *
 * WHY THIS ROUTE EXISTS
 * ---------------------
 * The confirmation used to be step 3 of `checkout.vue`, rendered at /checkout
 * with the order held only in that component's memory. Four things were broken
 * by construction, and none of them could be fixed without an address:
 *
 *   refresh / back  — reloading /checkout after paying rebuilt a checkout for a
 *                     cart that had just been cleared. The customer's proof of
 *                     purchase was one keystroke from disappearing.
 *   shareable       — no URL meant nothing to bookmark, forward to a colleague
 *                     approving the spend, or paste into a support ticket.
 *   analytics       — a purchase event had no distinct page view to fire on.
 *   the email       — the confirmation email quotes GMS-<ULID>; there was no
 *                     page that number could point at.
 *
 * WHY THE URL IS THE GMS NUMBER, NOT THE RAW MEDUSA ID
 * ---------------------------------------------------
 * `GMS-01M1AAX…` is the string the customer already has: it is on their
 * confirmation email and it is what support asks for. Addressing the page by it
 * means the number they can read is the number that works. `parseOrderNumber`
 * converts it back to `order_<ULID>` for the API, and is strict about the shape
 * (26-char Crockford base32, case-insensitive) so a malformed segment is
 * rejected HERE and never becomes a lookup.
 *
 * ACCESS MODEL — read this before changing the fetch
 * -------------------------------------------------
 * THIS SECTION WAS REWRITTEN. What it used to say was true of stock Medusa and
 * is no longer true of this backend, and the old text was actively dangerous
 * because it described the open endpoint as the intended design.
 *
 * What stock Medusa 2.11.3 does (verified in the installed dist, not the docs —
 * dist/api/store/orders/middlewares.js and dist/api/store/orders/[id]/route.js):
 * `GET /store/orders/:id` has NO `authenticate` middleware; only the LIST route
 * `/store/orders` is authenticated. The upstream route file even carries the
 * admission `// TODO: Do we want to apply some sort of authentication here?`.
 * Reproduced live: a bare curl with only the publishable key returned HTTP 200
 * and the full order — email, full name, delivery address, items, total. The
 * publishable key is not a credential; it ships in this bundle.
 *
 * WE NOW GATE THAT ROUTE. ghostmark/src/api/middlewares.ts attaches a guard
 * that grants access on either of two proofs and refuses everything else with
 * a 401:
 *
 *   1. CAPABILITY TOKEN — a short-lived HMAC-signed value bound to exactly one
 *      order id, minted server-side at cart completion and handed only to the
 *      caller who completed the cart. It arrives here as `?t=` and is sent on
 *      as the `x-order-access-token` header. THIS IS THE GUEST PATH.
 *   2. OWNERSHIP — a signed-in customer whose id equals the order's
 *      `customer_id`. Registered customers need no `?t=` and are unaffected by
 *      its expiry.
 *
 * An order id ALONE is no longer sufficient for anything.
 *
 * The guest confirmation page therefore still works — that was the hard
 * constraint on the fix, because the customer who just paid is by definition
 * not signed in, and locking them out of their own receipt at the moment their
 * money moved would be worse in user-visible terms than the leak.
 *
 * The URL remains a CAPABILITY: whoever holds the full link, token included,
 * can read the order. The difference from before is that the capability now
 * EXPIRES (7 days by default) and cannot be reconstructed from the order number
 * that appears in the confirmation email, in support tickets and in the admin.
 *
 * Two consequences are handled below and must not be removed — they protected
 * the order number before and they protect the token now:
 *   - `robots: noindex, nofollow` — an order page must never enter an index.
 *   - `referrer: no-referrer` — without it the full URL, token included, leaks
 *     in the `Referer` header of every outbound request the page makes.
 *
 * We deliberately do NOT put this page behind a login. Requiring an account
 * would lock the guest who just paid out of their own receipt.
 *
 * FAILURE MODES — never 500, never accuse
 * --------------------------------------
 * Same split `/account/orders/[id]` settled on, and for the same reason: a slow
 * backend must not produce copy that implies the customer is snooping.
 *   unparseable id / 400 / 401 / 403 / 404 -> "we can't find that order"
 *   anything else                          -> ours, apologise, offer retry
 * Neither branch throws, so a direct visit with a junk id renders a calm page
 * rather than a 500, and reveals nothing about whether that id exists.
 *
 * LAYOUT — brand-owned, not marketplace
 * ------------------------------------
 * Order of blocks follows what brand-owned apparel retailers actually put on
 * this screen, in their order:
 *   lululemon        https://mobbin.com/screens/285e3ff0-991f-4814-a5d2-0bca8ac57e65
 *     "Thank you, Alex!" -> order number inline in the sentence -> "you'll
 *     receive a confirmation email at <address>" -> Shipping to + Estimated
 *     delivery date side by side -> items.
 *   Urban Outfitters https://mobbin.com/screens/86a8b314-cc77-4161-8c56-587670f48be9
 *     "Thank you for your order!" -> "Your order number is: … You will receive a
 *     confirmation email at <address>" -> order details -> Shipping to.
 *   Selfridges       https://mobbin.com/screens/e91ee10d-7445-4ca6-b672-980b6c14bc66
 *     fulfilment expectation and date FIRST, then items, then a totals ledger.
 *
 * The consistent shape across all three: reassure, then identify, then say what
 * happens next, and only then itemise. Money last, because the customer has
 * already decided.
 *
 * What we deliberately did NOT copy, on the brand-owned/marketplace distinction:
 *   Etsy   https://mobbin.com/screens/5a4d57ea-e2e9-48f0-934d-852f56562c51
 *     leads with seller attribution and closes with a "People also bought"
 *     carousel. Both are marketplace furniture — the seller block exists because
 *     Etsy is not the seller, and the carousel monetises a page where GhostMark
 *     has nothing left to sell. GhostMark IS the seller; a cross-sell here would
 *     compete with the one thing this page owes the customer, which is
 *     confidence that the order they just paid for is real.
 *   Shop   https://mobbin.com/screens/9c13ad3c-7e7e-49f3-b965-753181654da0
 *     surfaces the card brand and last four. Ours is a receipt, not a dispute
 *     record, and re-displaying payment instrument details buys nothing.
 *
 * The "what happens next" block is modelled on the staged-expectation pattern
 * Faire and Hims use, where the customer is told the sequence rather than left
 * to infer it:
 *   Faire  https://mobbin.com/screens/85a2767e-6b77-48e6-8834-d08490f9f882
 *   Hims   https://mobbin.com/screens/3d9577f9-38ae-4846-b599-f2886a5af6fc
 * It is the block that carries the POD e-proof promise, which is the single
 * most important sentence on this page for a print-on-demand order: without it
 * the customer expects a parcel and gets an email asking them to approve
 * artwork.
 */

const route = useRoute()
const sdk = useMedusaClient()

/** The raw URL segment, exactly as typed or navigated to. */
const rawNumber = computed(() => String(route.params.number ?? ''))

/**
 * Strict parse. `null` here means "this cannot be one of our order numbers",
 * and short-circuits the fetch entirely — a malformed segment never reaches the
 * backend.
 */
const internalId = computed(() => parseOrderNumber(rawNumber.value))

/** Canonical display form, so the page renders `GMS-…` even if the URL was lowercased. */
const displayNumber = computed(() => formatOrderNumber(internalId.value) ?? rawNumber.value)

/**
 * The capability token, carried as `?t=` on the URL.
 *
 * WHY IT IS IN THE URL RATHER THAN A COOKIE OR sessionStorage
 * ----------------------------------------------------------
 * This page is server-rendered. The fetch below runs inside `useAsyncData`,
 * which on first load executes on the NUXT SERVER, not in the browser — so a
 * browser cookie is not attached to it and `sessionStorage` does not exist for
 * it. The URL is the one carrier that is present identically on both the server
 * render and every subsequent client render, which means the page works on a
 * cold load, a refresh and a back-navigation with no special-casing.
 *
 * It also means the customer's own reload and bookmark keep working, which a
 * tab-scoped store would not survive.
 *
 * `?t=` is bound to this one order and expires (7 days by default, see
 * ghostmark/src/utils/order-access.ts). The `referrer: no-referrer` and
 * `noindex, nofollow` meta already set on this page were previously protecting
 * the order id; they now also protect the token, and must not be removed.
 */
const accessToken = computed(() => {
  const t = route.query.t
  if (typeof t === 'string') return t
  if (Array.isArray(t) && typeof t[0] === 'string') return t[0]
  return ''
})

const { data: order, pending, error, refresh } = await useAsyncData(
  () => `gms-confirmed-${internalId.value ?? 'invalid'}`,
  async () => {
    if (!internalId.value) return null
    // -----------------------------------------------------------------------
    // ACCESS: the third argument is request HEADERS.
    //
    // `GET /store/orders/:id` is no longer open. It grants access on either of
    // two proofs, and this page relies on the first:
    //
    //   - `x-order-access-token`  — the capability minted when this order was
    //     placed. This is the GUEST path, and it is the only one a customer
    //     with no account has.
    //   - a signed-in customer whose id matches the order's `customer_id`.
    //     A registered customer therefore still loads this page with no `?t=`
    //     at all, and keeps loading it after the token has expired.
    //
    // A HEADER, not a query parameter, deliberately: our guard is appended
    // after Medusa's core `validateAndTransformQuery` on this route, which
    // rewrites `req.query`. Headers are untouched by that, so the token cannot
    // be lost to middleware ordering.
    //
    // If both proofs are absent the backend answers 401, which `isUnavailable`
    // below already folds into the calm "we can't find that order" state — no
    // error handling changed for this.
    // -----------------------------------------------------------------------
    const res = await sdk.store.order.retrieve(
      internalId.value,
      {
        fields: '*items,*items.variant,*items.variant.product,*items.variant.product.type,*shipping_address,*shipping_methods',
      },
      accessToken.value ? { 'x-order-access-token': accessToken.value } : undefined,
    )
    return res.order as any
  },
  // The token is NOT part of the cache key: a key is serialised into the SSR
  // payload, and there is no reason to write the token into the HTML a second
  // time. It is watched so that arriving with a fresh token refetches.
  { watch: [internalId, accessToken] },
)

/**
 * Medusa's FetchError carries the HTTP status on `.status`; `useAsyncData` may
 * wrap it, so check the cause too before deciding whose fault this is.
 */
const errorStatus = computed<number | null>(() => {
  const e = error.value as (Error & { status?: number, statusCode?: number, cause?: unknown }) | null
  if (!e) return null
  const cause = e.cause as { status?: number, statusCode?: number } | undefined
  const code = e.status ?? e.statusCode ?? cause?.status ?? cause?.statusCode
  return typeof code === 'number' ? code : null
})

/** Bad id, deleted order, someone else's order — indistinguishable, deliberately. */
const isUnavailable = computed(() => {
  if (!internalId.value) return true
  if (error.value) return [400, 401, 403, 404].includes(errorStatus.value ?? 0)
  return !pending.value && !order.value
})

/** Everything else that failed: ours, and probably transient. */
const isOurFault = computed(() => Boolean(error.value) && !isUnavailable.value)

const retrying = ref(false)
const onRetry = async () => {
  if (retrying.value) return
  retrying.value = true
  try { await refresh() }
  finally { retrying.value = false }
}

// ---------------------------------------------------------------------------
// Derived view data
// ---------------------------------------------------------------------------

const currency = computed(() => (order.value?.currency_code || 'gbp') as string)
const formatMoney = (amount?: number | null) =>
  formatMoneyShared({ amount, currency_code: currency.value })

const items = computed<any[]>(() => (Array.isArray(order.value?.items) ? order.value.items : []))

/** First name only, matching lululemon's "Thank you, Alex!". Falls back cleanly. */
const firstName = computed(() => {
  const n = order.value?.shipping_address?.first_name
  return typeof n === 'string' && n.trim() ? n.trim() : null
})

const orderDate = computed(() => {
  const iso = order.value?.created_at
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  // en-GB, matching /account/orders and /account/orders/[id].
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(d)
})

/**
 * POD vs apparel drives the whole "what happens next" section. Routed through
 * the shared `~/utils/cartMode` inference rather than a local heuristic, so this
 * page can never disagree with the cart, the checkout summary or the mixed-mode
 * banner about what kind of order this is.
 */
const mode = computed(() => inferCartMode(items.value))
const hasProofItems = computed(() => items.value.some(needsEProof) || mode.value === 'pod' || mode.value === 'mixed')

const deliveryEstimate = computed(() => {
  switch (mode.value) {
    case 'apparel': return '2-5 business days'
    case 'pod': return '3-5 weeks (48h e-proof + 2-4 weeks production)'
    case 'mixed': return 'Two delivery tracks — apparel ships first'
    default: return ''
  }
})

/**
 * The steps, in order, as the customer will actually experience them. POD adds
 * the e-proof gate in the middle, which is the step that surprises people.
 */
const nextSteps = computed(() => {
  const steps: { title: string, body: string }[] = [
    {
      title: 'Confirmation email',
      body: order.value?.email
        ? `On its way to ${order.value.email} with this order number on it.`
        : 'On its way, with this order number on it.',
    },
  ]
  if (hasProofItems.value) {
    steps.push({
      title: 'Your e-proof, within 48 hours',
      body: 'We set your artwork on the product and email you a proof. Nothing is printed until you approve it, and you can ask for changes.',
    })
    steps.push({
      title: 'Production, 2-4 weeks',
      body: 'Starts the day you approve the proof — not before.',
    })
  }
  steps.push({
    title: 'Dispatch',
    body: mode.value === 'mixed'
      ? 'Your ready-to-wear items ship straight away; printed items follow once approved and made.'
      : 'We email tracking as soon as it leaves us.',
  })
  return steps
})

useHead({
  // No " · GhostMark Studio" suffix here: app.vue's `titleTemplate` already
  // appends " · GhostMark", and adding our own produced
  // "Order GMS-… · GhostMark Studio · GhostMark" in the tab. The order number is
  // the useful half — it is what makes this tab findable among twenty others.
  title: () => `Order ${displayNumber.value}`,
  meta: [
    // An order page must never be indexed, and the URL is a capability, so it
    // must not ride out in a Referer header either. Both are load-bearing.
    { name: 'robots', content: 'noindex, nofollow' },
    { name: 'referrer', content: 'no-referrer' },
  ],
})
</script>

<template>
  <div class="bg-cream-tile min-h-screen">
    <!--
      Step indicator, carried over from checkout.vue so the customer lands on a
      page that visibly continues the flow they were in rather than a page that
      looks like somewhere else. Step 4 is now genuinely a page, so the four
      steps are four addresses for the first time.
    -->
    <div class="border-b border-ink-200 bg-white">
      <div class="mx-auto flex w-full max-w-rail flex-wrap items-center justify-center gap-x-6 gap-y-2 px-gutter py-4 sm:gap-x-10">
        <span class="gm-spec flex items-center gap-2 text-ink-600">
          <span class="flex h-6 w-6 items-center justify-center rounded-full border border-ink-400 gm-spec !text-[12px] font-bold">1</span>
          Cart
        </span>
        <span class="h-px w-6 bg-ink-300" />
        <span class="gm-spec flex items-center gap-2 text-ink-600">
          <span class="flex h-6 w-6 items-center justify-center rounded-full border border-ink-400 gm-spec !text-[12px] font-bold">2</span>
          Shipping
        </span>
        <span class="h-px w-6 bg-ink-300" />
        <span class="gm-spec flex items-center gap-2 text-ink-600">
          <span class="flex h-6 w-6 items-center justify-center rounded-full border border-ink-400 gm-spec !text-[12px] font-bold">3</span>
          Payment
        </span>
        <span class="h-px w-6 bg-ink-300" />
        <span class="gm-spec flex items-center gap-2 font-semibold text-ink-950">
          <span class="flex h-6 w-6 items-center justify-center rounded-full bg-ink-950 gm-spec !text-[12px] font-bold text-white">4</span>
          Confirmation
        </span>
      </div>
    </div>

    <div class="mx-auto w-full max-w-rail px-gutter py-10">
      <!-- 1 of 4: loading ------------------------------------------------ -->
      <div v-if="pending" role="status" class="flex items-center justify-center gap-3 py-20 text-[14px] text-ink-600">
        <UiSpinner :size="16" />
        <span>Loading your order&hellip;</span>
      </div>

      <!--
        2 of 4: not available. Covers a junk URL, a deleted order and someone
        else's order, all indistinguishable from here and deliberately kept that
        way — telling the visitor which one it is only helps someone probing.
        Note what this does NOT do: it does not accuse, and it does not 500.
      -->
      <div v-else-if="isUnavailable" class="mx-auto max-w-[560px] py-16 text-center">
        <h1 class="font-serif text-[28px] font-semibold text-ink-950">We can&rsquo;t find that order</h1>
        <p class="mt-3 text-[15px] leading-[1.6] text-ink-700">
          The link may be incomplete, or the order may have been removed. If you have just paid,
          check your confirmation email — it carries the order number and a link straight back here.
        </p>
        <div class="mt-8 flex flex-wrap items-center justify-center gap-3">
          <NuxtLink to="/account/orders" class="inline-flex h-[48px] items-center justify-center bg-ink-950 px-7 text-[14px] font-medium tracking-wide text-white hover:bg-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-cream-tile">
            Find it in your account
          </NuxtLink>
          <NuxtLink to="/contact" class="inline-flex h-[48px] items-center justify-center border border-ink-400 bg-white px-6 text-[14px] text-ink-700 hover:bg-cream-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-cream-tile">
            Contact us
          </NuxtLink>
        </div>
      </div>

      <!--
        3 of 4: our fault. Split out from the branch above so a timeout can
        never render "we can't find that order" at someone whose order is fine.
      -->
      <div v-else-if="isOurFault" class="mx-auto max-w-[560px] py-16 text-center">
        <h1 class="font-serif text-[28px] font-semibold text-ink-950">We couldn&rsquo;t load your order</h1>
        <p role="alert" class="mt-3 text-[15px] leading-[1.6] text-ink-700">
          This is on us, not you. <strong class="font-medium text-ink-950">Your order went through</strong> — we
          just couldn&rsquo;t fetch it to show you. Your confirmation email is still on its way.
        </p>
        <div class="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            class="inline-flex h-[48px] items-center justify-center gap-2 bg-ink-950 px-7 text-[14px] font-medium tracking-wide text-white hover:bg-ink-800 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-cream-tile"
            :disabled="retrying"
            @click="onRetry"
          >
            <UiSpinner v-if="retrying" :size="16" />
            {{ retrying ? 'Trying again…' : 'Try again' }}
          </button>
          <NuxtLink to="/contact" class="inline-flex h-[48px] items-center justify-center border border-ink-400 bg-white px-6 text-[14px] text-ink-700 hover:bg-cream-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-cream-tile">
            Contact us
          </NuxtLink>
        </div>
      </div>

      <!-- 4 of 4: the confirmation ---------------------------------------- -->
      <div v-else>
        <!--
          REASSURE. Success mark + personalised thanks, then the order number in
          the sentence rather than as a lonely "Order ID:" row — lululemon's
          construction, and it reads as a fact about their order instead of a
          database field.
        -->
        <div class="flex flex-col items-center text-center">
          <svg class="h-14 w-14 text-semantic-success-solid" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <h1 class="mt-5 font-serif text-[32px] font-semibold text-ink-950">
            {{ firstName ? `Thank you, ${firstName}!` : 'Thank you!' }}
          </h1>
          <p class="mt-3 max-w-[620px] text-[15px] leading-[1.6] text-ink-700">
            Your GhostMark order
            <!--
              `select-all` so one click grabs the whole number: this is the
              string the customer will paste into a support email, and hand-
              selecting 30 characters of base32 is a genuinely annoying thing to
              ask of someone. `gm-spec` because an order number is metadata, and
              the mono face makes O/0 and I/1 distinguishable when read aloud.
            -->
            <strong class="gm-spec select-all font-semibold text-ink-950">{{ displayNumber }}</strong>
            has been placed.
          </p>
          <p v-if="orderDate" class="mt-1 text-[13px] text-ink-600">Placed {{ orderDate }}</p>
        </div>

        <div class="mt-10 grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
          <div>
            <!--
              WHAT HAPPENS NEXT. Deliberately above the itemisation: the customer
              has just paid and their actual question is "and now?", not "what
              did I buy?". For a POD order this block carries the e-proof gate,
              which is the difference between a customer who waits for an email
              and a customer who waits for a parcel that is not coming yet.
            -->
            <section aria-labelledby="next-heading" class="rounded-2xl border border-ink-200 bg-white p-6">
              <h2 id="next-heading" class="text-[18px] font-semibold text-ink-950">What happens next</h2>
              <ol class="mt-5 space-y-5">
                <li v-for="(s, i) in nextSteps" :key="s.title" class="flex gap-4">
                  <span class="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-ink-300 gm-spec !text-[12px] font-bold text-ink-700" aria-hidden="true">{{ i + 1 }}</span>
                  <span class="flex-1">
                    <span class="block text-[14px] font-medium text-ink-950">{{ s.title }}</span>
                    <span class="mt-0.5 block text-[13px] leading-[1.55] text-ink-600">{{ s.body }}</span>
                  </span>
                </li>
              </ol>
            </section>

            <!-- WHAT WAS ORDERED -->
            <section aria-labelledby="items-heading" class="mt-6 rounded-2xl border border-ink-200 bg-white p-6">
              <h2 id="items-heading" class="text-[18px] font-semibold text-ink-950">What you ordered</h2>
              <ul v-if="items.length" class="mt-4 divide-y divide-ink-100">
                <li v-for="item in items" :key="item.id" class="flex gap-4 py-4">
                  <div class="h-[64px] w-[64px] flex-shrink-0 overflow-hidden rounded-lg bg-ink-100">
                    <img v-if="item.thumbnail" class="h-full w-full object-cover" :src="item.thumbnail" :alt="item.title" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="text-[14px] font-medium text-ink-950">{{ item.title }}</div>
                    <div v-if="item.variant_title" class="text-[13px] text-ink-600">{{ item.variant_title }}</div>
                    <div class="mt-0.5 text-[13px] text-ink-600">Qty: {{ item.quantity }}</div>
                    <!--
                      Per-line proof marker. On a mixed cart the customer needs
                      to know WHICH lines are waiting on them, not just that some
                      are — the aggregate sentence above cannot say that.
                    -->
                    <span v-if="needsEProof(item)" class="mt-1.5 inline-flex items-center gap-1.5 text-[12px] text-ink-700">
                      <span class="h-1.5 w-1.5 rounded-full bg-semantic-success-solid" aria-hidden="true" />
                      E-proof to follow within 48 hours
                    </span>
                  </div>
                  <div class="text-[14px] font-medium text-ink-950">{{ formatMoney(item.total) }}</div>
                </li>
              </ul>
              <p v-else class="mt-4 text-[14px] text-ink-600">No items are listed against this order.</p>
            </section>
          </div>

          <!-- Aside: delivery address, estimate, totals -->
          <aside class="space-y-6">
            <section v-if="order.shipping_address" aria-labelledby="ship-heading" class="rounded-2xl border border-ink-200 bg-white p-6">
              <h2 id="ship-heading" class="text-[18px] font-semibold text-ink-950">Delivering to</h2>
              <address class="mt-3 space-y-1 text-[14px] not-italic leading-[1.55] text-ink-700">
                <p class="text-ink-950">{{ order.shipping_address.first_name }} {{ order.shipping_address.last_name }}</p>
                <p v-if="order.shipping_address.company">{{ order.shipping_address.company }}</p>
                <p v-if="order.shipping_address.address_1">{{ order.shipping_address.address_1 }}</p>
                <p v-if="order.shipping_address.address_2">{{ order.shipping_address.address_2 }}</p>
                <p>{{ order.shipping_address.postal_code }} {{ order.shipping_address.city }}</p>
                <p v-if="order.shipping_address.province">{{ order.shipping_address.province }}</p>
                <p v-if="order.shipping_address.country_code">{{ order.shipping_address.country_code.toUpperCase() }}</p>
              </address>
              <div v-if="deliveryEstimate" class="mt-4 border-t border-ink-200 pt-4">
                <span class="gm-spec block !text-[12px] uppercase text-ink-600">Estimated delivery</span>
                <span class="mt-1 block text-[14px] text-ink-950">{{ deliveryEstimate }}</span>
              </div>
            </section>

            <section aria-labelledby="totals-heading" class="rounded-2xl border border-ink-200 bg-white p-6">
              <h2 id="totals-heading" class="text-[18px] font-semibold text-ink-950">Order total</h2>
              <dl class="mt-4 space-y-2 text-[14px]">
                <div class="flex items-baseline justify-between">
                  <dt class="text-ink-600">Subtotal</dt>
                  <dd class="text-ink-950">{{ formatMoney(order.item_subtotal ?? order.subtotal) }}</dd>
                </div>
                <div class="flex items-baseline justify-between">
                  <dt class="text-ink-600">Shipping</dt>
                  <dd class="text-ink-950">{{ formatMoney(order.shipping_total) }}</dd>
                </div>
                <div v-if="order.discount_total" class="flex items-baseline justify-between">
                  <dt class="text-ink-600">Discount</dt>
                  <dd class="text-ink-950">&minus;{{ formatMoney(order.discount_total) }}</dd>
                </div>
                <div class="flex items-baseline justify-between">
                  <dt class="text-ink-600">Tax</dt>
                  <dd class="text-ink-950">{{ formatMoney(order.tax_total) }}</dd>
                </div>
              </dl>
              <div class="mt-3 flex items-baseline justify-between border-t border-ink-200 pt-3">
                <span class="text-[16px] font-semibold text-ink-950">Total</span>
                <span class="text-[18px] font-bold text-ink-950">{{ formatMoney(order.total) }}</span>
              </div>
            </section>

            <div class="flex flex-col gap-3">
              <NuxtLink to="/products" class="inline-flex h-[48px] items-center justify-center bg-ink-950 px-7 text-[14px] font-medium tracking-wide text-white hover:bg-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-cream-tile">
                Continue shopping
              </NuxtLink>
              <NuxtLink to="/contact" class="inline-flex h-[48px] items-center justify-center border border-ink-400 bg-white px-6 text-[14px] text-ink-700 hover:bg-cream-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-cream-tile">
                Question about this order?
              </NuxtLink>
            </div>
          </aside>
        </div>
      </div>
    </div>
  </div>
</template>
