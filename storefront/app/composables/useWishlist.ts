export interface WishlistItem {
  id: string
  title: string
  handle: string
  thumbnail: string | null
  price: string
  addedAt: number
}

const STORAGE_KEY = 'gms_wishlist'

export const useWishlist = () => {
  const items = useState<WishlistItem[]>('gms_wishlist', () => [])

  const hydrate = () => {
    if (import.meta.server) return
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) items.value = JSON.parse(raw)
    } catch {
      // ignore
    }
  }

  const persist = () => {
    if (import.meta.server) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.value))
  }

  const add = (product: WishlistItem) => {
    if (items.value.some((i) => i.id === product.id)) return
    items.value = [...items.value, { ...product, addedAt: Date.now() }]
    persist()
  }

  const remove = (productId: string) => {
    items.value = items.value.filter((i) => i.id !== productId)
    persist()
  }

  const has = (productId: string) => items.value.some((i) => i.id === productId)

  const toggle = (product: WishlistItem) => {
    if (has(product.id)) {
      remove(product.id)
    } else {
      add(product)
    }
  }

  const count = computed(() => items.value.length)

  // Hydrate on client
  if (import.meta.client) {
    hydrate()
  }

  return { items, count, add, remove, has, toggle, hydrate }
}
