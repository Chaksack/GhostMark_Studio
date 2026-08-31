import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { signPayload, verifyPayload, timingSafeEqualString } from "./secure-token"
import { checkRateLimits, getClientIp } from "./rate-limit"

/**
 * =============================================================================
 * Access control for `GET /store/orders/:id`.
 * =============================================================================
 *
 * THE DEFECT THIS CLOSES
 * ----------------------
 * Upstream Medusa ships this route with NO authentication. Verified in the
 * installed dist, not in the docs:
 *
 *   node_modules/@medusajs/medusa/dist/api/store/orders/middlewares.js
 *     matcher "/store/orders"      -> authenticate("customer", [...])
 *     matcher "/store/orders/:id"  -> validateAndTransformQuery ONLY
 *
 *   node_modules/@medusajs/medusa/dist/api/store/orders/[id]/route.js:5
 *     // TODO: Do we want to apply some sort of authentication here?
 *     //       My suggestion is that we do
 *
 * That upstream TODO is the whole bug. The only gate in front of the route was
 * the publishable key, which ships inside the storefront JavaScript bundle and
 * is public by design. Reproduced against the live server before this file
 * existed: a bare `curl -H "x-publishable-api-key: pk_…"` returned HTTP 200 and
 * 9905 bytes containing the customer's email address, full name, delivery
 * address, line items and total.
 *
 * WHY THIS IS NOT FIXABLE BY CONFIGURATION
 * ----------------------------------------
 * The framework's own guard is hardcoded and cannot be reached from
 * medusa-config.ts:
 *
 *   node_modules/@medusajs/framework/dist/http/router.js:93
 *     #applyAuthMiddleware(routesFinder, "/store", "customer",
 *                          ["bearer", "session"], { allowUnauthenticated: true })
 *
 * `allowUnauthenticated: true` is a literal in the framework source, not a
 * config value. There is no supported toggle. A repo-level middleware is the
 * only lever, which is why `src/api/middlewares.ts` now exists.
 *
 * -----------------------------------------------------------------------------
 * THE CONSTRAINT THAT SHAPES THE DESIGN
 * -----------------------------------------------------------------------------
 * `/order/confirmed/<GMS-ULID>` renders for a GUEST who has just paid and, by
 * definition, is not signed in and has no account. The naive fix - bolt
 * `authenticate("customer", …)` onto the route the way the list route does it -
 * silently breaks the single highest-consequence page on the site: the receipt
 * every customer sees the instant their money moves.
 *
 * So the requirement is not "authenticate". It is:
 *
 *     distinguish "the person who just placed this order"
 *     from        "anyone holding the id"
 *
 * TWO INDEPENDENT GRANTS, EITHER OF WHICH SUFFICES
 * ------------------------------------------------
 *
 *   GRANT A - ownership.  A signed-in customer whose `actor_id` equals the
 *             order's `customer_id`. This is the account path, and it is the
 *             one that makes "another customer's order" a 401 rather than a
 *             200.
 *
 *   GRANT B - capability. A short-lived HMAC-signed token, bound to exactly
 *             one order id, minted server-side at the moment the cart is
 *             completed and handed only to the caller who completed it.
 *
 * WHY A CAPABILITY TOKEN AND NOT THE ALTERNATIVES
 * -----------------------------------------------
 * Three other directions were considered and rejected:
 *
 *   1. "Session / cart-scoped access: the browser that owns the cart."
 *      The obvious version is to let the caller present the cart id and check
 *      the order-cart link. It fails on two counts. First, the storefront
 *      deliberately clears the cart cookie at completion (checkout.vue:
 *      `cartId.value = null`) so that a fresh cart is created on the next
 *      visit - so the proof is gone one tick after it would be needed.
 *      Second, and worse, it just swaps one permanent bearer secret (the order
 *      id) for another (the cart id) which never expires and which is ALSO in
 *      the browser's storage and every request log along the checkout path.
 *      That is not a fix, it is a rename.
 *
 *   2. "An HttpOnly cookie set at completion."
 *      Attractive, and wrong for this stack. The confirmation page fetches the
 *      order inside `useAsyncData`, which runs during Nuxt SSR - the request
 *      originates from the Nuxt server, not the browser, so no browser cookie
 *      is attached. Making it work would mean either forcing that page
 *      client-only (losing SSR on the receipt) or forwarding cookies through
 *      the SSR boundary, and cross-origin (:3000 -> :9000) it would additionally
 *      need `SameSite=None; Secure`, which does not hold on plain-HTTP local
 *      development. An explicit token has none of these failure modes because
 *      we pass it ourselves, on both the server and the client render.
 *
 *   3. "A mint endpoint the storefront calls after placing the order."
 *      Any endpoint that turns an order id into a token is exactly as open as
 *      the endpoint we are closing, unless it demands a second proof - at
 *      which point that second proof is the real credential and the token is
 *      decoration. Minting inside the completion response needs no new surface
 *      at all: possession of the cart id at the moment of completion IS the
 *      proof, it is already required to complete, and it is consumed in the
 *      same request.
 *
 * WHAT THE TOKEN IS NOT
 * ---------------------
 * It is signed, not encrypted (see `signPayload`). Anyone holding it can read
 * the order id inside it. That is fine - they already have the id, it is in the
 * URL next to the token. The token's job is to be UNFORGEABLE and to EXPIRE,
 * not to hide anything.
 *
 * It is also stateless, which means it cannot be revoked before `exp`. That is
 * the deliberate trade for not adding a table: the blast radius is bounded by
 * the TTL instead of by a revocation list. If revocation is ever needed, the
 * cheapest addition is a `jti` plus a small deny-set; the payload shape below
 * leaves room for it.
 *
 * WHY THE TOKEN IS BOUND TO ONE ORDER ID
 * --------------------------------------
 * `oid` is inside the MAC. A token minted for order A presented against order B
 * fails the `oid` comparison and is refused. Without that binding a single
 * leaked token would be a skeleton key for every order, which would be a
 * strictly worse bug than the one being fixed.
 *
 * `signPayload`'s `purpose` argument gives the second layer of separation: the
 * purpose string is mixed into the HMAC, so a newsletter confirmation token, a
 * review token and an order-access token can never be swapped for one another
 * even though all three are signed with the same key.
 *
 * WHY EVERY REFUSAL IS THE SAME 401
 * ---------------------------------
 * "Order does not exist" and "order exists but is not yours" are answered
 * identically, and neither answer requires a database lookup when no credential
 * was presented at all. Splitting them would build an existence oracle: an
 * attacker could distinguish a real order id from a fabricated one by the
 * status code alone, which is precisely the enumeration primitive the ULID id
 * space is supposed to deny them. Same reasoning as
 * `/account/orders/[id].vue`, which already collapses 400/401/403/404 into one
 * "this order isn't available to you" state - so no storefront error handling
 * has to change for this.
 *
 * ON RATE LIMITING - the reasoning, not just the decision
 * -------------------------------------------------------
 * The question worth asking is "what does an attacker get per request", and the
 * answer changed when this file landed.
 *
 * BEFORE: an order id alone returned the order. The only thing standing between
 * an attacker and a customer's home address was the id's entropy. A ULID is a
 * 48-bit millisecond timestamp plus 80 random bits; 2^80 is not searchable, so
 * enumeration was impractical - but it was the ONLY control, and "impractical
 * to guess" is a poor place to put an entire access-control story.
 *
 * AFTER: guessing an id buys nothing, because the id is no longer sufficient.
 * To get a 200 an attacker must forge a 256-bit HMAC or steal a customer JWT.
 * Neither is a brute-force target.
 *
 * So rate limiting here is NOT protecting a guessable secret. It is protecting
 * the SERVER, and that is a real and separate concern: the Grant A path costs
 * one indexed database round trip per request, and it is reachable by anyone
 * holding any valid customer JWT - i.e. anyone who can register an account.
 * Spraying ids through that path is a cheap way to make us do expensive work.
 * A limit is therefore warranted, and it is applied.
 *
 * TWO THINGS ABOUT THE SHAPE OF THAT LIMIT, both deliberate:
 *
 *   - It meters FAILURES ONLY. A customer refreshing their own confirmation
 *     page, or an impatient one hammering reload while waiting for a dispatch
 *     update, must never be throttled out of their own receipt. Successful
 *     requests do not touch the counter.
 *
 *   - It buckets on the CALLER (IP), NOT on the order id. This is the opposite
 *     choice from `RATE_LIMITS.SUPPORT_TICKET_READ_CASE`, and the difference
 *     matters. There, the bucket protects a low-entropy per-case secret, so
 *     metering guesses against that case is the point. Here, an order-id bucket
 *     would hand an attacker a denial-of-service against a specific victim:
 *     spray failures at one order id, burn its bucket, and the customer who
 *     actually owns it is locked out of their own confirmation page. Metering
 *     the caller cannot do that.
 *
 * The ceiling is stated below rather than in `RATE_LIMITS`, and that is an
 * exception to this repo's convention - see the comment on the constant.
 * -----------------------------------------------------------------------------
 */

