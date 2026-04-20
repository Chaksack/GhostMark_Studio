<template>
  <div>
    <div class="mx-auto w-full max-w-screen-3xl px-5 sm:px-6 lg:px-8">
      <!-- Breadcrumb -->
      <nav class="flex items-center gap-1.5 py-4 text-[13px] text-zinc-500">
        <NuxtLink to="/" class="hover:text-zinc-950">Home</NuxtLink>
        <span>/</span>
        <NuxtLink to="/products" class="hover:text-zinc-950">Shop</NuxtLink>
        <span>/</span>
        <span class="text-zinc-950">{{ product?.title || 'Product' }}</span>
      </nav>

      <div v-if="pending" class="py-20 text-center text-zinc-500">Loading product&hellip;</div>
      <div v-else-if="!product" class="py-20 text-center text-zinc-500">Product not found.</div>

      <div v-else class="grid gap-8 pb-16 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12">
        <!-- Left: images -->
        <div>
          <div class="aspect-square overflow-hidden rounded-2xl bg-zinc-100">
            <img
              v-if="activeImage"
              class="h-full w-full object-cover"
              :src="activeImage"
              :alt="product.title"
            />
            <div v-else class="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-200/60 to-zinc-100">
              <svg class="h-16 w-16 text-zinc-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
            </div>
          </div>
          <!-- Thumbnail row -->
          <div v-if="images.length > 1" class="mt-3 flex gap-2 overflow-x-auto">
            <button
              v-for="(img, i) in images"
              :key="i"
              class="h-[72px] w-[72px] flex-shrink-0 overflow-hidden rounded-lg border-2 bg-zinc-100 transition"
              :class="activeImage === img ? 'border-zinc-950' : 'border-transparent hover:border-zinc-300'"
              @click="activeImage = img"
            >
              <img class="h-full w-full object-cover" :src="img" :alt="`View ${i + 1}`" />
            </button>
          </div>
        </div>

        <!-- Right: product info -->
        <div class="lg:sticky lg:top-28 lg:self-start">
          <h1 class="font-serif text-[32px] leading-[1.15] text-zinc-950 sm:text-[38px]">{{ product.title }}</h1>

          <div v-if="displayPrice" class="mt-3 flex items-baseline gap-2">
            <span class="text-[13px] text-zinc-500">Item price:</span>
            <span class="text-[16px] font-semibold text-zinc-950">{{ displayPrice }}</span>
          </div>

          <div class="mt-2 flex items-baseline gap-2">
            <span class="text-[13px] text-zinc-500">Lead time:</span>
            <span class="text-[14px] text-zinc-950">10-20 days</span>
          </div>

          <p class="mt-4 text-[15px] leading-relaxed text-zinc-600">
            {{ product.description || 'No description yet.' }}
          </p>

          <div class="mt-6 border-t border-zinc-200 pt-6">
            <h2 class="text-[14px] font-semibold uppercase tracking-wider text-zinc-500">Customize this product</h2>

            <!-- Variant selector -->
            <div v-if="variants.length > 1" class="mt-4">
              <label class="text-[13px] text-zinc-500" for="variant-select">Variant</label>
              <select
                id="variant-select"
                v-model="selectedVariantId"
                class="mt-1.5 w-full border border-zinc-200 bg-white px-3 py-2.5 text-[14px] text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-300"
              >
                <option v-for="v in variants" :key="v.id" :value="v.id">{{ v.title || v.sku || v.id }}</option>
              </select>
            </div>

            <!-- Quantity -->
            <div class="mt-4">
              <label class="text-[13px] text-zinc-500">Quantity</label>
              <div class="mt-1.5 flex items-center gap-0">
                <button
                  class="flex h-[42px] w-[42px] items-center justify-center border border-zinc-200 bg-white text-zinc-950 hover:bg-zinc-50 disabled:opacity-40"
                  :disabled="quantity <= 1"
                  @click="quantity--"
                  type="button"
                >&minus;</button>
                <div class="flex h-[42px] min-w-[56px] items-center justify-center border-y border-zinc-200 bg-white px-3 text-[14px] font-medium text-zinc-950">{{ quantity }}</div>
                <button
                  class="flex h-[42px] w-[42px] items-center justify-center border border-zinc-200 bg-white text-zinc-950 hover:bg-zinc-50"
                  @click="quantity++"
                  type="button"
                >+</button>
              </div>
            </div>
          </div>

          <div class="mt-6 flex flex-wrap gap-3">
            <button
              class="inline-flex h-[50px] flex-1 items-center justify-center bg-zinc-950 px-7 text-[14px] font-medium tracking-wide text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="!selectedVariantId || adding"
              @click="onAddToCart"
              type="button"
            >
              {{ adding ? 'Adding&hellip;' : 'Add to cart' }}
            </button>
            <button
              class="inline-flex h-[50px] w-[50px] items-center justify-center border border-zinc-200 bg-white text-zinc-400 hover:border-zinc-300 hover:text-zinc-950"
              type="button"
              aria-label="Add to favorites"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-4.6-9.5-8.7C.2 8.6 2.6 5.7 6 5.5c1.9-.1 3.2.8 4 1.8.8-1 2.1-1.9 4-1.8 3.4.2 5.8 3.1 3.5 6.8C19 16.4 12 21 12 21z"/></svg>
            </button>
          </div>

          <p v-if="addError" class="mt-3 text-[13px] text-red-700">{{ addError }}</p>
          <p v-if="addSuccess" class="mt-3 text-[13px] text-emerald-700">Added to cart!</p>

          <!-- Trust badges -->
          <div class="mt-8 grid grid-cols-2 gap-3">
            <div class="flex items-start gap-3 rounded-xl border border-zinc-200 bg-white p-3">
              <svg class="mt-0.5 h-5 w-5 shrink-0 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 12l2.5 2.5L16 9"/></svg>
              <div>
                <div class="text-[13px] font-semibold text-zinc-950">Worldwide delivery</div>
                <div class="text-[12px] text-zinc-500">EU, UK and USA</div>
              </div>
            </div>
            <div class="flex items-start gap-3 rounded-xl border border-zinc-200 bg-white p-3">
              <svg class="mt-0.5 h-5 w-5 shrink-0 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              <div>
                <div class="text-[13px] font-semibold text-zinc-950">Quality control</div>
                <div class="text-[12px] text-zinc-500">Each order is double checked</div>
              </div>
            </div>
            <div class="flex items-start gap-3 rounded-xl border border-zinc-200 bg-white p-3">
              <svg class="mt-0.5 h-5 w-5 shrink-0 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              <div>
                <div class="text-[13px] font-semibold text-zinc-950">They trust us!</div>
                <div class="text-[12px] text-zinc-500">Trusted by 2,000+ customers</div>
              </div>
            </div>
            <div class="flex items-start gap-3 rounded-xl border border-zinc-200 bg-white p-3">
              <svg class="mt-0.5 h-5 w-5 shrink-0 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
              <div>
                <div class="text-[13px] font-semibold text-zinc-950">Buy a sample</div>
                <div class="text-[12px] text-zinc-500">Try before you order</div>
              </div>
            </div>
          </div>

          <!-- Collapsible sections -->
          <div class="mt-8 divide-y divide-zinc-200 border-y border-zinc-200">
            <details v-for="(section, i) in infoSections" :key="i" class="group">
              <summary class="flex cursor-pointer items-center justify-between py-4 text-[15px] font-medium text-zinc-950">
                {{ section.title }}
                <span class="text-[20px] font-light text-zinc-400 transition-transform duration-200 group-open:rotate-45">+</span>
              </summary>
              <div class="pb-4 text-[14px] leading-relaxed text-zinc-600">{{ section.content }}</div>
            </details>
          </div>
        </div>
      </div>
    </div>

    <!-- You might also like -->
    <div v-if="relatedProducts.length" class="mt-16">
      <BestSellers :products="relatedProducts" />
    </div>

    <!-- FAQ + Newsletter -->
    <div class="mt-16 flex flex-col gap-16">
      <AppFaq />
      <AppNewletter />
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const sdk = useMedusaClient()
const regionState = useRegion()

