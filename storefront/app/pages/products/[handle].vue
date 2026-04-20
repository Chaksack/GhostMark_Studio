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

          <!-- Actions: buy a sample + wishlist -->
          <div class="mt-3 flex items-center gap-2">
            <button type="button" class="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[13px] text-zinc-950 hover:border-zinc-300">
              <svg class="h-4 w-4 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
              Buy a sample
            </button>
            <button
              class="inline-flex h-[38px] w-[38px] items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-400 hover:border-zinc-300 hover:text-zinc-950"
              type="button"
              aria-label="Add to favorites"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-4.6-9.5-8.7C.2 8.6 2.6 5.7 6 5.5c1.9-.1 3.2.8 4 1.8.8-1 2.1-1.9 4-1.8 3.4.2 5.8 3.1 3.5 6.8C19 16.4 12 21 12 21z"/></svg>
            </button>
          </div>

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
            <h2 class="text-[14px] font-semibold uppercase tracking-wider text-zinc-500">1. Pick a product variant</h2>

            <!-- Option pills (Merchery-style) -->
            <div v-if="optionGroups.length" class="mt-4 space-y-4">
              <div v-for="og in optionGroups" :key="og.id">
                <div class="text-[13px] text-zinc-500 mb-2">{{ og.title }}</div>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="val in og.values"
                    :key="val"
                    type="button"
                    class="rounded-full border px-3 py-1.5 text-[13px] transition"
                    :class="selectedOptions[og.id] === val
                      ? 'border-zinc-900 bg-zinc-900 text-white'
                      : 'border-zinc-200 bg-white text-zinc-900 hover:border-zinc-300'"
                    @click="onSelectOption(og.id, val)"
                  >
                    {{ val }}
                  </button>
                </div>
              </div>
            </div>

            <!-- Fallback variant dropdown if no option groups -->
            <div v-else-if="variants.length > 1" class="mt-4">
              <label class="text-[13px] text-zinc-500" for="variant-select">Variant</label>
              <select
                id="variant-select"
                v-model="selectedVariantId"
                class="mt-1.5 w-full border border-zinc-200 bg-white px-3 py-2.5 text-[14px] text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-300"
              >
                <option v-for="v in variants" :key="v.id" :value="v.id">{{ v.title || v.sku || v.id }}</option>
              </select>
            </div>

            <!-- 2. Upload your design -->
            <div class="mt-8">
              <h2 class="text-[14px] font-semibold uppercase tracking-wider text-zinc-500">2. Upload your design</h2>
              <div class="mt-3 rounded-xl border border-dashed border-zinc-300 bg-white p-3">
                <div class="mb-2 flex gap-2">
                  <button type="button" class="rounded-md border px-3 py-1.5 text-[13px]"
                    :class="activeDesignTab === 'front' ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-white text-zinc-900'"
                    @click="activeDesignTab = 'front'">Front</button>
                  <button type="button" class="rounded-md border px-3 py-1.5 text-[13px]"
                    :class="activeDesignTab === 'back' ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-white text-zinc-900'"
                    @click="activeDesignTab = 'back'">Back</button>
                </div>
                <div
                  class="flex h-36 w-full cursor-pointer items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50 text-center text-[13px] text-zinc-600"
                  @dragover.prevent
                  @drop.prevent="onDropDesign"
                  @click="designInput?.click()"
                >
                  <div>
                    <div class="mb-1 flex items-center justify-center gap-2 text-zinc-700">
                      <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                      <span>Click to upload or drag & drop</span>
                    </div>
                    <div class="text-[11px] text-zinc-500">Max 10MB. For best results upload EPS, AI, or PDF. We can vectorize artwork if necessary.</div>
                  </div>
                  <input ref="designInput" type="file" class="hidden" :accept="acceptedDesignTypes" @change="onPickDesign"/>
                </div>
                <ul v-if="currentDesignFiles.length" class="mt-2 list-disc space-y-1 pl-5 text-[12px] text-zinc-600">
                  <li v-for="(f, i) in currentDesignFiles" :key="i">{{ f.name }} ({{ (f.size/1024/1024).toFixed(2) }} MB)</li>
                </ul>
              </div>
            </div>

            <!-- 3. Quantity -->
            <div class="mt-8">
              <h2 class="text-[14px] font-semibold uppercase tracking-wider text-zinc-500">3. Quantity</h2>
              <div class="mt-2 flex items-center gap-0">
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
              <!-- Simple quantity tier presets -->
              <div class="mt-3 grid grid-cols-3 gap-2">
                <button v-for="q in quantityTiers" :key="q" type="button" @click="quantity = q"
                  class="rounded-lg border border-zinc-200 bg-white p-2 text-left text-[12px] hover:border-zinc-300">
                  <div class="text-[12px] text-zinc-950">{{ q }} pieces</div>
                  <div class="text-[11px] text-zinc-500">{{ unitPriceDisplay }}/piece</div>
                </button>
              </div>
            </div>
          </div>

          <div class="mt-6 flex flex-wrap gap-3">
            <button
              class="inline-flex h-[50px] flex-1 items-center justify-center bg-zinc-950 px-7 text-[14px] font-medium tracking-wide text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="!finalVariantId || adding"
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
  
    <!-- Sticky bottom summary bar -->
    <div
      v-if="product && (unitPriceMinor || 0) >= 0"
      class="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/70"
    >
      <div class="mx-auto flex w-full max-w-screen-3xl items-center gap-4 px-5 py-3 sm:px-6 lg:px-8">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-3">
            <div class="text-[12px] text-zinc-500">Lead time:</div>
            <div class="text-[12px] text-zinc-900">Approximately 8-14 business days</div>
          </div>
        </div>
        <div class="hidden items-center gap-4 sm:flex">
          <div class="text-right">
            <div class="text-[11px] text-zinc-500">Total</div>
            <div class="text-[15px] font-semibold text-zinc-950">{{ totalDisplay }}</div>
          </div>
          <button
            class="inline-flex h-[42px] items-center justify-center rounded-md bg-zinc-950 px-5 text-[13px] font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
            :disabled="!finalVariantId || adding"
            @click="onAddToCart"
            type="button"
          >
            {{ adding ? 'Adding…' : 'Add to cart' }}
            <svg class="ml-2 h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
          </button>
        </div>
        <div class="flex flex-1 sm:hidden">
          <button
            class="inline-flex h-[42px] w-full items-center justify-center rounded-md bg-zinc-950 px-4 text-[13px] font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
            :disabled="!finalVariantId || adding"
            @click="onAddToCart"
            type="button"
          >
            {{ adding ? 'Adding…' : `Add to cart · ${totalDisplay}` }}
          </button>
        </div>
      </div>
    </div>
  </div>
  </template>