/**
 * Domain separation tag mixed into the HMAC by signPayload/verifyPayload.
 * Changing this string invalidates every token in flight.
 */
export const ORDER_ACCESS_PURPOSE = "order_access"

/** Header the storefront presents the capability token in. */
export const ORDER_ACCESS_HEADER = "x-order-access-token"

/**
 * Default token lifetime: 7 days.
 *
 * The trade is between two real costs. Too short and a customer who bookmarks
 * their confirmation page - or opens it on their phone the next morning to
 * re-check the delivery address - is locked out of their own receipt with no
 * recovery path, because a guest has no account to sign into. Too long and a
 * link leaked by a shared screenshot, a forwarded message or a synced browser
 * history keeps disclosing a home address indefinitely.
 *
 * Seven days sits where it does because the DURABLE receipt is the confirmation
 * email, not this page. The page is a convenience with a bounded useful life:
 * it is read hard in the first hour, occasionally in the first few days, and
 * essentially never after that. Expiry is therefore a real control here rather
 * than a formality - it genuinely retires the capability while it still costs
 * nobody anything.
 *
 * A registered customer is unaffected either way: Grant A never expires.
 */
const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60

export function getOrderAccessTtlSeconds(): number {
  const raw = (process.env.ORDER_ACCESS_TOKEN_TTL_SECONDS ?? "").trim()
  if (!raw) {
    return DEFAULT_TTL_SECONDS
  }
  const parsed = Number(raw)
  // A misconfigured TTL must not silently become "forever" or "already
  // expired". Anything outside one minute to one year is treated as a typo and
  // the default is used instead.
  if (!Number.isFinite(parsed) || parsed < 60 || parsed > 365 * 24 * 60 * 60) {
    return DEFAULT_TTL_SECONDS
  }
  return Math.floor(parsed)
}

