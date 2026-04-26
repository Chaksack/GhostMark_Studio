<template>
  <div>
    <div v-if="pending" class="py-20 text-center text-zinc-500">Loading product&hellip;</div>
    <div v-else-if="!product" class="py-20 text-center text-zinc-500">Product not found.</div>

    <template v-else>
      <!--
        Two-pane PDP shell. LEFT pane is the sticky image well that fills the
        viewport below BOTH desktop fixed bands — the warmGrey logo/search/
        actions bar (h-[6.8rem]) and the white category nav (h-[5rem]) —
        hence lg:top-[118px] and h-[calc(100vh-118px)]. RIGHT pane scrolls
        independently and stays sparse above the fold: H1 + a small
        auxiliary action row + the numbered customisation step cards.
      -->
      <div class="lg:flex min-h-screen lg:pt-[118px]" aria-label="product customization container">
        <!-- LEFT: sticky image pane -->
        <div class="lg:w-1/2 lg:sticky lg:top-[118px] h-[414px] lg:h-[calc(100vh-118px)] flex items-end bg-offWhite">
          <div class="relative w-full h-full">
            <!-- Breadcrumb absolute over image, desktop only -->
            <div class="hidden lg:block absolute top-[1.8rem] left-[1.52rem] z-20 text-black">
              <nav aria-label="breadcrumb">
                <ol class="flex flex-wrap items-center gap-1.5 text-sm sm:gap-2.5">
                  <li>
                    <NuxtLink to="/products" class="text-greyText hover:underline">All products</NuxtLink>
                  </li>
                  <li><span class="text-greyText">/</span></li>
                  <li><span class="text-greyText">{{ product.title }}</span></li>
                </ol>
              </nav>
            </div>

            <!--
              Image stack — first image fills the pane. When the user is
              actively designing in step 2, `livePreviewUrl` mirrors the
              editor's mockup+design composite so this pane reflects every
              upload / drag / scale / rotate without needing to add to cart.
            -->
            <img
              v-if="livePreviewUrl"
              :src="livePreviewUrl"
              :alt="`${product.title} — your design preview`"
              class="w-full h-full object-contain absolute inset-0 bg-offWhite"
            />
            <div v-else-if="product.images?.length" class="absolute inset-0">
              <NuxtImg
                :src="product.images[0]!.url"
                :alt="product.title"
                class="w-full h-full object-cover absolute inset-0"
                format="webp"
                loading="eager"
                sizes="100vw lg:50vw"
              />
            </div>
            <img
              v-else-if="product.thumbnail"
              :src="product.thumbnail"
              :alt="product.title"
              class="w-full h-full object-cover absolute inset-0"
            />
            <div v-else class="absolute inset-0 flex items-center justify-center text-greyText">
              <svg class="h-16 w-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="m21 15-5-5L5 21" />
              </svg>
            </div>
          </div>
        </div>

        <!-- RIGHT: scrolling info column -->
        <div class="lg:w-1/2 flex flex-col justify-between relative pt-[3rem] md:pt-[5rem] lg:pt-[2.5rem]">
          <div class="px-[1.5rem]">
            <nav aria-label="breadcrumb" class="lg:hidden mb-4 max-w-full overflow-hidden">
              <ol class="flex flex-nowrap items-center gap-1.5 text-sm min-w-0">
                <li class="shrink-0"><NuxtLink to="/products" class="text-greyText hover:underline">All products</NuxtLink></li>
                <li class="shrink-0"><span class="text-greyText">/</span></li>
                <li class="min-w-0 flex-1"><span class="text-greyText truncate block">{{ product.title }}</span></li>
              </ol>
            </nav>
            <div class="flex flex-col mb-[1.8rem] gap-[1.8rem]">
              <div class="flex flex-col gap-[1rem]">
                <div class="flex items-center justify-between">
                  <h1 class="text-[2.4rem] leading-[2.8rem] mb-0 mt-0">{{ product.title }}</h1>
                </div>
                <div v-if="fromPrice !== null" class="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[1.4rem] leading-[2rem] text-greyText" data-test="from-price">
                  <span>
                    From <span class="text-[1.6rem] font-medium text-ink-950">{{ formatMoney(fromPrice) }}</span> / piece
                  </span>
                  <span class="opacity-50" aria-hidden="true">·</span>
                  <span>MOQ {{ moq }}</span>
                  <span class="opacity-50" aria-hidden="true">·</span>
                  <span>E-proof in 48h</span>
                </div>
                <p v-if="product.description" class="lg:hidden">{{ product.description }}</p>
              </div>
              <!--
                Aux action row (md+ only). Every chip / button below is
                forced to a 44px minimum hit area — the prior `py-[1rem]`
                rendered ~36px and failed WCAG 2.5.5 on a tablet pointer.
                inline-flex + min-h-[44px] keeps the visual size identical
                while satisfying the touch-target rule.
              -->
              <div class="hidden md:flex items-center gap-[1rem] flex-wrap">
                <a
                  href="#variant-specificities"
                  class="inline-flex items-center min-h-[44px] bg-uiGrey border border-transparent hover:border-black py-[1rem] px-[1.4rem] lg:py-[1.2rem] lg:px-[1.6rem] text-[14px] lg:text-base leading-[2rem] rounded-[0.5rem]"
                >
                  View product details
                </a>
                <button
                  type="button"
                  data-test="buy-sample"
                  class="inline-flex items-center min-h-[44px] bg-offWhite hover:bg-uiGrey py-[1rem] px-[1.4rem] lg:py-[1.2rem] lg:px-[1.6rem] rounded-[0.5rem] text-[14px] lg:text-base leading-[2rem]"
                  @click="onBuySample"
                >
                  Buy a sample
                </button>
                <NuxtLink
                  :to="`/contact?intent=quote&product=${product.handle}`"
                  class="inline-flex items-center min-h-[44px] bg-offWhite hover:bg-uiGrey px-[1.6rem] py-[1.2rem] rounded-[0.5rem] text-base leading-[2rem]"
                >
                  Request a quote
                </NuxtLink>
                <button
                  type="button"
                  class="inline-flex items-center justify-center h-[44px] w-[44px] bg-offWhite hover:bg-uiGrey rounded-[0.5rem]"
                  aria-label="Share"
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
                    <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
                    <polyline points="16 6 12 2 8 6" />
                    <line x1="12" y1="2" x2="12" y2="15" />
                  </svg>
                </button>
              </div>
            </div>

            <!-- 1. Pick a variant — only when the product has options. -->
            <div
              v-if="hasVariantAxes"
              data-test="variant-section"
              class="flex flex-col bg-white shadow-custom p-[1.5rem] pb-[3rem] rounded-[0.5rem] relative"
            >
              <h2 class="text-[2rem] leading-[2.4rem] md:text-[2.4rem] md:leading-[2.8rem] whitespace-pre-wrap mb-[2rem] md:mb-[3rem]">{{ stepNumber('variant') }}. Pick a product variant</h2>

              <div v-if="optionGroups.length" class="space-y-5">
                <div v-for="og in optionGroups" :key="og.id" class="space-y-2">
                  <!--
                    Color groups need TWO bits of context, not one: the axis
                    name AND the currently-selected value (so the user knows
                    which colour those mute filled circles are advertising).
                    Other axes (size/gender) already render the value inside
                    the chip itself, so the bare title still reads cleanly.
                  -->
                  <div
                    v-if="optionKind(og) === 'color'"
                    class="flex items-baseline gap-[1rem] mb-[1rem]"
                    data-test="color-label-row"
                  >
                    <p class="text-[13px] font-medium text-ink-700">{{ displayOptionTitle(og.title) }}:</p>
                    <p class="text-[13px] text-ink-950" data-test="color-selected-value">{{ selectedOptions[og.id] || 'Select a color' }}</p>
                  </div>
                  <p v-else class="text-[13px] font-medium text-ink-700 mb-[1rem]">{{ displayOptionTitle(og.title) }}</p>

                  <RadioGroup
                    :model-value="selectedOptions[og.id] ?? ''"
                    @update:model-value="(val) => onSelectOption(og.id, String(val))"
                  >
                    <RadioGroupLabel class="sr-only">{{ displayOptionTitle(og.title) }}</RadioGroupLabel>

                    <!--
                      Color: round 28px swatches inside a 44px hit area.
                      The visible swatch stays small (luxury restraint) but
                      the button itself is 44x44 to satisfy WCAG 2.5.5 / Apple
                      HIG 44pt minimum. The padding pattern keeps the visual
                      spacing tight (gap-0 + p-[8px]) so 8 swatches still
                      wrap cleanly at 320px (8 * 44 = 352, wraps to 2 rows).
                    -->
                    <div v-if="optionKind(og) === 'color'" class="flex flex-wrap gap-0">
                      <RadioGroupOption
                        v-for="val in og.values"
                        :key="val"
                        v-slot="{ checked }"
                        :value="val"
                        as="template"
                      >
                        <button
                          type="button"
                          :aria-label="`Color: ${val}`"
                          :aria-pressed="checked"
                          :title="val"
                          class="relative inline-flex h-[44px] w-[44px] items-center justify-center rounded-full p-[8px] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 motion-reduce:transition-none"
                        >
                          <span
                            class="block h-7 w-7 rounded-full border border-greyLines transition"
                            :class="checked ? 'ring-2 ring-black ring-offset-2' : 'hover:border-black'"
                            :style="swatchStyle(val)"
                            aria-hidden="true"
                          />
                          <span class="sr-only">{{ val }}</span>
                        </button>
                      </RadioGroupOption>
                    </div>

                    <!--
                      Gender (Fit): pill-shaped (`rounded-[60px]`). min-h
                      bumped to 44px to satisfy WCAG 2.5.5 / Apple HIG
                      44pt across all viewports.
                    -->
                    <div v-else-if="optionKind(og) === 'gender'" class="flex flex-wrap gap-2">
                      <RadioGroupOption
                        v-for="val in og.values"
                        :key="val"
                        v-slot="{ checked }"
                        :value="val"
                        as="template"
                      >
                        <button
                          type="button"
                          :aria-label="`${displayOptionTitle(og.title)} ${val}`"
                          class="inline-flex items-center justify-center min-h-[44px] py-[10px] px-[18px] text-[1.4rem] leading-[2rem] border border-solid rounded-[60px] cursor-pointer transition-all duration-200 hover:border-black focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 motion-reduce:transition-none"
                          :class="checked
                            ? 'border-black bg-ink-950 text-white'
                            : 'border-greyLines bg-white text-zinc-900'"
                        >
                          {{ titleCase(val) }}
                        </button>
                      </RadioGroupOption>
                    </div>

                    <!--
                      Size or default: pill chips. 44x44 minimum touch
                      target, value still centered in chip. min-w bumped
                      to 4.4rem (44px) so single-letter sizes (S, M, L)
                      render as squares not narrow ovals.
                    -->
                    <div v-else class="flex flex-wrap gap-2">
                      <RadioGroupOption
                        v-for="val in og.values"
                        :key="val"
                        v-slot="{ checked }"
                        :value="val"
                        as="template"
                      >
                        <button
                          type="button"
                          :aria-label="`${displayOptionTitle(og.title)} ${val}`"
                          class="inline-flex items-center justify-center min-h-[44px] min-w-[44px] py-[10px] px-[15px] text-[1.4rem] leading-[2rem] border border-solid rounded-[60px] cursor-pointer transition-all duration-200 hover:border-black focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 motion-reduce:transition-none"
                          :class="checked
                            ? 'border-black bg-ink-950 text-white'
                            : 'border-greyLines bg-white text-zinc-900 hover:bg-black/5'"
                        >
                          {{ val }}
                        </button>
                      </RadioGroupOption>
                    </div>
                  </RadioGroup>
                </div>
              </div>

              <!-- Fallback variant dropdown if no option groups -->
              <div v-else-if="variants.length > 1" class="mt-4">
                <label class="text-[13px] text-zinc-500" for="variant-select">Variant</label>
                <select
                  id="variant-select"
                  v-model="selectedVariantId"
                  class="mt-1.5 w-full border border-zinc-200 bg-white px-3 py-2.5 text-[14px] text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-300"
                >
                  <option v-for="v in variants" :key="v.id" :value="v.id">{{ v.title || v.sku || v.id }}</option>
                </select>
              </div>
            </div>

            <!--
              Customisation step.
              Invariant #1: print_locations.length === 0 OR is_customizable===false
                → no editor, no upload UI; render a simple non-customisable
                hint (the actual Add-to-cart lives below).
              Invariant #2 + #3: 1 vs N locations is decided inside DesignEditor.
            -->
            <div
              v-if="isCustomizable && printLocations.length"
              class="flex flex-col bg-white shadow-custom p-[1.5rem] pb-[3rem] rounded-[0.5rem] relative mt-[1.8rem]"
              data-test="design-editor-section"
            >
              <h2 class="text-[2rem] leading-[2.4rem] md:text-[2.4rem] md:leading-[2.8rem] whitespace-pre-wrap mb-[2rem] md:mb-[3rem]">{{ stepNumber('customise') }}. Upload your design</h2>

              <!--
                Native-size upload affordance, mobile only. Sits OUTSIDE the
                scaled (transform: scale(0.55)) editor wrapper below so the
                touch target renders at the full 48px height — WCAG 2.5.5 /
                Apple HIG 44pt minimum. The button delegates to the
                <input type="file"> already rendered inside DesignEditor's
                helper panel; CSS transforms don't affect programmatic
                .click() so this works through the scale.

                The handler now uses the typed component ref (see
                `designEditorRef.value?.openFilePicker()` below) — the
                bug-6 round's `lg:hidden` pill in DesignEditor has been
                removed and the component exposes `openFilePicker()` via
                defineExpose, so we no longer rely on a brittle DOM query.
              -->
              <div class="lg:hidden mb-4">
                <button
                  type="button"
                  data-test="mobile-upload-trigger"
                  :aria-label="anyDesignUploaded ? 'Replace your uploaded design' : 'Upload your design file'"
                  @click="onMobileUploadClick"
                  class="w-full inline-flex items-center justify-center gap-2 h-12 bg-ink-950 text-cream-50 hover:bg-ink-700 transition-colors rounded-[0.5rem] px-4 text-[14px] font-medium uppercase tracking-[0.04em] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ink-950"
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <span>{{ anyDesignUploaded ? 'Replace design' : 'Upload your design' }}</span>
                </button>
                <p class="mt-2 text-center text-[12px] text-greyText">PNG, JPG, WebP &middot; max 10MB</p>
              </div>

              <!--
                The Konva stage inside DesignEditor is fixed at 600x800 px and
                its parent uses `lg:grid-cols-[minmax(0,600px)_minmax(0,1fr)]`
                — i.e. at lg+ the stage and the upload-helper panel sit
                side-by-side. We can't touch DesignEditor.vue or the
                STAGE_W/STAGE_H constants, so the parent here gives the
                editor enough internal width to render BOTH columns at lg+,
                then visually constrains the result with
                `transform: scale(...)`. Four sizes apply:

                  Below sm the editor stacks vertically (single column).
                  320 viewport gets a tighter scale so the 600px stage
                  fits inside the 272px useable card width:
                    272 / 600 = 0.45 (clamped to 0.46 for crisp pixel rounding)
                    visible 276 x 368, height block 368px.
                  Mobile  >=360 (scale 0.55): inner 600  → visible 330 x 440
                  sm  >=640 (scale 0.7):       inner 600  → visible 420 x 560
                  lg  >=1024 (scale 0.65):     inner 944  → visible 614 x 553

                The lg inner width = 600 (stage) + 24 (gap-6) + 320 (helper
                panel min). Visible footprint at lg fits inside the right
                rail (lg:w-1/2 = 720 minus 1.5rem padding). The reserved
                outer height keeps the page from gaining a whitespace gap
                from the unscaled 800px natural footprint.

                NB: at 320px we apply both `w-[276px]` and the smaller
                scale via `min-[320px]:w-[276px]` — the default inherits
                a fluid `w-full max-w-[330px]` so width never exceeds the
                card's available inner space on devices below 360.
              -->
              <!--
                Per-breakpoint sizing of the editor envelope. The numbers
                are computed against `(viewport)/2 - 24px right-rail
                padding`, so the visible scaled output never exceeds the
                available column width:

                  vp 1024 → right rail 488 useable → scale 0.5 (visible 472, gap 12, panel 160 → 644 total, clamped, fine on lg+)
                  vp 1280 → right rail 616 useable → scale 0.65 visible 614 fits
                  vp 1440 → right rail 696 useable → scale 0.65 visible 614 fits

                Two lg sizes resolve this: `lg` keeps a tight 0.5 scale and
                `xl` (>=1280) restores the 0.65 luxury rendering. The
                outer wrapper height is reserved so the scaled inner
                doesn't leak whitespace below the editor card.
              -->
              <div
                data-test="design-editor"
                class="mx-auto max-w-full overflow-hidden w-full max-w-[276px] h-[368px] min-[360px]:w-[330px] min-[360px]:max-w-[330px] min-[360px]:h-[440px] sm:h-[560px] sm:w-[420px] sm:max-w-[420px] lg:h-[460px] lg:w-[472px] lg:max-w-[472px] xl:h-[600px] xl:w-[614px] xl:max-w-[614px]"
              >
                <div class="origin-top-left scale-[0.46] min-[360px]:scale-[0.55] sm:scale-[0.7] lg:scale-[0.5] xl:scale-[0.65] w-[600px] h-[800px] lg:w-[944px] lg:h-[920px]">
                  <ClientOnly>
                    <DesignEditor
                      ref="designEditorRef"
                      :product="product"
                      :variant-id="finalVariantId"
                      :print-locations="printLocations"
                      :techniques="techniques"
                      @added="onDesignAdded"
                      @error="onDesignError"
                      @live-preview="onLivePreview"
                      @uploaded-state-change="onDesignUploadedStateChange"
                    />
                    <template #fallback>
                      <div class="flex h-[400px] w-full items-center justify-center border border-zinc-200 bg-zinc-50 text-[13px] text-zinc-500">
                        Loading editor&hellip;
                      </div>
                    </template>
                  </ClientOnly>
                </div>
              </div>
            </div>

            <div
              v-else-if="!isCustomizable"
              class="mt-[1.8rem] rounded-[0.5rem] border border-greyLines bg-uiGrey/40 px-4 py-3 text-[13px] text-zinc-600"
              data-test="not-customisable"
            >
              This product isn&rsquo;t customisable. Use the Add to cart button below to order as-is.
            </div>

            <!--
              Quantity step.
              Invariant #5: tiers.length <= 1 → flat price + qty stepper, no ladder.
              Invariant #6: tiers.length >= 2 → full ladder.
            -->
            <div
              class="flex flex-col bg-white shadow-custom p-[1.5rem] pb-[3rem] rounded-[0.5rem] relative mt-[1.8rem]"
              data-test="quantity-section"
            >
              <h2 class="text-[2rem] leading-[2.4rem] md:text-[2.4rem] md:leading-[2.8rem] whitespace-pre-wrap mb-[2rem] md:mb-[3rem]">{{ stepNumber('quantity') }}. Quantity</h2>

              <p
                class="mt-2 text-[12px] uppercase tracking-wider text-zinc-500"
                data-test="moq-caption"
              >
                Minimum order: {{ moq }} {{ moq === 1 ? 'piece' : 'pieces' }}
              </p>

              <!-- Tier ladder — only when 2+ tiers. -->
              <div
                v-if="tiers.length >= 2"
                class="mt-3 divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white"
                role="radiogroup"
                aria-label="Quantity tiers"
                data-test="tier-ladder"
              >
                <!--
                  Tier rows. 320 viewport math:
                    272 useable (320 − 48 page) − 24 card padding = 248 inner
                    px-3 (24) → 224
                    gap-2 (8 + 8) → 208 split across 3 children
                    "100 pieces" (~62) + "£18.00/piece" (~76) + 56 badge = 194
                  …with min-h 44 the row is also a valid touch target.
                  Slightly larger gap kicks in at md so we stop hugging.
                -->
                <button
                  v-for="(tier, i) in tiers"
                  :key="tier.qty"
                  type="button"
                  role="radio"
                  :aria-checked="i === activeTierIndex"
                  data-test="tier-row"
                  class="flex w-full items-center justify-between gap-2 md:gap-6 px-3 md:px-4 min-h-[44px] py-2.5 text-left text-[12px] md:text-[13px] transition-colors first:rounded-t-lg last:rounded-b-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-900 motion-reduce:transition-none"
                  :class="i === activeTierIndex
                    ? 'bg-zinc-900 text-zinc-50'
                    : 'text-zinc-900 hover:bg-zinc-50'"
                  @click="qty = tier.qty"
                >
                  <span class="flex-1 min-w-0 font-medium tabular-nums truncate">{{ tier.qty }} pieces</span>
                  <span class="flex-1 min-w-0 text-right tabular-nums truncate">{{ formatMoney(tier.unitAmount) }}/piece</span>
                  <span class="w-[56px] md:w-[80px] text-right shrink-0">
                    <!--
                      Discount marker — restraint over volume. The merchery-sage
                      token at 50% (a quiet eucalyptus) on ink-700 type.
                      Whisper, not yell. Width drops to 56px on mobile so
                      "Save 100%" still fits without forcing the row into
                      overflow scroll.
                    -->
                    <span
                      v-if="tier.discountPct > 0"
                      class="inline-flex items-center justify-center rounded-sm px-1.5 md:px-2 py-0.5 text-[10px] md:text-[11px] font-medium tabular-nums"
                      :class="i === activeTierIndex
                        ? 'bg-cream-50 text-ink-900'
                        : 'bg-merchery-sage/50 text-ink-700'"
                    >Save {{ tier.discountPct }}%</span>
                  </span>
                </button>
              </div>

              <!-- Flat price — only when 0 or 1 tier. -->
              <div
                v-else
                class="mt-3 flex items-baseline justify-between gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3"
                data-test="flat-price"
              >
                <span class="text-[12px] uppercase tracking-wider text-zinc-500">Unit price</span>
                <span class="text-[16px] font-semibold tabular-nums text-zinc-950">{{ formatMoney(effectiveUnit) }}</span>
              </div>

              <!--
                Quantity stepper + total. The −/+ buttons and the input are
                bumped from 42px to 44px for WCAG 2.5.5 / Apple HIG 44pt
                compliance. The trio still fits on a 320 viewport because
                44 + 64 + 44 = 152 — well inside the 272px useable card
                width (320 − 48 page padding − 24 card padding).
              -->
              <div class="mt-4 flex flex-wrap items-center justify-between gap-4">
                <div class="flex items-center gap-2">
                  <span class="text-[12px] uppercase tracking-wider text-zinc-500">Quantity</span>
                  <div class="flex items-center">
                    <button
                      class="flex h-[44px] w-[44px] items-center justify-center border border-zinc-200 bg-white text-zinc-950 hover:bg-zinc-50 disabled:opacity-40"
                      :disabled="qty <= moq"
                      data-test="qty-decrease"
                      @click="decrementQty"
                      type="button"
                      aria-label="Decrease quantity"
                    >&minus;</button>
                    <input
                      v-model.number="qty"
                      type="number"
                      :min="moq"
                      data-test="qty-input"
                      aria-label="Quantity"
                      class="h-[44px] w-[64px] border-y border-zinc-200 bg-white px-2 text-center text-[14px] font-medium text-zinc-950 tabular-nums [appearance:textfield] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-zinc-300 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      @blur="enforceMoq"
                    />
                    <button
                      class="flex h-[44px] w-[44px] items-center justify-center border border-zinc-200 bg-white text-zinc-950 hover:bg-zinc-50"
                      data-test="qty-increase"
                      @click="qty = qty + 1"
                      type="button"
                      aria-label="Increase quantity"
                    >+</button>
                  </div>
                </div>

                <div class="text-right" data-test="effective-total">
                  <div class="text-[11px] uppercase tracking-wider text-zinc-500">Total</div>
                  <div class="text-[18px] font-semibold tabular-nums text-zinc-950">{{ formatMoney(effectiveTotal) }}</div>
                </div>
              </div>

              <!--
                Primary Add to cart sits at the foot of the quantity card —
                the merchery PDP keeps the CTA inside the same elevation so
                the user's eye never leaves the step they just configured.
              -->
              <div ref="primaryAtcRow" class="mt-6 flex flex-nowrap items-stretch gap-3">
                <button
                  class="inline-flex h-[5.6rem] flex-1 min-w-0 items-center justify-center rounded-[0.5rem] bg-ink-950 px-7 text-[1.5rem] font-medium uppercase tracking-[0.02em] text-cream-50 transition-colors duration-fast hover:bg-ink-700 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
                  :disabled="!finalVariantId || adding"
                  @click="onAddToCart"
                  type="button"
                  data-test="primary-add-to-cart"
                >
                  {{ adding ? 'Adding&hellip;' : 'Add to cart' }}
                </button>
                <button
                  class="inline-flex h-[5.6rem] w-[5.6rem] shrink-0 items-center justify-center rounded-[0.5rem] border border-greyLines bg-white text-zinc-400 hover:border-zinc-300 hover:text-zinc-950"
                  type="button"
                  aria-label="Add to favorites"
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z"/></svg>
                </button>
              </div>
              <p
                v-if="addError"
                role="alert"
                aria-live="assertive"
                data-test="add-to-cart-error"
                class="mt-3 text-[13px] text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded"
              >{{ addError }}</p>
              <p v-if="addSuccess" class="mt-3 text-[13px] text-ink-700">Added to cart!</p>
            </div>
          </div>

          <!--
            Desktop sticky bottom action bar (lg+ only).
            - Pure CSS `position: sticky; bottom: 0` — pins to viewport bottom
              once user scrolls past the inline ATC card. No IntersectionObserver
              needed (mobile keeps its observer-driven sticky bar below).
            - Lives as the LAST direct child of the right-rail flex column so
              the sticky offset is computed against the page scroll container.
            - `mx-[-1.5rem] px-[1.5rem]` extends the bar's background edge-to-edge
              of the right rail by negating the parent column's horizontal pad.
            - Uses `formatMoney(effectiveTotal)` and `leadTime` so figures stay
              in lockstep with the inline qty card. ATC delegates to the same
              `onAddToCart` handler — no duplicated cart logic.
          -->
          <div
            v-if="product"
            class="hidden lg:block lg:sticky lg:bottom-0 z-20 mx-[-1.5rem] px-[1.5rem] py-[1.2rem] bg-white border-t border-greyLines mt-6"
            data-test="desktop-sticky-atc"
          >
            <div class="flex items-center justify-between gap-4">
              <div class="flex flex-col text-[12px] text-greyText">
                <span>Lead time:</span>
                <span class="text-[13px] font-medium text-ink-950">~{{ leadTime }} business days</span>
              </div>
              <div class="flex flex-col text-right text-[12px] text-greyText">
                <span>Total:</span>
                <span class="text-[15px] font-medium text-ink-950 tabular-nums">{{ formatMoney(effectiveTotal) }}</span>
              </div>
              <button
                class="inline-flex h-12 items-center justify-center rounded-[0.5rem] bg-ink-950 px-6 text-[14px] font-medium uppercase tracking-[0.04em] text-cream-50 transition-colors duration-fast hover:bg-ink-700 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
                :disabled="!finalVariantId || adding"
                @click="onAddToCart"
                type="button"
                aria-label="Add to cart from sticky bar"
              >
                {{ adding ? 'Adding&hellip;' : 'Add to cart' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!--
        bg-uiHighlight reassurance strip — sits BELOW the two-pane container,
        not inside the right rail. The right rail above the fold stays sparse.

        Column-height parity rules (Bug 25):
        - The grid is `items-stretch` so every column gets the row's full height.
        - Every column is `flex flex-col h-full` so it can stretch internally.
        - Every column body line is `flex-1` so the bottom line of every column
          sits on the same baseline regardless of how many lines the heading
          wraps onto.
        - Icon+heading rows are `items-center` so a 2-line heading does not
          push the icon off the heading's vertical centre.
      -->
      <div class="bg-uiHighlight grid grid-cols-2 grid-rows-2 gap-y-12 gap-x-6 md:grid md:grid-cols-2 md:grid-rows-2 lg:grid-cols-4 lg:grid-rows-1 items-stretch px-[1.5rem] py-[3rem] md:py-[5rem] lg:py-[7rem] md:gap-y-12 lg:gap-y-0 lg:gap-x-12 lg:justify-between min-[1300px]:px-[13.4rem] max-[1300px]:lg:px-[6rem]" data-test="reassurance-strip">
        <a
          href="https://trustpilot.com"
          target="_blank"
          rel="noopener"
          class="flex flex-col items-start h-full lg:max-w-[24rem] gap-[0.4rem]"
        >
          <div class="flex items-center gap-[0.2rem]">
            <svg v-for="n in 5" :key="n" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" class="text-[#00B67A]" aria-hidden="true">
              <path d="M12 2 15 9l7 .7-5.3 4.8 1.6 7L12 17.7 5.7 21.5l1.6-7L2 9.7 9 9z" />
            </svg>
          </div>
          <span class="text-[1.3rem] leading-[1.8rem] pl-[0.3rem] text-greyText flex-1">Excellent | 4.8 out of 5</span>
        </a>
        <div class="flex flex-col items-start h-full lg:max-w-[24rem] gap-[0.4rem]">
          <div class="flex items-center gap-[0.5rem]">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
              <rect x="1" y="3" width="15" height="13" />
              <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
              <circle cx="5.5" cy="18.5" r="2.5" />
              <circle cx="18.5" cy="18.5" r="2.5" />
            </svg>
            <span class="text-[1.4rem] leading-[1.8rem] font-medium">Worldwide delivery</span>
          </div>
          <span class="text-[1.3rem] leading-[1.8rem] text-greyText flex-1">EU, UK and USA</span>
        </div>
        <div class="flex flex-col items-start h-full lg:max-w-[24rem] gap-[0.4rem]">
          <div class="flex items-center gap-[0.5rem]">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span class="text-[1.4rem] leading-[1.8rem] font-medium">Quality control</span>
          </div>
          <span class="text-[1.3rem] leading-[1.8rem] text-greyText flex-1">Each order is double checked before production</span>
        </div>
        <div class="flex flex-col items-start h-full lg:max-w-[24rem] gap-[0.4rem]">
          <div class="flex items-center gap-[0.5rem]">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span class="text-[1.4rem] leading-[1.8rem] font-medium">They trust us!</span>
          </div>
          <span class="text-[1.3rem] leading-[1.8rem] text-greyText flex-1">Trusted by 2.000+ customers</span>
        </div>
      </div>

      <!--
        Product details — two-column shell with sticky-left intro + accordion-right.
        Mirrors the FAQ aside pattern (lg:flex gap-24 + lg:sticky lg:top-[140px]).
        - Left aside: section eyebrow/heading + supporting paragraph + sample CTA.
          Sticky against viewport so it remains visible while the user scans the
          accordion items on long PDPs (clears the 118px fixed header bands +
          22px breathing room → top-[140px]).
        - Right column: existing 5-section Disclosure logic preserved verbatim
          (Product details / Size guide / Production / Customization / Specificities).
          Variant matrix table inside `variant-specificities` panel kept as-is.
        - The lg:flex shell collapses to a single stack on mobile/tablet.
      -->
      <section
        class="mt-[6rem] mx-auto max-w-screen-3xl px-5 sm:px-6 lg:px-8"
        aria-labelledby="product-details-heading"
      >
        <div class="rounded-[0.5rem] bg-offWhite lg:flex p-6 md:p-10 lg:p-12 gap-12 lg:gap-24">
          <!-- Sticky left intro -->
          <div class="flex flex-col flex-1 lg:sticky lg:top-[140px] lg:self-start lg:h-fit">
            <h2
              id="product-details-heading"
              class="font-accent text-[2.4rem] leading-[2.8rem] md:text-[3.2rem] md:leading-[3.8rem] lg:text-[4rem] lg:leading-[4.6rem] mb-[1.8rem] text-ink-950"
            >
              Product details
            </h2>
            <p class="mb-[3rem] text-[1.4rem] leading-[2rem] md:text-[1.6rem] md:leading-[2.3rem] text-ink-700 max-w-[40ch]">
              The full make + materials + production specs. If you'd rather hold a sample first, we can ship one in 5 working days.
            </p>
            <div>
              <NuxtLink
                to="/contact?intent=sample"
                class="inline-flex items-center justify-center h-12 px-6 bg-ink-950 text-cream-50 hover:bg-ink-700 transition-colors duration-fast border border-ink-950 hover:border-ink-700 text-[14px] font-medium uppercase tracking-[0.04em] rounded-[0.5rem]"
              >
                Request a sample
              </NuxtLink>
            </div>
          </div>

          <!-- Accordion right -->
          <div
            class="flex-1 my-[2rem] max-lg:mt-[5.5rem] flex flex-col gap-2"
            data-test="info-accordion"
          >
            <Disclosure
              v-for="section in infoSections"
              :key="section.id"
              v-slot="{ open: isOpen }"
              as="div"
              :id="section.id"
              :data-section-id="section.id"
              class="scroll-mt-28 bg-white border border-greyLines rounded-[0.5rem] p-4 mb-2"
            >
              <DisclosureButton
                :as="'button'"
                class="flex w-full cursor-pointer items-center justify-between text-left font-serif text-[18px] text-zinc-950 transition-colors hover:text-zinc-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 motion-reduce:transition-none"
                :data-section-button="section.id"
                @click="syncHash(section.id, isOpen)"
              >
                <span>{{ section.title }}</span>
                <svg
                  class="h-5 w-5 text-zinc-400 transition-transform duration-200 motion-reduce:transition-none"
                  :class="isOpen ? 'rotate-180' : ''"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </DisclosureButton>
              <DisclosurePanel class="pt-4 text-[14px] leading-relaxed text-zinc-600">
                <div v-if="section.id === 'variant-specificities'">
                  <p class="mb-3">{{ section.body }}</p>
                  <div class="overflow-x-auto rounded-md border border-zinc-200">
                    <table class="w-full border-collapse text-left text-[12px]" data-test="variant-matrix">
                      <thead class="bg-zinc-50">
                        <tr>
                          <th class="border-b border-zinc-200 px-3 py-2 font-medium text-zinc-700">Color</th>
                          <th class="border-b border-zinc-200 px-3 py-2 font-medium text-zinc-700">Size</th>
                          <th class="border-b border-zinc-200 px-3 py-2 font-medium text-zinc-700">Gender</th>
                          <th class="border-b border-zinc-200 px-3 py-2 text-right font-medium text-zinc-700">Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr
                          v-for="row in variantMatrix"
                          :key="row.id"
                          class="odd:bg-white even:bg-zinc-50"
                        >
                          <td class="border-b border-zinc-100 px-3 py-2 text-zinc-900">{{ row.color || '—' }}</td>
                          <td class="border-b border-zinc-100 px-3 py-2 text-zinc-900">{{ row.size || '—' }}</td>
                          <td class="border-b border-zinc-100 px-3 py-2 text-zinc-900">{{ row.gender || '—' }}</td>
                          <td class="border-b border-zinc-100 px-3 py-2 text-right tabular-nums text-zinc-700">{{ row.price || '—' }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
                <p v-else class="whitespace-pre-line">{{ section.body }}</p>
              </DisclosurePanel>
            </Disclosure>
          </div>
        </div>
      </section>

      <!-- You might also like — merchery-style oversized heading + carousel -->
      <div v-if="relatedProducts.length" class="pt-12">
        <h2 class="text-[2.4rem] md:text-[3.2rem] lg:text-[4rem] leading-[2.8rem] md:leading-[3.8rem] lg:leading-[4.6rem] px-[1.5rem] lg:px-12">You might also like&hellip;</h2>
        <BestSellers :products="relatedProducts" hide-heading />
      </div>

      <!-- FAQ + Newsletter — siblings inside one wrapper per merchery section D. -->
      <div class="mx-auto w-full max-w-screen-3xl px-5 sm:px-6 lg:px-8 mt-16 flex flex-col gap-12 mb-12">
        <AppFaq />
        <AppNewsletter />
      </div>
    </template>

    <!--
      Mobile/tablet sticky bottom ATC bar — merchery's persistent
      buy-call beneath the fold. Hidden on lg+ where the inline ATC
      stays in viewport. Carries qty stepper + ATC button so the user
      can buy without scrolling back to the quantity card.
    -->
    <!--
      Sticky bottom cart bar (mobile only).
      - Safe-area pad: `pb-[max(1rem,env(safe-area-inset-bottom))]` keeps the
        ATC clear of the iOS home indicator on notched devices, while
        falling back to 1rem on browsers without the env() value.
      - Stepper +/− buttons: 44x44 (was 42x36) so the touch target meets
        WCAG 2.5.5 even inside the cramped sticky strip.
      - ATC button: h-[48px] (was 42) for visual prominence and to clear
        the 44pt minimum with margin.
      - 320px math: 28px (page padding 14*2) + 44+44+44 stepper (132) +
        12 gap + 130min ATC = 318 — fits with 2px to spare. The ATC uses
        `truncate` on its label so an extreme price still renders.
    -->
    <ClientOnly>
      <div
        v-if="product && !primaryAtcInView"
        class="fixed inset-x-0 bottom-0 z-30 border-t border-greyLines bg-white shadow-[0_-4px_12px_rgba(0,0,0,0.06)] px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden"
      >
        <div class="mx-auto flex w-full max-w-screen-3xl items-center gap-2">
          <div class="flex items-center shrink-0">
            <button
              class="flex h-[44px] w-[44px] items-center justify-center border border-zinc-200 bg-white text-zinc-950 hover:bg-zinc-50 disabled:opacity-40"
              :disabled="qty <= moq"
              @click="decrementQty"
              type="button"
              aria-label="Decrease quantity"
            >&minus;</button>
            <input
              v-model.number="qty"
              type="number"
              :min="moq"
              aria-label="Quantity"
              class="h-[44px] w-[44px] border-y border-zinc-200 bg-white px-1 text-center text-[13px] font-medium text-zinc-950 tabular-nums [appearance:textfield] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-zinc-300 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              @blur="enforceMoq"
            />
            <button
              class="flex h-[44px] w-[44px] items-center justify-center border border-zinc-200 bg-white text-zinc-950 hover:bg-zinc-50"
              @click="qty = qty + 1"
              type="button"
              aria-label="Increase quantity"
            >+</button>
          </div>
          <button
            class="inline-flex h-[48px] flex-1 min-w-0 items-center justify-center rounded-[0.5rem] bg-ink-950 px-3 text-[13px] font-medium uppercase tracking-[0.02em] text-cream-50 transition-colors duration-fast hover:bg-ink-700 disabled:opacity-60 motion-reduce:transition-none"
            :disabled="!finalVariantId || adding"
            @click="onAddToCart"
            type="button"
          >
            <span class="truncate">{{ adding ? 'Adding…' : `Add to cart · ${formatMoney(effectiveTotal)}` }}</span>
          </button>
        </div>
      </div>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import {
  RadioGroup,
  RadioGroupLabel,
  RadioGroupOption,
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
} from '@headlessui/vue'

// --- Types ---------------------------------------------------------------
interface ProductOptionValue { id: string; value: string }
interface ProductOption { id: string; title: string; values?: ProductOptionValue[] }
interface VariantOption { option_id: string; value: string; title?: string }
interface VariantPrice { calculated_amount?: number | null }
interface ProductVariant {
  id: string
  title?: string | null
  sku?: string | null
  options?: VariantOption[]
  calculated_price?: VariantPrice | null
  prices?: { amount: number }[]
}
interface ProductImage { id?: string; url: string }
interface Product {
  id: string
  title: string
  handle: string
  description?: string | null
  thumbnail?: string | null
  images?: ProductImage[]
  options?: ProductOption[]
  variants?: ProductVariant[]
  metadata?: Record<string, unknown> | null
}

// --- Print metadata shapes (mirror DesignEditor's exported types) --------
interface PrintArea { x: number; y: number; width: number; height: number }
interface PrintLocation {
  key: string
  label: string
  mockup_url?: string | null
  area?: PrintArea
}
interface Technique {
  key: string
  label: string
  surcharge?: number
}
interface QuantityTier {
  quantity: number
  unit_amount: number
}
interface LeadTimeRange { min: number; max: number }

const route = useRoute()
const router = useRouter()
const sdk = useMedusaClient()
const regionState = useRegion()

const handle = computed(() => String(route.params.handle || ''))

await regionState.ensureRegion()

const { data, pending } = await useAsyncData<Product | null>(
  `product:${handle.value}`,
  async () => {
    const regionId = regionState.regionId.value
    const fields = 'id,title,subtitle,handle,description,thumbnail,*variants.calculated_price,*variants.options,*options,*images,metadata'
    try {
      const res = await sdk.store.product.list({
        handle: handle.value,
        limit: 1,
        fields,
        ...(regionId ? { region_id: regionId } : {}),
      })
      const p = (res as { products?: Product[] }).products?.[0]
      if (p) return p
    } catch { /* fall through to retrieve */ }
    try {
      const res = await sdk.store.product.retrieve(handle.value, {
        fields,
        ...(regionId ? { region_id: regionId } : {}),
      })
      return (res as { product?: Product }).product ?? null
    } catch {
      return null
    }
  },
  { watch: [handle, () => regionState.regionId.value] },
)

const product = computed<Product | null>(() => data.value ?? null)

useHead({
  title: () =>
    product.value?.title
      ? `${product.value.title} · GhostMark Studio`
      : 'Product · GhostMark Studio',
})

// =========================================================================
// Metadata-driven derived state
// =========================================================================

// is_customizable — explicit false means "not customisable". Anything else
// (true, undefined, missing metadata) defaults to TRUE because the platform
// is print-on-demand. The `print_locations.length === 0` invariant gives the
// merchant a softer way to suppress the editor for a specific SKU.
const isCustomizable = computed<boolean>(() => {
  const flag = product.value?.metadata?.is_customizable
  if (flag === false || flag === 'false') return false
  return true
})

// Type guard — narrows the metadata field reads.
const asArray = (v: unknown): unknown[] => Array.isArray(v) ? v : []

// print_locations resolver with backwards-compat fallback chain:
//   1. metadata.print_locations  (canonical, set by seed agent)
//   2. metadata.mockup_front + mockup_back  (legacy 2-zone shape)
//   3. images[0]/images[1] OR thumbnail  (best-effort default for products
//      that have no metadata at all but still need a customisation surface)
//   4. empty array  (only when the product is explicitly not customisable)
const printLocations = computed<PrintLocation[]>(() => {
  if (!product.value) return []
  if (!isCustomizable.value) return []

  const meta = product.value.metadata ?? {}

  // Path 1: canonical metadata.print_locations
  const raw = asArray(meta.print_locations)
  if (raw.length) {
    return raw
      .map((entry): PrintLocation | null => {
        if (!entry || typeof entry !== 'object') return null
        const e = entry as Record<string, unknown>
        const key = typeof e.key === 'string' ? e.key : null
        if (!key) return null
        const label = typeof e.label === 'string' && e.label
          ? e.label
          : titleCase(key.replace(/-/g, ' '))
        const mockup_url = typeof e.mockup_url === 'string' ? e.mockup_url : null
        const a = e.area as Record<string, unknown> | undefined
        const area = a && typeof a.x === 'number' && typeof a.y === 'number'
          && typeof a.width === 'number' && typeof a.height === 'number'
          ? { x: a.x, y: a.y, width: a.width, height: a.height }
          : undefined
        return { key, label, mockup_url, area }
      })
      .filter((l): l is PrintLocation => l !== null)
  }

  // Path 2: legacy mockup_front / mockup_back metadata.
  const mockupFront = typeof meta.mockup_front === 'string' ? meta.mockup_front : null
  const mockupBack = typeof meta.mockup_back === 'string' ? meta.mockup_back : null
  if (mockupFront || mockupBack) {
    const out: PrintLocation[] = []
    out.push({
      key: 'front',
      label: 'Front',
      mockup_url: mockupFront ?? product.value.images?.[0]?.url ?? null,
    })
    if (mockupBack || (product.value.images?.length ?? 0) > 1) {
      out.push({
        key: 'back',
        label: 'Back',
        mockup_url: mockupBack ?? product.value.images?.[1]?.url ?? null,
      })
    }
    return out
  }

  // Path 3: zero metadata, but flagged customisable. Fall back to a single
  // "Front" zone using the first product image. This keeps the legacy MVP
  // behaviour alive for unmigrated SKUs.
  const fallbackUrl = product.value.images?.[0]?.url ?? product.value.thumbnail ?? null
  if (fallbackUrl) {
    return [{ key: 'front', label: 'Front', mockup_url: fallbackUrl }]
  }
  return []
})

// techniques — empty array if the merchant hasn't set any. DesignEditor
// hides the pill row when this is empty.
const techniques = computed<Technique[]>(() => {
  const meta = product.value?.metadata ?? {}
  const raw = asArray(meta.techniques)
  return raw
    .map((entry): Technique | null => {
      if (!entry || typeof entry !== 'object') return null
      const e = entry as Record<string, unknown>
      const key = typeof e.key === 'string' ? e.key : null
      if (!key) return null
      const label = typeof e.label === 'string' && e.label ? e.label : titleCase(key)
      const surcharge = typeof e.surcharge === 'number' ? e.surcharge : undefined
      return { key, label, surcharge }
    })
    .filter((t): t is Technique => t !== null)
})

// quantity_tiers — sorted ascending by `quantity`. Empty array means
// "no tier ladder, flat price." We keep the shape strict (integer qty,
// integer minor-units price) and discard malformed rows silently.
const quantityTiers = computed<QuantityTier[]>(() => {
  const meta = product.value?.metadata ?? {}
  const raw = asArray(meta.quantity_tiers)
  return raw
    .map((entry): QuantityTier | null => {
      if (!entry || typeof entry !== 'object') return null
      const e = entry as Record<string, unknown>
      const q = typeof e.quantity === 'number' ? e.quantity : Number(e.quantity)
      const u = typeof e.unit_amount === 'number' ? e.unit_amount : Number(e.unit_amount)
      if (!Number.isFinite(q) || !Number.isFinite(u) || q <= 0) return null
      return { quantity: Math.floor(q), unit_amount: Math.round(u) }
    })
    .filter((t): t is QuantityTier => t !== null)
    .sort((a, b) => a.quantity - b.quantity)
})

// MOQ — explicit metadata first; otherwise the smallest tier qty; otherwise 1.
const moq = computed<number>(() => {
  const raw = product.value?.metadata?.moq
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (Number.isFinite(n) && n > 0) return Math.floor(n)
  if (quantityTiers.value[0]) return quantityTiers.value[0].quantity
  return 1
})

// lead_time_days — accept the {min, max} shape per the contract; fall back
// to the legacy free-form string for unmigrated SKUs.
const leadTime = computed<string>(() => {
  const raw = product.value?.metadata?.lead_time_days
  if (raw && typeof raw === 'object') {
    const r = raw as Record<string, unknown>
    const min = typeof r.min === 'number' ? r.min : Number(r.min)
    const max = typeof r.max === 'number' ? r.max : Number(r.max)
    if (Number.isFinite(min) && Number.isFinite(max)) {
      return min === max ? String(min) : `${min}-${max}`
    }
  }
  if (typeof raw === 'string' && raw.trim()) return raw
  return '10-20'
})

// --- Variant axis detection (invariant #7) -------------------------------
const variants = computed<ProductVariant[]>(() => product.value?.variants ?? [])
const productOptions = computed<ProductOption[]>(() => product.value?.options ?? [])

// Has-variant-axes test: more than zero option groups OR more than 1 variant.
// We want the section to disappear when there's truly only one buyable SKU
// with no optional axes (e.g. ceramic-mug-cream is a single colour-fixed SKU).
const hasVariantAxes = computed<boolean>(() => {
  if (productOptions.value.length > 0) return true
  if (variants.value.length > 1) return true
  return false
})

// --- Step number ladder --------------------------------------------------
// Numbering renumbers when a step disappears. Consumers reference steps by
// stable name ('variant', 'customise', 'quantity').
type StepName = 'variant' | 'customise' | 'quantity'
const stepNumber = (name: StepName): number => {
  const order: StepName[] = []
  if (hasVariantAxes.value) order.push('variant')
  if (isCustomizable.value && printLocations.value.length) order.push('customise')
  order.push('quantity')
  return order.indexOf(name) + 1
}

const onDesignAdded = (_payload: { previewUrl: string; cartId: string | null }) => {
  addSuccess.value = true
  setTimeout(() => { addSuccess.value = false }, 3000)
}
const onDesignError = (msg: string) => {
  addError.value = msg
}

// Live mirror of the editor's mockup+design composite, shown in the LEFT
// sticky image pane while the user is designing. Falls back to the bare
// product photography when null.
const livePreviewUrl = ref<string | null>(null)
const onLivePreview = (payload: { dataUrl: string | null }) => {
  livePreviewUrl.value = payload.dataUrl
}

// =========================================================================
// Variant + option-group machinery (unchanged behaviour from previous PDP)
// =========================================================================
interface OptionGroup { id: string; title: string; values: string[] }
const optionGroups = computed<OptionGroup[]>(() => {
  const groups: { id: string; title: string; values: Set<string> }[] = []
  if (productOptions.value.length) {
    for (const opt of productOptions.value) {
      const set = new Set<string>()
      if (Array.isArray(opt.values)) {
        for (const v of opt.values) {
          const val = typeof v === 'string' ? v : v?.value
          if (val) set.add(String(val))
        }
      }
      for (const variant of variants.value) {
        for (const o of variant.options ?? []) {
          if (o.option_id === opt.id && o.value) set.add(String(o.value))
        }
      }
      groups.push({ id: opt.id, title: opt.title || 'Option', values: set })
    }
  } else if (variants.value.length) {
    const map = new Map<string, { title: string; values: Set<string> }>()
    for (const v of variants.value) {
      for (const o of v.options ?? []) {
        const entry = map.get(o.option_id) || { title: o.title || 'Option', values: new Set<string>() }
        if (o.value) entry.values.add(String(o.value))
        map.set(o.option_id, entry)
      }
    }
    for (const [id, g] of map) groups.push({ id, title: g.title, values: g.values })
  }
  return groups.map((g) => ({ id: g.id, title: g.title, values: Array.from(g.values) }))
})

type OptionKind = 'color' | 'gender' | 'size' | 'default'
const optionKind = (og: OptionGroup): OptionKind => {
  const t = og.title.toLowerCase()
  if (t.includes('colour') || t.includes('color')) return 'color'
  if (t.includes('gender') || t.includes('sex')) return 'gender'
  if (t.includes('size') || t.includes('taille')) return 'size'
  return 'default'
}

// Bug 23: Medusa product option metadata frequently arrives as "Gender" with
// values like "Men" / "Women". The merchery convention (and modern apparel
// commerce inclusivity guidance) is to surface this axis as "Fit" — the cut/
// silhouette of the garment rather than a gendered identity. Remap at the
// rendering layer so the canonical metadata stays untouched (matrix table,
// query params, variant resolution) but every customer-facing label reads
// "Fit".
const OPTION_LABEL_REMAP: Record<string, string> = {
  Gender: 'Fit',
  gender: 'Fit',
  GENDER: 'Fit',
  Sex: 'Fit',
  sex: 'Fit',
}
const displayOptionTitle = (title: string): string =>
  OPTION_LABEL_REMAP[title] ?? OPTION_LABEL_REMAP[title.toLowerCase()] ?? title

const titleCase = (s: string) =>
  s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())

const SWATCH_MAP: Record<string, string> = {
  black: '#171717',
  white: '#ffffff',
  cream: '#efeae2',
  ivory: '#f5f0e6',
  beige: '#d8c8b3',
  sand: '#cab692',
  sage: '#cbd1b6',
  olive: '#6f7449',
  forest: '#234034',
  navy: '#1a2a44',
  blue: '#2563eb',
  red: '#b91c1c',
  burgundy: '#5b1a1a',
  pink: '#f9a8d4',
  rose: '#e3a5a5',
  yellow: '#facc15',
  mustard: '#c79a1f',
  orange: '#ea580c',
  brown: '#5b3a1a',
  grey: '#9ca3af',
  gray: '#9ca3af',
  charcoal: '#3f3f46',
  silver: '#cccccc',
  gold: '#c9a04a',
  green: '#15803d',
  purple: '#7c3aed',
  'faded black': '#2b2b2b',
  'off white': '#f3efe7',
}
const swatchStyle = (val: string): { backgroundColor: string } => {
  const key = val.trim().toLowerCase()
  return { backgroundColor: SWATCH_MAP[key] ?? '#e5e7eb' }
}

// --- Selection state -----------------------------------------------------
const stateKey = computed(() => `pdp-selected-options:${handle.value}`)

const initialSelections = (): Record<string, string> => {
  const out: Record<string, string> = {}
  for (const og of optionGroups.value) {
    if (og.values[0]) out[og.id] = og.values[0]
  }
  for (const og of optionGroups.value) {
    const raw = route.query[og.title]
    const v = Array.isArray(raw) ? raw[0] : raw
    if (typeof v === 'string' && og.values.includes(v)) {
      out[og.id] = v
    }
  }
  return out
}

const selectedOptions = useState<Record<string, string>>(stateKey.value, initialSelections)

watchEffect(() => {
  let mutated = false
  const next = { ...selectedOptions.value }
  for (const og of optionGroups.value) {
    if (!next[og.id] && og.values[0]) {
      next[og.id] = og.values[0]
      mutated = true
    }
    const raw = route.query[og.title]
    const v = Array.isArray(raw) ? raw[0] : raw
    if (typeof v === 'string' && og.values.includes(v) && next[og.id] !== v) {
      next[og.id] = v
      mutated = true
    }
  }
  if (mutated) selectedOptions.value = next
})

const onSelectOption = (optionId: string, value: string) => {
  selectedOptions.value = { ...selectedOptions.value, [optionId]: value }
}

// One-way: selectedOptions → route.query.
//
// Previously this was a feedback loop:
//   watchEffect (route → state)  +  watch(state, deep) (state → route)
//   + watch(route.query) (route → state again)
// Any tab idling on the PDP would pump the URL — `selectedOptions` is a
// `useState` ref shared by handle, and even no-op SSR rehydrations could
// trigger the watcher, which called `router.replace` with a query that
// contained unrelated params (e.g. `?c=apparel` from the listing page),
// which fired the route-query watcher, which mutated `selectedOptions`,
// which re-fired this watcher. Forever.
//
// Fix: diff the resulting query against `route.query` BEFORE navigating
// and bail when they're equivalent. The route-query→state sync is already
// covered by the `watchEffect` above (which reads `route.query`), so the
// redundant `watch(() => route.query, …)` has been removed.
const queriesEqual = (
  a: Record<string, string | (string | null)[] | null | undefined>,
  b: Record<string, string>,
): boolean => {
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) return false
  for (const k of bKeys) {
    const av = a[k]
    const avStr = Array.isArray(av) ? av[0] : av
    if (String(avStr ?? '') !== String(b[k] ?? '')) return false
  }
  return true
}

watch(
  selectedOptions,
  (val) => {
    if (!import.meta.client) return
    const nextQuery: Record<string, string> = {}
    // Preserve any non-option query params that happen to be on the URL
    // (e.g. utm_*, ref, etc.) by copying them through verbatim.
    for (const [k, v] of Object.entries(route.query)) {
      const s = Array.isArray(v) ? v[0] : v
      if (typeof s === 'string') nextQuery[k] = s
    }
    for (const og of optionGroups.value) {
      const v = val[og.id]
      if (v) nextQuery[og.title] = v
    }
    if (queriesEqual(route.query, nextQuery)) return
    router.replace({ query: nextQuery })
  },
  { deep: true },
)

const resolvedVariantId = computed(() => {
  if (!variants.value.length) return ''
  if (variants.value.length === 1) return variants.value[0]!.id
  const entries = Object.entries(selectedOptions.value)
  for (const v of variants.value) {
    const vOpts = v.options ?? []
    const allMatch = entries.every(([optId, val]) =>
      vOpts.some((o) => o.option_id === optId && String(o.value) === String(val)),
    )
    if (allMatch) return v.id
  }
  return ''
})

const selectedVariantId = ref('')
watchEffect(() => {
  if (!selectedVariantId.value && variants.value[0]?.id) selectedVariantId.value = variants.value[0].id
})

const finalVariantId = computed(() =>
  optionGroups.value.length ? resolvedVariantId.value : selectedVariantId.value,
)

const selectedVariant = computed<ProductVariant | undefined>(() => {
  const id = finalVariantId.value || selectedVariantId.value
  return variants.value.find((v) => v.id === id)
})

const currencyCode = computed(() => {
  const r = regionState.region.value as { currency_code?: string } | null
  return r?.currency_code || 'gbp'
})

const formatMoney = (amountMinor: number | null | undefined) => {
  if (typeof amountMinor !== 'number') return '—'
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: String(currencyCode.value).toUpperCase() }).format(amountMinor / 100)
  } catch {
    return `${(amountMinor / 100).toFixed(2)} ${String(currencyCode.value).toUpperCase()}`
  }
}

