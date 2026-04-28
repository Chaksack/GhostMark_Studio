<template>
  <li>
    <div class="relative">
      <!--
        Chip slot — top-left absolute. Bug 21 fix (P1) preserved: on mobile
        (≤390px) the previous 3-chip strip wrapped to two lines and consumed
        the top half of the thumbnail. We still cap to a SINGLE chip across
        all breakpoints to keep the photo as the dominant visual; richer chip
        stacks belong on the PDP, not the PLP card.
        Mode-aware (v2 IA): the chips rendered depend on `props.mode`
        (`shop` = D2C own-brand, `studio` = B2B custom + POD), filtered through
        `~/utils/chips`. See ProductCardChips for the variant treatment.
      -->
      <div
        v-if="visibleChips.length"
        class="absolute top-[1rem] left-[1rem] right-[1rem] z-[3] flex gap-[0.5rem] flex-wrap pointer-events-none"
      >
        <ProductCardChips :chips="visibleChips" />
      </div>

      <NuxtLink
        :to="`/products/${encodeURIComponent(product.handle || product.id)}`"
        class="leading-[2.4rem] items-center hover:underline relative w-full h-full overflow-hidden pb-[140%] bg-offWhite block group ring-1 ring-inset ring-greyLines/40 transition-shadow hover:ring-greyLines"
      >
        <!--
          HOVER image — z-[2], visible by default, fades out on group hover to
          reveal the BASE image below. Mirrors the merchery PLP card swap.
        -->
        <figure
          v-if="hoverImage && hoverImage !== product.thumbnail"
          class="absolute top-0 left-0 w-full h-full opacity-100 transition-opacity duration-200 ease-in-out z-[2] group-hover:opacity-0"
        >
          <img
            :src="hoverImage"
            :alt="product.title"
            class="w-full h-full object-cover"
            loading="lazy"
          />
        </figure>

        <!-- BASE image — z-[1], revealed on hover (or always visible if no hoverImage) -->
        <figure class="absolute top-0 left-0 w-full h-full z-[1]">
          <img
            v-if="product.thumbnail"
            :src="product.thumbnail"
            :alt="product.title"
            class="w-full h-full object-cover"
            loading="lazy"
          />
          <div v-else class="flex h-full w-full items-center justify-center text-greyText">
            <Icon name="image-placeholder" :size="40" :stroke-width="1.5" />
          </div>
        </figure>
      </NuxtLink>

      <div class="mt-[0.6rem] flex gap-[0.6rem] justify-between items-start">
        <div>
          <NuxtLink
            :to="`/products/${encodeURIComponent(product.handle || product.id)}`"
            class="leading-[2.4rem] flex items-center p-0 hover:no-underline"
          >
            <p class="leading-[1.6rem] lg:leading-[2.4rem] text-[13px] lg:text-[16px] mb-[2px] line-clamp-2">
              {{ product.title }}
            </p>
          </NuxtLink>
          <p
            v-if="price"
            class="leading-[1.6rem] lg:leading-[2.4rem] text-[13px] lg:text-[16px]"
          >
            From {{ price }}
          </p>
        </div>
        <!--
          Touch target fix (WCAG 2.1 AA — 44x44 minimum). The heart icon stays
          visually small (20x20) because it is decorative chrome on the meta
          row, but the BUTTON itself must be a 44x44 hit zone. We use the
          `-m-2 p-2` negative-margin / padding pair to expand the tap area
          without altering the layout footprint, so the title + price column
          to the left does not reflow. `grid place-items-center` keeps the
          icon perfectly centred regardless of the larger box.
        -->
        <button
          type="button"
          class="grid place-items-center min-h-[44px] min-w-[44px] -m-2 p-2 rounded-full cursor-pointer bg-transparent border-none outline-none focus-visible:ring-2 focus-visible:ring-ink-950 focus-visible:ring-offset-1 transition-transform duration-200 ease-in-out hover:scale-[1.1]"
          :aria-label="wishlistButtonLabel"
          :aria-pressed="isWishlisted ? 'true' : 'false'"
          @click.prevent="toggleWishlist"
        >
          <Icon
            :name="isWishlisted ? 'wishlist-filled' : 'wishlist'"
            :size="20"
          />
        </button>
      </div>
    </div>
  </li>