/**
 * Rate-limit policy for refused reads of `GET /store/orders/:id`.
 *
 * WHY THIS CONSTANT IS HERE AND NOT IN `RATE_LIMITS` (src/utils/rate-limit.ts).
 * That file's header states, correctly, that every ceiling should live in one
 * reviewable block, and this one breaks that rule. It does so because the lane
 * that owns this change was explicitly scoped out of editing rate-limit.ts.
 * This is a known, deliberate inconsistency and the follow-up is a one-line
 * move: add `ORDER_READ_REFUSED_IP` to `RATE_LIMITS` and import it here.
 *
 * 60 refused reads per 10 minutes per IP. Generous against a human (a
 * legitimate caller produces zero refusals - success is not metered) and tight
 * enough that scripted spraying through the database-touching branch is
 * pointless.
 */
const ORDER_READ_REFUSED_IP = { limit: 60, windowMs: 10 * 60_000 } as const

export type OrderAccessTokenPayload = {
  /** The one order id this token grants access to. */
  oid: string
  exp?: number
}

/**
 * Mint a capability token for exactly one order.
 *
 * Called only from the cart-completion response interceptor below, i.e. only
 * for a caller who has just proven possession of the cart id.
 */
export function mintOrderAccessToken(orderId: string): string {
  if (!orderId || typeof orderId !== "string") {
    throw new Error("mintOrderAccessToken: orderId is required")
  }
  return signPayload({ oid: orderId }, getOrderAccessTtlSeconds(), ORDER_ACCESS_PURPOSE)
}