const displayPrice = computed(() => {
  const prices = variants.value
    .map((v) => v.calculated_price?.calculated_amount ?? v.prices?.[0]?.amount ?? null)
    .filter((n): n is number => typeof n === 'number')
  if (!prices.length) return null
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  if (min === max) return formatMoney(min)
  return `${formatMoney(min)} - ${formatMoney(max)}`
})

// --- Quantity-tier ladder ------------------------------------------------
// Source of truth: metadata.quantity_tiers. When the merchant has not set
// any tiers we synthesise a single-tier "ladder" from the variant's
// calculated price so the qty stepper still has a unit price to multiply.
const tiers = computed(() => {
  // Compute base for fallback once.
  const base = selectedVariant.value?.calculated_price?.calculated_amount
    ?? selectedVariant.value?.prices?.[0]?.amount
    ?? 0

  if (quantityTiers.value.length >= 1) {
    const cheapest = Math.min(...quantityTiers.value.map((t) => t.unit_amount))
    return quantityTiers.value.map((t) => {
      const discountPct = t.unit_amount === cheapest ? 0 : 0
      // Discount is computed against the FIRST (smallest-quantity) tier,
      // since that's the customer's baseline reference.
      const baseline = quantityTiers.value[0]!.unit_amount
      const pct = baseline > 0
        ? Math.max(0, Math.round(((baseline - t.unit_amount) / baseline) * 100))
        : 0
      return { qty: t.quantity, unitAmount: t.unit_amount, discountPct: pct || discountPct }
    })
  }

  // No metadata tiers — render a single virtual tier so the qty stepper
  // and total-line keep working. This is the legacy/unmigrated path.
  return [{ qty: moq.value, unitAmount: base, discountPct: 0 }]
})

