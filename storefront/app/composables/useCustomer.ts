// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any

export const useCustomer = () => {
  const customer = useState<any | null>('gms_customer', () => null)
  const isLoading = useState<boolean>('gms_customer_loading', () => false)
  const sdk = useMedusaClient()
  const cartState = useCart()

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
  }

  const refresh = async () => {
    // P2 fix: avoid the gratuitous /store/customers/me 401 spam that hits
    // the backend on every guest pageload (auth middleware -> refresh()).
    // The token cookie is the source of truth for "is this browser logged
    // in?" — when it's empty there's no point round-tripping the API only
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
    // but be explicit — also calls our wrapper which wipes the cookie.
    try {
      const client = (sdk as AnyClient).client
      if (client && typeof client.clearToken === 'function') {
        await client.clearToken()
      }
    } catch {
      // best-effort
    }
    customer.value = null
  }

  return { customer, isLoading, refresh, login, register, logout }
}
