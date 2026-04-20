export const useCustomer = () => {
  const customer = useState<any | null>('gms_customer', () => null)
  const isLoading = useState<boolean>('gms_customer_loading', () => false)
  const sdk = useMedusaClient()
  const cartState = useCart()

  const refresh = async () => {
    isLoading.value = true
    try {
      const res = await sdk.store.customer.retrieve({ fields: '*' } as any)
      customer.value = (res as any).customer
      return customer.value
    } catch {
      customer.value = null
      return null
    } finally {
      isLoading.value = false
    }
  }

  const login = async (email: string, password: string) => {
    const result = await sdk.auth.login('customer', 'emailpass', { email, password } as any)
    if (typeof result !== 'string') return { ok: false as const, location: result.location }

    await refresh()
    try {
      if (cartState.cartId.value) await sdk.store.cart.transferCart(cartState.cartId.value)
    } catch {
      // ignore
    }

    return { ok: true as const }
  }

  const register = async (email: string, password: string, firstName?: string, lastName?: string) => {
    await sdk.auth.register('customer', 'emailpass', { email, password } as any)
    await sdk.store.customer.create({ email, first_name: firstName, last_name: lastName } as any)
    await refresh()
  }

  const logout = async () => {
    await sdk.auth.logout()
    customer.value = null
  }

  return { customer, isLoading, refresh, login, register, logout }
}