export type TokenVerdict =
  | { ok: true }
  | { ok: false; reason: "absent" | "malformed" | "expired" | "wrong_order" | "invalid" }

/**
 * Verify a presented token against the order id being requested.
 *
 * `expired` is distinguished from `invalid` because it is the one failure a
 * legitimate customer can hit, and a caller may want to say "this link has
 * expired" rather than "not yours". It is deliberately NOT reflected to the
 * HTTP client - see the guard below.
 */
export function verifyOrderAccessToken(
  token: string | undefined | null,
  orderId: string
): TokenVerdict {
  if (!token) {
    return { ok: false, reason: "absent" }
  }

  const result = verifyPayload<OrderAccessTokenPayload>(token, ORDER_ACCESS_PURPOSE)
  if (!result.valid) {
    if (result.reason === "expired") {
      return { ok: false, reason: "expired" }
    }
    if (result.reason === "malformed") {
      return { ok: false, reason: "malformed" }
    }
    return { ok: false, reason: "invalid" }
  }

  const oid = result.payload?.oid
  if (typeof oid !== "string" || !oid) {
    return { ok: false, reason: "invalid" }
  }

  // Constant-time, for consistency with the rest of secure-token.ts. The order
  // id is not secret so this is belt-and-braces rather than load-bearing, but a
  // `===` here would be the one place in this codebase where a token component
  // is compared with an early-exit.
  if (!timingSafeEqualString(oid, orderId)) {
    return { ok: false, reason: "wrong_order" }
  }

  return { ok: true }
}

/** Pull the token out of the request header, tolerating array-valued headers. */
function readTokenHeader(req: MedusaRequest): string | null {
  const raw = (req.headers as Record<string, unknown>)[ORDER_ACCESS_HEADER]
  if (typeof raw === "string") {
    return raw.trim() || null
  }
  if (Array.isArray(raw) && typeof raw[0] === "string") {
    return raw[0].trim() || null
  }
  return null
}

/**
 * Look up the order's owner.
 *
 * Selects `customer_id` and nothing else: this runs before the route handler
 * and must not become a second, slower copy of the read it is guarding.
 */
async function getOrderCustomerId(
  req: MedusaRequest,
  orderId: string
): Promise<string | null> {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order",
    fields: ["id", "customer_id"],
    filters: { id: orderId },
  })
  const row = Array.isArray(data) ? data[0] : null
  const customerId = (row as { customer_id?: string } | null)?.customer_id
  return typeof customerId === "string" && customerId ? customerId : null
}

/**
 * The guard. Registered in src/api/middlewares.ts against
 * `GET /store/orders/:id`.
 *
 * ORDER OF CHECKS IS DELIBERATE, cheapest and least side-effecting first:
 *
 *   1. capability token  - pure HMAC, no I/O, no database
 *   2. customer ownership - one indexed lookup, only if a credential exists
 *   3. refuse
 *
 * The unauthenticated, tokenless caller - which is every attacker holding only
 * an order id, and was the entire bug - is refused at step 3 without the server
 * ever touching the database or learning whether the id is real.
 */
