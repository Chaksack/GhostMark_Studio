// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any

// The cookie name MUST match nuxt.config.ts `medusa.auth.jwtTokenStorageKey`
// and the readers in app/middleware/auth.ts + app/plugins/medusa-token-cookie.ts.
const AUTH_COOKIE_NAME = 'gms_auth_token'
const AUTH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30 // 30 days, matches plugin

export const useCustomer = () => {
  const customer = useState<any | null>('gms_customer', () => null)
  const isLoading = useState<boolean>('gms_customer_loading', () => false)
  const sdk = useMedusaClient()
  const cartState = useCart()

  // ──────────────────────────────────────────────────────────────────────
  // Synchronous cookie persistence.
  //
  // The companion plugin (app/plugins/medusa-token-cookie.ts) wraps
  // `client.setToken` and pipes the value through Nuxt's `useCookie` ref.
  // That works for SSR rehydration, but on the client the cookie ref's
  // `value = token` write is batched through Vue's reactivity scheduler
  // (async watch, default `flush: 'pre'`). The watch callback is the only
  // thing that actually mutates `document.cookie`.
  //
  // In the AuthModal login flow we do:
  //   await sdk.auth.login(...)        // SDK calls (wrapped) client.setToken
  //   await persistToken(token)        // belt-and-braces; same wrap path
  //   await refresh()                  // creates a NEW useCookie ref and reads
  //                                    // `document.cookie` to decide whether
  //                                    // to round-trip /store/customers/me
  // The microtask ordering between Vue's effect scheduler and the awaited
  // continuations is not deterministic enough to guarantee `document.cookie`
  // is materialised before `refresh()` reads it back. When it isn't,
  // `refresh()` short-circuits, customer stays null, the modal closes, and
  // the next navigation to /account sees an empty cookie -> bounce to login.
  //
  // Fix: bypass Vue's reactive write path on the client and mutate
  // `document.cookie` synchronously. The plugin's wrapped setToken still
  // runs and keeps the useCookie ref in sync for any reactive consumers.
  // On SSR (no `document`) we fall back to the useCookie ref, which is the
  // correct surface for setting `Set-Cookie` response headers.
  const writeAuthCookie = (token: string): void => {
    if (import.meta.client && typeof document !== 'undefined') {
      const isHttps = window.location.protocol === 'https:'
      // Synchronous write: visible to the very next `document.cookie` read.
      const parts = [
        `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}`,
        'Path=/',
        `Max-Age=${AUTH_COOKIE_MAX_AGE_SECONDS}`,
        'SameSite=Lax',
      ]
      if (isHttps) parts.push('Secure')
      document.cookie = parts.join('; ')
      return
    }
    // SSR path: nuxt's useCookie ref maps onto the Set-Cookie response header.
    const ref = useCookie<string | null>(AUTH_COOKIE_NAME, {
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: AUTH_COOKIE_MAX_AGE_SECONDS,
      path: '/',
    })
    ref.value = token
  }

  const clearAuthCookie = (): void => {
    if (import.meta.client && typeof document !== 'undefined') {
      // Max-Age=0 evicts the cookie atomically.
      document.cookie = `${AUTH_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`
      return
    }
    const ref = useCookie<string | null>(AUTH_COOKIE_NAME, { path: '/' })
    ref.value = null
  }

  // Defense-in-depth: even with `jwtTokenStorageMethod: 'memory'` (set in
  // nuxt.config.ts), explicitly hand the token back to the SDK instance after
  // login/register. The SDK's `Auth.login` already calls `setToken_` for
  // `local`/`session`/`memory`/`custom`, but if a future config swap to
  // `nostore` ever regresses, this guarantees the bearer header is attached
  // on the very next call (e.g. transferCart, customer.create) AND that the
  // token-cookie plugin's setToken wrapper persists the value.
  const persistToken = async (token: string): Promise<void> => {
    const client = (sdk as AnyClient).client
    if (client && typeof client.setToken === 'function') {
      await client.setToken(token)
    }
    // Belt and braces: synchronously commit the cookie so the very next
    // `document.cookie` read (e.g. from `refresh()` below or the route
    // middleware on the next navigation) sees the freshly-issued JWT,
    // regardless of when Vue's reactive watch in the plugin actually flushes.
    writeAuthCookie(token)
  }

  const refresh = async () => {
    // P2 fix: avoid the gratuitous /store/customers/me 401 spam that hits
    // the backend on every guest pageload (auth middleware -> refresh()).
    // The token cookie is the source of truth for "is this browser logged
    // in?"; when it's empty there's no point round-tripping the API only
    // to receive a 401, fail the catch branch, and short-circuit anyway.
    // See app/plugins/medusa-token-cookie.ts for the cookie lifecycle.
    const tokenCookie = useCookie<string | null>('gms_auth_token')
    if (!tokenCookie.value) {
      customer.value = null
      return null
    }

    isLoading.value = true
    try {
      const res = await sdk.store.customer.retrieve({ fields: '*' } as any)
      customer.value = (res as any).customer
      return customer.value
    } catch {
      customer.value = null
      // The token may have expired or been revoked. Clear it so subsequent
      // requests don't keep sending a known-bad bearer header (and so the
      // middleware's cookie short-circuit kicks in on the next navigation).
      try {
        const client = (sdk as AnyClient).client
        if (client && typeof client.clearToken === 'function') {
          await client.clearToken()
        }
      } catch {
        // best-effort
      }
      // Synchronous eviction: see `clearAuthCookie` comment in `logout`.
      clearAuthCookie()
      return null
    } finally {
      isLoading.value = false
    }
  }

  const login = async (email: string, password: string) => {
    const result = await sdk.auth.login('customer', 'emailpass', { email, password } as any)
    if (typeof result !== 'string') return { ok: false as const, location: result.location }

    // Belt-and-braces: re-pin the JWT on the client instance so the
    // token-cookie plugin's setToken wrapper persists it to the cookie.
    await persistToken(result)

    await refresh()
    try {
      if (cartState.cartId.value) await sdk.store.cart.transferCart(cartState.cartId.value)
    } catch {
      // ignore
    }

    return { ok: true as const }
  }

  const register = async (email: string, password: string, firstName?: string, lastName?: string) => {
    const regToken = await sdk.auth.register('customer', 'emailpass', { email, password } as any)
    // The registration token is required for the customer.create call.
    await persistToken(regToken)
    await sdk.store.customer.create({ email, first_name: firstName, last_name: lastName } as any)

    // CRITICAL: the registration token is a pre-customer onboarding token; it
    // is NOT accepted by `/store/carts/{id}/customer`. Exchange it for a real
    // customer-session token by calling `auth.login` once.
    const sessionResult = await sdk.auth.login('customer', 'emailpass', { email, password } as any)
    if (typeof sessionResult === 'string') await persistToken(sessionResult)

    await refresh()
    try {
      if (cartState.cartId.value) await sdk.store.cart.transferCart(cartState.cartId.value)
    } catch {
      // ignore
    }
  }

  const logout = async () => {
    await sdk.auth.logout()
    // `auth.logout` clears the SDK's stored token via the storage adapter,
    // but be explicit: also calls our wrapper which wipes the cookie.
    try {
      const client = (sdk as AnyClient).client
      if (client && typeof client.clearToken === 'function') {
        await client.clearToken()
      }
    } catch {
      // best-effort
    }
    // Synchronously evict the cookie, same reasoning as writeAuthCookie:
    // the plugin's wrapped clearToken pushes the null through Vue's async
    // watch, which may not have flushed before the next navigation re-reads
    // document.cookie. Setting Max-Age=0 here is immediate and idempotent.
    clearAuthCookie()
    customer.value = null
  }

  return { customer, isLoading, refresh, login, register, logout }
}