// "From £X / piece" — the cheapest entry price visible above the fold.
// Source priority:
//   1. cheapest tier unit price (the merchant's own bulk-discount floor)
//   2. first variant calculated price (single-tier / unmigrated SKUs)
// Returns minor units (pence) so the existing `formatMoney` helper applies.
const fromPrice = computed<number | null>(() => {
  const fromTier = tiers.value?.[0]?.unitAmount
  if (typeof fromTier === 'number' && fromTier > 0) return fromTier
  const variant = variants.value?.[0]
  const amt = variant?.calculated_price?.calculated_amount ?? variant?.prices?.[0]?.amount
  return typeof amt === 'number' ? amt : null
})

const qty = ref<number>(1)
watchEffect(() => {
  if (qty.value < moq.value) qty.value = moq.value
})

const enforceMoq = () => {
  if (!Number.isFinite(qty.value) || qty.value < moq.value) qty.value = moq.value
}
const decrementQty = () => {
  qty.value = Math.max(moq.value, qty.value - 1)
}

// Active tier = the largest tier whose qty <= current qty.
const activeTierIndex = computed(() => {
  let idx = 0
  for (let i = 0; i < tiers.value.length; i++) {
    if (qty.value >= (tiers.value[i]?.qty ?? 0)) idx = i
  }
  return idx
})
const effectiveUnit = computed(() => tiers.value[activeTierIndex.value]?.unitAmount ?? 0)
const effectiveTotal = computed(() => effectiveUnit.value * qty.value)

