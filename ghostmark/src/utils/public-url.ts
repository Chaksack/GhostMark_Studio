/**
 * Public base URL resolution.
 *
 * These were duplicated inline in several routes, which meant a deployment
 * could resolve one link against the storefront and another against localhost
 * depending on which copy a route happened to use. One implementation.
 */

/** Public storefront origin, for customer-facing links and image assets. */
export function resolveStorefrontBase(): string {
  return (
    process.env.STOREFRONT_PUBLIC_URL ||
    process.env.NEXT_PUBLIC_STOREFRONT_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    process.env.FRONTEND_URL ||
    "http://localhost:8000"
  ).replace(/\/$/, "")
}

/** This backend's own origin, for links that are served by an API route. */
export function resolveBackendBase(): string {
  return (
    process.env.MEDUSA_BACKEND_URL ||
    process.env.BACKEND_URL ||
    process.env.ADMIN_PUBLIC_URL ||
    "http://localhost:9000"
  ).replace(/\/$/, "")
}

export default { resolveStorefrontBase, resolveBackendBase }
