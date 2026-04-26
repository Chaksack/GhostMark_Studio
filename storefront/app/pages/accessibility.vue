<template>
  <div class="lg:pt-[118px]">
    <div class="relative px-[1.5rem] lg:px-[3rem] max-w-[80rem] mx-auto">
      <nav class="absolute top-[2rem] self-end md:self-start" aria-label="breadcrumbs">
        <ol class="flex items-center gap-1">
          <li><NuxtLink to="/" class="text-sm text-greyText hover:text-ink-950 hover:underline">Home</NuxtLink></li>
          <li class="text-sm text-greyText" aria-hidden="true">/</li>
          <li><span class="text-sm text-ink-950" aria-current="page">Accessibility</span></li>
        </ol>
      </nav>

      <h1 class="relative pt-[6rem] lg:pt-[10rem] mt-0 mb-[3rem] lg:mb-[4rem] text-[3.6rem] lg:text-[5.6rem] leading-[4rem] lg:leading-[6rem]">
        Accessibility
      </h1>

      <div class="prose prose-neutral max-w-[60rem] mb-[6rem] space-y-6 text-ink-700 leading-[1.65]">
        <p class="text-[1.6rem]">
          GhostMark Studio is committed to making this storefront usable by everyone, including
          people who rely on assistive technology. We aim to meet the WCAG 2.1 Level AA standard
          across the catalogue, the design editor, and the checkout flow.
        </p>

        <h2 class="text-[2rem] lg:text-[2.4rem] font-medium text-ink-950 mt-[3rem]">What we're doing</h2>
        <ul class="list-disc list-outside ml-6 space-y-2 text-[1.5rem]">
          <li>Semantic HTML and ARIA roles on every interactive control.</li>
          <li>Keyboard-reachable focus indicators on every clickable element.</li>
          <li>Touch targets at the WCAG 44×44 minimum across all viewports.</li>
          <li>Colour contrast tuned to AA against the warm offWhite palette.</li>
          <li>Visible text alternatives for icon-only buttons.</li>
        </ul>

        <h2 class="text-[2rem] lg:text-[2.4rem] font-medium text-ink-950 mt-[3rem]">Known gaps</h2>
        <ul class="list-disc list-outside ml-6 space-y-2 text-[1.5rem]">
          <li>The print-on-demand canvas editor's keyboard story is in active development.</li>
          <li>Some product imagery is currently sourced from third parties and lacks brand-specific alt text.</li>
        </ul>

        <h2 class="text-[2rem] lg:text-[2.4rem] font-medium text-ink-950 mt-[3rem]">Get in touch</h2>
        <p class="text-[1.5rem]">
          If you hit a barrier, email
          <a href="mailto:hello@ghostmark.studio" class="text-ink-950 underline hover:no-underline">hello@ghostmark.studio</a>.
          We treat accessibility issues as bugs and route them straight to the team.
        </p>
      </div>
    </div>

    <div class="mx-auto w-full max-w-screen-3xl px-5 sm:px-6 lg:px-8 mt-16 flex flex-col gap-12 mb-12">
      <AppNewsletter />
    </div>
  </div>
</template>

<script setup lang="ts">
useHead({
  title: 'Accessibility · GhostMark Studio',
  meta: [
    {
      name: 'description',
      content: 'GhostMark Studio accessibility statement — WCAG 2.1 Level AA commitments, known gaps, and how to report issues.',
    },
  ],
})
</script>
