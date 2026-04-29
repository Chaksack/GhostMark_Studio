export const useCart = () => {
  const cartId = useCookie<string | null>('gms_cart_id', { sameSite: 'lax' })
  const cart = useState<any | null>('gms_cart', () => null)
  const isReady = useState<boolean>('gms_cart_ready', () => false)

  const sdk = useMedusaClient()
  const regionState = useRegion()

  const ensureCart = async () => {
    if (cart.value?.id) {
      isReady.value = true
      return cart.value
    }

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
    isReady.value = true
    return cart.value
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
    if (import.meta.client) {
      try {
        localStorage.removeItem('gms_cart_id')
      } catch {
        // localStorage may be unavailable (private mode); cookie reset is sufficient
      }
    }
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