export async function requireOrderAccess(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
): Promise<void> {
  const orderId = String(req.params?.id ?? "")
  const logger = safeLogger(req)

  const refuse = (reason: string): void => {
    // Meter refusals only. See the header comment for why the bucket is the
    // caller and not the order.
    checkRateLimits([
      {
        name: "order_read_refused_ip",
        key: getClientIp(req),
        ...ORDER_READ_REFUSED_IP,
      },
    ])

    // The reason is logged, never returned. The body is byte-identical for
    // "no such order", "not yours", "expired link" and "forged token".
    logger?.debug?.(
      `[order-access] refused GET /store/orders/${orderId}: ${reason}`
    )
    res.status(401).json({
      type: "unauthorized",
      message:
        "You are not authorized to view this order. Sign in to the account that placed it, or open the link from your confirmation email.",
    })
  }

  if (!orderId) {
    refuse("no order id in path")
    return
  }

  // --- Grant B: capability token (no I/O) --------------------------------
  const token = readTokenHeader(req)
  if (token) {
    const verdict = verifyOrderAccessToken(token, orderId)
    if (verdict.ok) {
      next()
      return
    }
    // Fall through rather than refusing immediately: a signed-in customer whose
    // confirmation link has expired should still be served by Grant A.
    logger?.debug?.(`[order-access] token rejected (${verdict.reason})`)
  }

  // --- Grant A: authenticated customer owns the order --------------------
  // `auth_context` is populated by the framework's own store auth middleware,
  // which runs on every /store request with allowUnauthenticated:true - it
  // decodes a valid session or bearer and then declines to enforce anything.
  // We do the enforcing.
  const authContext = (req as unknown as { auth_context?: { actor_id?: string; actor_type?: string } })
    .auth_context

  if (authContext?.actor_id && authContext.actor_type === "customer") {
    let ownerId: string | null = null
    try {
      ownerId = await getOrderCustomerId(req, orderId)
    } catch (e) {
      // A lookup failure must not fail OPEN. Refuse and let the caller retry.
      logger?.error?.(
        `[order-access] owner lookup failed for ${orderId}: ${(e as Error)?.message}`
      )
      refuse("owner lookup threw")
      return
    }

    if (ownerId && timingSafeEqualString(ownerId, authContext.actor_id)) {
      next()
      return
    }

    refuse(
      ownerId
        ? "authenticated customer is not the owner"
        : "order not found or has no owner"
    )
    return
  }

  refuse(token ? "token present but not valid for this order" : "no credential presented")
}

/**
 * Mint-on-completion. Registered against `POST /store/carts/:id/complete`.
 *
 * WHY A RESPONSE INTERCEPTOR RATHER THAN A NEW ROUTE
 * --------------------------------------------------
 * The moment of cart completion is the only point in the system where the
 * server knows, from evidence it already required, that this caller is the
 * person placing this order. Possession of the cart id is that evidence, it is
 * mandatory to complete, and it is spent in the same request. Minting here adds
 * zero new attack surface. Any separate mint endpoint would have to re-establish
 * the same proof, and a mint endpoint that DIDN'T would simply be the original
 * vulnerability wearing a different path.
 *
 * WHY IT IS TOTALLY DEFENSIVE
 * ---------------------------
 * This wrapper sits in the response path of the request that takes the
 * customer's money. Under no circumstance may a defect in token minting turn a
 * successful payment into an error the customer sees. Every failure is caught,
 * logged, and the original response body is sent exactly as the core route
 * built it. The worst outcome of a bug here is a confirmation page that asks
 * the customer to use their email link - never a lost order.
 *
 * The upstream route replies with `{ type: "order", order }` on success and
 * `{ type: "cart", cart, error }` when payment finalisation fails
 * (dist/api/store/carts/[id]/complete/route.js). Only the former is augmented.
 */
export function attachOrderAccessToken(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
): void {
  const logger = safeLogger(req)
  const originalJson = res.json.bind(res)

  ;(res as unknown as { json: (body: unknown) => unknown }).json = (body: unknown) => {
    try {
      const payload = body as
        | { type?: string; order?: { id?: unknown } }
        | null
        | undefined

      if (
        payload &&
        payload.type === "order" &&
        typeof payload.order?.id === "string" &&
        payload.order.id
      ) {
        ;(payload as Record<string, unknown>).order_access_token =
          mintOrderAccessToken(payload.order.id)
        ;(payload as Record<string, unknown>).order_access_token_expires_in =
          getOrderAccessTtlSeconds()
      }
    } catch (e) {
      logger?.error?.(
        `[order-access] failed to mint access token on cart completion: ${
          (e as Error)?.message
        }`
      )
    }
    return originalJson(body as never)
  }

  next()
}

/**
 * The container logger, or null. Resolving must never be the thing that breaks
 * a request, and in unit tests there is no container at all.
 */
function safeLogger(req: MedusaRequest): {
  debug?: (m: string) => void
  error?: (m: string) => void
} | null {
  try {
    return req.scope.resolve(ContainerRegistrationKeys.LOGGER) as never
  } catch {
    return null
  }
}

export default {
  ORDER_ACCESS_PURPOSE,
  ORDER_ACCESS_HEADER,
  getOrderAccessTtlSeconds,
  mintOrderAccessToken,
  verifyOrderAccessToken,
  requireOrderAccess,
  attachOrderAccessToken,
}
