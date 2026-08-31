<template>
  <div>
    <!-- Hero -->
    <div class="bg-[#f5f1ec] py-14 text-center">
      <h1 class="font-serif text-[36px] leading-tight text-ink-950 sm:text-[48px]">Frequently asked questions</h1>
      <p class="mx-auto mt-3 max-w-[50ch] text-[15px] text-ink-700">
        Everything you need to know about ordering, pricing, customization, and more.
      </p>
    </div>

    <div class="mx-auto w-full max-w-rail px-gutter py-12">
      <div class="grid gap-10 lg:grid-cols-[220px_1fr]">
        <!-- Sidebar nav -->
        <nav class="hidden lg:block">
          <div class="sticky top-28 space-y-1">
            <button
              v-for="cat in categories"
              :key="cat.slug"
              class="block w-full rounded-lg px-3 py-2 text-left text-[14px] transition"
              :class="activeCategory === cat.slug ? 'bg-ink-950 font-semibold text-white' : 'text-ink-700 hover:bg-ink-100 hover:text-ink-950'"
              @click="scrollTo(cat.slug)"
              type="button"
            >
              {{ cat.label }}
            </button>
          </div>
        </nav>

        <!-- Mobile category select -->
        <div class="lg:hidden">
          <select
            v-model="activeCategory"
            class="w-full border border-ink-400 bg-white px-3 py-2.5 text-[14px] text-ink-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            @change="scrollTo(activeCategory)"
          >
            <option v-for="cat in categories" :key="cat.slug" :value="cat.slug">{{ cat.label }}</option>
          </select>
        </div>

        <!-- FAQ sections -->
        <div class="space-y-10">
          <section
            v-for="cat in categories"
            :key="cat.slug"
            :id="`faq-${cat.slug}`"
            :ref="(el) => { if (el) sectionRefs[cat.slug] = el as HTMLElement }"
          >
            <h2 class="font-serif text-[24px] text-ink-950">{{ cat.label }}</h2>
            <div class="mt-4 divide-y divide-ink-200 border-y border-ink-200">
              <details v-for="(q, i) in cat.questions" :key="i" class="group">
                <summary class="flex cursor-pointer items-center justify-between py-4 text-[15px] font-medium text-ink-950">
                  {{ q.q }}
                  <span class="text-[20px] font-light text-ink-600 transition-transform duration-200 group-open:rotate-45">+</span>
                </summary>
                <div class="pb-4 text-[14px] leading-relaxed text-ink-700">{{ q.a }}</div>
              </details>
            </div>
          </section>
        </div>
      </div>

      <!-- Didn't find answer CTA -->
      <div class="mt-16 rounded-2xl bg-[#f5f1ec] p-8 text-center sm:p-12">
        <h2 class="font-serif text-[28px] text-ink-950">Didn't find an answer?</h2>
        <p class="mx-auto mt-2 max-w-[45ch] text-[15px] text-ink-700">
          Our team is happy to help with any questions you might have.
        </p>
        <NuxtLink
          to="/contact"
          class="mt-6 inline-flex h-[48px] items-center justify-center bg-ink-950 px-8 text-[14px] font-medium tracking-wide text-white hover:bg-ink-800"
        >
          Contact us
        </NuxtLink>
      </div>

      <!-- Shop CTA banner -->
      <div class="mt-12 rounded-2xl bg-ink-950 p-8 text-center sm:p-12">
        <h2 class="font-serif text-[28px] text-white">Ready to get started?</h2>
        <!--
          ink-300, not ink-600 — the same inversion as the /about CTA band,
          copy-pasted. The ink ramp runs dark-to-light, so the "muted body"
          step is ink-600 on a LIGHT ground and ink-300 on a dark one; using
          ink-600 here put dark text on a dark slab at 2.37:1.
        -->
        <p class="mx-auto mt-2 max-w-[45ch] text-[15px] text-ink-300">
          Browse our catalog of sustainable branded merchandise.
        </p>
        <NuxtLink
          to="/products"
          class="mt-6 inline-flex h-[48px] items-center justify-center bg-white px-8 text-[14px] font-medium tracking-wide text-ink-950 hover:bg-ink-100"
        >
          Shop now
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'FAQ' })

const sectionRefs = reactive<Record<string, HTMLElement>>({})
const activeCategory = ref('ordering')

