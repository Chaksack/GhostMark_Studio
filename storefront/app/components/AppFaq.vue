<template>
  <section class="mx-auto w-full max-w-screen-3xl px-5 sm:px-6 lg:px-8">
    <div class="rounded-2xl bg-[#f5f1ec] px-6 py-10 sm:px-10 sm:py-14 lg:px-14">
      <div class="grid gap-10 lg:grid-cols-[1fr_1fr] lg:gap-16">
        <!-- Left: heading + description -->
        <div>
          <h2 class="font-serif text-[32px] leading-[1.15] text-zinc-950 sm:text-[42px]">
            Frequently asked questions
          </h2>
          <p class="mt-5 max-w-[460px] text-[15px] leading-relaxed text-zinc-700">
            Need some help? Browse through our summary of the most frequently asked
            questions about shipping, returns, samples, sourcing, pricing, and many more!
          </p>
          <NuxtLink
            to="/faq"
            class="mt-7 inline-flex h-[46px] items-center justify-center bg-zinc-950 px-6 text-[14px] font-medium text-white hover:bg-zinc-800"
          >
            View more
          </NuxtLink>
        </div>

        <!-- Right: accordion -->
        <div>
          <div
            v-for="(item, i) in faqs"
            :key="i"
            class="border-t border-zinc-300 last:border-b"
          >
            <button
              class="flex w-full items-center justify-between py-4 text-left text-[15px] font-normal text-zinc-950 sm:text-[16px]"
              @click="toggle(i)"
            >
              <span>{{ item.question }}</span>
              <span
                class="ml-4 flex h-6 w-6 shrink-0 items-center justify-center text-[20px] font-light text-zinc-950 transition-transform duration-200"
                :class="{ 'rotate-45': openIndex === i }"
              >+</span>
            </button>
            <div
              v-show="openIndex === i"
              class="pb-4 pr-10 text-[14px] leading-relaxed text-zinc-600"
            >
              {{ item.answer }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
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
    answer: 'MOQ varies by product and decoration method. Contact us for specific requirements.',
  },
]

const openIndex = ref<number | null>(null)

const toggle = (i: number) => {
  openIndex.value = openIndex.value === i ? null : i
}
</script>
