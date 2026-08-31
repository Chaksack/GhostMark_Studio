import { defineMiddlewares } from "@medusajs/framework/http"

import {
  attachOrderAccessToken,
  requireOrderAccess,
} from "../utils/order-access"

/**
 * =============================================================================
 * Repo-level HTTP middleware registration.
 * =============================================================================
 *
 * This file did not exist before. It exists now because there is exactly one
 * class of problem it can solve and nothing else can: a defect in a CORE
 * Medusa route, which we do not own and must not patch in node_modules.
 *
 * WHAT MEDUSA DOES WITH THIS FILE
 * -------------------------------
 * `MiddlewareFileLoader` scans the api source dirs for `middlewares.ts` and
 * merges what it finds with the core middleware set
 * (@medusajs/framework/dist/http/router.js, #loadHttpResources). Two properties
 * of that merge drive everything below, and both were checked against the
 * installed 2.11.3 dist rather than taken from the documentation:
 *
 *   1. A repo middleware CANNOT REPLACE a core one. Entries are appended to the
 *      stack for a matching route, never substituted. So `requireOrderAccess`
 *      runs alongside the core `validateAndTransformQuery`, not instead of it,
 *      and it runs before the route handler. That is all we need - we are
 *      adding a gate, not changing how the route reads.
 *
 *   2. Because our middleware is appended, `req.query` may already have been
 *      replaced by the core query validator by the time we run. This is why the
 *      capability token travels in a REQUEST HEADER and not a query parameter:
 *      headers are never rewritten by any middleware in the chain, so the guard
 *      cannot be defeated - or accidentally blinded - by ordering.
 *
 * WHY THE FRAMEWORK'S OWN GUARD CANNOT BE USED HERE
 * -------------------------------------------------
 *   node_modules/@medusajs/framework/dist/http/router.js:93
 *     #applyAuthMiddleware(routesFinder, "/store", "customer",
 *                          ["bearer", "session"], { allowUnauthenticated: true })
 *
 * `allowUnauthenticated: true` is a hardcoded literal, and the `/store` prefix
 * is hardcoded too. No value in medusa-config.ts reaches either. The framework
 * decodes a customer session or bearer if one is present - which is what makes
 * `req.auth_context` available to our guard - and then deliberately declines to
 * enforce anything. Enforcement is ours to add.
 *
 * -----------------------------------------------------------------------------
 * SCOPE DISCIPLINE
 * -----------------------------------------------------------------------------
 * Two entries, both narrow, both method-pinned.
 *
 * `/store/orders/:id` matches the single retrieve route. Express path matching
 * is segment-exact, so it does NOT capture the transfer sub-routes
 * (`/store/orders/:id/transfer/accept` and friends), which upstream already
 * authenticates, nor the list route `/store/orders`, which upstream already
 * authenticates. Pinning `method: ["GET"]` keeps it that way even if a future
 * Medusa version adds a verb on the same path - a new POST would then be
 * ungated and visible in review here, rather than silently inheriting a guard
 * written for a read.
 *
 * `/store/carts/:id/complete` is only wrapped to append a field to the success
 * response. It adds no gate and can refuse nothing; see the comment on
 * `attachOrderAccessToken` for why a failure there is contained.
 *
 * ANYTHING ADDED TO THIS FILE IS GLOBAL AND EASY TO GET WRONG. A matcher that
 * is one wildcard too wide silently gates routes nobody intended, and the
 * symptom shows up as an unrelated page breaking. Keep entries method-pinned
 * and path-exact, and say in a comment why each one exists.
 */
export default defineMiddlewares({
  routes: [
    {
      // THE FIX. Upstream ships this route with no authentication at all -
      // dist/api/store/orders/[id]/route.js carries the upstream TODO admitting
      // it. Until this line existed, an order id plus the public publishable
      // key returned the customer's email, full name, delivery address and
      // order contents to anyone who asked.
      matcher: "/store/orders/:id",
      method: ["GET"],
      middlewares: [requireOrderAccess],
    },
    {
      // Mints the capability token that keeps the guest confirmation page
      // working after the gate above closes. Response-shaping only.
      matcher: "/store/carts/:id/complete",
      method: ["POST"],
      middlewares: [attachOrderAccessToken],
    },
  ],
})
