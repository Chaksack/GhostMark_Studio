<template>
  <div class="mx-auto w-full max-w-rail px-gutter">
    <h1 class="text-3xl font-bold tracking-tight sm:text-4xl">Resources</h1>
    <p class="mt-2 text-ink-600">Blog posts from Strapi (falls back to empty list).</p>

    <div class="my-6 h-px w-full bg-ink-200" />

    <div v-if="pending" class="text-ink-600">Loading posts…</div>
    <div v-else-if="!posts.length" class="text-ink-600">No posts yet.</div>

    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <NuxtLink
        v-for="p in posts"
        :key="p.id"
        class="group rounded-2xl border border-ink-200 bg-white p-5 transition hover:bg-cream-50"
        :to="`/blog/${p.attributes?.slug || p.slug || p.id}`"
      >
        <div class="inline-flex rounded-full border border-ink-200 bg-white px-3 py-1 text-xs font-semibold text-ink-700">Post</div>
        <div class="mt-3 text-base font-bold text-ink-950">
          {{ p.attributes?.title || p.title || 'Untitled' }}
        </div>
        <div class="mt-2 text-sm font-semibold text-ink-700 group-hover:text-ink-950">Read →</div>
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
