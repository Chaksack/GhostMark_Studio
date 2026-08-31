<template>
  <li>
    <div class="relative">
      <!--
        `pb-[100%]` is the image aspect ratio, and it is the single largest
        control on how much of the page one product occupies. It was `pb-[140%]`
        (a 5:7 portrait, 0.71) which made the image 415px of a 544px card at
        1440 -- one card was 60% of the fold and the catalogue was ~16 screens.

        Changed to 1:1 on two measured grounds, not on taste.

        1. IT MATCHES THE PHOTOGRAPHY. A tall portrait crop is what fashion
           retailers shooting garments ON A BODY use: Urban Outfitters 0.68,
           lululemon (apparel PLP) 0.81, Selfridges 0.75. Storefronts shooting
           product ON A NEUTRAL GROUND land square-to-landscape: Squarespace
           commerce default 1.0, adidas PLP 1.05, Etsy 1.14, Klarna 1.17,
           Faire 1.44. GhostMark's catalogue is the second kind, and it is
           MIXED -- flat-lay tees next to totes, mugs and candles whose source
           frames are landscape. Square is the only crop that does not
           systematically damage one half of a mixed catalogue.

        2. THE OLD CROP WAS VISIBLY DESTROYING SHOTS. At 140% the Workshop Tote
           and the Atelier Hoodie -- both landscape source frames -- were
           padded out with dead environment above and below the subject, and
           the Studio Tee lifestyle shot had the model's head cut off. Fixing
           the density and fixing the crop damage are the same edit.

        Do NOT reach for a taller ratio again without re-checking the
        photography. If the catalogue ever moves to on-body shooting, 4:5
        (`pb-[125%]`, lululemon accessories measures 0.82) is the next stop --
        not 5:7.
      -->
      <NuxtLink
        :to="`/products/${encodeURIComponent(product.handle || product.id)}`"
        class="leading-[24px] items-center hover:underline relative w-full h-full overflow-hidden pb-[100%] bg-cream-tile block group ring-1 ring-inset ring-ink-200/60 transition-shadow hover:ring-ink-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-cream-tile"
      >
        <!--
          REST image: z-[1], the merchandiser-chosen `thumbnail`. Always the
          image the card sits on.

          This layering was previously INVERTED: the alternate image was z-[2]
          at `opacity-100` and faded OUT on hover, so every card in the grid
          rested on `images[1]` and revealed the thumbnail only when you
          pointed at it. The old comment described that as intended, which is
          how it survived review, the variable named `hoverImage` was in fact
          the at-rest image, so nobody reading the code saw a contradiction.

          Two things were wrong with it. lululemon, Urban Outfitters and
          Selfridges all rest on the primary and reveal the alternate, so it
          read backwards to anyone used to a fashion grid. More concretely, it
          desynced browse from cart, wishlist and search, all three read
          `thumbnail`, so the same product wore two different faces depending
          on where you met it.
        -->
        <!--
          `thumbnailFailed` is why the `v-if` is not just `product.thumbnail`.

          The guard used to be `v-if="product.thumbnail"` alone, which handles
          exactly one of the two ways a product can have no picture:

            absent: no thumbnail on the record. Handled: placeholder renders.
            broken: a thumbnail URL that 404s. NOT handled: the <img> was
                      rendered, the fetch failed, and the card collapsed to raw
                      alt text ("Heavyweight Sweatshirt - Black") on bare grey.

          The second case is live right now, two seeded products share an
          Unsplash id that has since been deleted, so a real customer sees
          filenames-as-design in the middle of the grid. Every reference grid
          (David, UGLYCASH, Shopify Supply via Mobbin) keeps the tile at full
          aspect ratio with a neutral fill; none let it collapse to text.

          So `@error` flips the same flag the absent case already sets, and both
          failure modes land on the placeholder that was always there.
        -->
        <figure class="absolute top-0 left-0 w-full h-full z-[1]">
          <img
            v-if="product.thumbnail && !thumbnailFailed"
            :src="product.thumbnail"
            :alt="product.title"
            class="w-full h-full object-cover"
            loading="lazy"
            @error="thumbnailFailed = true"
          />
          <div v-else class="flex h-full w-full items-center justify-center text-ink-400">
            <Icon name="image-placeholder" :size="40" :stroke-width="1.5" />
          </div>
        </figure>

        <!--
          ALTERNATE image: z-[2], transparent at rest, fades IN on hover.
          `aria-hidden` because it is the same product: announcing a second
          identical alt string to a screen reader adds nothing.
          `motion-reduce:transition-none` honours a reduced-motion preference:
          the swap still happens, it just doesn't animate.
        -->
        <!--
          The alternate needs the opposite treatment to the primary. A broken
          PRIMARY should fall back to the placeholder, because the tile must
          show something. A broken ALTERNATE should remove the whole hover
          layer instead, substituting a placeholder here would mean hovering a
          perfectly good product photo wipes it to a grey icon, which is worse
          than having no hover swap at all. Hence `alternateFailed` gates the
          <figure>, not the <img>.
        -->
        <figure
          v-if="alternateImage && !alternateFailed"
          aria-hidden="true"
          class="absolute top-0 left-0 w-full h-full opacity-0 transition-opacity duration-200 ease-in-out z-[2] group-hover:opacity-100 motion-reduce:transition-none"
        >
          <img
            :src="alternateImage"
            alt=""
            class="w-full h-full object-cover"
            loading="lazy"
            @error="alternateFailed = true"
          />
        </figure>
      </NuxtLink>

      <!--
        META BLOCK: eyebrow, then title + heart, then price, then commerce.

        The chip used to be absolutely positioned OVER the photograph. It is
        now an eyebrow above the title, for three reasons:

        1. No major apparel reference puts a status chip on the photo.
           lululemon sets "TRENDING" and "BEST GIFT" in the meta block above
           the title; Urban Outfitters and Selfridges put nothing on the image
           but the heart. GhostMark was the outlier.
        2. This card's own chip comment said the goal was to "keep the photo as
           the dominant visual", and then overlaid the photo to achieve it.
           Capping to one chip treated the symptom; moving it removes the
           cause, and the photo is now completely clean.
        3. It was actively misleading. Catalogue photography is assigned per
           CATEGORY, not per product, 24 imaged products share just 10 image
           sets, so those claims were landing on stock photos of unrelated
           objects: "MADE IN EUROPE" over a candle, "BEST SELLER" over a photo
           of reading glasses.

        Net vertical cost is zero: an absolute overlay was replaced, not added
        to, and Bug 21 (a 3-chip strip wrapping at ≤390px and eating the top of
        the thumbnail) is now impossible by construction: there is no overlay
        left to eat anything.
      -->
      <div class="mt-[0.6rem]">
        <!--
          Rendered unconditionally, the component reserves the eyebrow line
          even when there are no chips, so cards with and without one keep
          their titles and prices on the same baseline across a grid row.
        -->
        <ProductCardChips :chips="visibleChips" />

        <!--
          Only the TITLE shares a row with the heart. Price and commerce line
          sit below it at the card's full width.

          They used to be inside this flex column too, which meant they were
          laid out against `card width - 44px heart - gap`. At 390px the card
          is 151px wide, so the text column was ~97px and "per piece · no
          minimum" wrapped onto two lines, breaking the single-line meta row
          the whole design depends on for scanning down a column. The heart
          only ever needed to align with the title.
        -->
        <div class="flex gap-[0.6rem] justify-between items-start">
        <div class="min-w-0 flex-1">
          <NuxtLink
            :to="`/products/${encodeURIComponent(product.handle || product.id)}`"
            :aria-label="product.title"
            class="leading-[24px] flex items-center p-0 hover:no-underline rounded-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-cream-tile"
          >
            <!--
              The title box always reserves TWO lines.

              `line-clamp-2` caps the title at two lines but did not reserve
              them, so a one-line title ("Tech Pouch") produced a shorter box
              than a two-line one ("Heavyweight Sweatshirt - Black"). Everything
              below (price, and now the commerce meta line) was pushed up or
              down accordingly, so in any grid row containing a single wrapped
              title the price rows across that row did not align. At 4-up that
              is visible on nearly every row and reads as a broken grid.

              The min-height is exactly 2x the line-height already declared on
              this element (1.6rem mobile, 2.4rem from `lg`), so the reserved
              box and the rendered text can never disagree. It is a spacing
              value derived from existing type tokens, not a new type size.

              `text-balance` keeps a two-line title from leaving one orphaned
              word on the second line.
            -->
            <!--
              THE VISIBLE TITLE IS THE FAMILY NAME, NOT THE RAW TITLE.

              12 of the 26 live products are one half of a near-identical pair
              whose only difference is a suffix: "Steel Bottle - 500ml" beside
              "Steel Bottle - 750ml", "Ceramic Mug - Cream" beside "- Sage".
              Rendered whole, the differentiating half lands at the END of the
              string, which is the least scannable position on the card: the
              eye has already read the shared prefix on the card next to it.

              So `resolveVariantDescriptor` splits the family from the
              differentiator and the differentiator moves to its own fixed slot
              on the price row (see ProductCardVariant). Where nothing was
              promoted, `family` IS the title verbatim, so a product with no
              suffix renders exactly as before.

              THE ACCESSIBLE NAME STAYS WHOLE. `product.title` is still what
              the link announces, because browse, cart, wishlist and search
              must all answer to the same words: a customer who finds "Steel
              Bottle 750ml" by screen reader on a card has to be able to find
              the same string in the cart. CHECKOUT asked for this explicitly
              and is keeping raw `item.title` on its rows for the same reason.
              The split is a density optimisation for a 4-up grid, and it stops
              at the pixels.
            -->
            <!--
              RESERVE: two lines below `lg`, exactly one from `lg` up.

              The two-line reserve was right when it landed and is still right
              on mobile, where a 2-up grid gives each card ~163px and
              "Heavyweight Sweatshirt" genuinely wraps. From `lg` the grid is
              4-up at ~289px, the title is 16px, and promoting the variant
              suffix out of the title made every family name shorter still.
              Measured across all 24 cards at 1440: 24 of 24 render on ONE
              line, so the second reserved line was empty on every card in the
              catalogue, costing 38px of dead space under every title. With the
              price row now carrying the variant token, that gap read as a
              layout fault rather than as breathing room.

              The clamp changes WITH the reserve, and that pairing is the whole
              point: `lg:line-clamp-1` makes two lines impossible at `lg`, so a
              one-line reserve can never disagree with the rendered text. The
              alignment guarantee is preserved by CONSTRUCTION rather than by
              the observation that today's titles happen to fit, which is what
              makes this safe against a future product called something long.
              The trade is that such a title truncates at `lg` instead of
              wrapping; the full string stays available in the link's
              `aria-label` and as the native tooltip, and nothing in the live
              catalogue truncates today (longest family name: "Heavyweight
              Sweatshirt", 22 characters against roughly 30 that fit).
            -->
            <p
              :title="product.title"
              class="leading-[16px] lg:leading-[24px] text-[13px] lg:text-[16px] mb-[2px] line-clamp-2 lg:line-clamp-1 min-h-[3.2rem] lg:min-h-[2.4rem] text-balance"
            >
              {{ variant.family }}
            </p>
          </NuxtLink>
        </div>
        <!--
          Touch target fix (WCAG 2.1 AA, 44x44 minimum). The heart icon stays
          visually small (20x20) because it is decorative chrome on the meta
          row, but the BUTTON itself must be a 44x44 hit zone. We use the
          `-m-2 p-2` negative-margin / padding pair to expand the tap area
          without altering the layout footprint, so the title column to the
          left does not reflow. `grid place-items-center` keeps the icon
          perfectly centred regardless of the larger box.
        -->
        <button
          type="button"
          class="grid place-items-center min-h-[44px] min-w-[44px] shrink-0 -m-2 p-2 rounded-full cursor-pointer bg-transparent border-none outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-cream-tile transition-transform duration-200 ease-in-out hover:scale-[1.1] motion-reduce:transition-none"
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

          <!--
            Price. Unchanged in size and weight from the title above it, the
            equal-weight pairing is deliberate and is not a hierarchy failure.

            Two fixes:
            1. `tabular-nums`. In a 4-up grid proportional figures make the
               price column visibly ragged, because a `1` is narrower than a
               `4`. Tabular figures let the eye run straight down the column.
            2. "From" is now conditional. It used to print on every card. Of
               26 catalogue products exactly ONE (the gift card) has variants
               that differ in price, every tee, mug and bottle has a single
               price across all its sizes. "From £22.00" on a one-price tee
               reads as quote pricing and quietly undercuts the buy-as-is
               proposition. It now appears only where the figure really is a
               floor: POD volume tiers, and genuine per-variant denominations.
          -->
          <!--
            PRICE ROW: price left, variant differentiator right.

            The row used to hold the price alone. Measured at 1440 on
            /products, "£35.00" occupies ~55px of a 289px card, so roughly 80%
            of this row was whitespace on all 24 cards. The differentiator goes
            there because it costs no vertical rhythm at all, and because the
            two facts that genuinely vary between two cards of the same family
            are exactly these two: what it costs and which one it is.

            `items-baseline` so the price and a mono spec label sit on a shared
            baseline despite different faces and x-heights. `gap-2` guarantees
            they can never touch when a long colourway meets a four-figure
            price; the variant is `shrink-0` and the price is allowed to be the
            flexible one, because a truncated price is a bug and a truncated
            colourway is merely unfortunate (in practice neither truncates:
            longest live pairing is "£89.00" against "FADED POWDER").
          -->
          <div class="flex items-baseline justify-between gap-2">
            <p
              v-if="price"
              class="leading-[16px] lg:leading-[24px] text-[13px] lg:text-[16px] text-ink-700 tabular-nums"
            >
              <template v-if="commerce.fromPrice">From </template>{{ price }}
            </p>
            <ProductCardVariant :variant="variant" />
          </div>

          <!--
            COMMERCE META LINE: the disclosure this card previously lacked.

            The store runs two businesses out of one catalogue: apparel you buy
            one of, and POD goods with a 25-piece minimum. Nothing before the
            product page told you which was which. A chip could not fix that:
            a badge present on 40% of cards is unscannable by construction,
            because the eye cannot compare a column of mostly-absent things.

            So this follows Faire, where the minimum is pointedly NOT a badge:
            it is small grey meta text under the price, on EVERY card, and
            badges are reserved for the genuinely exceptional ("Top Shop",
            "Up to 10% off"). Checked against real Faire screens rather than
            taken on trust: a brand with no rating still renders "$318 min",
            and a brand with no minimum renders "$0 min" rather than omitting
            the line. Uniform shape, varying number: that is what makes it
            scannable, and it is why this line renders unconditionally.

            Both states name the price basis ("per piece") so the ONLY thing
            that varies down a column is the minimum itself. That also fixes
            the brief's specific complaint: "From £32.00" on a Tech Pouch read
            as the price of one pouch when it is the per-unit price on a
            25-piece run.

            Type: `text-micro` (12px / 1.45 / normal tracking), an existing
            declared token, so this adds no font size to an app already
            rendering 41 against 6. Deliberately NOT `text-eyebrow`, which is
            also 12px but carries 0.08em tracking and 1.2 leading: it is an
            uppercase-label token and reads loose on sentence-case figures.
            `tabular-nums` matches the price above so "25" and "15" occupy the
            same width. Subordination to the title and price is carried by
            COLOUR (ink-500 vs ink-950), not by size, at 13px/12px on mobile
            a size step would be too small to read as hierarchy anyway, which
            is exactly how lululemon sets its own third line.
          -->
          <p
            class="mt-[2px] text-micro text-ink-500 tabular-nums"
            data-test="card-commerce-meta"
          >
            {{ commerceMeta }}
          </p>
      </div>
    </div>
  </li>
</template>

<script setup lang="ts">
import Icon from '~/components/ui/Icon.vue'
import {
  modeFromProductType,
  plpChipsForMode,
  filterChipKeysByCapability,
  resolveCardCommerce,
  type Chip,
  type CommerceMode,
} from '~/utils/chips'
import { formatMoney } from '~/utils/money'
import { resolveVariantDescriptor } from '~/utils/productVariant'

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
  /** Medusa StoreProductType: `value` is the human-readable label (e.g. `'apparel'`, `'pod'`). */
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
     * Medusa product type, when present we derive the chip mode from
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

/**
 * Normalise an image URL for comparison only, never for rendering.
 *
 * Strips the query string and trailing slash so a CDN-parameterised variant of
 * the thumbnail (`...jpg?w=800`) is recognised as the same asset. Without this
 * the "is the alternate actually different?" test below passes on URLs that
 * are the same picture, producing a cross-fade between identical frames, a
 * hover that appears broken rather than absent.
 */
const sameAsset = (a?: string | null, b?: string | null): boolean => {
  if (!a || !b) return false
  const strip = (u: string) => u.split('?')[0]!.replace(/\/+$/, '')
  return strip(a) === strip(b)
}

/**
 * The image revealed on hover. Explicit prop wins; otherwise the first image
 * that is genuinely a different asset from the thumbnail.
 *
 * This used to take `images[1]` blindly. Scanning for the first distinct image
 * instead is correct whenever Medusa's `thumbnail` is not `images[0]`, in
 * that case index 1 can BE the thumbnail, and the old code produced a 200ms
 * fade between two copies of the same photograph.
 *
 * KNOWN LIMITATION, deliberately not papered over here. Catalogue photography
 * is assigned per category rather than per product: 24 imaged products share
 * 10 image sets, and only `studio-tee-charcoal` / `studio-tee-cream` have
 * unique photography (and they are colourways of each other). So the alternate
 * revealed on hover is frequently a photo that other products also use. A card
 * cannot detect that (it only ever sees its own product) and the correct
 * gate ("is this image unique in the catalogue?") would disable the swap on
 * 100% of the current catalogue. This is a catalogue defect, not a component
 * one; the component is hardened as far as its own data allows.
 */
const alternateImage = computed<string | undefined>(() => {
  if (props.hoverImage) return props.hoverImage
  const thumb = props.product.thumbnail
  const distinct = (props.product.images ?? [])
    .map(i => i?.url)
    .find((u): u is string => typeof u === 'string' && !!u && !sameAsset(u, thumb))
  return distinct ?? undefined
})

/**
 * Load-failure flags for the two <img> elements above.
 *
 * These MUST be reset when the URL changes. A grid renders these cards in a
 * `v-for`, and Vue reuses the component instance when the underlying list is
 * re-sorted, filtered or paginated, the DOM node survives and only the props
 * change. Without the watcher a single broken product "infects" whichever card
 * slot it occupied: the next product to be rendered into that slot inherits
 * `thumbnailFailed === true` and shows the placeholder despite having a
 * perfectly good photo. That failure mode is much harder to spot than the bug
 * being fixed, because it only appears after a sort or filter.
 *
 * Watching the resolved URLs (not the product id) is deliberate: it is the
 * src that the <img> actually reacts to, so it is the src that decides whether
 * a previous failure is still meaningful.
 */
const thumbnailFailed = ref(false)
const alternateFailed = ref(false)

watch(
  () => props.product.thumbnail,
  () => { thumbnailFailed.value = false },
)
watch(alternateImage, () => { alternateFailed.value = false })

// Chip resolution: read raw chip keys from product metadata, then run them
// through the mode-aware catalog in `~/utils/chips`.
//
// Sources, in priority order:
//   1. `metadata.chips: string[]`     preferred, matches the v2 IA taxonomy.
//   2. `metadata.badges: string[]`    legacy seed shape, kept for backward
//                                     compatibility while the catalog migrates.
//   3. `product.tags[].value`         Medusa StoreProductTag fallback so
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
  const merged = Array.from(new Set([...fromChips, ...fromBadges, ...fromTags]))
  // Suppress capability claims the product's own metadata denies. Applied
  // HERE rather than inside `visibleChipsForMode` because this is the first
  // point at which the product is in scope: the mode filter downstream only
  // ever receives keys and a mode, so it cannot know that a `custom_print`
  // chip belongs to a sticker sheet with no print locations. See
  // `filterChipKeysByCapability` for the measured defect and for why the
  // check is a strict `=== false` and not a truthy test.
  return filterChipKeysByCapability(merged, meta)
})

