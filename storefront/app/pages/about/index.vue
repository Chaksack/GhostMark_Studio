<template>
  <div>
    <!-- Hero -->
    <div class="bg-[#f5f1ec] py-16 text-center sm:py-20">
      <h1 class="font-serif text-[36px] leading-tight text-ink-950 sm:text-[52px]">A mark that outlasts<br class="hidden sm:block" /> the campaign.</h1>
      <p class="mx-auto mt-4 max-w-[55ch] text-[16px] leading-relaxed text-ink-700">
        One bench, three crafts: laser engraving, DTF print and apparel finishing, for studios, agencies and brands who care that the object outlasts the launch.
      </p>
    </div>

    <div class="mx-auto w-full max-w-rail px-gutter">
      <!-- Mission -->
      <section class="py-16">
        <div class="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <span class="text-[13px] font-semibold uppercase tracking-widest text-ink-600">Our mission</span>
            <h2 class="mt-3 font-serif text-[28px] leading-snug text-ink-950 sm:text-[34px]">
              The mark stays after the moment.
            </h2>
            <p class="mt-4 text-[15px] leading-relaxed text-ink-700">
              The most powerful work isn't loud or complicated: it's the kind people feel before they fully understand it. A whisper of craft, precision and imagination. Every piece we make is chosen and finished with that in mind.
            </p>
            <p class="mt-3 text-[15px] leading-relaxed text-ink-700">
              Onboarding kits, signature apparel, considered gifts: whatever the brief, we move it from sample to shipped without losing the thread.
            </p>
          </div>
          <div class="aspect-[4/3] overflow-hidden rounded-2xl bg-gradient-to-br from-[#e8ddd3] to-[#f5f1ec]">
            <div class="flex h-full w-full items-center justify-center">
              <svg class="h-20 w-20 text-ink-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
            </div>
          </div>
        </div>
      </section>

      <!-- Values -->
      <section class="border-t border-ink-200 py-16">
        <div class="text-center">
          <span class="text-[13px] font-semibold uppercase tracking-widest text-ink-600">Our values</span>
          <h2 class="mt-3 font-serif text-[28px] text-ink-950 sm:text-[34px]">What we stand for</h2>
        </div>
        <div class="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div v-for="value in values" :key="value.title" class="rounded-2xl border border-ink-200 bg-white p-6">
            <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-[#f5f1ec]">
              <span class="text-[20px]">{{ value.emoji }}</span>
            </div>
            <h3 class="mt-4 text-[16px] font-semibold text-ink-950">{{ value.title }}</h3>
            <p class="mt-2 text-[14px] leading-relaxed text-ink-700">{{ value.description }}</p>
          </div>
        </div>
      </section>

      <!-- How it works -->
      <section class="border-t border-ink-200 py-16">
        <div class="text-center">
          <span class="text-[13px] font-semibold uppercase tracking-widest text-ink-600">How it works</span>
          <h2 class="mt-3 font-serif text-[28px] text-ink-950 sm:text-[34px]">From idea to delivery</h2>
        </div>
        <div class="mx-auto mt-10 grid max-w-3xl gap-0">
          <div v-for="(s, i) in steps" :key="i" class="flex gap-5">
            <div class="flex flex-col items-center">
              <div class="flex h-10 w-10 items-center justify-center rounded-full bg-ink-950 text-[14px] font-bold text-white">{{ i + 1 }}</div>
              <div v-if="i < steps.length - 1" class="w-px flex-1 bg-ink-200" />
            </div>
            <div class="pb-10">
              <h3 class="text-[16px] font-semibold text-ink-950">{{ s.title }}</h3>
              <p class="mt-1 text-[14px] leading-relaxed text-ink-700">{{ s.description }}</p>
            </div>
          </div>
        </div>
      </section>

      <!-- Sustainability -->
      <section class="border-t border-ink-200 py-16">
        <div class="grid items-center gap-10 lg:grid-cols-2">
          <div class="order-2 lg:order-1 aspect-[4/3] overflow-hidden rounded-2xl bg-gradient-to-br from-sage/30 to-sage/10">
            <div class="flex h-full w-full items-center justify-center">
              <svg class="h-20 w-20 text-sage" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
          </div>
          <div class="order-1 lg:order-2">
            <span class="text-[13px] font-semibold uppercase tracking-widest text-ink-600">Sustainability</span>
            <h2 class="mt-3 font-serif text-[28px] leading-snug text-ink-950 sm:text-[34px]">
              Business for good
            </h2>
            <p class="mt-4 text-[15px] leading-relaxed text-ink-700">
              We are proudly committed to responsible business practices. From B Corp certified suppliers to 1% for the Planet donations, every order you place contributes to positive change.
            </p>
            <div class="mt-6 grid grid-cols-2 gap-4">
              <div class="rounded-xl bg-[#f5f1ec] p-4 text-center">
                <div class="text-[24px] font-bold text-ink-950">B Corp</div>
                <div class="text-[13px] text-ink-600">Certified suppliers</div>
              </div>
              <div class="rounded-xl bg-[#f5f1ec] p-4 text-center">
                <div class="text-[24px] font-bold text-ink-950">1%</div>
                <div class="text-[13px] text-ink-600">For the Planet</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- CTA -->
      <section class="mb-16 rounded-2xl bg-ink-950 p-8 text-center sm:p-14">
        <h2 class="font-serif text-[28px] text-white sm:text-[36px]">Ready to create something great?</h2>
        <!--
          ink-300, not ink-600. The ink ramp runs dark-to-light, so the
          "muted body" step is ink-600 ON A LIGHT GROUND and its MIRROR
          (ink-300) on a dark one. Using ink-600 here inverted the ramp:
          2.37:1 on ink-950, i.e. dark text on a dark slab. ink-300 is
          8.17:1 and still reads as clearly subordinate to the white h2
          above it (18.69:1), which is the effect the ink-600 was reaching
          for. ink-400 would also pass, but at 4.98:1 it has 0.48 of
          headroom over the floor — too little for supporting copy.
        -->
        <p class="mx-auto mt-3 max-w-[45ch] text-[15px] text-ink-300">
          Browse our catalog or get in touch to start your branded merch project today.
        </p>
        <div class="mt-7 flex flex-wrap items-center justify-center gap-4">
          <NuxtLink to="/products" class="inline-flex h-[48px] items-center justify-center bg-white px-8 text-[14px] font-medium tracking-wide text-ink-950 hover:bg-ink-100">
            Shop now
          </NuxtLink>
          <!--
            Same inversion in the border, and it failed the other way round:
            border-ink-600 is 2.37:1 on ink-950, under SC 1.4.11's 3:1 for a
            control boundary — and the boundary is the only thing that makes
            this ghost button read as a button. The old hover (ink-400,
            4.98:1) PASSED, so the control was legal only while the pointer
            was on it, which is exactly backwards. Rest state now clears the
            floor on its own and hover lifts to white, matching the primary.
          -->
          <NuxtLink to="/contact" class="inline-flex h-[48px] items-center justify-center border border-ink-400 px-8 text-[14px] font-medium tracking-wide text-white hover:border-white">
            Contact us
          </NuxtLink>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'About · GhostMark Studio' })

const values = [
  { emoji: '\u2728', title: 'Quality first', description: 'We select only premium products that people will actually use and keep.' },
  { emoji: '\uD83C\uDF31', title: 'Sustainability', description: 'Eco-friendly materials, responsible suppliers, and carbon-neutral shipping.' },
  { emoji: '\uD83E\uDD1D', title: 'Transparency', description: 'Clear pricing, honest timelines, and no hidden fees or surprises.' },
  { emoji: '\uD83D\uDE80', title: 'Simplicity', description: 'From quote to delivery, we handle everything so you can focus on your brand.' },
]

const steps = [
  { title: 'Browse & select', description: 'Choose products from our curated catalog of sustainable branded merchandise.' },
  { title: 'Customize', description: 'Upload your logo and choose your decoration method. We support screen printing, embroidery, laser engraving, and more.' },
  { title: 'Approve proofs', description: 'We send you digital mockups for review before anything goes into production.' },
  { title: 'We produce & ship', description: 'Our production partners manufacture your merch and we handle worldwide delivery.' },
]
</script>
