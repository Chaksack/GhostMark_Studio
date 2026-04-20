export default defineNuxtRouteMiddleware(async () => {
  const { customer, refresh } = useCustomer()
  if (!customer.value) await refresh()
  if (!customer.value) {
    return navigateTo({ path: '/', query: { auth: 'login' } })
  }
})
