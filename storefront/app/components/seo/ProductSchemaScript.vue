<!--
  ProductSchemaScript.vue
  -----------------------
  Headless JSON-LD injector for PDPs. Renders no DOM — instead it pushes a
  `<script type="application/ld+json">` tag through Nuxt's `useHead` so the
  payload lands inside <head> (where Google expects structured data) without
  depending on a parent slot.

  Integration (deferred — PDP file is owned by another agent):

      <script setup lang="ts">
      import ProductSchemaScript from '~/components/seo/ProductSchemaScript.vue'
      const canonicalUrl = computed(() =>
        `${useRuntimeConfig().public.siteUrl || ''}/products/${product.value.handle}`,
      )
      </script>
      <template>
        <ProductSchemaScript :product="product" :url="canonicalUrl" />
        <!-- ...rest of PDP... -->
      </template>

  The `key` on the script entry is per-product, so route changes between PDPs
  replace (rather than stack) the JSON-LD tag.
-->

<template>
  <!-- Headless: useHead handles the actual injection. -->
</template>

<script setup lang="ts">
import { computed, watchEffect } from 'vue'
import { useHead } from '#imports'
import { useProductSchema } from '~/composables/useProductSchema'

const props = defineProps<{
  product: any
  url: string
}>()

const { schema } = useProductSchema(props)

const json = computed(() => (schema.value ? JSON.stringify(schema.value) : ''))
const productKey = computed(() => `schema-product-${props.product?.id || props.product?.handle || 'unknown'}`)

watchEffect(() => {
  if (!json.value) return
  useHead({
    script: [
      {
        type: 'application/ld+json',
        innerHTML: json.value,
        key: productKey.value,
      },
    ],
  })
})
</script>
