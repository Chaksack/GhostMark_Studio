<template>
  <div class="lg:pt-[118px]">
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
      <!-- 3. Best sellers -->
      <BestSellers :products="bestSellers" />

      <!--
        4. Case-study mosaic — the editorial centrepiece. Sits between
        product-led grids (BestSellers / Discover) so the page reads as
        product → proof-of-work → product. Self-contained section: it
        paints its own warmGrey band + 6/10rem vertical rhythm and does
        not need the parent flex gap. All six tiles are placeholders
        until real client work + /case-studies/* pages ship — see
        CaseStudyMosaic.vue for the swap-out instructions.
      -->
      <CaseStudyMosaic />

      <!--
        5. Discover — curated landings.
        RealLifeShowcase + BrandShowcase intentionally omitted: we don't have
        real lifestyle photography to fill the former, and we are the brand
        ourselves, not a multi-brand reseller for the latter. Restraint is
        edited content, not missing content — empty grey placeholders read
        as "half-built." Components remain on disk for future content drops.
      -->
      <DiscoverSection :products="bestSellers" />

      <!-- 5. Testimonials -->
      <TestimonialCarousel />

      <!-- 6. Recently added -->
      <RecentlyAdded :products="recentProducts" />

      <!--
        7. FAQ + Newsletter — siblings inside one wrapper, per merchery.
        Wrapper margin/gap mirror the section ramp above so the FAQ band
        doesn't sit flush against RecentlyAdded on phones.
      -->
      <div class="mx-auto mb-10 mt-6 flex w-full max-w-screen-3xl flex-col gap-8 px-5 sm:mb-12 sm:mt-8 sm:gap-10 sm:px-6 md:mt-10 md:gap-12 lg:mt-[3rem] lg:px-8">
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

const { data: bestSellerData } = await useAsyncData(
  'home:best-sellers',
  async () => sdk.store.product.list({
    limit: 10,
    fields: 'id,handle,title,subtitle,description,thumbnail,*images,*variants.calculated_price,*variants.options.value,*options.values,metadata,*tags',
    ...(regionState.regionId.value ? { region_id: regionState.regionId.value } : {}),
  } as any),
  { watch: [() => regionState.regionId.value] },
)

const { data: recentData } = await useAsyncData(
  'home:recently-added',
  async () => sdk.store.product.list({
    limit: 10,
    order: '-created_at',
    fields: 'id,handle,title,subtitle,description,thumbnail,*images,*variants.calculated_price,*variants.options.value,*options.values,metadata,*tags',
    ...(regionState.regionId.value ? { region_id: regionState.regionId.value } : {}),
  } as any),
  { watch: [() => regionState.regionId.value] },
)

const bestSellers = computed(() => ((bestSellerData.value as any)?.products ?? []) as any[])
const recentProducts = computed(() => ((recentData.value as any)?.products ?? []) as any[])

onMounted(() => {
  useCart().ensureCart()
})
</script>