<script setup lang="ts">
const route = useRoute()
const sdk = useMedusaClient()
const regionState = useRegion()

const handle = computed(() => String(route.params.handle || ''))

// Fetch product data without blocking the initial render so breadcrumbs show immediately
const { data, pending } = useAsyncData(
  () => `product:${handle.value}`,
  async () => {
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
  },
  { watch: [handle] }
)

const product = computed(() => data.value as any)
useHead({ title: computed(() => product.value?.title || 'Product') })

const variants = computed(() => product.value?.variants ?? [])
const currentVariant = computed<any>(() => {
  const id = finalVariantId.value || selectedVariantId.value
  return (variants.value as any[]).find((v: any) => v.id === id)
})
const unitPriceMinor = computed<number | null>(() => {
  const v: any = currentVariant.value
  return v?.calculated_price?.calculated_amount ?? v?.prices?.[0]?.amount ?? null
})
const unitPriceDisplay = computed(() => formatMoney(unitPriceMinor.value || undefined) || '—')
const totalMinor = computed(() => {
  const up = unitPriceMinor.value
  if (typeof up !== 'number') return null
  return up * quantity.value
})
const totalDisplay = computed(() => formatMoney(totalMinor.value || undefined) || '—')
const productOptions = computed<any[]>(() => product.value?.options ?? [])
// Build option groups from product options or derive from variants
const optionGroups = computed<{ id: string; title: string; values: string[] }[]>(() => {
  const groups: { id: string; title: string; values: Set<string> }[] = []
  // Prefer product.options with values array if present
  if (Array.isArray(productOptions.value) && productOptions.value.length) {
    for (const opt of productOptions.value) {
      const set = new Set<string>()
      // Some Medusa payloads include opt.values as array of { value }
      if (Array.isArray((opt as any).values)) {
        for (const v of (opt as any).values) {
          const val = typeof v === 'string' ? v : v?.value
          if (val) set.add(String(val))
        }
      }
      // Also derive from variants to be safe
      for (const variant of variants.value as any[]) {
        for (const o of variant?.options ?? []) {
          if (o?.option_id === opt.id && o?.value) set.add(String(o.value))
        }
      }
      groups.push({ id: opt.id, title: opt.title || 'Option', values: set })
    }
  } else if ((variants.value as any[])?.length) {
    // Derive purely from variants when product.options missing
    const map = new Map<string, { title: string; values: Set<string> }>()
    for (const v of variants.value as any[]) {
      for (const o of v?.options ?? []) {
        const entry = map.get(o.option_id) || { title: o?.title || 'Option', values: new Set<string>() }
        if (o?.value) entry.values.add(String(o.value))
        map.set(o.option_id, entry)
      }
    }
    for (const [id, g] of map) groups.push({ id, title: g.title, values: g.values })
  }
  // Convert Set to array and sort for stable UI
  return groups.map(g => ({ id: g.id, title: g.title, values: Array.from(g.values) }))
})