const scrollTo = (slug: string) => {
  activeCategory.value = slug
  const el = sectionRefs[slug]
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const categories = [
  {
    slug: 'ordering',
    label: 'Ordering',
    questions: [
      { q: 'How do I place an order?', a: 'Simply browse our catalog, select your products, customize them with your branding, and submit your order. Our team will review and send you a proof for approval.' },
      { q: 'What is the minimum order quantity?', a: 'Most of the catalogue has no minimum: order a single piece if that is all you need. Where a custom run does carry one it is 25 pieces, and the figure is stated on the product page before anything reaches your basket.' },
      { q: 'Can I order samples before placing a bulk order?', a: 'Yes! We offer sample orders for most products so you can check quality before committing to a full order.' },
    ],
  },
  {
    slug: 'pricing',
    label: 'Pricing',
    questions: [
      { q: 'How is pricing determined?', a: 'Pricing depends on the product, quantity, decoration method, and any additional customization. Volume discounts are available for larger orders.' },
      { q: 'Are there any setup fees?', a: 'Setup fees may apply for certain decoration methods like screen printing. Digital printing and embroidery have no setup fees.' },
      { q: 'Do you offer volume discounts?', a: 'Yes, the more you order the better the unit price. Contact us for a custom quote on large orders.' },
    ],
  },
  {
    slug: 'customization',
    label: 'Customization',
    questions: [
      { q: 'What decoration methods do you offer?', a: 'We offer screen printing, embroidery, laser engraving, digital transfer, and direct-to-garment printing depending on the product.' },
      { q: 'What file formats do you accept for logos?', a: 'The customiser takes PNG, JPEG and WebP. Upload the largest version you have. Vector files (AI, EPS, PDF, SVG) go to the artwork team rather than the uploader: send them with your order and we will vectorise at no charge.' },
      { q: 'Can I customize the packaging?', a: 'Yes, we offer custom packaging options including branded boxes, tissue paper, and stickers.' },
    ],
  },
  {
    slug: 'samples',
    label: 'Samples',
    questions: [
      { q: 'How do I request a sample?', a: 'Add the product to your cart and select the sample option, or contact us directly to arrange a sample.' },
      { q: 'How long does it take to receive a sample?', a: 'Samples typically ship within 3-5 business days and arrive within 1-2 weeks depending on your location.' },
    ],
  },
  {
    slug: 'products',
    label: 'Products',
    questions: [
      { q: 'Are your products sustainable?', a: 'We prioritize sustainable and ethically sourced products. Many of our items are B Corp certified, organic, or made from recycled materials.' },
      { q: 'Can I request a product not listed in your catalog?', a: 'Absolutely. Contact our team with your requirements and we will source the right product for you.' },
    ],
  },
  {
    slug: 'payments',
    label: 'Payments',
    questions: [
      { q: 'What payment methods do you accept?', a: 'We accept credit cards, bank transfers, and purchase orders for established business accounts.' },
      { q: 'When is payment due?', a: 'Payment is due upon proof approval for new customers. Established accounts may qualify for net-30 terms.' },
    ],
  },
  {
    slug: 'after-sales',
    label: 'After Sales',
    questions: [
      { q: 'What if I receive a defective product?', a: 'We have a quality guarantee. If you receive defective items, contact us within 14 days and we will arrange a replacement or refund.' },
      { q: 'Can I return or exchange items?', a: 'Due to the custom nature of our products, returns are limited to defective items. Contact us to discuss your specific situation.' },
    ],
  },
  {
    slug: 'shipping',
    label: 'Shipping',
    questions: [
      { q: 'Where do you ship?', a: 'We ship worldwide, with primary fulfillment centers in the EU, UK, and USA for fast regional delivery.' },
      { q: 'How long does shipping take?', a: 'Standard shipping takes 3-7 business days within the EU/US. International orders may take 7-14 business days.' },
      { q: 'Can I ship to multiple addresses?', a: 'Yes, we support split shipments to multiple addresses. Just provide the details when placing your order.' },
    ],
  },
  {
    slug: 'logistics',
    label: 'Logistics',
    questions: [
      { q: 'Do you offer warehousing and fulfillment?', a: 'Yes, we can store your branded merch and fulfill orders on demand through our logistics partners.' },
      { q: 'Can I track my order?', a: 'Yes, you will receive tracking information via email once your order ships.' },
    ],
  },
  {
    slug: 'club',
    label: 'Club',
    questions: [
      { q: 'What is the GhostMark Club?', a: 'The GhostMark Club is our loyalty program offering exclusive discounts, early access to new products, and dedicated account management.' },
      { q: 'How do I join?', a: 'Create an account and place your first order to automatically enroll in the club.' },
    ],
  },
  {
    slug: 'business-for-good',
    label: 'Business for Good',
    questions: [
      { q: 'What sustainability commitments do you have?', a: 'We are committed to 1% for the Planet, B Corp certified suppliers, carbon-neutral shipping, and minimal plastic packaging.' },
      { q: 'Do you support charitable causes?', a: 'Yes, we donate 1% of revenue to environmental nonprofits and partner with social enterprises for selected products.' },
    ],
  },
  {
    slug: 'terms',
    label: 'Terms & Conditions',
    questions: [
      { q: 'Where can I find your terms and conditions?', a: 'Our full terms and conditions are available on our website. Contact us if you have specific questions about your order terms.' },
      { q: 'What is your privacy policy?', a: 'We take data privacy seriously. Your information is only used for order processing and is never sold to third parties.' },
    ],
  },
]
</script>