</template>

<script setup lang="ts">
import Icon from '~/components/ui/Icon.vue'
import {
  modeFromProductType,
  visibleChipsForMode,
  type Chip,
  type CommerceMode,
} from '~/utils/chips'

interface VariantCalculatedPrice {
  calculated_amount?: number | null
  currency_code?: string | null
}
interface VariantLike {
  calculated_price?: VariantCalculatedPrice | null
  prices?: { amount?: number | null; currency_code?: string | null }[] | null
}

interface ProductTagLike {
  value?: string | null
}

interface ProductImageLike {
  url?: string | null
}

interface ProductTypeLike {
  /** Medusa StoreProductType — `value` is the human-readable label (e.g. `'apparel'`, `'pod'`). */
  value?: string | null
}

const props = withDefaults(defineProps<{
  product: {
    id: string
    handle?: string
    title: string
    thumbnail?: string | null
    images?: ProductImageLike[] | null
    variants?: VariantLike[]
    metadata?: Record<string, unknown> | null
    tags?: ProductTagLike[] | null
    /**
     * Medusa product type — when present we derive the chip mode from
     * `type.value` (`'apparel'` -> D2C chips, `'pod'` -> B2B/POD chips). PLP
     * fetchers should include `*type` in the `fields` arg of
     * `sdk.store.product.list` for this to be populated.
     */
    type?: ProductTypeLike | null
  }
  /**
   * Commerce surface this card is rendered on. Drives which chip taxonomy is
   * visible (see `~/utils/chips`):
   *   - `apparel` -> D2C own-brand (Studio Canon) chips only. Canonical
   *                  product-type-derived value.
   *   - `shop`    -> Sibling of `apparel` (legacy alias).
   *   - `pod`     -> B2B / POD chips only. Canonical product-type-derived value.
   *   - `studio`  -> Sibling of `pod` (legacy alias).
   *   - `auto`    -> Render every resolvable chip (search / discover surfaces).
   *
   * NOTE: When `product.type.value` is present and resolvable
   * (`'apparel'` | `'pod'`) it overrides this prop. The prop is therefore the
   * fallback used only when the product feed lacks the type expansion.
   *
   * Defaults to `auto` so existing callers (BestSellers, RecentlyAdded,
   * DiscoverSection, search) keep their current behaviour without changes.
   */
  mode?: CommerceMode
  /**
   * Optional explicit hover image override. When omitted we default to the
   * second image in `product.images` (if present), giving the merchery hover
   * swap "for free" on any product seeded with at least two images.
   */
  hoverImage?: string | null
}>(), { mode: 'auto' })

// Hover image: explicit prop wins; otherwise pull `images[1]?.url` so a card
// with multiple seeded images automatically gets the merchery hover-swap.
// `images[0]` is intentionally NOT used as the hover image — the BASE figure
// already shows the thumbnail (which Medusa typically aliases to images[0]),
// so reusing it would result in a no-op cross-fade.
const hoverImage = computed<string | undefined>(() => {
  if (props.hoverImage) return props.hoverImage
  const second = props.product.images?.[1]?.url
  return typeof second === 'string' && second ? second : undefined
})

