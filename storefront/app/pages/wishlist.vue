<template>
  <div class="min-h-screen bg-[#f5f1ec]">
    <section class="border-b border-zinc-200 bg-white">
      <div class="mx-auto w-full max-w-screen-xl px-5 py-12 sm:px-6 lg:px-8 lg:py-16">
        <p class="text-[12px] font-semibold uppercase tracking-[0.22em] text-zinc-500">Saved For Later</p>
        <div class="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 class="font-serif text-[34px] leading-none text-zinc-950 sm:text-[42px]">Your wishlist</h1>
            <p class="mt-3 max-w-2xl text-[15px] text-zinc-600">Keep track of the products you want to revisit, compare, or order next.</p>
          </div>
          <div class="text-[14px] text-zinc-500">{{ items.length }} item{{ items.length === 1 ? '' : 's' }}</div>
        </div>
      </div>
    </section>

    <section class="mx-auto w-full max-w-screen-xl px-5 py-10 sm:px-6 lg:px-8">
      <div v-if="!items.length" class="rounded-3xl border border-zinc-200 bg-white px-6 py-16 text-center sm:px-10">
        <svg class="mx-auto h-14 w-14 text-zinc-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M12 21s-7-4.6-9.5-8.7C.2 8.6 2.6 5.7 6 5.5c1.9-.1 3.2.8 4 1.8.8-1 2.1-1.9 4-1.8 3.4.2 5.8 3.1 3.5 6.8C19 16.4 12 21 12 21z" />
        </svg>
        <h2 class="mt-5 font-serif text-[28px] text-zinc-950">Your wishlist is empty</h2>
        <p class="mx-auto mt-3 max-w-xl text-[15px] text-zinc-500">Browse the catalog and save products to keep them handy here.</p>
        <NuxtLink
          to="/products"
          class="mt-7 inline-flex h-[48px] items-center justify-center rounded-lg bg-zinc-950 px-8 text-[14px] font-medium text-white hover:bg-zinc-800"
        >
          Explore products
        </NuxtLink>
      </div>

      <div v-else class="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <article
          v-for="item in items"
          :key="item.id"
          class="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm"
        >
          <NuxtLink :to="`/products/${item.handle}`" class="block aspect-[4/3] overflow-hidden bg-zinc-100">
            <img
              v-if="item.thumbnail"
              :src="item.thumbnail"
              :alt="item.title"
              class="h-full w-full object-cover transition-transform duration-300 hover:scale-[1.03]"
              loading="lazy"
            />
            <div v-else class="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-200/70 to-zinc-100">
              <svg class="h-10 w-10 text-zinc-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="m21 15-5-5L5 21" />
              </svg>
            </div>
          </NuxtLink>

          <div class="p-6">
            <div class="flex items-start justify-between gap-4">
              <div>
                <NuxtLink :to="`/products/${item.handle}`" class="text-[18px] font-semibold text-zinc-950 hover:underline">
                  {{ item.title }}
                </NuxtLink>
                <p class="mt-1 text-[15px] text-zinc-600">{{ item.price }}</p>
              </div>
              <button
                class="inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 text-zinc-500 hover:border-zinc-300 hover:text-zinc-950"
                type="button"
                :aria-label="`Remove ${item.title} from wishlist`"
                @click="remove(item.id)"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div class="mt-6 flex gap-3">
              <NuxtLink
                :to="`/products/${item.handle}`"
                class="flex-1 rounded-lg bg-zinc-950 px-4 py-3 text-center text-[14px] font-medium text-white hover:bg-zinc-800"
              >
                View product
              </NuxtLink>
              <button
                class="rounded-lg border border-zinc-200 px-4 py-3 text-[14px] font-medium text-zinc-950 hover:bg-zinc-50"
                type="button"
                @click="remove(item.id)"
              >
                Remove
              </button>
            </div>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'Wishlist' })

const { hydrate, items, remove } = useWishlist()

onMounted(() => {
  hydrate()
})
</script>
