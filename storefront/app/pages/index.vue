<template>
  <div>
    <!-- 1. Hero -->
    <HeroSection />

    <!-- 2. Client logo bar -->
    <LogoBar />

    <!--
      Section rhythm. Mobile collapses to a 32px / 48px gap; desktop stays at
      the editorial 64px so the page reads as breathable without forcing the
      phone user to scroll past 100vh of dead space between bands.
    -->
    <div class="mt-8 flex flex-col gap-10 sm:mt-10 sm:gap-12 md:mt-12 md:gap-14 lg:mt-14 lg:gap-16">
      <!--
        3. Best sellers: D2C flavour.
        Filtered to product.type.value === 'apparel' so the band that follows
        the "Shop the Studio Canon" primary CTA stays consistent with what
        that CTA delivers (buy-as-is, no upload step). POD items still surface
        below in RecentlyAdded and via the secondary CTA.
      -->
      <BestSellers :products="bestSellersApparel" />

      <!--
        4. Case-study mosaic: the editorial centrepiece. Sits between
        product-led grids (BestSellers / Discover) so the page reads as
        product → proof-of-work → product. Self-contained section: it
        paints its own warmGrey band + 6/10rem vertical rhythm and does
        not need the parent flex gap. All six tiles are placeholders
        until real client work + /case-studies/* pages ship, see
        CaseStudyMosaic.vue for the swap-out instructions.
      -->
      <CaseStudyMosaic />

      <!--
        5. Discover: curated landings.
        RealLifeShowcase + BrandShowcase intentionally omitted: we don't have
        real lifestyle photography to fill the former, and we are the brand
        ourselves, not a multi-brand reseller for the latter. Restraint is
        edited content, not missing content, empty grey placeholders read
        as "half-built." Components remain on disk for future content drops.
      -->
      <DiscoverSection :products="bestSellers" />

      <!--
        DiscoverSection self-fetches up to 2 live Medusa collections (e.g.
        DTF, Hot Deals) and renders each as a shelf with real product cards.
        The `:products="bestSellers"` prop is the editorial fallback the
        component falls back to when the SDK returns 0 usable collections,
        so the band never collapses to dead space on a fresh/offline backend.
        Bestsellers is intentionally the full mixed-type list (apparel + POD)
        so the fallback rail isn't artificially D2C-only.
      -->

      <!-- 5. Testimonials -->
      <TestimonialCarousel />

      <!--
        6. Recently added: mixed feed.
        Intentionally NOT type-filtered: this is a "what's new" rail across
        the whole catalogue, so both apparel and POD items are welcome. The
        chronological lens does the merchandising work.
      -->
      <RecentlyAdded :products="recentProducts" />

      <!--
        7. FAQ + Newsletter: siblings inside one wrapper, per merchery.
        Wrapper margin/gap mirror the section ramp above so the FAQ band
        doesn't sit flush against RecentlyAdded on phones.
      -->
      <div class="mx-auto mb-10 mt-6 flex w-full max-w-rail flex-col gap-8 px-gutter sm:mb-12 sm:mt-8 sm:gap-10 md:mt-10 md:gap-12 lg:mt-[3rem]">
        <AppFaq />
        <AppNewsletter />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'Home' })

const sdk = useMedusaClient()
const regionState = useRegion()

// Resolve the active region BEFORE listing products. Without `region_id` on
// the request, Medusa returns variants with `calculated_price = null`, which
// silently strips every "From £X" price tag from the BestSellers and
// RecentlyAdded grids on the homepage. Same fix as `/products`.
await regionState.ensureRegion()

// Resolve the apparel type_id so BestSellers can be server-narrowed. The
// band only renders D2C-flavoured pieces (per the section comment above),
// so server-side filtering keeps the response tight (10 apparel items vs
// 10 mixed-then-filtered-to-maybe-3). If the resolver can't map the slug
// (endpoint not exposed, harvest empty), `apparelId` stays undefined and
// we fall back to the existing client-side `apparelOnly` filter below.
const typeRes = useProductTypes()
await typeRes.ensureResolved()
const apparelTypeId = computed<string | undefined>(() => typeRes.apparelId.value)

// `*type` is appended to the field selection so `product.type.value` is
// hydrated client-side. Without it, the apparel/pod split below silently
// returns empty arrays and the BestSellers band collapses. Same shape the
// PLP uses, kept aligned on purpose.
const PRODUCT_LIST_FIELDS = 'id,handle,title,subtitle,description,thumbnail,*images,*variants.calculated_price,*variants.options.value,*options.values,metadata,*tags,*type'

// BestSellers band is apparel-only, pass `type_id` so the backend does
// the narrowing. Cache key includes `apparelTypeId` so the request refetches
// if the resolver lands its result after first render (SSR vs CSR drift).
const { data: bestSellerData } = await useAsyncData(
  () => `home:best-sellers-${apparelTypeId.value ?? 'unresolved'}-${regionState.regionId.value ?? 'no-region'}`,
  async () => {
    const args: Record<string, unknown> = {
      limit: 10,
      fields: PRODUCT_LIST_FIELDS,
    }
    if (regionState.regionId.value) args.region_id = regionState.regionId.value
    if (apparelTypeId.value) args.type_id = [apparelTypeId.value]
    return sdk.store.product.list(args as any)
  },
  { watch: [() => regionState.regionId.value, apparelTypeId] },
)

const { data: recentData } = await useAsyncData(
  'home:recently-added',
  async () => sdk.store.product.list({
    limit: 10,
    order: '-created_at',
    fields: PRODUCT_LIST_FIELDS,
    ...(regionState.regionId.value ? { region_id: regionState.regionId.value } : {}),
  } as any),
  { watch: [() => regionState.regionId.value] },
)

const bestSellers = computed(() => ((bestSellerData.value as any)?.products ?? []) as any[])
const recentProducts = computed(() => ((recentData.value as any)?.products ?? []) as any[])

/**
 * Defensive client-side narrowing. Backend taxonomy (see
 * project_product_taxonomy memo) uses `product.type.value` of either
 * 'apparel' (D2C buy-as-is) or 'pod' (upload + MOQ flow). When the
 * `type_id` lookup resolves, Medusa has already filtered, `apparelOnly`
 * is a no-op. When the lookup fails, this keeps the BestSellers band
 * accurate instead of leaking POD items into the D2C rail.
 */
const apparelOnly = (list: any[]) =>
  list.filter((p) => p?.type?.value?.toLowerCase() === 'apparel')

// If the SDK was filtered server-side, the list is already apparel-only and
// the client filter is a cheap pass-through. If unresolved, this narrows.
const bestSellersApparel = computed(() => (
  apparelTypeId.value ? bestSellers.value : apparelOnly(bestSellers.value)
))

onMounted(() => {
  useCart().ensureCart()
})
</script>