// Chip resolution — read raw chip keys from product metadata, then run them
// through the mode-aware catalog in `~/utils/chips`.
//
// Sources, in priority order:
//   1. `metadata.chips: string[]`   — preferred, matches the v2 IA taxonomy.
//   2. `metadata.badges: string[]`  — legacy seed shape, kept for backward
//                                     compatibility while the catalog migrates.
//   3. `product.tags[].value`       — Medusa StoreProductTag fallback so
//                                     existing tag-driven cards keep working.
// Unknown / off-mode keys are silently dropped by `visibleChipsForMode`, so a
// product with no chip metadata simply renders no chip slot.
const chipKeys = computed<string[]>(() => {
  const meta = (props.product?.metadata ?? null) as Record<string, unknown> | null
  const fromChips = Array.isArray(meta?.chips)
    ? (meta!.chips as unknown[]).filter((b): b is string => typeof b === 'string')
    : []
  const fromBadges = Array.isArray(meta?.badges)
    ? (meta!.badges as unknown[]).filter((b): b is string => typeof b === 'string')
    : []
  const fromTags = (props.product?.tags ?? [])
    .map(t => t?.value)
    .filter((v): v is string => typeof v === 'string' && v.length > 0)
  return Array.from(new Set([...fromChips, ...fromBadges, ...fromTags]))
})

// Resolve the effective chip mode. Priority order:
//   1. `product.type.value` from Medusa (canonical source — `'apparel'` or
//      `'pod'`). This survives PLP/PDP/Discover surfaces uniformly because
//      it travels with the product itself.
//   2. The explicit `mode` prop passed by the caller (legacy `'shop'` /
//      `'studio'` / `'auto'`).
// We fall back to the prop only when `product.type` is missing or the value
// doesn't map to a known mode, so existing callers (Discover, search) that
// pass `mode="auto"` continue to render every resolvable chip.
const productMode = computed<CommerceMode>(() => {
  const fromType = modeFromProductType(props.product?.type?.value)
  return fromType ?? props.mode
})

// Bug 21 fix (P1) preserved: the PLP thumbnail can only carry a single
// editorial chip without competing with the product photo. We slice to one
// chip here rather than in the child so any future variant (e.g. PDP recap)
// can still consume the full chip list via a different wrapper.
const visibleChips = computed<Chip[]>(() =>
  visibleChipsForMode(chipKeys.value, productMode.value).slice(0, 1),
)

// Medusa V2: read `calculated_price.calculated_amount` (region-aware), with
// the legacy `prices[]` array as a fallback for fixtures fetched without a
// region context. Pick the cheapest priced variant so a multi-size product
// shows the lowest sticker rather than whichever variant Medusa surfaced
// first.
const price = computed<string | null>(() => {
  const variants = props.product.variants ?? []
  let amount: number | null = null
  let currency: string | null = null
  for (const v of variants) {
    const a: any = v as any
    const calcAmt = a?.calculated_price?.calculated_amount
    const calcCur = a?.calculated_price?.currency_code
    const fallbackAmt = a?.prices?.[0]?.amount
    const fallbackCur = a?.prices?.[0]?.currency_code
    const candAmt = typeof calcAmt === 'number' ? calcAmt : (typeof fallbackAmt === 'number' ? fallbackAmt : null)
    const candCur = calcCur || fallbackCur || null
    if (candAmt == null) continue
    if (amount == null || candAmt < amount) {
      amount = candAmt
      currency = candCur
    }
  }
  if (amount == null) return null
  const value = amount / 100
  const code = (currency || 'gbp').toUpperCase()
  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  } catch {
    return `${value.toFixed(2)} ${code}`
  }
})

// Wishlist — delegate persistence to the composable. We pass the resolved
// price string back into the wishlist item so the wishlist drawer can render
// the cached sticker without re-querying Medusa.
const wishlist = useWishlist()
const isWishlisted = computed(() => wishlist.has(props.product.id))
// Action-aware aria-label so SR users hear "Remove ..." once the heart is
// filled, not the now-incorrect "Add ..." prompt. Falls back to a generic
// "item" string if title is ever missing — defensive against partial data.
const wishlistButtonLabel = computed(() => {
  const name = (props.product?.title || 'item').trim() || 'item'
  return isWishlisted.value
    ? `Remove ${name} from favorites`
    : `Add ${name} to favorites`
})
const toggleWishlist = () => {
  wishlist.toggle({
    id: props.product.id,
    title: props.product.title,
    handle: props.product.handle ?? props.product.id,
    thumbnail: props.product.thumbnail ?? null,
    price: price.value ?? '',
    addedAt: Date.now(),
  })
}
</script>