const handle = computed(() => String(route.params.handle || ''))

const { data, pending } = await useAsyncData(`product:${handle.value}`, async () => {
  try {
    const res = await sdk.store.product.list({ handle: handle.value, limit: 1 } as any)
    const p = (res as any)?.products?.[0]
    if (p) return p
  } catch { /* ignore */ }
  try {
    const res = await sdk.store.product.retrieve(handle.value as any, { fields: '*variants' } as any)
    return (res as any)?.product
  } catch {
    return null
  }
})

const product = computed(() => data.value as any)
useHead({ title: computed(() => product.value?.title || 'Product') })

const variants = computed(() => product.value?.variants ?? [])
const images = computed(() => {
  const imgs: string[] = []
  if (product.value?.thumbnail) imgs.push(product.value.thumbnail)
  for (const img of product.value?.images ?? []) {
    if (img?.url && !imgs.includes(img.url)) imgs.push(img.url)
  }
  return imgs
})

const activeImage = ref<string | null>(null)
watchEffect(() => {
  if (!activeImage.value && images.value.length) activeImage.value = images.value[0]
})

const currencyCode = computed(() =>
  (regionState.region.value as any)?.currency_code || 'usd'
)

const formatMoney = (amountMinor: number | null | undefined) => {
  if (typeof amountMinor !== 'number') return null
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: String(currencyCode.value).toUpperCase() }).format(amountMinor / 100)
  } catch {
    return `${(amountMinor / 100).toFixed(2)} ${String(currencyCode.value).toUpperCase()}`
  }
}

