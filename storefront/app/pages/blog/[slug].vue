<template>
  <div class="mx-auto w-full max-w-screen-2xl px-5 sm:px-6 lg:px-8">
    <NuxtLink to="/blog" class="text-sm font-semibold text-zinc-600 hover:text-zinc-950">← Back to resources</NuxtLink>
    <div class="my-4 h-px w-full bg-zinc-200" />

    <div v-if="pending" class="text-zinc-500">Loading…</div>
    <div v-else-if="!post" class="text-zinc-500">Post not found.</div>

    <article v-else class="w-full max-w-3xl rounded-2xl border border-zinc-200 bg-white p-6">
      <h1 class="text-2xl font-bold tracking-tight sm:text-3xl">{{ post.attributes?.title || post.title || 'Untitled' }}</h1>
      <p class="mt-3 text-zinc-600">
        {{ post.attributes?.excerpt || post.excerpt || 'Add content fields in Strapi to render rich body here.' }}
      </p>
    </article>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
useHead({ title: 'Post' })
const { getPostBySlug } = useCms()

const slug = computed(() => String(route.params.slug || ''))
const { data, pending } = await useAsyncData(`cms:post:${slug.value}`, async () => await getPostBySlug(slug.value))
const post = computed(() => ((data.value as any)?.data ?? [])[0] ?? null)
</script>