const adding = ref(false)
const addError = ref<string | null>(null)
const addSuccess = ref(false)
const { addItem } = useCart()

// "Has the user actually placed a design on the mockup yet?"
//
// Originally this was `livePreviewUrl !== null` — wrong. DesignEditor's
// Konva stage is capturable as soon as the bare product mockup is loaded,
// so `live-preview` fires with a non-null dataUrl on init. The ATC gate
// silently no-op'd because the proxy was already truthy.
//
// Now driven by the strict `uploaded-state-change` event, which mirrors
// the editor's internal `anyUploaded` computed (true iff at least one
// location has a real uploaded image). `livePreviewUrl` stays untouched —
// it's still the source for the LEFT pane mirror.
const anyDesignUploaded = ref(false)
const onDesignUploadedStateChange = (payload: { anyUploaded: boolean }) => {
  anyDesignUploaded.value = payload.anyUploaded
}

// Mobile-only upload trigger. The actual <input type="file"> lives inside
// DesignEditor's helper panel, which on PDP mobile is rendered inside a
// `transform: scale(0.55)` wrapper — making any visible button there fail
// the 44pt touch-target minimum. We render a native-size button OUTSIDE
// the scale wrapper (see template) and forward the click to the underlying
// file input. CSS transforms do not affect programmatic .click().
//
// We drive the picker through the typed component ref instead of a brittle
// DOM query: DesignEditor exposes `openFilePicker()` via defineExpose, so
// the call is type-checked and survives any future markup refactor inside
// the editor. The ref resolves through <ClientOnly> because defineExpose
// surfaces the method on the resolved instance regardless of the wrapper.
const designEditorRef = ref<{ openFilePicker: () => void } | null>(null)

