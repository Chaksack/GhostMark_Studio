export const useCartDrawer = () => {
  const isOpen = useState<boolean>('gms_cart_drawer_open', () => false)
  return {
    isOpen,
    open: () => {
      isOpen.value = true
    },
    close: () => {
      isOpen.value = false
    },
    toggle: () => {
      isOpen.value = !isOpen.value
    },
  }
}
