<template>
  <div class="mx-auto w-full max-w-screen-2xl px-5 sm:px-6 lg:px-8">
    <h1 class="text-3xl font-bold tracking-tight sm:text-4xl">Resources</h1>
    <p class="mt-2 text-zinc-500">Blog posts from Strapi (falls back to empty list).</p>

    <div class="my-6 h-px w-full bg-zinc-200" />

    <div v-if="pending" class="text-zinc-500">Loading posts…</div>
    <div v-else-if="!posts.length" class="text-zinc-500">No posts yet.</div>

    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <NuxtLink
        v-for="p in posts"
        :key="p.id"
        class="group rounded-2xl border border-zinc-200 bg-white p-5 transition hover:bg-zinc-50"
        :to="`/blog/${p.attributes?.slug || p.slug || p.id}`"
      >
        <div class="inline-flex rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-zinc-700">Post</div>
        <div class="mt-3 text-base font-bold text-zinc-950">
          {{ p.attributes?.title || p.title || 'Untitled' }}
        </div>
        <div class="mt-2 text-sm font-semibold text-zinc-600 group-hover:text-zinc-950">Read →</div>
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'Resources' })
const { listPosts } = useCms()
const { data, pending } = await useAsyncData('cms:posts', async () => await listPosts())
const posts = computed(() => (data.value as any)?.data ?? [])
</script>
