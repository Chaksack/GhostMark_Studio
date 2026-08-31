<template>
  <div class="mx-auto w-full max-w-rail px-gutter">
    <NuxtLink to="/blog" class="text-sm font-semibold text-ink-700 hover:text-ink-950">← Back to resources</NuxtLink>
    <div class="my-4 h-px w-full bg-ink-200" />

    <div v-if="pending" class="text-ink-600">Loading…</div>
    <div v-else-if="!post" class="text-ink-600">Post not found.</div>

    <article v-else class="w-full max-w-3xl rounded-2xl border border-ink-200 bg-white p-6">
      <h1 class="text-2xl font-bold tracking-tight sm:text-3xl">{{ post.attributes?.title || post.title || 'Untitled' }}</h1>
      <p class="mt-3 text-ink-700">
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