// Resolve the effective chip mode. Priority order:
//   1. `product.type.value` from Medusa (canonical source: `'apparel'` or
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

// PLP chip resolution. `plpChipsForMode` additionally drops chips flagged
// `plp: false`, the ubiquitous ones (MADE IN EUROPE, on 24 of 26 products)
// and the ones the commerce meta line now states properly (FROM 25 UNITS,
// POD READY). We cap here rather than in the child so a future consumer
// (e.g. a PDP recap) can still take the full list from `visibleChipsForMode`.
const visibleChips = computed<Chip[]>(() =>
  plpChipsForMode(chipKeys.value, productMode.value, 2),
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
  // Formatting is delegated to `~/utils/money`, the local implementation
  // this replaces divided by 100. Amounts are Medusa v2 major units.
  return formatMoney({ amount, currency_code: currency })
})

// Do this product's variants actually differ in price? Drives whether the
// price earns a "From" prefix. Across the live catalogue exactly one product
// (the gift card, with real denominations) does; every tee, mug and bottle is
// single-priced across its sizes.
const priceVaries = computed<boolean>(() => {
  const amounts = new Set<number>()
  for (const v of props.product.variants ?? []) {
    const a = v as any
    const amt = a?.calculated_price?.calculated_amount ?? a?.prices?.[0]?.amount
    if (typeof amt === 'number') amounts.add(amt)
    if (amounts.size > 1) return true
  }
  return false
})

