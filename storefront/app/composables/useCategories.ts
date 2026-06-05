import type { StoreProductCategory } from '@medusajs/types'

/**
 * useCategories — single source of truth for the storefront taxonomy.
 *
 * The previous incarnation shipped a hardcoded `FALLBACK_CATEGORIES` seed
 * that masked an empty Medusa catalogue with synthetic labels (Apparel,
 * Drinkware, …). Those labels did NOT match the real backend handles, so
 * every category link the header rendered was a guaranteed 404 against
 * the live catalogue. The fallback is now removed: the composable returns
 * whatever Medusa returns, and an empty list on failure (never a throw).
 *
 * Shape contract:
 *   - `CategoryItem`  : { label, handle }                — leaf nodes
 *   - `CategoryGroup` : { id, key, label, handle, to,    — top-level nodes,
 *                         items[], children?[] }           augmented with
 *                                                          presentation-side
 *                                                          fields (`key`,
 *                                                          `to`) so header
 *                                                          and mobile nav
 *                                                          consume them
 *                                                          without further
 *                                                          shaping.
 *   `items` is preserved for backward compatibility with `AppMobileNav.vue`
 *   and `/categories` index page (both consume `group.items[]`). It is the
 *   same data as `children`, mapped down to the {label, handle} pair those
 *   consumers need.
 *
 * SSR / hydration:
 *   - State is shared via `useState` so the SSR fetch result is sent to the
 *     client and reused — no second fetch on hydration, no flicker.
 *   - Consumers call `await ensureResolved()` before reading
 *     `categories.value`. Multiple concurrent callers share the same
 *     in-flight promise (re-entry guarded by `state.pending`).
 *
 * Failure mode:
 *   - SDK errors (network, 5xx) are caught — `categories.value` stays an
 *     empty array. Nav simply renders the two primary mode entries (Shop
 *     and Studio POD) plus a separator and stops — better than throwing a
 *     500 from layout.
 */

export interface CategoryItem {
  label: string
  handle: string
}

export interface CategoryGroup {
  id: string
  key: string
  label: string
  handle: string
  to: string
  items: CategoryItem[]
  children?: CategoryGroup[]
}

type RawCategory = StoreProductCategory & {
  category_children?: RawCategory[]
}

function toItem(raw: RawCategory): CategoryItem {
  return { label: raw.name, handle: raw.handle }
}

function toGroup(raw: RawCategory): CategoryGroup {
  const kids = Array.isArray(raw.category_children) ? raw.category_children : []
  return {
    id: raw.id,
    key: raw.handle,
    label: raw.name,
    handle: raw.handle,
    to: `/categories/${raw.handle}`,
    items: kids.map(toItem),
    children: kids.length ? kids.map(toGroup) : undefined,
  }
}

interface CategoryState {
  list: CategoryGroup[]
  pending: boolean
  error: string | null
  resolved: boolean
  inflight: Promise<CategoryGroup[]> | null
}

export const useCategories = () => {
  const state = useState<CategoryState>('gms-categories', () => ({
    list: [],
    pending: false,
    error: null,
    resolved: false,
    inflight: null,
  }))

  const ensureResolved = async (): Promise<CategoryGroup[]> => {
    if (state.value.resolved) return state.value.list
    if (state.value.inflight) return state.value.inflight

    state.value.pending = true
    state.value.error = null

    const sdk = useMedusaClient()
    const promise = (async () => {
      try {
        const res: any = await sdk.store.category.list({
          limit: 100,
          fields: 'id,name,handle,parent_category_id,*category_children',
          include_descendants_tree: true,
        })
        const raw: RawCategory[] = (res?.product_categories || []) as RawCategory[]
        // Top-level only — descendants live nested in `category_children`.
        const top = raw.filter(c => !c.parent_category_id).map(toGroup)
        state.value.list = top
      }
      catch (err: any) {
        state.value.error = err?.message ?? 'Failed to load categories'
        state.value.list = []
      }
      finally {
        state.value.pending = false
        state.value.resolved = true
        state.value.inflight = null
      }
      return state.value.list
    })()

    state.value.inflight = promise
    return promise
  }

  return {
    categories: computed(() => state.value.list),
    pending: computed(() => state.value.pending),
    error: computed(() => state.value.error),
    ensureResolved,
    // `refresh` kept for parity with previous API surface — drops cached
    // result and re-fires the fetch on next `ensureResolved()`.
    refresh: async () => {
      state.value.resolved = false
      state.value.inflight = null
      return ensureResolved()
    },
  }
}
