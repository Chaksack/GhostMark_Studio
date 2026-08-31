/**
 * Shared constants for the newsletter double opt-in flow.
 *
 * These live outside src/api because Medusa's route loader only treats files
 * named `route.ts` as routes (verified in
 * node_modules/@medusajs/framework/dist/http/routes-loader.js:77), and having
 * one route module import another to share a constant is a needless coupling.
 */

/**
 * Domain separation tag for the confirmation token.
 *
 * signPayload mixes this into the MAC, so a token minted for the newsletter
 * cannot be replayed against any other signed-token flow that shares the same
 * signing key, and vice versa. Without it, a token minted anywhere in the app
 * would verify everywhere in the app.
 */
export const NEWSLETTER_CONFIRM_PURPOSE = "newsletter-confirm"

/** Confirmation links expire in 24 hours. Long enough for a real person. */
export const NEWSLETTER_CONFIRM_TTL_SECONDS = 24 * 60 * 60

export default { NEWSLETTER_CONFIRM_PURPOSE, NEWSLETTER_CONFIRM_TTL_SECONDS }