// The commerce facts this card discloses. Resolved through the product TYPE,
// never through raw `metadata.moq`: see `resolveCardCommerce` for the full
// reasoning, and why reading the metadata directly would make browse
// contradict the product page.
const commerce = computed(() =>
  resolveCardCommerce(
    props.product?.type?.value,
    props.product?.metadata ?? null,
    priceVaries.value,
  ),
)

/**
 * The meta-line sentence.
 *
 * Kept to a fixed two-clause shape across every state so a column of these
 * reads as a table: the price basis is always stated, and the only thing that
 * changes is the constraint on the right of the middot. "piece" is the noun
 * the PDP already uses ("Minimum order: 25 pieces"), so browse and detail
 * speak with one voice.
 */
const commerceMeta = computed<string>(() => {
  const c = commerce.value
  if (c.kind === 'giftcard') return 'digital · delivered by email'
  if (c.kind === 'minimum') return `per piece · min ${c.moq}`
  return 'per piece · no minimum'
})

/**
 * The differentiator that tells this product apart from its near-twin.
 *
 * Resolved from real product data in priority order: a multi-value `Color`
 * option first, then a classified " - " title suffix, then a single-value
 * `Size` option that is a genuine measure. See `~/utils/productVariant` for
 * the full reasoning, including an honest note on which branch is a heuristic
 * and why it is still the right call for these nine products.
 *
 * Always returns a descriptor, so `variant.family` is safe to render as the
 * title: where nothing was promoted it is `product.title` verbatim.
 */
const variant = computed(() => resolveVariantDescriptor(props.product))

// Wishlist: delegate persistence to the composable. We pass the resolved
// price string back into the wishlist item so the wishlist drawer can render
// the cached sticker without re-querying Medusa.
const wishlist = useWishlist()
const isWishlisted = computed(() => wishlist.has(props.product.id))
// Action-aware aria-label so SR users hear "Remove ..." once the heart is
// filled, not the now-incorrect "Add ..." prompt. Falls back to a generic
// "item" string if title is ever missing, defensive against partial data.
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
