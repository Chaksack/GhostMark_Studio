<template>
  <div>
    <div class="relative mx-auto w-full max-w-rail px-gutter">
      <!-- Breadcrumb: flow at <md so it never collides with a wrapping H1.
           Floats absolute at md+ where there's vertical headroom. -->
      <!--
        `md:z-10` is load bearing and is not decoration.

        At md+ this nav goes `absolute` while the H1 below it is `relative`,
        and BOTH carry `z-index: auto`. Two positioned elements with auto
        z-index paint in DOM order, so the H1, being later, painted OVER the
        breadcrumb. The H1's box extends up across this row even though its
        glyphs do not, so the link looked completely normal and was not
        clickable. Measured with elementFromPoint at the link's centre: the hit
        returned `H1.relative`, not the anchor, at 768, 1024 and 1440 on
        /shop, /products and /shop/canon. It worked at 390 only because the nav
        is `static` there and the two never overlap.

        Raised by STUDIO-QA, who also caught the trap that nearly hid it: a
        page-wide `getByRole('link', {name:'Home'}).first()` matches the
        HEADER's home link, which is fine, and reports a false pass. Scope
        breadcrumb assertions to `main`.
      -->
      <nav class="pt-[2rem] md:absolute md:top-[2rem] md:z-10 md:pt-0" aria-label="breadcrumbs">
        <ol class="flex flex-wrap items-center gap-x-1 gap-y-0">
          <li><NuxtLink to="/" class="gm-tap-44 text-sm text-greyText hover:text-ink-950 hover:underline">Home</NuxtLink></li>
          <li class="text-sm text-greyText" aria-hidden="true">/</li>
          <li><NuxtLink to="/shop" class="gm-tap-44 text-sm text-greyText hover:text-ink-950 hover:underline">Shop</NuxtLink></li>
          <li class="text-sm text-greyText" aria-hidden="true">/</li>
          <li><span class="text-sm text-ink-950" aria-current="page">Canon</span></li>
        </ol>
      </nav>

      <p class="pt-[2rem] md:pt-[6rem] lg:pt-[10rem] text-[12px] uppercase tracking-[0.18em] text-greyText mb-3">2026 Drop</p>
      <h1 class="gm-display gm-display-xl relative mt-0 mb-[3rem] max-w-[1100px] text-ink-950 lg:mb-[4rem]">
        The Studio Canon
      </h1>
      <p class="mb-[6rem] max-w-[560px]">
        Our own line. Pieces we wear, give, and stand by, designed in the studio, produced in low runs. Buy one, or invite a team to put their mark on the next batch via /studio.
      </p>

      <!-- Grid: 2-up mobile -> 3-up tablet -> 4-up desktop.

           This used to stop at 3-up on lg, with the comment "keeps each piece's
           photography weighty". Measured at 1440x900 that produced a 411x704
           card: 78% of the fold, so the first screen of the canon held three
           photographs and not one price, title or product name. That is not
           weight, it is a page you cannot read. Verified in-browser before
           changing it.

           It still stops one step short of the wider catalogue -- no
           `xl:grid-cols-5` -- because the canon IS a curated twelve-piece line
           and a slightly larger tile is a defensible editorial signal. 4-up at
           1440 gives a 300px square photograph, which is larger than every
           merch reference I measured (Faire 184, Etsy 261, adidas 276). -->
      <ul v-if="!pending && sortedProducts.length" class="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-5 lg:gap-y-10">
        <ProductCard v-for="p in sortedProducts" :key="p.id" :product="p" mode="shop" />
      </ul>
      <div v-else-if="pending" class="py-20 text-center text-ink-600">Loading the canon&hellip;</div>
      <div v-else class="py-12 text-center">
        <p class="mx-auto max-w-[440px] font-body text-body text-ink-500">
          The canon is restocking. Check back next week, or
          <NuxtLink to="/shop" class="ml-1 text-ink-950 underline decoration-dashed underline-offset-4 hover:decoration-solid">
            browse the wider Shop catalogue
          </NuxtLink>.
        </p>
      </div>
    </div>

    <div class="mx-auto w-full max-w-rail px-gutter mt-16 flex flex-col gap-12 mb-12">
      <AppNewsletter />
    </div>
  </div>
</template>

<script setup lang="ts">
import { applySort, useProductTypeIds } from '~/utils/filters'

useHead({
  title: 'The Studio Canon · GhostMark Studio',
  meta: [{ name: 'description', content: 'The GhostMark Canon: our own line of pieces, designed in Bordeaux, produced in low runs.' }],
})

const sdk = useMedusaClient()
const regionState = useRegion()
await regionState.ensureRegion()

// Resolve apparel type_id once, Studio Canon is the curated apparel drop, so
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
      fields: 'id,handle,title,subtitle,description,thumbnail,*images,*variants.calculated_price,*variants.options.value,*options.title,*options.values,*type,metadata,*tags',
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
