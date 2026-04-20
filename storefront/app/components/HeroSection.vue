<template>
  <section class="relative overflow-hidden bg-[#f5f1ec]">
    <div class="mx-auto w-full max-w-screen-3xl px-5 sm:px-6 lg:px-8">
      <div class="grid items-center gap-8 py-14 lg:grid-cols-2 lg:gap-12 lg:py-20">
        <!-- Left: copy -->
        <div class="max-w-[620px]">
          <h1 class="font-serif text-[42px] font-normal leading-[1.1] text-zinc-950 sm:text-[56px] lg:text-[68px]">
            Good merch,<br />for good brands.
          </h1>
          <p class="mt-6 max-w-[480px] text-[17px] leading-relaxed text-zinc-700">
            We personalise the most beautiful and
            <NuxtLink to="/about" class="underline decoration-dotted underline-offset-4">premium</NuxtLink>
            products for your brand to shine in real life.
          </p>
          <div class="mt-8 flex flex-wrap items-center gap-3">
            <NuxtLink
              to="/products"
              class="inline-flex h-[50px] items-center justify-center bg-zinc-950 px-7 text-[14px] font-medium tracking-wide text-white hover:bg-zinc-800"
            >
              Shop all products
            </NuxtLink>
            <NuxtLink
              to="/contact"
              class="inline-flex h-[50px] items-center justify-center border border-zinc-950 bg-transparent px-7 text-[14px] font-medium tracking-wide text-zinc-950 hover:bg-zinc-950 hover:text-white"
            >
              Talk to our team
            </NuxtLink>
          </div>
        </div>

        <!-- Right: image carousel -->
        <div class="relative">
          <div
            ref="carouselRef"
            class="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <div
              v-for="(slide, i) in slides"
              :key="i"
              class="w-[300px] flex-shrink-0 snap-start sm:w-[340px]"
            >
              <div class="aspect-[3/4] overflow-hidden rounded-xl bg-zinc-200">
                <div class="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-300/60 to-zinc-200/80">
                  <svg class="h-12 w-12 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="m21 15-5-5L5 21" />
                  </svg>
                </div>
              </div>
              <div class="mt-3 flex items-center justify-between">
                <span class="text-[13px] text-zinc-500">{{ slide.product }}</span>
                <span class="text-[13px] font-medium text-zinc-950">{{ slide.brand }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
const slides = [
  { product: 'Cabas bag', brand: "Arc'teryx" },
  { product: 'Kaweco pen', brand: 'Soeur Paris' },
  { product: 'Yeti tumbler', brand: 'Osom coffee' },
  { product: 'Linen napkin', brand: 'Delvaux' },
  { product: 'Enamel mug', brand: 'Financial Times' },
]

const carouselRef = ref<HTMLElement | null>(null)
</script>
