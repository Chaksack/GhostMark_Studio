import type { StoreProductCategory } from '@medusajs/types'

/**
 * useCategories — Phase 7 domain wiring.
 *
 * Surfaces the storefront's top-level taxonomy as a flat
 * { label, handle, items[] } shape so the header mega-menu and the mobile
 * drawer can iterate without each owning Medusa-shaped objects.
 *
 * Backend behaviour:
 *   - Calls `sdk.store.category.list({ parent_category_id: null,
 *     include_descendants_tree: true })` to get the root tier of categories
 *     plus their direct children in a single round trip.
 *   - Wraps the call in `useAsyncData` so SSR receives the data, the client
 *     hydrates from the same payload, and refetching is a one-liner.
 *
 * Failure mode (frontend-only / backend down):
 *   - Any error from the SDK (network, 5xx, timeout) is swallowed and
 *     `FALLBACK_CATEGORIES` is returned. SSR therefore never crashes when
 *     the Medusa container at :9000 is offline; the page still renders
 *     a sensible default taxonomy. The same fallback is used when the
 *     backend returns zero categories so an empty seed never produces an
 *     empty nav.
 *
 * Type contract:
 *   - `CategoryGroup` is the public shape consumed by `AppHeader` /
 *     `AppMobileNav`. Visual concerns (gradients, illustrations) live in a
 *     presentation-side lookup keyed by handle, NOT in this data.
 */

export interface CategoryItem {
  label: string
  handle: string
}

export interface CategoryGroup {
  label: string
  handle: string
  items: CategoryItem[]
}

const FALLBACK_CATEGORIES: CategoryGroup[] = [
  {
    label: 'Apparel',
    handle: 'apparel',
    items: [
      { label: 'T-shirts', handle: 't-shirts' },
      { label: 'Hoodies', handle: 'hoodies' },
      { label: 'Sweatshirts', handle: 'sweatshirts' },
      { label: 'Caps', handle: 'caps' },
    ],
  },
  {
    label: 'Drinkware',
    handle: 'drinkware',
    items: [
      { label: 'Mugs', handle: 'mugs' },
      { label: 'Water bottles', handle: 'bottles' },
      { label: 'Tumblers', handle: 'tumblers' },
    ],
  },
  {
    label: 'Accessories',
    handle: 'accessories',
    items: [
      { label: 'Tote bags', handle: 'totes' },
      { label: 'Stickers', handle: 'stickers' },
      { label: 'Notebooks', handle: 'notebooks' },
    ],
  },
  {
    label: 'Lifestyle',
    handle: 'lifestyle',
    items: [
      { label: 'Tech', handle: 'tech' },
      { label: 'Home', handle: 'home' },
    ],
  },
]

function toGroup(cat: StoreProductCategory): CategoryGroup {
  const children = cat.category_children ?? []
  return {
    label: cat.name,
    handle: cat.handle,
    items: children.map<CategoryItem>((child) => ({
      label: child.name,
      handle: child.handle,
    })),
  }
}

export const useCategories = () => {
  const sdk = useMedusaClient()

  const { data, error, pending, refresh } = useAsyncData<CategoryGroup[]>(
    'gms-categories',
    async () => {
      try {
        const res = await sdk.store.category.list({
          parent_category_id: null,
          include_descendants_tree: true,
          limit: 50,
          fields: 'id,name,handle,category_children.id,category_children.name,category_children.handle',
        })
        const cats = res.product_categories ?? []
        if (!cats.length) return FALLBACK_CATEGORIES
        return cats.map(toGroup)
      }
      catch {
        return FALLBACK_CATEGORIES
      }
    },
    {
      default: () => FALLBACK_CATEGORIES,
      server: true,
    },
  )

  return { categories: data, error, pending, refresh }
}