const displayPrice = computed(() => {
  const vs = variants.value as any[]
  const prices = vs
    .map((v: any) => v?.calculated_price?.calculated_amount ?? v?.prices?.[0]?.amount ?? null)
    .filter((n: any) => typeof n === 'number') as number[]
  if (!prices.length) return null
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  if (min === max) return formatMoney(min)
  return `${formatMoney(min)} - ${formatMoney(max)}`
})

const selectedVariantId = ref('')
watchEffect(() => {
  if (!selectedVariantId.value && variants.value?.[0]?.id) selectedVariantId.value = variants.value[0].id
})

const quantity = ref(1)
const adding = ref(false)
const addError = ref<string | null>(null)
const addSuccess = ref(false)
const { addItem } = useCart()

const onAddToCart = async () => {
  if (!selectedVariantId.value) return
  adding.value = true
  addError.value = null
  addSuccess.value = false
  try {
    await addItem(selectedVariantId.value, quantity.value)
    addSuccess.value = true
    setTimeout(() => { addSuccess.value = false }, 3000)
  } catch (e: any) {
    addError.value = e?.message || 'Failed to add item.'
  } finally {
    adding.value = false
  }
}

const infoSections = [
  { title: 'Product details', content: 'Detailed product specifications vary by item. Contact us for full spec sheets.' },
  { title: 'Product specificities', content: 'Each product has unique properties based on material, origin, and construction method.' },
  { title: 'Production', content: 'Standard production time is 10-20 business days after proof approval. Rush options available on request.' },
  { title: 'Customization', content: 'We support screen printing, embroidery, laser engraving, and digital transfer. Upload your logo during checkout.' },
]

const { data: relatedData } = await useAsyncData(`related:${handle.value}`, async () => {
  return await sdk.store.product.list({ limit: 5 } as any)
})
const relatedProducts = computed(() => {
  const all = ((relatedData.value as any)?.products ?? []) as any[]
  return all.filter((p: any) => p.handle !== handle.value).slice(0, 5)
})
</script>
