<template>
  <aside
    aria-labelledby="footer-faq-heading"
    class="rounded-[0.5rem] bg-offWhite lg:flex p-6 md:p-10 lg:p-12 gap-12 lg:gap-24"
  >
      <!-- Left: heading + intro + CTA -->
      <div class="flex flex-col flex-1 lg:sticky lg:top-[140px] lg:self-start lg:h-fit">
        <h2 id="footer-faq-heading" class="gm-display gm-display-lg mb-[1.8rem] text-ink-950">
          Frequently asked questions
        </h2>
        <p class="mb-[3rem] text-[14px] leading-[20px] md:text-[16px] md:leading-[23px]">
          Need some help? Browse through our summary of the most frequently asked
          questions about shipping, returns, samples, sourcing, pricing, and many more!
        </p>
        <div>
          <NuxtLink
            to="/faq"
            class="bg-ink-950 text-cream-50 hover:bg-transparent hover:text-ink-950 border border-ink-950 border-solid px-5 h-11 text-sm font-medium inline-flex items-center justify-center transition-colors duration-fast motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2"
          >
            View more
          </NuxtLink>
        </div>
      </div>

      <!-- Right: accordion -->
      <div class="flex-1 my-[2rem] max-lg:mt-[5.5rem]">
        <div
          v-for="(item, i) in faqs"
          :key="i"
          class="border-b border-black first:border-t pt-[1.8rem] pb-[2rem] pr-[0.7rem]"
        >
          <h3 class="flex">
            <button
              class="flex flex-1 items-center justify-between transition-all text-left group font-sans mx-0 -my-3 px-0 py-3"
              type="button"
              @click="toggle(i)"
            >
              <span>{{ item.question }}</span>
              <!--
                +/- icon built from two pure divs, exactly per the merchery
                reference: a horizontal bar that always shows, plus a vertical
                bar that rotates and scales away when the row is open.
              -->
              <div class="relative h-4 w-4 shrink-0">
                <div class="absolute inset-0 flex items-center justify-center">
                  <div class="absolute w-3 h-0.5 bg-current"></div>
                  <div
                    class="absolute w-0.5 h-3 bg-current transition-all duration-300"
                    :class="{ 'rotate-90 scale-x-0': openIndex === i }"
                  ></div>
                </div>
              </div>
            </button>
          </h3>
          <div
            v-show="openIndex === i"
            class="overflow-hidden text-sm pt-[1rem] pr-[2rem] leading-relaxed"
          >
            {{ item.answer }}
          </div>
        </div>
      </div>
  </aside>
</template>

<script setup lang="ts">
const faqs = [
  {
    question: 'Is it possible to put different items into gift boxes?',
    answer: 'Yes, we offer custom gift box configurations. Contact us for more details on combining different products into a single gift set.',
  },
  {
    question: 'How can I find out more about your products?',
    answer: 'Browse our product pages for detailed specifications, or reach out to our team for personalized guidance.',
  },
  {
    question: 'Will it be possible to see the e-proof before my order goes into production?',
    answer: 'Absolutely. We provide a digital proof for your approval before any production begins.',
  },
  {
    question: 'Is it possible to shorten the lead time for production?',
    answer: 'Rush production is available for select items. Reach out with your timeline and we will do our best to accommodate.',
  },
  {
    question: 'Why are your prices not fixed and vary within a range?',
    answer: 'Pricing depends on order quantity, decoration method, and product selection. We provide tailored quotes so you always get the best value.',
  },
  {
    question: 'Can you ship the merch to multiple addresses?',
    answer: 'Yes, we support multi-address shipping. Simply provide the list of delivery addresses with your order.',
  },
  {
    question: 'Where do you ship?',
    answer: 'We ship worldwide. Delivery times and costs vary by destination.',
  },
  {
    question: 'What is the minimum order quantity (MOQ)?',
    answer: 'Most of the catalogue has no minimum: order a single piece if that is all you need. Where a custom run does carry one it is 25 pieces, and the figure is stated on the product page before anything reaches your basket.',
  },
]

const openIndex = ref<number | null>(null)

const toggle = (i: number) => {
  openIndex.value = openIndex.value === i ? null : i
}
</script>
