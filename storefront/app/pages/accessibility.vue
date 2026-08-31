<template>
  <div>
    <div class="relative mx-auto w-full max-w-rail px-gutter">
      <nav class="absolute top-[2rem] z-10 self-end md:self-start" aria-label="breadcrumbs">
        <ol class="flex items-center gap-1">
          <li><NuxtLink to="/" class="text-sm text-greyText hover:text-ink-950 hover:underline">Home</NuxtLink></li>
          <li class="text-sm text-greyText" aria-hidden="true">/</li>
          <li><span class="text-sm text-ink-950" aria-current="page">Accessibility</span></li>
        </ol>
      </nav>

      <h1 class="gm-display gm-display-xl relative mt-0 mb-[3rem] pt-[6rem] text-ink-950 lg:mb-[4rem] lg:pt-[10rem]">
        Accessibility
      </h1>

      <div class="prose prose-neutral max-w-[600px] mb-[6rem] space-y-6 text-ink-700 leading-[1.65]">
        <p class="text-[16px]">
          GhostMark Studio is committed to making this storefront usable by everyone, including
          people who rely on assistive technology. We aim to meet the WCAG 2.1 Level AA standard
          across the catalogue, the design editor, and the checkout flow.
        </p>

        <h2 class="gm-display gm-display-md mt-[3rem] text-ink-950">What we're doing</h2>
        <ul class="list-disc list-outside ml-6 space-y-2 text-[15px]">
          <li>Semantic HTML and ARIA roles on every interactive control.</li>
          <li>Keyboard-reachable focus indicators on every clickable element.</li>
          <li>Touch targets at the WCAG 44×44 minimum across all viewports.</li>
          <li>Colour contrast tuned to AA against the warm offWhite palette.</li>
          <li>Visible text alternatives for icon-only buttons.</li>
        </ul>

        <h2 class="gm-display gm-display-md mt-[3rem] text-ink-950">Known gaps</h2>
        <ul class="list-disc list-outside ml-6 space-y-2 text-[15px]">
          <li>The print-on-demand canvas editor's keyboard story is in active development.</li>
          <li>Some product imagery is currently sourced from third parties and lacks brand-specific alt text.</li>
        </ul>

        <h2 class="gm-display gm-display-md mt-[3rem] text-ink-950">Get in touch</h2>
        <p class="text-[15px]">
          If you hit a barrier, email
          <a href="mailto:hello@ghostmark.studio" class="text-ink-950 underline hover:no-underline">hello@ghostmark.studio</a>.
          We treat accessibility issues as bugs and route them straight to the team.
        </p>
      </div>
    </div>

    <div class="mx-auto w-full max-w-rail px-gutter mt-16 flex flex-col gap-12 mb-12">
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
      content: 'GhostMark Studio accessibility statement: WCAG 2.1 Level AA commitments, known gaps, and how to report issues.',
    },
  ],
})
</script>
