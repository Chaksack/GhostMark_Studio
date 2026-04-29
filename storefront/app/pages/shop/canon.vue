<template>
  <div class="lg:pt-[118px]">
    <div class="relative px-[1.5rem] lg:px-[3rem]">
      <!-- Breadcrumb — flow at <md so it never collides with a wrapping H1.
           Floats absolute at md+ where there's vertical headroom. -->
      <nav class="pt-[2rem] md:absolute md:top-[2rem] md:pt-0" aria-label="breadcrumbs">
        <ol class="flex flex-wrap items-center gap-x-1 gap-y-0">
          <li><NuxtLink to="/" class="text-sm text-greyText hover:text-ink-950 hover:underline">Home</NuxtLink></li>
          <li class="text-sm text-greyText" aria-hidden="true">/</li>
          <li><NuxtLink to="/shop" class="text-sm text-greyText hover:text-ink-950 hover:underline">Shop</NuxtLink></li>
          <li class="text-sm text-greyText" aria-hidden="true">/</li>
          <li><span class="text-sm text-ink-950" aria-current="page">Canon</span></li>
        </ol>
      </nav>

      <p class="pt-[2rem] md:pt-[6rem] lg:pt-[10rem] text-[12px] uppercase tracking-[0.18em] text-greyText mb-3">2026 Drop</p>
      <h1 class="relative mb-[3rem] max-w-[110rem] mt-0 lg:mb-[4rem] text-[4rem] sm:text-[4.4rem] lg:text-[8rem] leading-[4.4rem] sm:leading-[4.8rem] lg:leading-[8.8rem] tracking-[-0.01em]">
        The Studio Canon
      </h1>
      <p class="mb-[6rem] max-w-[56rem]">
        Our own line. Pieces we wear, give, and stand by — designed in the studio, produced in low runs. Buy one, or invite a team to put their mark on the next batch via /studio.
      </p>

      <!-- Grid: 2-up mobile -> 2-up sm (keeps photo size generous on phones) ->
           3-up tablet -> 3-up desktop (the canon is a curated short list, so we
           don't push to 4-up on lg — keeps each piece's photography weighty). -->
      <ul v-if="!pending && sortedProducts.length" class="grid grid-cols-2 gap-[1.6rem] md:grid-cols-3 lg:gap-[3rem]">
        <ProductCard v-for="p in sortedProducts" :key="p.id" :product="p" mode="shop" />
      </ul>
      <div v-else-if="pending" class="py-20 text-center text-zinc-500">Loading the canon&hellip;</div>
      <div v-else class="py-12 text-center">
        <p class="mx-auto max-w-[44rem] font-body text-body text-ink-500">
          The canon is restocking. Check back next week, or
          <NuxtLink to="/shop" class="ml-1 text-ink-950 underline decoration-dashed underline-offset-4 hover:decoration-solid">
            browse the wider Shop catalogue
          </NuxtLink>.
        </p>
      </div>
    </div>

    <div class="mx-auto w-full max-w-screen-3xl px-5 sm:px-6 lg:px-8 mt-16 flex flex-col gap-12 mb-12">
      <AppNewsletter />
    </div>
  </div>
</template>

<script setup lang="ts">
import { applySort, useProductTypeIds } from '~/utils/filters'

useHead({
  title: 'The Studio Canon · GhostMark Studio',
  meta: [{ name: 'description', content: 'The GhostMark Canon — our own line of pieces, designed in Bordeaux, produced in low runs.' }],
})

const sdk = useMedusaClient()
const regionState = useRegion()
await regionState.ensureRegion()

// Resolve apparel type_id once — Studio Canon is the curated apparel drop, so
// the canon page is even stricter than /shop (only apparel products, never
// POD). Falls back to client-side filter on `product.type.value` if the
// backend doesn't expose the type-id lookup yet.
const { typeIds, ensureTypeIds } = useProductTypeIds()
await ensureTypeIds()
const apparelTypeId = computed(() => typeIds.value['apparel'] ?? null)

const { data, pending } = await useAsyncData(
  () => `shop-canon-${apparelTypeId.value ?? 'all'}-${regionState.regionId.value ?? 'no-region'}`,
  async () => {
    const args: Record<string, unknown> = {
      limit: 12,
      fields: 'id,handle,title,subtitle,description,thumbnail,*images,*variants.calculated_price,*variants.options.value,*options.values,*type,metadata,*tags',
    }
    if (regionState.regionId.value) args.region_id = regionState.regionId.value
    if (apparelTypeId.value) args.type_id = [apparelTypeId.value]
    return sdk.store.product.list(args as any)
  },
  { watch: [() => regionState.regionId.value, apparelTypeId] },
)

const products = computed(() => (data.value as any)?.products ?? [])
const sortedProducts = computed(() => {
  const sorted = applySort(products.value, 'newest')
  if (apparelTypeId.value) return sorted // server already filtered
  return sorted.filter((p: any) => String(p?.type?.value ?? '').toLowerCase() === 'apparel')
})
</script>
