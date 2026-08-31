/**
 * Account auth gate.
 *
 * Decision flow:
 *   1. No `gms_auth_token` cookie -> immediately bounce to home with the
 *      login modal hint. This is the fast path for guests and skips a
 *      guaranteed-401 round trip to /store/customers/me (P2 fix, see
 *      useCustomer.refresh()).
 *   2. Cookie present but `useCustomer().customer` is empty (e.g. fresh
 *      hard reload) -> attempt one silent refresh. The companion plugin
 *      `app/plugins/medusa-token-cookie.ts` rehydrates the SDK's in-memory
 *      token from the cookie before this middleware fires.
 *   3. Refresh failed (token expired / revoked) -> bounce to login.
 *
 * SSR-safe: `useCookie` works on both the server and client, so the
 * middleware reaches the same verdict whether it runs during SSR or in
 * the browser.
 */
export default defineNuxtRouteMiddleware(async () => {
  const tokenCookie = useCookie<string | null>('gms_auth_token')
  if (!tokenCookie.value) {
    return navigateTo({ path: '/', query: { auth: 'login' } })
  }

  const { customer, refresh } = useCustomer()
  if (!customer.value) await refresh()
  if (!customer.value) {
    return navigateTo({ path: '/', query: { auth: 'login' } })
  }
})
