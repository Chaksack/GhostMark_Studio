<template>
  <div>
    <!-- 1. Hero -->
    <HeroSection />

    <!-- 2. Client logo bar -->
    <LogoBar />

    <div class="mt-14 flex flex-col gap-16">
      <!-- 3. Best sellers -->
      <BestSellers :products="bestSellers" />

      <!-- 4. Products in real life -->
      <RealLifeShowcase />

      <!-- 5. Discover -->
      <DiscoverSection />

      <!-- 6. Best selling brands -->
      <BrandShowcase />

      <!-- 7. Testimonials -->
      <TestimonialCarousel />

      <!-- 8. Recently added -->
      <RecentlyAdded :products="recentProducts" />

      <!-- 9. FAQ -->
      <AppFaq />

      <!-- 10. Newsletter -->
      <AppNewletter />
    </div>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'Home' })

const sdk = useMedusaClient()

const { data: bestSellerData } = await useAsyncData('home:best-sellers', async () => {
  return await sdk.store.product.list({ limit: 10 } as any)
})

const { data: recentData } = await useAsyncData('home:recently-added', async () => {
  return await sdk.store.product.list({ limit: 10, order: '-created_at' } as any)
})

const bestSellers = computed(() => ((bestSellerData.value as any)?.products ?? []) as any[])
const recentProducts = computed(() => ((recentData.value as any)?.products ?? []) as any[])

onMounted(() => {
  useRegion().ensureRegion()
  useCart().ensureCart()
})
</script>