// Track selected options; initialize with first available value per group
const selectedOptions = reactive<Record<string, string>>({})
watchEffect(() => {
  for (const g of optionGroups.value) {
    if (!selectedOptions[g.id] && g.values[0]) {
      selectedOptions[g.id] = g.values[0]
    }
  }
})

const onSelectOption = (optionId: string, value: string) => {
  selectedOptions[optionId] = value
}

// Given selectedOptions, resolve the matching variant id
const resolvedVariantId = computed(() => {
  if (!(variants.value as any[])?.length) return ''
  // Single variant fallback
  if ((variants.value as any[])?.length === 1) return (variants.value as any[])[0].id
  const entries = Object.entries(selectedOptions)
  for (const v of variants.value as any[]) {
    const vOpts = v?.options ?? []
    const allMatch = entries.every(([optId, val]) => vOpts.some((o: any) => o?.option_id === optId && String(o?.value) === String(val)))
    if (allMatch) return v.id
  }
  return ''
})

// Final variant id used by the UI (option pills preferred, fallback to dropdown)
const finalVariantId = computed(() => optionGroups.value.length ? resolvedVariantId.value : selectedVariantId.value)
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
const quantityTiers = [25, 50, 100]
const adding = ref(false)
const addError = ref<string | null>(null)
const addSuccess = ref(false)
const { addItem } = useCart()

// Design upload (placeholder, client-side only)
const acceptedDesignTypes = '.eps,.ai,.pdf,.png,.jpg,.jpeg,.svg'
const designInput = ref<HTMLInputElement | null>(null)
const activeDesignTab = ref<'front' | 'back'>('front')
const designFront = ref<File[]>([])
const designBack = ref<File[]>([])
const currentDesignFiles = computed(() => activeDesignTab.value === 'front' ? designFront.value : designBack.value)
const handleFiles = (files: FileList | File[]) => {
  const arr = Array.from(files)
  const filtered = arr.filter((f) => f.size <= 10 * 1024 * 1024) // 10MB limit
  if (activeDesignTab.value === 'front') designFront.value = filtered
  else designBack.value = filtered
}
const onPickDesign = (e: Event) => {
  const input = e.target as HTMLInputElement
  if (input?.files?.length) handleFiles(input.files)
}
const onDropDesign = (e: DragEvent) => {
  const files = e.dataTransfer?.files
  if (files && files.length) handleFiles(files)
}

const onAddToCart = async () => {
  if (!finalVariantId.value) return
  adding.value = true
  addError.value = null
  addSuccess.value = false
  try {
    await addItem(finalVariantId.value, quantity.value)
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
