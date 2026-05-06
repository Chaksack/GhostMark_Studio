<template>
  <!--
    Headless JSON-LD injector for PDPs. Renders no DOM — useHead pushes a
    `script type="application/ld+json"` tag into head so Google's rich-results
    parser indexes the Product schema. Per-product key dedupes on route change.
    Integration example lives in pages/products/[handle].vue.
  -->
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
