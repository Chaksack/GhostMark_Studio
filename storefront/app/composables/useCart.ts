// Module-level guard so the regionId watcher is registered exactly once
// per client session, regardless of how many components call useCart().
// useCart() can be invoked from dozens of components per page; registering
// a watcher inside each invocation would multiply network refreshes on a
// single region flip and leak listeners across navigations. The composable
// itself is request-scoped on the server (no-op there), and the watcher
// is only registered on the client where this module persists for the
// lifetime of the SPA shell.
let cartRegionWatcherWired = false

export const useCart = () => {
  // In-flight resolution is parked on the Nuxt app instance, NOT at module
  // scope. On the client the two are equivalent (one app per tab), but on
  // the server the module is evaluated once per process and shared by every
  // concurrent request, so a module-level promise would hand one visitor's
  // cart to another visitor who happened to render at the same moment.
  // `useNuxtApp()` is per-request on the server and a singleton on the
  // client, which is exactly the scope this guard needs. Nuxt's own
  // `useAsyncData` parks its promises the same way (`nuxtApp._asyncDataPromises`).
  const nuxtApp = useNuxtApp() as ReturnType<typeof useNuxtApp> & {
    _gmsCartResolution?: Promise<any> | null
  }

  const cartId = useCookie<string | null>('gms_cart_id', { sameSite: 'lax' })
  const cart = useState<any | null>('gms_cart', () => null)
  const isReady = useState<boolean>('gms_cart_ready', () => false)
  // Sidecar cookie tracking when the current `gms_cart_id` was minted.
  // The Medusa cart id itself carries no timestamp, so we mirror creation
  // time here to support a dev-mode staleness check (24h cutoff). Lifetime
  // tracks the 30-day cart cookie horizon so legitimate long-lived carts
  // still surface a usable timestamp.
  const cartCreatedAtCookie = useCookie<string | null>('gms_cart_created_at', { sameSite: 'lax', maxAge: 60 * 60 * 24 * 30 })

  // Dev-mode auto-clear: cart cookies that survive more than 24h between
  // sessions are almost always stale fixtures from a prior debugging run
  // (e.g. the persistent Workshop Tote qty 15 surfaced by the e2e suite).
  // Clearing in development saves manual cookie-wipes; production paths
  // must NEVER auto-clear because real customers expect their carts to
  // survive the full 30 days. Runs synchronously before any reactive
  // state setup so downstream `ensureCart()` sees a clean slate.
  if (import.meta.dev && import.meta.client && cartId.value && cartCreatedAtCookie.value) {
    const createdAt = new Date(cartCreatedAtCookie.value).getTime()
    const ageHours = (Date.now() - createdAt) / (1000 * 60 * 60)
    if (ageHours > 24) {
      // Inline the wipe because `clearCart()` is declared later in this
      // closure and isn't hoisted; calling it here would be a TDZ error.
      cartId.value = null
      cart.value = null
      isReady.value = false
      cartCreatedAtCookie.value = null
      nuxtApp._gmsCartResolution = null
      if (typeof localStorage !== 'undefined') {
        try { localStorage.removeItem('gms_cart_id') } catch {}
      }
      console.info('[useCart] auto-cleared stale dev cart aged %d hours', Math.round(ageHours))
    }
  }

  // Developer escape hatch: ?clearCart=1 wipes cart state on first run.
  // Strips the query param afterwards so a refresh or component remount
  // doesn't re-trigger the clear and so deep links remain idempotent.
  // Dev-only to avoid handing customers a foot-gun via a shared URL.
  if (import.meta.client && import.meta.dev) {
    const route = useRoute()
    if (route.query.clearCart === '1') {
      cartId.value = null
      cart.value = null
      isReady.value = false
      cartCreatedAtCookie.value = null
      nuxtApp._gmsCartResolution = null
      if (typeof localStorage !== 'undefined') {
        try { localStorage.removeItem('gms_cart_id') } catch {}
      }
      // Remove the param so a refresh doesn't re-trigger.
      const router = useRouter()
      const next = { ...route.query }
      delete next.clearCart
      void router.replace({ path: route.path, query: next })
      console.info('[useCart] cleared cart via ?clearCart=1')
    }
  }

  const sdk = useMedusaClient()
  const regionState = useRegion()

  /**
   * Resolve the active cart, minting one if needed.
   *
   * Concurrency contract: callers may invoke this simultaneously and will
   * all receive the SAME cart. `ensureCart()` is called from several
   * independent `onMounted` hooks that fire in the same tick. On the
   * homepage that is three: `pages/index.vue`, plus `<CartDropdown>`
   * twice over, because AppHeader mounts it in both the desktop rail and
   * the mobile rail.
   *
   * Without a shared in-flight promise every one of those callers reads
   * `cart.value?.id` as empty (nothing has resolved yet), awaits
   * `ensureRegion()` and the retrieve, and then POSTs `/store/carts`.
   * Measured on a cold homepage load against the dev server: three carts
   * minted per page view, 3/3 runs, dropping to one with this guard in
   * place. Two of those three were orphaned empty cart rows in the shared
   * database, and because the last writer wins on both `cart` and the
   * `gms_cart_id` cookie, an item added to the first cart could vanish
   * behind the third — the cart page reading "Your cart is empty"
   * straight after a successful add.
   *
   * The body below is unchanged; it is only wrapped so that the first
   * caller does the work and the rest await its result. The promise is
   * released once it settles, so a failed attempt is retried rather than
   * cached as a permanent error.
   */
  const ensureCart = async () => {
    if (cart.value?.id) {
      isReady.value = true
      return cart.value
    }

    // Join an attempt already underway instead of starting a second one.
    if (nuxtApp._gmsCartResolution) return await nuxtApp._gmsCartResolution

    const resolve = async () => {
      if (!regionState.regionId.value) await regionState.ensureRegion()

      if (cartId.value) {
        try {
          const res = await sdk.store.cart.retrieve(cartId.value, { fields: '*items,*items.variant.product.type,*region' } as any)
          cart.value = (res as any).cart
          isReady.value = true
          return cart.value
        } catch {
          cartId.value = null
        }
      }

      const created = await sdk.store.cart.create({ region_id: regionState.regionId.value as any } as any)
      cart.value = (created as any).cart
      cartId.value = cart.value.id
      // Stamp creation time so the dev-mode 24h staleness check has a
      // reference point. Only writes on actual cart mints (not on cookie
      // retrieve) so the timestamp reflects when the backend cart was
      // born, not when this composable last hydrated it.
      cartCreatedAtCookie.value = new Date().toISOString()
      isReady.value = true
      return cart.value
    }

    // No `await` sits between starting `resolve()` and publishing its
    // promise, so control cannot pass to another caller in between: every
    // later caller is guaranteed to observe a populated slot.
    const pending = resolve()
    nuxtApp._gmsCartResolution = pending
    try {
      return await pending
    } finally {
      // Only the originating caller clears it. Late joiners already hold
      // their own reference to `pending`, so releasing the slot here
      // cannot strand them.
      if (nuxtApp._gmsCartResolution === pending) nuxtApp._gmsCartResolution = null
    }
  }

  const refresh = async () => {
    if (!cartId.value) return await ensureCart()
    const res = await sdk.store.cart.retrieve(cartId.value, { fields: '*items,*items.variant.product.type,*region' } as any)
    cart.value = (res as any).cart
    return cart.value
  }

  const addItem = async (variantId: string, quantity = 1) => {
    const c = await ensureCart()
    const res = await sdk.store.cart.createLineItem(c.id, { variant_id: variantId, quantity } as any, { fields: '*items,*items.variant.product.type,*region' } as any)
    cart.value = (res as any).cart
    return cart.value
  }

  const updateItem = async (lineItemId: string, quantity: number) => {
    const c = await ensureCart()
    const res = await sdk.store.cart.updateLineItem(c.id, lineItemId, { quantity } as any, { fields: '*items,*items.variant.product.type,*region' } as any)
    cart.value = (res as any).cart
    return cart.value
  }

  const removeItem = async (lineItemId: string) => {
    const c = await ensureCart()
    await sdk.store.cart.deleteLineItem(c.id, lineItemId, { fields: '*items,*items.variant.product.type,*region' } as any)
    return await refresh()
  }

  const updateCart = async (body: Record<string, any>) => {
    const c = await ensureCart()
    const res = await sdk.store.cart.update(c.id, body as any, { fields: '*items,*items.variant.product.type,*region' } as any)
    cart.value = (res as any).cart
    return cart.value
  }

  const listShippingOptions = async () => {
    const c = await ensureCart()
    const res = await sdk.store.fulfillment.listCartOptions({ cart_id: c.id } as any)
    return (res as any).shipping_options || []
  }

  const addShippingMethod = async (optionId: string) => {
    const c = await ensureCart()
    const res = await sdk.store.cart.addShippingMethod(c.id, { option_id: optionId } as any, { fields: '*items,*items.variant.product.type,*region' } as any)
    cart.value = (res as any).cart
    return cart.value
  }

  const complete = async () => {
    const c = await ensureCart()
    return await sdk.store.cart.complete(c.id)
  }

  /**
   * Hard-reset the local cart reference. Drops the `gms_cart_id` cookie and
   * any mirrored localStorage entry, clears in-memory state, and lets the
   * next `ensureCart()` call mint a fresh cart on the backend.
   *
   * Wire this on logout / session reset so the badge does not display a
   * stale quantity (e.g. the persistent "25" from a prior dev session).
   * Manual recovery: in DevTools run
   *   document.cookie = 'gms_cart_id=; Max-Age=0; path=/'
   *   localStorage.removeItem('gms_cart_id')
   * then reload.
   */
  const clearCart = () => {
    cartId.value = null
    cart.value = null
    isReady.value = false
    // Abandon any resolution still in flight. Without this, a mint that
    // was already mid-request would be adopted by the next ensureCart()
    // call and resurrect the very cart this function was asked to drop.
    nuxtApp._gmsCartResolution = null
    // Drop the sidecar timestamp too; otherwise a manual clearCart()
    // followed by a fresh mint would inherit an obsolete creation time
    // and the dev-mode staleness check could fire incorrectly on the
    // next session.
    cartCreatedAtCookie.value = null
    if (import.meta.client) {
      try {
        localStorage.removeItem('gms_cart_id')
      } catch {
        // localStorage may be unavailable (private mode); cookie reset is sufficient
      }
    }
  }

  // Region-change subscription.
  //
  // When the user flips region (RegionSelector / GeoModal → setRegion()),
  // useRegion() already issues `sdk.store.cart.update(cartId, { region_id })`
  // which causes Medusa to recompute `currency_code`, line `unit_price`,
  // tax, and totals server-side. But without re-reading the cart, our local
  // `cart` ref still mirrors the old region: header badge, mini-cart
  // drawer, and checkout summary show stale GBP totals after a switch to
  // EUR until the next page navigation triggers a fresh retrieve.
  //
  // We watch `regionId` here (rather than inside setRegion) so that ANY
  // path that mutates the region cookie (direct setRegion call, future
  // cookie-sync from the server, dev tools tampering) triggers a refresh.
  // Keeps the responsibility on the cart side: it knows when its own state
  // is stale, and consumers of useRegion don't need to know about cart.
  //
  // Client-only via `import.meta.client`: SSR seeds region from the cookie
  // on the first request and never mutates it, so a server-side watcher
  // would never fire and would only add lifecycle noise.
  //
  // Module-level guard prevents duplicate watchers when useCart() is called
  // from multiple components on the same page.
  if (import.meta.client && !cartRegionWatcherWired) {
    cartRegionWatcherWired = true
    watch(
      () => regionState.regionId.value,
      async (newId, oldId) => {
        // No-op when the value didn't actually change (initial fire),
        // when the new id is null (region cleared), or when there's no
        // cart yet to refresh. The next addItem() will mint a fresh
        // cart in the new region via ensureCart().
        if (!newId || newId === oldId) return
        if (!cartId.value) return
        try {
          await refresh()
        } catch {
          // Best-effort. The cookie flip is already authoritative, and
          // the next user-driven cart mutation will re-read with the
          // current region. Surfacing a toast here would be noise.
        }
      },
      { immediate: false, flush: 'post' },
    )
  }

  return {
    cartId,
    cart,
    isReady,
    ensureCart,
    refresh,
    addItem,
    updateItem,
    removeItem,
    updateCart,
    listShippingOptions,
    addShippingMethod,
    complete,
    clearCart,
  }
}