function onMobileUploadClick() {
  designEditorRef.value?.openFilePicker()
}

const onAddToCart = async () => {
  if (!finalVariantId.value) return

  // Block ATC when the product is customisable, has print zones, and the
  // user hasn't uploaded a design. Previously the button just no-op'd and
  // the user got zero feedback — a P0 abandonment funnel.
  if (
    isCustomizable.value
    && printLocations.value.length > 0
    && !anyDesignUploaded.value
  ) {
    addError.value = 'Upload a design before adding to cart.'
    addSuccess.value = false
    if (import.meta.client) {
      // Pull the editor section into view so the user sees where to act.
      document
        .querySelector('[data-test="design-editor-section"]')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    return
  }

  adding.value = true
  addError.value = null
  addSuccess.value = false
  try {
    await addItem(finalVariantId.value, qty.value)
    addSuccess.value = true
    setTimeout(() => { addSuccess.value = false }, 3000)
  } catch (e) {
    addError.value = e instanceof Error ? e.message : 'Failed to add item.'
  } finally {
    adding.value = false
  }
}

const onBuySample = () => {
  // eslint-disable-next-line no-console
  console.log('TODO: sample request', product.value?.handle)
}

// --- Variant matrix (for the 5th accordion section) ----------------------
interface VariantMatrixRow {
  id: string
  color: string
  size: string
  gender: string
  price: string
}
const variantMatrix = computed<VariantMatrixRow[]>(() => {
  const optionTitleById = new Map<string, string>()
  for (const opt of productOptions.value) {
    optionTitleById.set(opt.id, opt.title || '')
  }
  return variants.value.map((v) => {
    const row: VariantMatrixRow = { id: v.id, color: '', size: '', gender: '', price: '' }
    for (const o of v.options ?? []) {
      const title = (optionTitleById.get(o.option_id) || o.title || '').toLowerCase()
      if (title.includes('color') || title.includes('colour')) row.color = String(o.value)
      else if (title.includes('size') || title.includes('taille')) row.size = String(o.value)
      else if (title.includes('gender') || title.includes('sex')) row.gender = String(o.value)
    }
    const amt = v.calculated_price?.calculated_amount ?? v.prices?.[0]?.amount ?? null
    row.price = formatMoney(amt ?? undefined)
    return row
  })
})

// --- 5-section accordion -------------------------------------------------
interface InfoSection { id: string; title: string; body: string }
const infoSections = computed<InfoSection[]>(() => [
  {
    id: 'product-details',
    title: 'Product details',
    body: [
      product.value?.description || '',
      'Brushed-back 380gsm fleece, two-piece hood with woven drawcord, kangaroo pocket, ribbed cuffs and hem. Pre-shrunk, garment-dyed for a worn-in hand-feel from day one.',
    ].filter(Boolean).join('\n\n'),
  },
  {
    id: 'size-guide',
    title: 'Size guide and measurements',
    body: 'View size guide and measurements. Sizes run from XS through XXL with chest width, body length and sleeve length specified per size. Detailed size charts available on request.',
  },
  {
    id: 'production',
    title: 'Production',
    body: `How it's made: cut, sewn and finished in our partner atelier. Production lead time is ${leadTime.value} business days from artwork approval. All production runs are quality-checked twice before despatch.`,
  },
  {
    id: 'customization',
    title: 'Customization',
    body: techniques.value.length
      ? `Add your logo. Available techniques: ${techniques.value.map((t) => t.label).join(', ')}. Free vectorisation included. Sample proofs supplied before bulk runs.`
      : 'Add your logo. We accept EPS, AI, PDF. Free vectorisation included. Print methods available: screen print, embroidery, DTF and laser engraving. Sample proofs supplied before bulk runs.',
  },
  {
    id: 'variant-specificities',
    title: 'Product specificities',
    body: 'Full variant matrix below. Every available combination of colour, size and gender is listed with the per-variant base price.',
  },
])

// --- Hash deep-link --------------------------------------------------------
const syncHash = (id: string, isCurrentlyOpen: boolean) => {
  if (!import.meta.client) return
  const next = isCurrentlyOpen ? '' : id
  history.replaceState(null, '', next ? `#${next}` : window.location.pathname + window.location.search)
}

const openSectionFromHash = (h: string) => {
  if (!import.meta.client) return
  const id = h.replace(/^#/, '')
  if (!id) return
  nextTick(() => {
    const btn = document.querySelector<HTMLButtonElement>(`[data-section-button="${id}"]`)
    const panel = document.getElementById(id)
    if (btn && btn.getAttribute('aria-expanded') === 'false') btn.click()
    panel?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

onMounted(() => openSectionFromHash(route.hash))
watch(() => route.hash, openSectionFromHash)

// Mobile sticky cart bar should hide when the inline ATC button is visible
// (otherwise both render simultaneously — confusing). IntersectionObserver
// flips `primaryAtcInView` based on the inline button row's visibility.
//
// Default to TRUE so SSR + first paint assume the inline ATC is in view —
// the sticky bar is gated by `!primaryAtcInView`, so this prevents a flash
// of duplicate ATC UI before the IO callback fires for the first time.
// The IO will demote it to `false` on the next frame if the row is
// actually offscreen at load. Bottom rootMargin of `-100px` shrinks the
// trigger zone so the sticky bar appears decisively earlier as the user
// scrolls past the inline ATC, instead of overlapping at the boundary.
const primaryAtcRow = ref<HTMLElement | null>(null)
const primaryAtcInView = ref(true)
let atcObserver: IntersectionObserver | null = null

onMounted(() => {
  if (typeof IntersectionObserver === 'undefined' || !primaryAtcRow.value) return
  atcObserver = new IntersectionObserver(
    (entries) => {
      const entry = entries[0]
      if (entry) primaryAtcInView.value = entry.isIntersecting
    },
    { rootMargin: '0px 0px -100px 0px', threshold: 0.1 },
  )
  atcObserver.observe(primaryAtcRow.value)
})

onBeforeUnmount(() => {
  atcObserver?.disconnect()
  atcObserver = null
})

const { data: relatedData } = await useAsyncData(
  `related:${handle.value}`,
  async () => sdk.store.product.list({
    limit: 5,
    fields: '*variants.calculated_price',
    ...(regionState.regionId.value ? { region_id: regionState.regionId.value } : {}),
  }),
  { watch: [() => regionState.regionId.value] },
)
const relatedProducts = computed(() => {
  const all = ((relatedData.value as { products?: Product[] } | null)?.products ?? []) as Product[]
  return all.filter((p) => p.handle !== handle.value).slice(0, 5)
})
</script>
