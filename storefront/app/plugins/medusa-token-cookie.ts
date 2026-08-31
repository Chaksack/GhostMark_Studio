/**
 * medusa-token-cookie: persist the Medusa JWT across hard reloads.
 *
 * Background
 * ----------
 * `nuxt.config.ts` configures the SDK with `jwtTokenStorageMethod: 'memory'`,
 * which stores the token on the in-memory `Client.token` field. That works
 * for SPA navigation but is wiped on a hard reload, leaving the auth
 * middleware to redirect every authenticated user back to /account/login on
 * any refresh.
 *
 * Why not `jwtTokenStorageMethod: 'local'`?
 *   - localStorage is unavailable during SSR, so the SDK throws on import.
 *   - localStorage is not sent on the SSR pre-render request, so the
 *     middleware (which can run server-side) wouldn't see the token anyway.
 *   - It's also the standard XSS exfiltration sink that the security team
 *     wants out of the bundle.
 *
 * Why not configure `auth.storage` directly in nuxt.config?
 *   - `@nuxtjs/medusa` 1.2.0 forwards the entire `medusa` block through
 *     `runtimeConfig.public`, which is JSON-serialised at build time.
 *     Functions on `storage` would silently disappear, so the SDK would
 *     fall through to `nostore` and never persist anything.
 *   - `useCookie()` is only callable inside a Nuxt setup context, so we
 *     can't construct the adapter at module-config time.
 *
 * Solution
 * --------
 * Run `enforce: 'post'` so the @nuxtjs/medusa plugin has already created
 * the SDK instance, then:
 *   1. Hydrate the in-memory token from the `gms_auth_token` cookie if
 *      one exists (rehydration after reload / first SSR render).
 *   2. Wrap `client.setToken` so every subsequent token write (login,
 *      register, refresh) also persists to the cookie.
 *   3. Wrap `client.clearToken` so logout also wipes the cookie.
 *
 * The cookie is set with `sameSite: 'lax'` (CSRF-resistant for top-level
 * GETs), `secure` in production (HTTPS-only), and a 30-day max age.
 * `httpOnly` is intentionally NOT set: the Medusa SDK reads the JWT from
 * client-side state to attach the bearer header, so the token must be
 * readable from JavaScript. XSS defence is delegated to CSP `script-src`
 * in nuxt.config.ts.
 */
export default defineNuxtPlugin({
  name: 'medusa-token-cookie',
  enforce: 'post',
  setup() {
    const sdk = useMedusaClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = (sdk as any).client
    if (!client || typeof client.setToken !== 'function') {
      // Defensive: if the SDK shape ever changes, fail loudly in dev but
      // don't break boot in prod.
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[medusa-token-cookie] SDK client missing setToken; cookie persistence disabled')
      }
      return
    }

    const cookie = useCookie<string | null>('gms_auth_token', {
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    })

    // 1. Rehydrate on boot. The SDK's getToken() will short-circuit to the
    //    in-memory token, so we push the cookie value into it via setToken.
    if (cookie.value) {
      // Fire-and-forget: setToken returns a Promise but in `memory` mode it
      // is synchronous internally.
      void client.setToken(cookie.value)
    }

    // 2. Wrap setToken so login / register / refresh persist to the cookie.
    const originalSetToken = client.setToken.bind(client)
    client.setToken = async (token: string): Promise<void> => {
      await originalSetToken(token)
      cookie.value = token || null
    }

    // 3. Wrap clearToken so logout wipes the cookie.
    const originalClearToken = client.clearToken.bind(client)
    client.clearToken = async (): Promise<void> => {
      await originalClearToken()
      cookie.value = null
    }
  },
})
