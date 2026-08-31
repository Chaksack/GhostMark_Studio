<template>
  <div>
    <!--
      JSON-LD Product structured data. Headless component, renders no DOM,
      pushes a <script type="application/ld+json"> into <head> via useHead.
      Sits at the top of the page wrapper (outside the pending/not-found
      branches) so it emits as soon as product data resolves, on both POD
      (AggregateOffer) and apparel (single Offer) flows. The `v-if`
      hydration-guards SSR and avoids emitting a stale schema during the
      pending state, useProductSchema returns null on missing product
      anyway, but skipping the mount keeps the head graph cleaner.
    -->
    <ProductSchemaScript v-if="product" :product="product" :url="canonicalUrl" />

    <div v-if="pending" class="py-20 text-center text-ink-600">Loading product&hellip;</div>
    <div v-else-if="!product" class="py-20 text-center text-ink-600">Product not found.</div>

    <template v-else>
      <!--
        Two-pane PDP shell. LEFT pane is the sticky image well that fills the
        viewport below BOTH desktop fixed bands: the warmGrey logo/search/
        actions bar (h-[68px]) and the white category nav (h-[50px]).
        Hence lg:top-[var(--header-offset)] and h-[calc(100vh-var(--header-offset))].
        The page-level top padding lives on <main> in layouts/default.vue.
        RIGHT pane scrolls
        independently and stays sparse above the fold: H1 + a small
        auxiliary action row + the numbered customisation step cards.
      -->
      <div class="lg:flex min-h-screen" aria-label="product customization container">
        <!-- LEFT: sticky image pane -->
        <div class="lg:w-1/2 lg:sticky lg:top-[var(--header-offset)] h-[414px] lg:h-[calc(100vh-var(--header-offset))] flex items-end bg-offWhite">
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
              Image stack: first image fills the pane. When the user is
              actively designing in step 2, `livePreviewUrl` mirrors the
              editor's mockup+design composite so this pane reflects every
              upload / drag / scale / rotate without needing to add to cart.
            -->
            <img
              v-if="livePreviewUrl"
              :src="livePreviewUrl"
              :alt="`${product.title}, your design preview`"
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
                  <h1 class="text-[24px] leading-[28px] mb-0 mt-0">{{ product.title }}</h1>
                </div>
                <!--
                  Product meta row: the strip of plain facts under the title.
                  Reference: Faire puts a wholesale minimum in the same
                  typographic slot as the rating ("★4.8  $100 min") rather than
                  in a warning callout. A minimum is an *attribute* of what
                  you're buying, not an error the buyer has yet to make. So
                  this row stays greyText at body size, never an alert colour,
                  and never a badge.

                  Each fact is gated INDEPENDENTLY, which is the actual fix
                  here. Previously the whole row hung off
                  `v-if="isPOD && fromPrice !== null"`, so a product whose
                  minimum was live but whose type or price resolved
                  unexpectedly disclosed no minimum at all while still being
                  clamped to one. `metaFacts` is derived from `moq` (the same
                  ref every enforcement site reads) so the disclosure and the
                  clamp can no longer disagree. See `metaFacts` in <script>.

                  The `data-test="from-price"` hook is kept verbatim: the e2e
                  POD contract asserts "From" + "/ piece" + "MOQ n" +
                  "E-proof in 48h" against this one element, and the PLP
                  filter suite asserts count 0 on apparel. The name is now a
                  slight misnomer: it is the meta row, and the from-price is
                  only one of the facts it may carry.
                -->
                <div
                  v-if="metaFacts.length"
                  class="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[14px] leading-[20px] text-greyText"
                  data-test="from-price"
                >
                  <template v-for="(fact, i) in metaFacts" :key="fact.key">
                    <span v-if="i > 0" class="opacity-50" aria-hidden="true">·</span>
                    <span v-if="fact.key === 'from-price'">
                      From <span class="text-[16px] font-medium text-ink-950">{{ fact.text }}</span> / piece
                    </span>
                    <span v-else :data-test="`meta-${fact.key}`">{{ fact.text }}</span>
                  </template>
                </div>
                <!--
                  Gift card: denomination variants are the offering, so we
                  surface the cheapest "From £X" rather than a single
                  selected-variant unit price. Caption lines up the two
                  reassurances buyers actually care about (instant email
                  delivery and no expiry) without the MOQ/e-proof copy
                  that only applies to bulk POD.
                -->
                <p
                  v-else-if="isGiftCard && minVariantPrice !== null"
                  class="text-[18px] leading-[24px] text-ink-950 font-medium"
                  data-test="giftcard-price"
                >
                  From {{ formatMoney(minVariantPrice) }}
                  <span class="block text-[13px] leading-[18px] font-normal text-greyText mt-1">Email-delivered &middot; Codes don&rsquo;t expire</span>
                </p>
                <p
                  v-else-if="isApparel && unitPrice !== null"
                  class="text-[18px] leading-[24px] text-ink-950 font-medium"
                  data-test="apparel-price"
                >
                  {{ formatMoney(unitPrice) }}
                </p>
                <p v-if="product.description" class="lg:hidden">{{ product.description }}</p>
              </div>
              <!--
                Aux action row (md+ only). Every chip / button below is
                forced to a 44px minimum hit area, the prior `py-[1rem]`
                rendered ~36px and failed WCAG 2.5.5 on a tablet pointer.
                inline-flex + min-h-[44px] keeps the visual size identical
                while satisfying the touch-target rule.
              -->
              <!--
                Aux row, branched. "View product details" and "Share" are
                shared between POD + apparel flows. "Buy a sample" +
                "Request a quote" are POD-only B2B affordances and
                disappear on apparel, a D2C buyer either buys the unit
                on the spot or doesn't buy at all; quote/sample requests
                pollute the decision space and depress conversion.
                Gift cards hide the entire details/sample/quote trio:
                there are no physical specs to view, no sample to ship,
                and no bulk quote to request for a digital code.
              -->
              <div class="hidden md:flex items-center gap-[1rem] flex-wrap">
                <a
                  v-if="!isGiftCard"
                  href="#variant-specificities"
                  class="inline-flex items-center min-h-11 bg-uiGrey border border-transparent hover:border-black py-2.5 px-4 lg:px-5 text-[14px] leading-5 rounded-none"
                >
                  View product details
                </a>
                <!--
                  These two are affordances of a PRINT order, not of the
                  ability to print — so they follow `isCustomOrder`, not
                  `canCustomise`. A visitor reading an apparel page as a shelf
                  item is not asking for a sample of their own artwork.
                -->
                <button
                  v-if="showsPrintCommerce"
                  type="button"
                  data-test="buy-sample"
                  class="inline-flex items-center min-h-11 bg-offWhite hover:bg-uiGrey py-2.5 px-4 lg:px-5 rounded-none text-[14px] leading-5"
                  @click="onBuySample"
                >
                  Buy a sample
                </button>
                <NuxtLink
                  v-if="showsPrintCommerce"
                  :to="`/contact?intent=quote&product=${product.handle}`"
                  class="inline-flex items-center min-h-11 bg-offWhite hover:bg-uiGrey px-5 py-2.5 rounded-none text-[14px] leading-5"
                >
                  Request a quote
                </NuxtLink>
                <button
                  type="button"
                  class="inline-flex items-center justify-center h-[44px] w-[44px] bg-offWhite hover:bg-uiGrey rounded-none"
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

            <!-- 1. Pick a variant: only when the product has options. -->
            <div
              v-if="hasVariantAxes"
              data-test="variant-section"
              class="flex flex-col bg-white shadow-custom p-[1.5rem] pb-[3rem] rounded-[0.5rem] relative"
            >
              <h2 class="text-[20px] leading-[24px] md:text-[24px] md:leading-[28px] whitespace-pre-wrap mb-[2rem] md:mb-[3rem]">{{ stepNumber('variant') }}. Pick a product variant</h2>

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
                          class="relative inline-flex h-[44px] w-[44px] items-center justify-center rounded-full p-[8px] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 motion-reduce:transition-none"
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
                          class="inline-flex items-center justify-center min-h-11 py-[10px] px-[18px] text-[14px] leading-5 border border-solid rounded-none cursor-pointer transition-all duration-200 hover:border-black focus:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 motion-reduce:transition-none"
                          :class="checked
                            ? 'border-black bg-ink-950 text-white'
                            : 'border-greyLines bg-white text-ink-950'"
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
                          class="inline-flex items-center justify-center min-h-11 min-w-11 py-[10px] px-[15px] text-[14px] leading-5 border border-solid rounded-none cursor-pointer transition-all duration-200 hover:border-black focus:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 motion-reduce:transition-none"
                          :class="checked
                            ? 'border-black bg-ink-950 text-white'
                            : 'border-greyLines bg-white text-ink-950 hover:bg-black/5'"
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
                <label class="text-[13px] text-ink-600" for="variant-select">Variant</label>
                <select
                  id="variant-select"
                  v-model="selectedVariantId"
                  class="mt-1.5 w-full border border-ink-400 bg-white px-3 py-2.5 text-[14px] text-ink-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                >
                  <option v-for="v in variants" :key="v.id" :value="v.id">{{ v.title || v.sku || v.id }}</option>
                </select>
              </div>
            </div>

            <!--
              Customisation step.
              Gated on `canCustomise`, which is the product's actual
              capability rather than its Medusa type. Any product carrying
              `is_customizable` plus at least one published print location
              renders the editor, which is 22 of 26 including all 20
              apparel. Type was never the capability field: it excluded 20
              products that have real print zones and included 2 stickers
              that have none. A product with zero print_locations still
              skips the editor, which stays the merchant's way of saying
              "not customisable today".
              Invariant #2 + #3: 1 vs N locations is decided inside DesignEditor.
            -->
            <div
              v-if="canCustomise"
              class="flex flex-col bg-white shadow-custom p-[1.5rem] pb-[3rem] rounded-[0.5rem] relative mt-[1.8rem]"
              data-test="design-editor-section"
            >
              <h2 class="text-[20px] leading-[24px] md:text-[24px] md:leading-[28px] whitespace-pre-wrap mb-[0.75rem]">{{ stepNumber('customise') }}. Upload your design</h2>

              <!--
                The terms of the printed order, before the upload rather than
                after it. See `customTerms`. Discovering a minimum of 25 and a
                three-week lead time AFTER attaching artwork is the same
                defect as never stating them, only later and more annoying.
              -->
              <p
                class="mb-[2rem] font-body text-caption text-ink-600 md:mb-[3rem]"
                data-test="custom-production-terms"
              >{{ customTerms }}</p>

              <!--
                Attach / detach announcement. POLITE, not assertive: attaching
                artwork is a step the customer just completed successfully, so
                it should queue behind whatever the screen reader is already
                saying rather than interrupt it. (The assertive region on this
                page is reserved for the add-to-cart failure, which genuinely
                does need to cut in.)

                Rendered as a sibling of the visual strip rather than as an
                aria-live wrapper AROUND it, because the strip contains
                buttons and a filename that change on replace, a live region
                spanning them would re-announce the whole block on every
                edit. One short sentence, changed only when the state changes.
              -->
              <p class="sr-only" role="status" aria-live="polite" data-test="design-announcement">
                {{ designAnnouncement }}
              </p>

              <!--
                ATTACHED-DESIGN CONFIRMATION.

                The problem this closes: before this round, nothing on the
                page ever confirmed that artwork was attached. `onDesignAdded`
                received a payload and threw it away, so the only evidence a
                design existed was the left pane quietly swapping to the
                composite, which a customer who scrolled past it never saw.
                Combined with three add-to-cart buttons that dropped the
                design entirely, "did my artwork make it?" was unanswerable
                from the UI.

                Reference: Blue Apron's option chips carry a check mark once
                chosen, so a completed step reads at a glance. Reference:
                Semrush's editor renders an explicit post-save state (thumbnail
                + "Your design is saved") so saving and committing are two
                distinct, legible acts. We take the completed-step read from
                the first and the thumbnail-plus-affirmation from the second.

                Deviation from Semrush, deliberate: they pair the saved state
                with a "Back to editing" button. Here the editing surface is
                the very next element in the same card, so a button that
                scrolls 200px down would be theatre. `Replace` and `Remove`
                do real work instead; the "Edit design" jump-back lives in the
                sticky bars, where the customer genuinely is somewhere else.

                Not colour-only (WCAG 1.4.1): the state is carried by a check
                glyph, the word "attached", and the thumbnail, the sage wash
                is the least of the three signals.
              -->
              <!--
                Layout note: `flex-wrap` plus a full-width action group below
                `sm` is load-bearing, not decoration. At 390px the right rail
                gives this strip ~318px of usable width, and thumbnail (56) +
                gap (12) + a legible summary (~130 min) + Replace/Remove
                (~150, and NOT shrinkable without dropping under the 44px
                touch target) overflows it. Forced onto one line the heading
                wrapped straight through the buttons and the filename
                truncated to two characters. Letting the actions drop to their
                own row costs ~44px of height and keeps every element at full
                size and fully readable.
              -->
              <div
                v-if="anyDesignUploaded"
                data-test="design-attached"
                class="mb-[2rem] flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[0.5rem] border border-merchery-sage bg-merchery-sage/25 p-3"
              >
                <img
                  v-if="livePreviewUrl"
                  :src="livePreviewUrl"
                  alt=""
                  class="h-14 w-14 shrink-0 rounded-[0.35rem] border border-merchery-sage bg-white object-contain"
                />
                <div
                  v-else
                  class="h-14 w-14 shrink-0 rounded-[0.35rem] border border-merchery-sage bg-white"
                  aria-hidden="true"
                />

                <div class="min-w-0 flex-1 basis-[8rem]">
                  <p class="flex items-center gap-1.5 text-[14px] leading-[20px] font-medium text-ink-950">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="shrink-0" aria-hidden="true">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Design attached
                  </p>
                  <p class="mt-0.5 truncate text-[13px] leading-[18px] text-ink-700" data-test="design-attached-summary">
                    {{ attachedDesignSummary }}
                  </p>
                </div>

                <div class="flex w-full shrink-0 items-center gap-1 sm:w-auto sm:justify-end">
                  <button
                    type="button"
                    data-test="design-replace"
                    class="inline-flex min-h-[44px] items-center rounded-none px-3 text-[13px] font-medium text-ink-950 underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ink-950"
                    @click="onReplaceDesign"
                  >
                    Replace
                  </button>
                  <button
                    type="button"
                    data-test="design-remove"
                    class="inline-flex min-h-[44px] items-center rounded-none px-3 text-[13px] text-ink-700 underline-offset-4 hover:text-ink-950 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ink-950"
                    @click="onRemoveDesign"
                  >
                    Remove
                  </button>
                </div>
              </div>

              <!--
                Native-size upload affordance, mobile only. Sits OUTSIDE the
                scaled (transform: scale(0.55)) editor wrapper below so the
                touch target renders at the full 48px height, WCAG 2.5.5 /
                Apple HIG 44pt minimum. The button delegates to the
                <input type="file"> already rendered inside DesignEditor's
                helper panel; CSS transforms don't affect programmatic
                .click() so this works through the scale.

                The handler now uses the typed component ref (see
                `designEditorRef.value?.openFilePicker()` below), the
                bug-6 round's `lg:hidden` pill in DesignEditor has been
                removed and the component exposes `openFilePicker()` via
                defineExpose, so we no longer rely on a brittle DOM query.

                Now hidden once artwork is attached (`v-if="!anyDesignUploaded"`).
                It used to flip its own label to "Replace design" and stay,
                which, with the confirmation strip above it also offering
                Replace, put two replace affordances within 60px of each
                other, and put a SECOND full-width ink slab on a page whose
                only ink slab should be the add-to-cart. One primary weight,
                one primary action: while empty this is the step's call to
                act; once filled, the strip is the step's state and owns its
                verbs.
              -->
              <!--
                SAVED-DESIGN STRIP. Renders INSTEAD of the inline editor when a
                draft saved on /design/[handle] exists for this product.

                Precedence is deliberate and total: a saved draft wins. Two
                editors that disagree about what artwork is attached is the
                failure mode of adding a second surface at all, so there is
                exactly one source of truth at any moment, the draft if there
                is one, the inline editor otherwise. `onAddToCart` branches on
                the same `hasSavedDesign`, so what the customer is looking at
                and what the button commits cannot diverge.
              -->
              <div v-if="hasSavedDesign" data-test="design-saved-strip" class="mb-[2rem]">
                <div class="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[0.5rem] border border-merchery-sage bg-merchery-sage/25 p-3">
                  <img
                    v-if="savedDraft?.commit?.preview_url"
                    :src="savedDraft.commit.preview_url"
                    alt=""
                    class="h-14 w-14 shrink-0 rounded-[0.35rem] border border-merchery-sage bg-white object-contain"
                  />
                  <div class="min-w-0 flex-1 basis-[8rem]">
                    <p class="flex items-center gap-1.5 text-[14px] leading-[20px] font-medium text-ink-950">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="shrink-0" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Your design is saved
                    </p>
                    <p class="mt-0.5 truncate text-[13px] leading-[18px] text-ink-700" data-test="saved-design-summary">
                      {{ savedDesignSummary }}
                    </p>
                  </div>
                  <div class="flex w-full shrink-0 items-center gap-1 sm:w-auto sm:justify-end">
                    <NuxtLink
                      :to="designSurfaceUrl"
                      data-test="saved-design-edit"
                      class="inline-flex min-h-[44px] items-center rounded-none px-3 text-[13px] font-medium text-ink-950 underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ink-950"
                    >
                      Edit design
                    </NuxtLink>
                    <button
                      type="button"
                      data-test="saved-design-remove"
                      class="inline-flex min-h-[44px] items-center rounded-none px-3 text-[13px] text-ink-700 underline-offset-4 hover:text-ink-950 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ink-950"
                      @click="onRemoveSavedDesign"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>

              <!-- No saved draft: the inline editor, exactly as before. -->
              <template v-else>
              <div v-if="!anyDesignUploaded" class="lg:hidden mb-4">
                <button
                  type="button"
                  data-test="mobile-upload-trigger"
                  aria-label="Upload your design file"
                  @click="onMobileUploadClick"
                  class="w-full inline-flex items-center justify-center gap-2 h-12 bg-ink-950 text-cream-50 hover:bg-ink-700 transition-colors rounded-none px-4 text-[14px] font-medium uppercase tracking-[0.04em] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ink-950"
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <span>Upload your design</span>
                </button>
                <p class="mt-2 text-center text-[12px] text-greyText">PNG, JPG, WebP &middot; max 10MB</p>
              </div>

              <!--
                DesignEditor sizes its own canvas.

                This used to be a fixed-size envelope wrapping a
                `transform: scale()` box, because the editor's Konva stage was
                hard-fixed at 600x800 and its internal 2-column layout needed
                944px of width that this rail does not have. The editor now
                measures its own container with a ResizeObserver and scales the
                stage to fit, and its layout is a single column, so it renders
                correctly at any width from ~280px up. The wrapper has nothing
                left to do.

                DO NOT REINTRODUCE A SCALE WRAPPER HERE. The old one was the
                direct cause of three defects:
                  - `transform: scale()` does not shrink the layout box, so the
                    reserved h-[920px] showed up as ~245px of dead space inside
                    a card whose canvas was only 520px tall.
                  - The 390px overflow was wrapper arithmetic:
                    600px inner * scale-[0.55] = 330px in a 327px card.
                  - Every control inside rendered at 0.46-0.65x, so nominal
                    44px touch targets were ~20px and 13px copy was 8.45px.
                    That is the only reason the mobile upload button below had
                    to be lifted out of the editor in the first place.

                See the STAGE SIZING block at the top of DesignEditor.vue.
              -->
              <div data-test="design-editor" class="w-full">
                <ClientOnly>
                  <DesignEditor
                    ref="designEditorRef"
                    :product="product"
                    :variant-id="finalVariantId"
                    :print-locations="printLocations"
                    :techniques="techniques"
                    @error="onDesignError"
                    @live-preview="onLivePreview"
                    @uploaded-state-change="onDesignUploadedStateChange"
                  />
                  <template #fallback>
                    <div class="flex h-[400px] w-full items-center justify-center border border-ink-200 bg-cream-50 text-[13px] text-ink-600">
                      Loading editor&hellip;
                    </div>
                  </template>
                </ClientOnly>
              </div>

              <!--
                ENTRY POINT to the dedicated surface. Placed AFTER the inline
                editor, not before it: the inline card still works and is the
                faster path for a single logo, so this is an escalation ("more
                room"), not a redirect. Patreon's merch flow reaches its own
                dedicated editor the same way, from inside the product step
                rather than instead of it.
              -->
              <div class="mt-4 flex justify-center">
                <NuxtLink
                  :to="designSurfaceUrl"
                  data-test="open-design-surface"
                  class="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-none border border-ink-950 px-5 text-[14px] font-medium text-ink-950 transition-colors duration-fast hover:bg-ink-950 hover:text-cream-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ink-950 motion-reduce:transition-none"
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" />
                    <line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" />
                  </svg>
                  <span>Open the full editor</span>
                </NuxtLink>
              </div>
              </template>
            </div>

            <!--
              POD product with no print_locations seeded yet, render an
              "email-us-the-artwork" affordance so the page doesn't
              silently skip Step 2. Without this branch, a POD SKU
              missing metadata.print_locations falls through the
              `v-if="isPOD && printLocations.length"` gate above and the
              user sees MOQ/e-proof copy with no way to act on it.
              The CTA hands off to /contact?intent=pod-artwork, where
              ops will mock up the design against the proof in 48 hours
              (matching the e-proof reassurance copy above).
            -->
            <div
              v-else-if="isPODWithoutLocations"
              data-test="pod-no-locations"
              class="mt-[1.8rem] flex flex-col bg-uiHighlight shadow-custom p-[1.5rem] pb-[3rem] rounded-[0.5rem] border border-greyLines"
            >
              <h2 class="text-[20px] leading-[24px] md:text-[24px] md:leading-[28px] whitespace-pre-wrap mb-[1.5rem]">{{ stepNumber('customise') }}. Upload your design</h2>
              <p class="text-[14px] leading-[20px] md:text-[15px] md:leading-[24px] text-ink-700 mb-[2rem] max-w-[55ch]">
                Print zones haven&rsquo;t been published for this product yet. Email us your artwork after checkout and our team will mock it up against the proof in 48 hours.
              </p>
              <NuxtLink
                to="/contact?intent=pod-artwork"
                class="inline-flex items-center justify-center self-start min-h-11 px-5 py-2.5 rounded-none border border-ink-950 text-[14px] font-medium text-ink-950 hover:bg-ink-950 hover:text-cream-50 transition-colors duration-fast focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ink-950 motion-reduce:transition-none"
              >
                Email artwork brief &rarr;
              </NuxtLink>
            </div>

            <!--
              "Not customisable" hint: POD-only. Surfaces only when the
              merchant has explicitly flagged a POD SKU as not-customisable
              (so the buyer understands why the editor is missing).
              Apparel/gift-card never show this, for D2C/digital the
              absence of an editor is the default, not an exception worth
              narrating.
            -->
            <div
              v-else-if="isPOD && !isCustomizable"
              class="mt-[1.8rem] rounded-[0.5rem] border border-greyLines bg-uiGrey/40 px-4 py-3 text-[13px] text-ink-700"
              data-test="not-customisable"
            >
              This product isn&rsquo;t customisable. Use the Add to cart button below to order as-is.
            </div>

            <!--
              Quantity step: POD branch.
              Invariant #5: tiers.length <= 1 → flat price + qty stepper, no ladder.
              Invariant #6: tiers.length >= 2 → full ladder.
              The MOQ caption, tier ladder and discount badges are all
              B2B affordances and never render on apparel.
            -->
            <div
              v-if="showsPrintCommerce"
              class="flex flex-col bg-white shadow-custom p-[1.5rem] pb-[3rem] rounded-[0.5rem] relative mt-[1.8rem]"
              data-test="quantity-section"
            >
              <h2 class="text-[20px] leading-[24px] md:text-[24px] md:leading-[28px] whitespace-pre-wrap mb-[2rem] md:mb-[3rem]">{{ stepNumber('quantity') }}. Quantity</h2>

              <!--
                Minimum-order disclosure, moved off the type branch.

                It used to render unconditionally inside this POD-only card,
                which meant the minimum was stated exactly when `isPOD` was
                true and never otherwise, even though `moq` (and every clamp
                that reads it: the seeding watchEffect, `enforceMoq`,
                `decrementQty`, the stepper's `:min`, the MOBILE STICKY BAR's
                stepper, which is shared across all three flows) is the real
                arbiter. Gating on `hasMinimum` ties the sentence to the same
                ref the clamps obey, so a product cannot be subject to a
                minimum it does not state. The apparel/gift-card card below
                carries the identical block for the same reason.

                Kept as `data-test="moq-caption"`: the e2e POD contract
                asserts it visible on POD and absent on apparel, which
                `showsMinimumFact` satisfies (apparel resolves moq to 1, and
                several POD SKUs legitimately have no minimum, see the
                `hasMinimum` / `showsMinimumFact` split in <script>).

                Faire's register, not an alert's: plain uppercase caption in
                the same ink-600 as the "Unit price" and "Quantity" labels
                around it. A minimum is a fact about the product, and the
                buyer has not done anything wrong by reading it.
              -->
              <!--
                Suppressed when the quantity <select> is rendering, because
                that control states the same minimum on its own label line
                (Faire's "Case of 12" slot) 30px below this. Two statements of
                one fact, a paragraph apart, is the duplication this whole
                change is about, so the caption MOVES rather than doubling.
                `data-test="moq-caption"` travels with it, keeping the two
                specs that assert the caption visible on POD
                (plp-shop-filter.spec.ts:50, PdpPage.ts:74) green against
                whichever branch is on screen.
              -->
              <p
                v-if="showsMinimumFact && !usesQuantitySelect"
                class="mt-2 text-[12px] uppercase tracking-wider text-ink-600"
                data-test="moq-caption"
              >
                Minimum order: {{ moq }} {{ moq === 1 ? 'piece' : 'pieces' }}
              </p>

              <!--
                Faire-pattern quantity select. THE LADDER IS THE PICKER.

                What this replaced: a `role="radiogroup"` tier ladder sitting
                ABOVE a ± stepper. Each ladder row printed a unit price and a
                percentage but never a total, and the total was computed
                separately in another block. Two derivations, two places to
                look: click "250 pieces · Save 22%", read one number, get
                charged another. Every row here carries quantity, unit price
                AND total from `priceAt()`, the one function that also feeds
                the Total figure, the sticky bar and the add-to-cart label,
                so there is no second surface left to drift from.

                It also fixes a control that could not express the product: a
                ± stepper on a 25-piece floor with tiers at 25/50/100/250
                takes 225 clicks to get from the minimum to the top tier.
                Enumerating the legal quantities makes the illegal ones
                unreachable rather than policed after the fact.

                Native <select>, deliberately, see the rationale block in
                <script>. Keyboard, typeahead, screen-reader semantics and
                the platform picker on touch, none of it re-implemented.

                ⚠️ NOT HONOURED BY THE CART YET. These totals are computed
                from `metadata.quantity_tiers`; Medusa still resolves the
                line item off the flat variant price until the quantity-tier
                migration runs, and every figure is 100x high until
                `migrate-price-units.ts --apply` runs. Both are tracked at
                the GATE note on `priceAt()` in <script>. This control is
                more prominent than the ladder it replaced, so it is also a
                more prominent place to be wrong: do not treat it as shipped.
              -->
              <div v-if="usesQuantitySelect" class="mt-3" data-test="quantity-select">
                <!--
                  Faire's "Item Quantity … Case of 12" line: the label and the
                  constraint share one baseline, so the rule is stated on the
                  control it governs. `text-eyebrow` for the uppercase label,
                  `text-micro` for the caption: they are both 12px and they
                  are not interchangeable.
                -->
                <div class="flex items-baseline justify-between gap-3">
                  <label for="pod-qty-select" class="text-eyebrow uppercase text-ink-600">Quantity</label>
                  <!--
                    Gated on `showsMinimumFact`, NOT `hasMinimum`: it is the
                    same predicate the card caption it replaced used, so a POD
                    product can never lose the disclosure by moving it here.
                    At a floor of 1 "Minimum 1" still answers the question a
                    bulk buyer arrived with, which is the reason
                    `showsMinimumFact` exists.
                  -->
                  <span
                    v-if="showsMinimumFact"
                    id="pod-qty-floor"
                    class="text-micro tabular-nums text-ink-600"
                    data-test="moq-caption"
                  >Minimum {{ moq }}</span>
                </div>

                <div v-if="!customQtyMode" class="relative mt-2">
                  <!--
                    `tabular-nums` is set on the closed control (where it
                    applies everywhere) and on each <option> (where it applies
                    only on platforms that let CSS reach the option list,
                    Chrome/Firefox on Windows and Linux). macOS and the iOS /
                    Android pickers draw options natively and ignore it. That
                    is the one thing given up by not hand-rolling a listbox,
                    and it is worth less than the ARIA the native control
                    provides: with four rows sharing an identical token order
                    the ladder still scans without a hard decimal column.
                  -->
                  <select
                    id="pod-qty-select"
                    v-model="qtySelectValue"
                    :aria-describedby="[showsQuoteLine ? 'pod-qty-quote' : '', showsMinimumFact ? 'pod-qty-floor' : ''].filter(Boolean).join(' ') || undefined"
                    data-test="qty-select"
                    class="h-[44px] w-full appearance-none rounded-[0.5rem] border border-ink-200 bg-white pl-3 pr-8 text-[14px] font-medium text-ink-950 tabular-nums transition-colors duration-fast hover:border-ink-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-cream-50 motion-reduce:transition-none"
                  >
                    <option
                      v-for="tier in tiers"
                      :key="tier.qty"
                      :value="String(tier.qty)"
                      class="tabular-nums"
                    >{{ quantityOptionLabel(tier.qty) }}</option>
                    <!-- Escape hatch, last row, Faire's own ordering. -->
                    <option value="custom">Custom quantity&hellip;</option>
                  </select>
                  <svg
                    class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-600"
                    viewBox="0 0 24 24" width="16" height="16" fill="none"
                    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                    aria-hidden="true"
                  ><polyline points="6 9 12 15 18 9" /></svg>
                </div>

                <!--
                  Custom quantity. The input REPLACES the select in the same
                  box (Faire does this too) rather than appearing beneath it,
                  so there are never two quantity controls to disagree.

                  The quote line underneath is the whole point: a value
                  between tiers is exactly where a buyer cannot work out
                  which price band they are in, so the tier is named inline.
                  It is `aria-describedby` on the field, not merely adjacent.
                -->
                <div v-else class="mt-2">
                  <input
                    ref="customQtyInput"
                    v-model.number="qty"
                    type="number"
                    inputmode="numeric"
                    step="1"
                    :min="moq"
                    data-test="qty-custom-input"
                    aria-label="Custom quantity"
                    :aria-describedby="showsMinimumFact ? 'pod-qty-quote pod-qty-floor' : 'pod-qty-quote'"
                    class="h-[44px] w-full rounded-[0.5rem] border border-ink-200 bg-white px-3 text-[14px] font-medium text-ink-950 tabular-nums [appearance:textfield] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-cream-50 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    @blur="enforceMoq"
                  />
                  <!--
                    Faire strands you in custom mode with no way back to the
                    list. `mt-3` also keeps this clear of the 44px field above
                    it by more than the 8px needed to stop two touch targets
                    overlapping at 390.
                  -->
                  <button
                    type="button"
                    data-test="qty-exit-custom"
                    class="mt-3 inline-flex min-h-[44px] items-center text-micro text-greyText underline underline-offset-2 transition-colors duration-fast hover:text-ink-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-cream-50 motion-reduce:transition-none"
                    @click="exitCustomQty"
                  >Choose a set quantity</button>
                </div>

                <!--
                  ONE quote line, shared by both branches and placed after
                  them so it never sits between the `v-if` and its `v-else`.

                  It is also deliberately OUTSIDE the select's `relative`
                  wrapper: the chevron is centred with `top-1/2
                  -translate-y-1/2` against its positioned ancestor, so
                  parking this paragraph in there dropped the arrow to the
                  midpoint of the select PLUS the caption.

                  Renders only when the option row could not say everything,
                  in custom mode (where naming the applicable tier is the
                  whole point) and at compact widths (where the saving was
                  dropped to make the row fit). On a wide viewport with a
                  tier selected the option already reads as this line would,
                  and printing both is the duplication being removed.
                -->
                <p
                  v-if="showsQuoteLine"
                  id="pod-qty-quote"
                  class="mt-2 text-micro tabular-nums text-ink-700"
                  data-test="qty-quote"
                >{{ quoteLine }}</p>
              </div>

              <!-- Flat price: only when 0 or 1 tier. -->
              <div
                v-else
                class="mt-3 flex items-baseline justify-between gap-3 rounded-lg border border-ink-200 bg-white px-4 py-3"
                data-test="flat-price"
              >
                <span class="text-[12px] uppercase tracking-wider text-ink-600">Unit price</span>
                <span class="text-[16px] font-semibold tabular-nums text-ink-950">{{ formatMoney(effectiveUnit) }}</span>
              </div>

              <!--
                Quantity stepper + total. The −/+ buttons and the input are
                bumped from 42px to 44px for WCAG 2.5.5 / Apple HIG 44pt
                compliance. The trio still fits on a 320 viewport because
                44 + 64 + 44 = 152, well inside the 272px useable card
                width (320 − 48 page padding − 24 card padding).

                DONE (the FUTURE note that stood here): the Faire-style
                quantity <select> is built, above. This stepper is now the
                fallback for the case the select cannot express, a product
                with 0 or 1 tier, where there is no ladder to enumerate and a
                free-running quantity against one flat unit price is the
                honest control. `usesQuantitySelect` is the single switch.

                THIS PARAGRAPH USED TO SAY "no SKU in the catalogue carries
                `metadata.quantity_tiers`, so the select is dead code". THAT IS
                FALSE and it was false in a way that would mislead exactly the
                person doing pricing work. Measured against :9000 on
                2026-08-31: TWENTY-TWO of 26 products carry a tier ladder,
                between 4 and 7 rows each (studio-tee-charcoal 7,
                atelier-hoodie 7, workshop-tote 4, cable-organiser 4,
                tech-pouch 4, and 17 more).

                The select is NOT dead code. `usesQuantitySelect` is
                `isPOD && tiers.length >= 2`, so it renders TODAY on
                cable-organiser and tech-pouch, the two typed-pod products that
                carry ladders. The stepper branch below is what the other 24
                get. Both paths are live; neither is waiting on a migration.

                The stepper cannot reach an illegal quantity: `:min` plus the
                `moq` watch, `enforceMoq` on blur and `decrementQty`'s clamp
                all read the same ref, and `onAddToCart` calls `enforceMoq`
                defensively before committing.
              -->
              <div
                class="mt-4 flex flex-wrap items-center gap-4"
                :class="usesQuantitySelect ? 'justify-end' : 'justify-between'"
              >
                <div v-if="!usesQuantitySelect" class="flex items-center gap-2">
                  <span class="text-[12px] uppercase tracking-wider text-ink-600">Quantity</span>
                  <div class="flex items-center">
                    <!--
                      Decrement at the floor. Two changes over the previous
                      pass, both about honesty:

                      1. It now READS disabled. `disabled:opacity-40` alone on
                         a white button is a weak signal; the muted surface +
                         not-allowed cursor make the floor visible before the
                         click rather than after it.
                      2. It says WHY. `aria-describedby` points at the
                         "Minimum n pieces" text beside the control, so a
                         screen-reader user who lands on a dead button hears
                         the constraint instead of just "dimmed". A `title`
                         would have covered the mouse and nothing else.
                    -->
                    <button
                      class="flex h-[44px] w-[44px] items-center justify-center border border-ink-200 bg-white text-ink-950 transition-colors duration-fast hover:bg-cream-50 disabled:cursor-not-allowed disabled:border-ink-100 disabled:bg-cream-50 disabled:text-ink-300 motion-reduce:transition-none"
                      :disabled="qty <= moq"
                      :aria-describedby="hasMinimum ? 'pod-qty-floor' : undefined"
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
                      :aria-describedby="hasMinimum ? 'pod-qty-floor' : undefined"
                      class="h-[44px] w-[64px] border-y border-ink-400 bg-white px-2 text-center text-[14px] font-medium text-ink-950 tabular-nums [appearance:textfield] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-semantic-focus [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      @blur="enforceMoq"
                    />
                    <button
                      class="flex h-[44px] w-[44px] items-center justify-center border border-ink-200 bg-white text-ink-950 hover:bg-cream-50"
                      data-test="qty-increase"
                      @click="qty = qty + 1"
                      type="button"
                      aria-label="Increase quantity"
                    >+</button>
                  </div>
                  <!--
                    Faire's "Case of 12" slot: the floor stated ON the control
                    it constrains, right where the buyer's eye already is,
                    rather than only in a caption at the top of the card. Also
                    the aria-describedby target for the two inputs above.
                  -->
                  <span
                    v-if="hasMinimum"
                    id="pod-qty-floor"
                    class="whitespace-nowrap text-[12px] text-ink-600 tabular-nums"
                    data-test="qty-floor"
                  >Minimum {{ moq }}</span>
                </div>

                <div class="text-right" data-test="effective-total">
                  <div class="gm-spec text-ink-600">Total</div>
                  <div class="text-[18px] font-semibold tabular-nums text-ink-950">{{ formatMoney(effectiveTotal) }}</div>
                </div>
              </div>

              <!--
                Quantity notices. The old behaviour silently rewrote what the
                buyer typed: enter 5 against a minimum of 25 and the field
                just became 25, with no sentence anywhere saying so. Snapping
                without narrating is the same class of defect as clamping
                without disclosing.

                POLITE, not assertive, the buyer caused this and is looking
                straight at the field; interrupting them is unnecessary. The
                region is always mounted (never `v-if`'d away) so assistive
                tech has a stable node to observe rather than one that
                appears at announcement time, which some screen readers miss.
              -->
              <p
                class="mt-2 min-h-[1.25rem] text-[12px] leading-[1.25rem] text-ink-700"
                role="status"
                aria-live="polite"
                data-test="qty-notice"
              >{{ qtyNotice }}</p>

              <!--
                Primary Add to cart sits at the foot of the quantity card,
                the merchery PDP keeps the CTA inside the same elevation so
                the user's eye never leaves the step they just configured.

                This is now the ONLY commit control in the document flow (the
                two sticky bars are mirrors of it, and DesignEditor's
                "Add customised item" is gone). It is also the only one that
                could ever attach artwork before, the difference is that it
                now does, via `collectDesignPayload()` inside `onAddToCart`.

                The label carries the money, per Blue Apron's configurator:
                one button reading `Add, $19.98` next to a summary of what
                you configured, rather than a bare "Add to cart" and a total
                the buyer has to go looking for. `commitLabel` also narrates
                the design-preparation phase, which can take a beat while the
                stage is captured and the proof uploaded, a silent 800ms on
                the primary CTA reads as a dead button.
              -->
              <div ref="primaryAtcRow" class="mt-6 flex flex-nowrap items-stretch gap-3">
                <button
                  class="inline-flex h-12 flex-1 min-w-0 items-center justify-center rounded-none bg-ink-950 px-7 text-[14px] font-medium uppercase tracking-[0.02em] text-cream-50 transition-colors duration-fast hover:bg-ink-700 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
                  :disabled="!finalVariantId || adding"
                  :aria-busy="adding || undefined"
                  @click="onAddToCart"
                  type="button"
                  data-test="primary-add-to-cart"
                >
                  <!--
                    Label is 14px, not the 24px this button used to carry, so
                    "ADD TO CART" measures ~100px and fits on one line inside
                    the ~282px slab left at 390px after the favourite button
                    and gap. `leading-tight` is retained only as insurance for
                    the longest busy string ("Attaching design…"); nothing
                    wraps at any tested width. No `truncate`: silently clipping
                    a primary CTA to "ADD TO C…" is worse than either option.
                  -->
                  <span class="text-center leading-tight">{{ commitLabel }}</span>
                </button>
                <button
                  class="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-none border border-greyLines bg-white text-ink-600 hover:border-ink-400 hover:text-ink-950"
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
              <!--
                Success confirmation. Names the artwork explicitly on the POD
                path ("with your design") because that is the fact the
                customer could not previously verify anywhere, the whole
                reason this round exists. `role="status"` announces it
                politely on its own; no `aria-live` override needed.
              -->
              <p
                v-if="addSuccess"
                role="status"
                data-test="add-to-cart-success"
                class="mt-3 flex items-center gap-1.5 text-[13px] text-ink-700"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="shrink-0" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {{ addSuccessMessage }}
              </p>
            </div>

            <!--
              Quantity step: Apparel (D2C) / Gift-card branch.
              No tier ladder, no discount badges. The qty stepper sits next
              to a live total line, then the single primary ATC button. Copy
              stays conversational ("Add to cart") rather than B2B-laden.
              Same `onAddToCart` handler is reused (the design gate inside it
              is scoped to POD).
              Gift cards reuse this card verbatim, buying a digital code
              is functionally the same as buying an apparel SKU: pick a
              variant (denomination), set qty, ATC. The buyer-facing
              copy upstream (price label + caption) already narrates
              the gift-card-specific reassurance.

              The stepper's floor now reads `moq` instead of a hard-coded 1.
              `moq` already resolves to 1 for both these flows, so this is
              behaviour-identical today, but the previous literal was how
              the two halves drifted apart in the first place. The comment
              above this card used to assert "MOQ is hard-coded to 1" while
              `moq` itself was reading stale apparel metadata and clamping to
              25, and nothing in the markup could tell you which was true.
              One ref, read everywhere, is the whole point.
            -->
            <div
              v-else-if="isApparel || isGiftCard"
              ref="primaryAtcRow"
              class="flex flex-col bg-white shadow-custom p-[1.5rem] pb-[3rem] rounded-[0.5rem] relative mt-[1.8rem]"
              data-test="apparel-add-to-cart"
            >
              <h2 class="text-[20px] leading-[24px] md:text-[24px] md:leading-[28px] whitespace-pre-wrap mb-[2rem] md:mb-[3rem]">{{ stepNumber('quantity') }}. Quantity</h2>

              <!--
                Same disclosure block as the POD card, gated on the same
                `showsMinimumFact`. Inert today (this branch is never POD, and
                apparel/gift-card resolve `moq` to 1, so it never renders and
                the PLP e2e contract's "no moq-caption on apparel" assertion
                holds), present so that the day someone relaxes the type gate
                on `moq`, the sentence arrives with the clamp instead of a
                release later.
              -->
              <p
                v-if="showsMinimumFact"
                class="mb-4 text-[12px] uppercase tracking-wider text-ink-600"
                data-test="moq-caption"
              >
                Minimum order: {{ moq }} {{ moq === 1 ? 'piece' : 'pieces' }}
              </p>

              <div class="flex flex-wrap items-center justify-between gap-4">
                <div class="flex items-center gap-2">
                  <span class="text-[12px] uppercase tracking-wider text-ink-600">Quantity</span>
                  <div class="flex items-center">
                    <button
                      class="flex h-[44px] w-[44px] items-center justify-center border border-ink-200 bg-white text-ink-950 transition-colors duration-fast hover:bg-cream-50 disabled:cursor-not-allowed disabled:border-ink-100 disabled:bg-cream-50 disabled:text-ink-300 motion-reduce:transition-none"
                      :disabled="qty <= moq"
                      :aria-describedby="hasMinimum ? 'apparel-qty-floor' : undefined"
                      data-test="apparel-qty-decrease"
                      @click="decrementQty"
                      type="button"
                      aria-label="Decrease quantity"
                    >&minus;</button>
                    <input
                      v-model.number="qty"
                      type="number"
                      :min="moq"
                      data-test="apparel-qty-input"
                      aria-label="Quantity"
                      :aria-describedby="hasMinimum ? 'apparel-qty-floor' : undefined"
                      class="h-[44px] w-[64px] border-y border-ink-400 bg-white px-2 text-center text-[14px] font-medium text-ink-950 tabular-nums [appearance:textfield] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-semantic-focus [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      @blur="enforceMoq"
                    />
                    <button
                      class="flex h-[44px] w-[44px] items-center justify-center border border-ink-200 bg-white text-ink-950 hover:bg-cream-50"
                      data-test="apparel-qty-increase"
                      @click="qty = qty + 1"
                      type="button"
                      aria-label="Increase quantity"
                    >+</button>
                  </div>
                  <span
                    v-if="hasMinimum"
                    id="apparel-qty-floor"
                    class="whitespace-nowrap text-[12px] text-ink-600 tabular-nums"
                  >Minimum {{ moq }}</span>
                </div>
                <p class="text-[20px] font-medium text-ink-950 tabular-nums" data-test="apparel-total">
                  {{ formatMoney(effectiveTotal) }}
                </p>
              </div>

              <p
                class="mt-2 min-h-[1.25rem] text-[12px] leading-[1.25rem] text-ink-700"
                role="status"
                aria-live="polite"
                data-test="qty-notice"
              >{{ qtyNotice }}</p>

              <div class="mt-6 flex flex-nowrap items-stretch gap-3">
                <button
                  class="inline-flex h-12 flex-1 min-w-0 items-center justify-center rounded-none bg-ink-950 px-7 text-[14px] font-medium uppercase tracking-[0.02em] text-cream-50 transition-colors duration-fast hover:bg-ink-700 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
                  :disabled="!finalVariantId || adding"
                  :aria-busy="adding || undefined"
                  @click="onAddToCart"
                  type="button"
                  data-test="primary-add-to-cart"
                >
                  <!--
                    Label is 14px, not the 24px this button used to carry, so
                    "ADD TO CART" measures ~100px and fits on one line inside
                    the ~282px slab left at 390px after the favourite button
                    and gap. `leading-tight` is retained only as insurance for
                    the longest busy string ("Attaching design…"); nothing
                    wraps at any tested width. No `truncate`: silently clipping
                    a primary CTA to "ADD TO C…" is worse than either option.
                  -->
                  <span class="text-center leading-tight">{{ commitLabel }}</span>
                </button>
                <button
                  class="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-none border border-greyLines bg-white text-ink-600 hover:border-ink-400 hover:text-ink-950"
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
              <!--
                Success confirmation. Names the artwork explicitly on the POD
                path ("with your design") because that is the fact the
                customer could not previously verify anywhere, the whole
                reason this round exists. `role="status"` announces it
                politely on its own; no `aria-live` override needed.
              -->
              <p
                v-if="addSuccess"
                role="status"
                data-test="add-to-cart-success"
                class="mt-3 flex items-center gap-1.5 text-[13px] text-ink-700"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="shrink-0" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {{ addSuccessMessage }}
              </p>
            </div>
          </div>

          <!--
            Desktop bottom action bar (lg+ only). REVEALED ON SCROLL, not
            persistent. It is `position: fixed` and gated on
            `!desktopAtcInView`, so it exists only while the in-flow buy card
            is off screen.

            WHY IT CHANGED (measured, 2026-08-30, /products/studio-tee-cream):
            The bar used to be `lg:sticky lg:bottom-0` with no gate, which
            produced three defects at once.

            1. TWO PRIMARY CTAs AT ONCE, OVERLAPPING. At 1440x900 the in-flow
               "Add to cart" sat at y 780-828 and this bar pinned itself at
               y 813-900. The bar covered the bottom 15px of the button it was
               supposed to be a fallback for (22px at 1539x893). Both CTAs were
               on screen together for the first ~600px of scroll.
            2. IT WAS ONLY EVER VISIBLE WHERE IT WAS REDUNDANT. Because a
               sticky element stops sticking once its own flow position scrolls
               past, the bar was gone by y=1200 of a 4921px document. It
               covered exactly the range where the real CTA was already on
               screen, and nothing of the 3900px below it. Backwards.
            3. IT WAS NOT CLICKABLE ON A FIRST VISIT. `bottom: 0` with no
               `--consent-height` offset put it entirely under the cookie
               banner (104px at desktop, bar is 87px tall).
               `document.elementFromPoint` at the button's own centre returned
               the consent banner's button, not this one. A screenshot cannot
               see that; only a hit test can.

            The fix, in order:
            - `fixed` instead of `sticky`, so the bar is available for the
              whole document rather than only near the top, and so mounting or
              unmounting it costs no flow height (a `v-if` on an in-flow
              element would shorten the document by ~111px, move the observed
              target, and let the trigger oscillate).
            - `v-if="!desktopAtcInView"`, driven by a second
              IntersectionObserver on the same `primaryAtcRow` element the
              mobile bar watches, but with its own options. See the observer
              block in <script setup> for why the two are separate.
            - `bottom-[var(--consent-height,0px)]`, the same binding the mobile
              bar has carried for weeks. tokens.css says plainly that
              fixed/sticky action bars offset themselves this way; this one
              never did.

            WHY A REVEAL-ON-SCROLL BAR RATHER THAN DELETING IT (Mobbin, web):
            A *persistent* desktop bottom CTA bar is not an apparel-PDP
            pattern. lululemon, Urban Outfitters, Depop, Hims, Apple, the
            Shopify default theme and Amazon all leave the commit control in
            the buy column and let it scroll away. Every bottom-docked
            commit bar in the corpus belongs to a linear task, not a
            merchandising page: Kiwi.com's "Proceed to payment", Deel's order
            wizard, sweetgreen's configurator, DoorDash's modal footer.
            So the always-on treatment had to go.
            But adidas, the largest brand-owned apparel reference available,
            *does* keep a commit control on screen at every scroll depth: its
            whole buy panel is pinned, still showing ADD TO BAG down at
            "Complete the look" and "How to style". This layout cannot borrow
            that directly, because here it is the IMAGE pane that is
            `lg:sticky` and the buy column that scrolls. A reduced-summary bar
            that appears once the buy card leaves is the same affordance
            expressed in the pane arrangement this page already has. Airbnb's
            "From $31 / guest - Reserve" is the closest direct analogue.

            ALIGNMENT: the inner row is `px-12` (48px), NOT `px-gutter`. This
            bar sits inside a 50vw pane, not a page rail band, so `max-w-rail`
            is inert here (the pane only exceeds the 1416px rail box above a
            2832px viewport) and `px-gutter` is fluid where the thing it must
            line up with is not. The in-flow content offset is a constant 48px
            (24px pane pad + 24px card pad), so `px-12` puts the bar's Add to
            cart flush with the in-flow button row's right edge at EVERY
            width; `px-gutter` would only match at >=1440 and run 12.5px wide
            at 1024.

            - Uses `formatMoney(effectiveTotal)` and `leadTime` so figures stay
              in lockstep with the inline qty card. ATC delegates to the same
              `onAddToCart` handler, no duplicated cart logic.
          -->
          <!--
            Desktop sticky bar: shared across flows but with branched
            messaging in the LEFT info column:
            - POD: "Lead time: ~10-15 working days" (production wait)
            - Apparel: "In stock · dispatched in 3-5 working days", the
              window published on /shipping, and the same figure the
              "Delivery and returns" accordion section states further down
              the page. The bar used to promise 1-2 days while the accordion
              promised 10-15 business days from artwork approval; neither
              number was reachable from the other.
            - Gift-card: "Delivered instantly · Sent by email" (no
              physical fulfilment, no shipping window to communicate;
              omitting the lead-time block keeps the bar honest).
            The total figure is driven by `effectiveTotal`, which itself
            branches inside (apparel reads `unitPrice * qty`, POD reads
            tier-aware `effectiveUnit * qty`).

            The design chip is new. Reference: Blue Apron's sticky
            configurator bar carries the item, a one-line summary of what you
            configured with an inline Edit, the quantity, and one button
            holding the price, so the buyer can commit from anywhere on the
            page without scrolling back to re-check what they chose. That is
            exactly the gap here: a customer who has scrolled past the editor
            has no way to know their artwork is still attached, and the bar
            they commit from is the natural place to say so.

            It leads the bar (before lead time) because it is the fact the
            buyer is least sure of.
          -->
          <!--
            NO HORIZONTAL BLEED ON THIS BAR. It used to carry
            `mx-[-1.5rem] px-[1.5rem]`, a full-bleed trick widening it by 48px so
            the white background reached the column edges. The right half had
            nothing to bleed INTO: the bar measured 762px against a 714px parent,
            putting its right edge at 1451 on a 1427px client width, so every PDP
            carried a 24px horizontal scrollbar at desktop. Measured stable at
            scrollTop, mid-page and bottom.

            Do not reintroduce the negative margin. A negative margin on an
            element whose parent already reaches the right gutter always
            overflows. If the bleed is wanted back, remove the padding from the
            parent instead.

            STILL TRUE AFTER THE FIXED-POSITION CHANGE, and worth restating
            because the mechanism is now different. The bar is `fixed right-0
            w-1/2`, so it is laid out against the initial containing block and
            is exactly the right pane's width by construction, with no
            dependence on the parent's padding at all. `px-12` is INNER
            padding; it cannot overflow. Verified 0px horizontal overflow at
            1440 and 390 at every scroll stop.

            Unrelated and untouched: the MOBILE bar's
            `bottom-[var(--consent-height,0px)]` binding, which keeps the cookie
            banner from covering add-to-cart.
          -->
          <div
            v-if="product && !desktopAtcInView && !footerInView"
            class="hidden lg:block fixed right-0 bottom-[var(--consent-height,0px)] w-1/2 z-20 py-[1.2rem] bg-white border-t border-greyLines shadow-[0_-4px_12px_rgba(0,0,0,0.06)] transition-[bottom] duration-fast motion-reduce:transition-none"
            data-test="desktop-sticky-atc"
          >
            <div class="flex items-center justify-between gap-4 px-12">
              <div
                v-if="anyDesignUploaded"
                class="flex min-w-0 items-center gap-2"
                data-test="sticky-design-chip"
              >
                <img
                  v-if="livePreviewUrl"
                  :src="livePreviewUrl"
                  alt=""
                  class="h-10 w-10 shrink-0 rounded-[0.35rem] border border-merchery-sage bg-white object-contain"
                />
                <div class="flex min-w-0 flex-col text-[12px] text-greyText">
                  <span class="flex items-center gap-1 text-[13px] font-medium text-ink-950">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="shrink-0" aria-hidden="true">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Design attached
                  </span>
                  <button
                    type="button"
                    class="self-start underline underline-offset-2 hover:text-ink-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ink-950"
                    data-test="sticky-edit-design"
                    @click="scrollToEditor"
                  >Edit design</button>
                </div>
              </div>

              <!--
                Ordered custom-first on purpose. A printed order quotes the
                PRINT lead time (10-20 days in the catalogue), never the
                ready-to-ship estimate below it. Getting this the other way
                round promises a date the business misses on every order.
              -->
              <div v-if="showsPrintCommerce" class="flex flex-col text-[12px] text-greyText">
                <span>Lead time:</span>
                <span class="text-[13px] font-medium text-ink-950">~{{ leadTime }} working days</span>
              </div>
              <div v-else-if="isGiftCard" class="flex flex-col text-[12px] text-greyText" data-test="sticky-giftcard-meta">
                <span>Delivered instantly</span>
                <span class="text-[13px] font-medium text-ink-950">Sent by email</span>
              </div>
              <div v-else-if="isApparel" class="flex flex-col text-[12px] text-greyText">
                <span>In stock</span>
                <span class="text-[13px] font-medium text-ink-950">Dispatched in 3-5 working days</span>
              </div>
              <div class="ml-auto flex flex-col text-right text-[12px] text-greyText">
                <span>{{ qty }} &times; {{ formatMoney(effectiveUnit) }}</span>
                <span class="text-[15px] font-medium text-ink-950 tabular-nums">{{ formatMoney(effectiveTotal) }}</span>
              </div>
              <button
                class="inline-flex h-12 shrink-0 items-center justify-center rounded-none bg-ink-950 px-6 text-[14px] font-medium uppercase tracking-[0.04em] text-cream-50 transition-colors duration-fast hover:bg-ink-700 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
                :disabled="!finalVariantId || adding"
                :aria-busy="adding || undefined"
                @click="onAddToCart"
                type="button"
                data-test="sticky-add-to-cart"
                aria-label="Add to cart from sticky bar"
              >
                {{ adding ? stickyBusyLabel : 'Add to cart' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!--
        bg-uiHighlight reassurance strip: sits BELOW the two-pane container,
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
          class="flex flex-col items-start h-full lg:max-w-[240px] gap-[0.4rem]"
        >
          <div class="flex items-center gap-[0.2rem]">
            <svg v-for="n in 5" :key="n" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" class="text-[#00B67A]" aria-hidden="true">
              <path d="M12 2 15 9l7 .7-5.3 4.8 1.6 7L12 17.7 5.7 21.5l1.6-7L2 9.7 9 9z" />
            </svg>
          </div>
          <span class="text-[13px] leading-[18px] pl-[0.3rem] text-greyText flex-1">Excellent | 4.8 out of 5</span>
        </a>
        <div class="flex flex-col items-start h-full lg:max-w-[240px] gap-[0.4rem]">
          <div class="flex items-center gap-[0.5rem]">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
              <rect x="1" y="3" width="15" height="13" />
              <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
              <circle cx="5.5" cy="18.5" r="2.5" />
              <circle cx="18.5" cy="18.5" r="2.5" />
            </svg>
            <span class="text-[14px] leading-[18px] font-medium">Worldwide delivery</span>
          </div>
          <span class="text-[13px] leading-[18px] text-greyText flex-1">EU, UK and USA</span>
        </div>
        <div class="flex flex-col items-start h-full lg:max-w-[240px] gap-[0.4rem]">
          <div class="flex items-center gap-[0.5rem]">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span class="text-[14px] leading-[18px] font-medium">Quality control</span>
          </div>
          <span class="text-[13px] leading-[18px] text-greyText flex-1">Each order is double checked before production</span>
        </div>
        <div class="flex flex-col items-start h-full lg:max-w-[240px] gap-[0.4rem]">
          <div class="flex items-center gap-[0.5rem]">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span class="text-[14px] leading-[18px] font-medium">They trust us!</span>
          </div>
          <span class="text-[13px] leading-[18px] text-greyText flex-1">Trusted by 2,000+ customers</span>
        </div>
      </div>

      <!--
        Product details: two-column shell with sticky-left intro + accordion-right.
        Mirrors the FAQ aside pattern (lg:flex gap-24 + lg:sticky lg:top-[140px]).
        - Left aside: section eyebrow/heading + supporting paragraph + sample CTA.
          Sticky against viewport so it remains visible while the user scans the
          accordion items on long PDPs (clears the 118px fixed header bands +
          22px breathing room → top-[140px]).
        - Right column: Disclosure list driven by `infoSections`, which is
          branched on product mode, apparel gets details / size guide (only
          where there is a garment size run) / delivery + returns; POD gets
          details / artwork / proofing / production. Both end on the variant
          matrix, whose columns are the product's real option axes.
        - The lg:flex shell collapses to a single stack on mobile/tablet.
      -->
      <section
        class="mt-[6rem] mx-auto max-w-rail px-gutter"
        aria-labelledby="product-details-heading"
      >
        <div class="rounded-[0.5rem] bg-offWhite lg:flex p-6 md:p-10 lg:p-12 gap-12 lg:gap-24">
          <!-- Sticky left intro -->
          <div class="flex flex-col flex-1 lg:sticky lg:top-[140px] lg:self-start lg:h-fit">
            <h2
              id="product-details-heading"
              class="font-accent text-[24px] leading-[28px] md:text-[32px] md:leading-[38px] lg:text-[40px] lg:leading-[46px] mb-[1.8rem] text-ink-950"
            >
              Product details
            </h2>
            <p class="mb-[3rem] text-[14px] leading-[20px] md:text-[16px] md:leading-[23px] text-ink-700 max-w-[40ch]">
              Materials, make and the practical detail: what this is, how it reaches you, and every variant we offer.
            </p>
            <div>
              <NuxtLink
                to="/contact?intent=sample"
                class="inline-flex items-center justify-center h-12 px-6 bg-ink-950 text-cream-50 hover:bg-ink-700 transition-colors duration-fast border border-ink-950 hover:border-ink-700 text-[14px] font-medium uppercase tracking-[0.04em] rounded-none"
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
                class="flex w-full cursor-pointer items-center justify-between text-left font-serif text-[18px] text-ink-950 -my-3 py-3 transition-colors hover:text-ink-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus motion-reduce:transition-none"
                :data-section-button="section.id"
                @click="syncHash(section.id, isOpen)"
              >
                <span>{{ section.title }}</span>
                <svg
                  class="h-5 w-5 text-ink-600 transition-transform duration-200 motion-reduce:transition-none"
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
              <DisclosurePanel class="pt-4 text-[14px] leading-relaxed text-ink-700">
                <div v-if="section.id === 'variant-specificities'">
                  <p class="mb-3">{{ section.body }}</p>
                  <div class="overflow-x-auto rounded-md border border-ink-200">
                    <!--
                      Columns come from `variantMatrixColumns`, which is the
                      product's own option axes. A single-axis product now
                      renders a two-column table instead of four, two of
                      which were em-dashes on every row.
                    -->
                    <table class="w-full border-collapse text-left text-[12px]" data-test="variant-matrix">
                      <thead class="bg-cream-50">
                        <tr>
                          <th
                            v-for="col in variantMatrixColumns"
                            :key="col.id"
                            scope="col"
                            class="border-b border-ink-200 px-3 py-2 font-medium text-ink-700"
                          >{{ col.label }}</th>
                          <th scope="col" class="border-b border-ink-200 px-3 py-2 text-right font-medium text-ink-700">Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr
                          v-for="row in variantMatrix"
                          :key="row.id"
                          class="odd:bg-white even:bg-cream-50"
                        >
                          <td
                            v-for="col in variantMatrixColumns"
                            :key="col.id"
                            class="border-b border-ink-100 px-3 py-2 text-ink-950"
                          >{{ row.cells[col.id] || '–' }}</td>
                          <td class="border-b border-ink-100 px-3 py-2 text-right tabular-nums text-ink-700">{{ row.price || '–' }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
                <template v-else>
                  <p class="whitespace-pre-line text-pretty">{{ section.body }}</p>
                  <NuxtLink
                    v-if="section.link"
                    :to="section.link.to"
                    class="mt-3 inline-flex items-center gap-1 text-[13px] text-ink-950 underline underline-offset-4 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-cream-50"
                  >
                    {{ section.link.label }}
                    <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                      <path d="M2 8h12M9 3l5 5-5 5" />
                    </svg>
                  </NuxtLink>
                </template>
              </DisclosurePanel>
            </Disclosure>
          </div>
        </div>
      </section>

      <!-- You might also like: merchery-style oversized heading + carousel -->
      <div v-if="relatedProducts.length" class="pt-12">
        <h2 class="text-[24px] md:text-[32px] lg:text-[40px] leading-[28px] md:leading-[38px] lg:leading-[46px] px-[1.5rem] lg:px-12">You might also like&hellip;</h2>
        <BestSellers :products="relatedProducts" hide-heading />
      </div>

      <!-- FAQ + Newsletter: siblings inside one wrapper per merchery section D. -->
      <div class="mx-auto w-full max-w-rail px-gutter mt-16 flex flex-col gap-12 mb-12">
        <AppFaq />
        <AppNewsletter />
      </div>
    </template>

    <!--
      Mobile/tablet sticky bottom ATC bar: merchery's persistent
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
        12 gap + 130min ATC = 318, fits with 2px to spare. The ATC uses
        `truncate` on its label so an extreme price still renders.

      Two rows now, following Blue Apron's sticky configurator: a summary
      line (what you configured + an inline Edit) above the commit line
      (quantity + one button carrying the money). The summary row is the
      answer to "is my artwork still attached?" for a customer who is
      three screens below the editor, and it costs VERTICAL space only,
      the 318/320 horizontal budget above is untouched, which is why the
      thumbnail did NOT go inline with the stepper.

      The summary row is also where the minimum lands on mobile: the
      quantity card's "Minimum n" caption is far offscreen by the time
      this bar appears, and the decrement in this bar is clamped by the
      same `moq`. Disabled-and-unexplained is exactly the state Task 2 is
      about.
    -->
    <!--
      ⚠️ P0: THIS BAR SITS UNDER THE COOKIE BANNER UNLESS `--consent-height` IS SET.

      The consent banner (CookieBanner.vue:45) is `fixed inset-x-0 bottom-0
      z-[60]`, and its content row (`:50`) is `flex-col … lg:flex-row`, so the
      buttons stack and it renders ~309px tall on EVERY viewport below 1024px,
      the exact range this bar is visible in (`lg:hidden`). At 390x844 it
      spans y 535→844 and this bar spans y 739→844, so the banner covers this
      bar completely.

      Measured consequence, hit-tested with storage cleared:
        elementFromPoint on "−"                    -> banner, NOT the button
        elementFromPoint on "+"                    -> banner, NOT the button
        elementFromPoint on "Add to cart · £800.00" -> banner, NOT the button
      i.e. on a first visit a mobile customer cannot add to cart at all. This
      survived every visual pass in this session, mine included, because a
      SCREENSHOT CANNOT SEE POINTER INTERCEPTION: both elements paint, and the
      banner simply wins the hit test.

      Fix is split by file ownership. ART owns the mechanism: shrink the banner
      and publish `--consent-height` from tokens.css, equal to the banner's
      rendered height while it is visible and 0px once dismissed. This file owns
      the consumption: `bottom-[var(--consent-height,0px)]` lifts the bar clear
      of the banner and drops it back flush when consent is decided.

      The `0px` fallback is load-bearing, not defensive padding: until the token
      exists this compiles to `bottom: 0px`, i.e. byte-identical to the previous
      `bottom-0`. So this change is a no-op today and becomes the fix the moment
      ART lands the token, neither lane blocks the other.

      Do NOT "fix" this by raising this bar's z-index above the banner. The
      banner is 309px tall, so winning the z-fight paints this bar on top of the
      cookie copy and buries the consent controls instead. Lift, don't stack.

      ACCEPTANCE TEST IS A HIT TEST, NOT A SCREENSHOT:
        clear localStorage/cookies, viewport 390x844, then
        document.elementFromPoint(cx, cy) on this bar's three controls must
        return this bar (or its descendants), never the banner.
    -->
    <ClientOnly>
      <div
        v-if="product && !primaryAtcInView"
        class="fixed inset-x-0 bottom-[var(--consent-height,0px)] z-30 border-t border-greyLines bg-white shadow-[0_-4px_12px_rgba(0,0,0,0.06)] px-3 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] transition-[bottom] duration-fast motion-reduce:transition-none lg:hidden"
        data-test="mobile-sticky-atc"
      >
        <div class="mx-auto w-full max-w-rail">
          <!--
            Summary row. Renders only when it has something to say, so an
            apparel SKU with no design and no minimum keeps the original
            single-row bar and its original height.
          -->
          <div
            v-if="anyDesignUploaded || hasMinimum"
            class="mb-2 flex items-center gap-2 text-[12px] leading-[16px]"
            data-test="mobile-sticky-summary"
          >
            <img
              v-if="anyDesignUploaded && livePreviewUrl"
              :src="livePreviewUrl"
              alt=""
              class="h-7 w-7 shrink-0 rounded-[0.25rem] border border-merchery-sage bg-white object-contain"
            />
            <span v-if="anyDesignUploaded" class="flex min-w-0 items-center gap-1 font-medium text-ink-950">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="shrink-0" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span class="truncate">Design attached</span>
            </span>
            <button
              v-if="anyDesignUploaded"
              type="button"
              class="shrink-0 text-greyText underline underline-offset-2 hover:text-ink-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ink-950"
              data-test="mobile-sticky-edit-design"
              @click="scrollToEditor"
            >Edit</button>
            <span
              v-if="hasMinimum"
              id="sticky-qty-floor"
              class="ml-auto shrink-0 tabular-nums text-greyText"
            >Minimum {{ moq }}</span>
          </div>

          <div class="flex items-center gap-2">
            <div class="flex items-center shrink-0">
              <button
                class="flex h-[44px] w-[44px] items-center justify-center border border-ink-200 bg-white text-ink-950 disabled:cursor-not-allowed disabled:border-ink-100 disabled:bg-cream-50 disabled:text-ink-300"
                :disabled="qty <= moq"
                :aria-describedby="hasMinimum ? 'sticky-qty-floor' : undefined"
                @click="decrementQty"
                type="button"
                aria-label="Decrease quantity"
              >&minus;</button>
              <input
                v-model.number="qty"
                type="number"
                :min="moq"
                aria-label="Quantity"
                :aria-describedby="hasMinimum ? 'sticky-qty-floor' : undefined"
                class="h-[44px] w-[44px] border-y border-ink-400 bg-white px-1 text-center text-[13px] font-medium text-ink-950 tabular-nums [appearance:textfield] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-semantic-focus [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                @blur="enforceMoq"
              />
              <button
                class="flex h-[44px] w-[44px] items-center justify-center border border-ink-200 bg-white text-ink-950 hover:bg-cream-50"
                @click="qty = qty + 1"
                type="button"
                aria-label="Increase quantity"
              >+</button>
            </div>
            <button
              class="inline-flex h-[48px] flex-1 min-w-0 items-center justify-center rounded-none bg-ink-950 px-3 text-[13px] font-medium uppercase tracking-[0.02em] text-cream-50 transition-colors duration-fast hover:bg-ink-700 disabled:opacity-60 motion-reduce:transition-none"
              :disabled="!finalVariantId || adding"
              :aria-busy="adding || undefined"
              @click="onAddToCart"
              type="button"
              data-test="mobile-sticky-add-to-cart"
              aria-label="Add to cart from sticky bar"
            >
              <span class="truncate">{{ adding ? stickyBusyLabel : `Add to cart · ${formatMoney(effectiveTotal)}` }}</span>
            </button>
          </div>
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
// Explicit import: Nuxt auto-imports nested-component dirs with a path
// prefix (`SeoProductSchemaScript`), which is awkward for an SEO concern
// that should read like a plain tag. Importing directly preserves the
// `<ProductSchemaScript>` name and keeps the dependency obvious to anyone
// auditing what the PDP emits to <head>.
import ProductSchemaScript from '~/components/seo/ProductSchemaScript.vue'

// Money formatting is centralised in `~/utils/money`. This page previously
// carried its own `formatMoney` shadow that divided by 100 and passed
// `undefined` as the locale, see the header of that module for why both
// were wrong.
import { formatMoney as formatMoneyShared } from '~/utils/money'
import { useDesignDrafts } from '~/composables/useDesignDraft'
import type { DesignDraft } from '~/composables/useDesignDraft'
// Print-zone / technique resolvers. Extracted out of this file so the
// dedicated design surface at /design/[handle] resolves the SAME metadata by
// the same rules. Verified behaviour-identical across all 26 catalogue
// products before the swap. See the header of ~/utils/printMetadata.
import {
  parsePrintLocations,
  parseTechniques,
  isCustomizable as isCustomizableProduct,
} from '~/utils/printMetadata'

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
interface ProductTypeRef { id?: string; value?: string | null }
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
  type?: ProductTypeRef | null
  type_id?: string | null
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
    const fields = 'id,title,subtitle,handle,description,thumbnail,*variants.calculated_price,*variants.options,*options,*images,metadata,*type,type_id,*tags'
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

// Canonical URL for JSON-LD `Product.url` and `Offer.url`. Schema.org
// REQUIRES absolute URLs, relative paths are silently ignored by Google's
// rich-results parser, leaving the product unindexed for shopping cards.
//
// Resolution order:
//   1. Browser:    `window.location.origin` is the truth on the client and
//                  also matches whatever proxy/CDN host the user actually
//                  reached (so local, staging, prod all "just work").
//   2. SSR:        `runtimeConfig.public.siteUrl` if the operator set one.
//   3. Fallback:   localhost; harmless in dev, and since the schema only
//                  matters for crawlers (which hit the prod host), a wrong
//                  base in dev never reaches Search Console.
//
// `runtimeConfig.public.siteUrl` is read defensively because nuxt.config
// does not yet declare it; reading an undefined key would tighten the
// coupling between this file and infra config we don't own.
const canonicalUrl = computed<string>(() => {
  const path = `/products/${handle.value}`
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${path}`
  }
  const config = useRuntimeConfig()
  const base = ((config.public as Record<string, unknown>)?.siteUrl as string)
    || 'http://localhost:3000'
  return `${base.replace(/\/$/, '')}${path}`
})

// =========================================================================
// Metadata-driven derived state
// =========================================================================

// is_customizable: explicit false means "not customisable". Anything else
// (true, undefined, missing metadata) defaults to TRUE because the platform
// is print-on-demand. The `print_locations.length === 0` invariant gives the
// merchant a softer way to suppress the editor for a specific SKU.
// Backed by ~/utils/printMetadata so this page and the dedicated design
// surface at /design/[handle] cannot drift apart on what "customisable" means.
const isCustomizable = computed<boolean>(() => isCustomizableProduct(product.value))

// Type guard: narrows the metadata field reads.
const asArray = (v: unknown): unknown[] => Array.isArray(v) ? v : []

// print_locations resolver with backwards-compat fallback chain:
//   1. metadata.print_locations  (canonical, set by seed agent)
//   2. metadata.mockup_front + mockup_back  (legacy 2-zone shape)
//   3. images[0]/images[1] OR thumbnail  (best-effort default for products
//      that have no metadata at all but still need a customisation surface)
//   4. empty array  (only when the product is explicitly not customisable)
const printLocations = computed<PrintLocation[]>(() => parsePrintLocations(product.value))

// =========================================================================
// Product flow discriminator (POD vs Apparel/D2C vs Gift-Card).
//
// `product.type.value` is Medusa's product-type relation, populated via
// `fields: '...,*type'` above. We branch the entire PDP on this single
// string discriminator so the same template renders three distinct
// experiences without forking the route:
//
//   'pod':         B2B print-on-demand. Variant + design upload + tier ladder
//                  + MOQ messaging + e-proof copy. The original PDP.
//   'apparel':     D2C ready-to-ship apparel. Variant + simple qty stepper +
//                  single ATC. No upload step, no MOQ, no e-proof copy.
//   'gift-card':   Digital code, instantly email-delivered. Functionally
//                  buy-as-is (reuses the apparel ATC card visually), but
//                  surfaces an explicit "Email-delivered · Codes don't
//                  expire" caption and suppresses B2B affordances (sample,
//                  quote, lead-time) plus the upload step.
//
// Fallback: if a product has no `type` set (legacy SKUs in the DB before
// the type seed runs), fall back to the existing `isCustomizable` +
// `printLocations.length` signal, i.e. anything customisable is treated
// as POD, anything else is treated as apparel. This keeps the v18/v19
// behaviour intact for un-typed products.
type ProductFlow = 'pod' | 'apparel' | 'gift-card'

const productType = computed<ProductFlow>(() => {
  const raw = (product.value?.type?.value as string | undefined)?.toLowerCase()
  if (raw === 'pod') return 'pod'
  if (raw === 'gift-card' || raw === 'giftcard') return 'gift-card'
  if (raw === 'apparel') return 'apparel'
  return isCustomizable.value && printLocations.value.length ? 'pod' : 'apparel'
})

const isPOD = computed(() => productType.value === 'pod')
const isApparel = computed(() => productType.value === 'apparel')
const isGiftCard = computed(() => productType.value === 'gift-card')

// POD product that was typed 'pod' upstream but the merchant hasn't seeded
// any print_locations metadata yet. Without this discriminator the
// customisation step silently disappears (`v-if="isPOD && printLocations.length"`
// drops to false), leaving the user staring at MOQ/e-proof copy with no
// upload affordance to act on. We surface an "email artwork brief" CTA
// instead so the page narrates the gap rather than hiding it.
//
// Explicitly excludes the `is_customizable=false` case, that path already
// has its own "not customisable" hint card and shouldn't be hijacked by
// the email-artwork CTA (the merchant has actively flagged the SKU as
// not customisable, so prompting for artwork would mislead the buyer).
const isPODWithoutLocations = computed(
  () => isPOD.value && isCustomizable.value && printLocations.value.length === 0,
)

/**
 * Can THIS product actually be customised, regardless of its Medusa type?
 *
 * Print on demand is a production method, not a product category, and
 * `product.type.value` was never the capability field. Measured live across
 * all 26 products:
 *
 *   is_customizable && print_locations > 0   22   can be customised
 *   is_customizable === false                 2   stickers, buy as-is only
 *   is_customizable && print_locations == 0   1   no published zones
 *   type.value === 'pod'                      5   includes 2 that cannot be
 *                                                 customised and 1 fixture
 *
 * So `type` both excludes 20 products that carry real print zones and
 * includes 3 that cannot use them. All 20 apparel products have populated
 * `print_locations`, `moq` and `quantity_tiers`: workshop-tote carries 2
 * zones at moq 15, studio-tee-charcoal 2 zones at moq 25 with a 7 step
 * ladder. That data is intentional, not stale, per the seed manifest in
 * ghostmark/src/scripts/seed-commerce-mode.ts.
 *
 * NOT WIRED YET. NOTHING GATES ON THIS. It is kept because the measurement
 * above is correct and is the target state, but it was wired to the design
 * editor's `v-if` for about an hour and had to be reverted, and the reason is
 * worth writing down so nobody re-lands the same half-migration.
 *
 * I assumed opening the editor was the safe half, because it writes a design
 * payload rather than a price. That was wrong. FOUR systems key off `isPOD`
 * and they must move together or not at all:
 *
 *   1. `needsDesign` at the add-to-cart handler, `isPOD && printLocations`.
 *      The ENTIRE design payload path lives inside it: collectDesignPayload(),
 *      /api/custom-cart, design_data, preview_url. With only the editor
 *      moved, an apparel customer uploads artwork, sees a preview, clicks add
 *      to cart, and a bare line item is posted with NO design. Measured at the
 *      network layer: apparel sent {variant_id, quantity:1} and nothing else,
 *      while cable-organiser sent design_data with the same actions. Silent
 *      loss of customer-supplied content, and they are charged for a plain
 *      garment. The comment 25 lines below that handler calls this "the exact
 *      failure this refactor exists to remove", and its loud refusal only
 *      fires INSIDE needsDesign, so apparel never reaches it.
 *   2. `stepNumber()`, whose ladder is built gated on `isPOD`, so 'customise'
 *      is never pushed for apparel and indexOf returns -1. The heading
 *      rendered "0. Upload your design" between steps 1 and 2.
 *   3. The MOQ / minimum / tier-ladder family. `moq` hard-returns 1 when
 *      !isPOD, so apparel showed an editor with no minimum and no ladder.
 *   4. Lead time. Apparel quotes "Dispatched in 3-5 working days", the
 *      ready-to-ship D2C estimate, on a page offering to print artwork. The
 *      same operation on cable-organiser quotes 10-15 days. That is a
 *      delivery date the business would miss on every such order.
 *
 * The pricing risk I was actually worried about did NOT materialise: the
 * GBP 875 class does not reproduce, because `moq` returns 1 before it reads
 * metadata. The real defect was the opposite of the one I guarded against.
 */
const canCustomise = computed<boolean>(
  () => isCustomizable.value && printLocations.value.length > 0,
)

// -------------------------------------------------------------------------
// THE MODE MODEL. Read this before touching any gate below.
//
// Uploading artwork and having us print it IS the product. It is not a
// separate shelf and it is not a property of `product.type.value`. Measured
// live across all 26 catalogue rows:
//
//   20 apparel  is_customizable, 1-3 print zones, moq 15-25, 4-7 tiers,
//               lead_time_days 10-20 (a PRINT lead time, not a shelf one)
//    2 pod      cable-organiser, tech-pouch: same shape, commerce_mode
//               'studio'
//    2 pod      logo-sticker-sheet, studio-sticker-pack: is_customizable
//               FALSE, buy as-is only
//    1 pod      studio-laser-coaster: customizable, zero zones (fixture)
//
// So `type === 'pod'` excluded 20 products that carry real print zones and
// included 3 that cannot use them. Gating the upload UI on it is why
// "Upload your design" was missing from every apparel page.
//
// A product is therefore in ONE OF TWO MODES, and the mode is a property of
// the ORDER, not of the product:
//
//   as-is   buy the blank object. qty 1, unit price, no minimum, no upload.
//   custom  we print your artwork on it. MOQ and the tier ladder apply, the
//           print lead time applies, and the design payload must reach the
//           cart.
//
// As-is is the default (approved decision). Attaching a design is what moves
// an order into custom mode — which is why `isCustomOrder` reads the design
// state rather than the product type.
// -------------------------------------------------------------------------

/** Seeded lane: 'shop' = D2C buy-as-is, 'studio' = made to order. */
const commerceMode = computed<string>(() =>
  String(product.value?.metadata?.commerce_mode ?? '').toLowerCase(),
)

/**
 * Declared HERE, far from the rest of the design state, on purpose.
 * `watch(moq, …, { immediate: true })` runs during setup, `moq` now reads
 * `isCustomOrder`, and `isCustomOrder` reads these. Left at their natural
 * home ~900 lines below they would be in the temporal dead zone and the
 * page would die on first paint with a ReferenceError.
 */
const anyDesignUploaded = ref(false)
const savedDraft = ref<DesignDraft | null>(null)
const hasSavedDesign = computed<boolean>(() => !!savedDraft.value?.commit)

/** Artwork is attached, from the inline editor or a saved draft. */
const hasDesign = computed<boolean>(() => anyDesignUploaded.value || hasSavedDesign.value)

/**
 * This product cannot be bought blank: the studio lane is made-to-order.
 * Only `commerce_mode === 'studio'` (cable-organiser, tech-pouch). Apparel
 * is `shop`, so its upload is an OFFER, never a toll gate — that is the
 * difference between adding the flow and breaking the buy-as-is path.
 */
const requiresDesign = computed<boolean>(() => canCustomise.value && commerceMode.value === 'studio')

/**
 * This ORDER is a print order. Drives every commercial consequence: MOQ,
 * the tier ladder, the quantity card, the print lead time and the payload
 * route at add-to-cart. Deliberately NOT `canCustomise` — an apparel buyer
 * who never uploads anything must keep their qty-1 unit price.
 */
const isCustomOrder = computed<boolean>(() => requiresDesign.value || (canCustomise.value && hasDesign.value))

/**
 * Does this page wear the print-commerce chrome — "From £X", MOQ, the tier
 * ladder, the e-proof promise, the production lead time?
 *
 * `isPOD || isCustomOrder`, and the `isPOD` half is deliberate rather than
 * lazy. Three pod-typed SKUs cannot be customised at all
 * (logo-sticker-sheet and studio-sticker-pack are is_customizable=false,
 * studio-laser-coaster has zero zones) and on a pure capability rule they
 * would silently lose the chrome they ship with today. That is not what was
 * asked for and it is not this change's business: the ask was to give
 * apparel the upload flow it should always have had, not to restyle three
 * sticker pages on the way past.
 *
 * So: pod-typed products keep exactly the chrome they have. Apparel gains it
 * the moment its order becomes a print order. Nothing regresses.
 */
const showsPrintCommerce = computed<boolean>(() => isPOD.value || isCustomOrder.value)

// Cheapest variant price across the product's catalogued variants. Used by
// the gift-card "From £X" label (denomination variants ARE the offering),
// independent of which variant the v-model has selected.
const minVariantPrice = computed<number | null>(() => {
  const prices = (variants.value || [])
    .map((v) => v?.calculated_price?.calculated_amount ?? v?.prices?.[0]?.amount ?? null)
    .filter((n): n is number => typeof n === 'number')
  return prices.length ? Math.min(...prices) : null
})

// techniques, empty array if the merchant hasn't set any. DesignEditor
// hides the pill row when this is empty.
const techniques = computed<Technique[]>(() => parseTechniques(product.value))

// quantity_tiers, sorted ascending by `quantity`. Empty array means
// "no tier ladder, flat price." We keep the shape strict (integer qty,
// 2dp price) and discard malformed rows silently.
//
// ⚠️ MONEY ROUNDING: ROUND TO 2dp, NEVER TO WHOLE UNITS.
//
// `unit_amount` used to hold minor-unit INTEGERS (2944 = £29.44), where
// `Math.round(u)` was a harmless no-op. The tier migration moved this
// metadata to MAJOR units (29.44), and that same `Math.round(u)` then
// rounded to the whole POUND: £29.44 rendered as £29.00, and 250 x £24.96
// rendered as 250 x £25.00 = £6,250.00 against a cart that charges
// £6,240.00. A £10 gap quoted on the button the customer presses, under a
// "Save 22%" badge.
//
// `Math.round(u * 100) / 100` is correct under BOTH conventions: it is a
// no-op on legacy integers and preserves pence on major units, which is
// why it is the right default here regardless of which convention a given
// environment's data happens to be in.
//
// This is the FOURTH instance of Math.round() applied at the wrong
// magnitude in this repo (see scratchpad/coord/BACKEND.md). The tell is
// always the same: a round() written when the value was a minor-unit
// integer, surviving into a world where it is major. It typechecks
// perfectly every time. Do not reintroduce it.
//
// NOTE: the Math.round in `savePct` further down IS correct, rounding a
// percentage to whole percent is intended. Do not "fix" that one.
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
      return { quantity: Math.floor(q), unit_amount: Math.round(u * 100) / 100 }
    })
    .filter((t): t is QuantityTier => t !== null)
    .sort((a, b) => a.quantity - b.quantity)
})

// MOQ: a minimum order quantity is a POD (B2B print-on-demand) concept only.
//
// Why the type gate is load-bearing, not defensive:
//   20 of the 26 catalogue products are typed `apparel` yet still carry
//   `metadata.moq` (and `print_locations`) left over from an earlier seed.
//   Reading that metadata unconditionally made the apparel branch open at
//   qty 25, a £35 tee presented a £875.00 total, with the decrement button
//   enabled but inert because every clamp site (`watchEffect`, `enforceMoq`,
//   `decrementQty`) pushed the value straight back up to 25. The apparel ATC
//   card's own comment already asserts "MOQ is hard-coded to 1"; it was the
//   only place that believed it.
//
//   The stale metadata is a catalogue data problem and is deliberately NOT
//   fixed here. Instead we branch on the resolved product type, which is the
//   project's stated convention: decide on `product.type.value`, never on a
//   metadata heuristic. That keeps this correct whether or not the catalogue
//   is ever cleaned up.
//
// For POD: explicit metadata first, otherwise the smallest tier qty,
// otherwise 1. For apparel / gift cards: always 1.
/**
 * The minimum that applies WHEN THIS PRODUCT IS PRINTED, whatever mode the
 * order is in right now. Kept separate from `moq` so the customise step can
 * state its terms BEFORE the customer uploads: discovering a minimum of 25
 * after you have attached artwork is the same defect as not stating it at
 * all, just later and more annoying.
 */
const printMoq = computed<number>(() => {
  const raw = product.value?.metadata?.moq
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (Number.isFinite(n) && n > 0) return Math.floor(n)
  if (quantityTiers.value[0]) return quantityTiers.value[0].quantity
  return 1
})

// Mode, not type: a minimum is a consequence of printing, so it binds a
// custom ORDER. An apparel buyer taking the blank still buys one.
const moq = computed<number>(() => (showsPrintCommerce.value ? printMoq.value : 1))

// "Is this product subject to a minimum the buyer needs to know about?"
//
// The single predicate that gates EVERY minimum-order disclosure on this page:
// the meta row under the title, the caption in both quantity cards, the
// "Minimum n" beside both steppers, the mobile sticky bar's summary row, and
// the `aria-describedby` on every clamped decrement button.
//
// It is deliberately derived from `moq` and nothing else. The previous pass
// fixed the *enforcement* half of this bug (gating `moq` on `isPOD` so a
// £35 tee stopped opening at qty 25 and quoting £875) but left the
// *disclosure* half hanging off `v-if="isPOD"` blocks in two separate places.
// Those are different conditions, and a product whose type resolves
// unexpectedly (a legacy SKU with no `type` falling through the
// `isCustomizable && printLocations.length` fallback, say) could satisfy one
// and not the other. That gap is the whole defect: silently clamped, never
// told. Disclosure and clamp must read the same ref or they will drift again.
const hasMinimum = computed<boolean>(() => moq.value > 1)

// "Should the page STATE a minimum, whether or not there is one to enforce?"
//
// Deliberately broader than `hasMinimum`, and the distinction is real:
//
//   hasMinimum:       a floor exists. Drives the CONSTRAINT affordances: the
//                     "Minimum n" beside each stepper, the `aria-describedby`
//                     on a decrement that is disabled because of it, the
//                     mobile sticky bar's floor note. Rendering those at a
//                     floor of 1 would explain a rule that isn't limiting
//                     anybody.
//   showsMinimumFact: the minimum is part of how this product is described.
//                     Drives the FACT: the meta row under the H1 and the
//                     caption at the top of the quantity card.
//
// A bulk buyer on a POD SKU is scanning for the minimum whether or not there
// is one, "MOQ 1" answers the question rather than leaving them to infer an
// absence from silence, and several POD SKUs in the catalogue genuinely have
// no minimum (studio-sticker-pack, logo-sticker-sheet). The POD e2e contract
// asserts /MOQ \d+/ against the meta row for exactly that reason.
//
// On apparel this collapses to `hasMinimum`, which is 1, which is nothing,
// which is what the PLP contract asserts and what a D2C buyer should see.
const showsMinimumFact = computed<boolean>(() => hasMinimum.value || showsPrintCommerce.value)

// lead_time_days, accept the {min, max} shape per the contract; fall back
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

/**
 * The terms of a PRINT order, stated on the customise step itself.
 *
 * As-is is the default, so the page's headline dispatch estimate is the
 * ready-to-ship one ("Dispatched in 3-5 working days") and that is true of
 * the blank object sitting in the buy box. It is NOT true of a printed run,
 * which is 10-20 days and carries a minimum. A page that offers to print
 * your artwork while showing only the shelf estimate is quoting a date the
 * business misses on every such order — so the printed terms are stated
 * where the offer is made, before any artwork is attached.
 */
const customTerms = computed<string>(() => {
  if (!canCustomise.value) return ''
  const parts = ['Printed to order', `~${leadTime.value} working days`]
  if (printMoq.value > 1) parts.push(`minimum ${printMoq.value}`)
  return parts.join(' · ')
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
  // Customise step belongs to POD only, apparel + gift-card skip upload
  // entirely. Count the step for BOTH the full-editor branch AND the
  // "no print zones seeded" affordance, so a POD product without
  // locations still gets a numbered Step 2 heading on its email-artwork
  // card. Non-customisable PODs (where the merchant has explicitly opted
  // out of artwork upload) skip the slot, the "not customisable" hint
  // renders without a step heading, and quantity stays at Step 2.
  // Capability, not type. Every product with real print zones gets a
  // numbered customise step, which is what stops the heading rendering
  // "0. Upload your design" — indexOf returns -1 when the step is absent
  // from the ladder but present in the template.
  if (canCustomise.value || isPODWithoutLocations.value) {
    order.push('customise')
  }
  order.push('quantity')
  return order.indexOf(name) + 1
}

// NOTE: `onDesignAdded` is gone. It was the handler for DesignEditor's
// `added` event and it took `{ previewUrl, cartId }` (the only two facts
// that could have proved a design was attached) and discarded both, flashing
// a generic "Added to cart!" for three seconds. The editor no longer adds
// anything to the cart (see COMMIT OWNERSHIP in DesignEditor.vue) and the
// attached state is now a first-class thing this page renders, not a
// transient toast: see `attachedDesigns` / `attachedDesignSummary` below.

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
// commerce inclusivity guidance) is to surface this axis as "Fit": the cut/
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
// Any tab idling on the PDP would pump the URL, `selectedOptions` is a
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

// Thin adapter over the shared helper so the ~20 template call sites keep
// their positional `formatMoney(amount)` shape. Amounts are Medusa v2 major
// units and are NOT scaled here.
const formatMoney = (amount: number | null | undefined) =>
  formatMoneyShared({ amount, currency_code: currencyCode.value })

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
    return quantityTiers.value.map((t) => ({ qty: t.quantity, unitAmount: t.unit_amount }))
  }

  // No metadata tiers, render a single virtual tier so the qty stepper
  // and total-line keep working. This is the legacy/unmigrated path.
  return [{ qty: moq.value, unitAmount: base }]
})

// "From £X / piece": the cheapest entry price visible above the fold.
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

// Apparel D2C: price the *currently selected* variant at its calculated
// per-unit amount, no tier discount, no MOQ multiplier. Falls through
// to the first variant's amount when nothing is selected yet (initial
// SSR paint before the v-model resolves).
const unitPrice = computed<number | null>(() => {
  const v = selectedVariant.value ?? variants.value?.[0]
  const amt = v?.calculated_price?.calculated_amount ?? v?.prices?.[0]?.amount
  return typeof amt === 'number' ? amt : null
})

// -------------------------------------------------------------------------
// Meta row facts: the strip of plain attributes under the H1.
//
// Modelled on Faire, which renders a wholesale minimum in the same
// typographic slot as the rating ("★4.8  $100 min") rather than in an alert.
// The minimum is a property of the product, like its price or its lead time;
// dressing it as a warning implies the buyer has done something wrong by
// arriving, and buries the one number a bulk buyer most needs to plan around.
//
// Each fact is independently derived, which is the structural fix. The old
// markup was one `v-if="isPOD && fromPrice !== null"` wrapping all three, so
// a null price took the MOQ disclosure down with it. Now a product can state
// its minimum with no price resolved, or its price with no minimum, and the
// separator logic follows from the array rather than from hand-placed
// middle dots between fixed spans.
//
// Order is deliberate: price (what it costs), then minimum (what you must
// commit to), then the e-proof promise (what reassures you). The e2e POD
// contract asserts all four phrases against `[data-test="from-price"]`.
// -------------------------------------------------------------------------
interface MetaFact { key: string; text: string }

const metaFacts = computed<MetaFact[]>(() => {
  const out: MetaFact[] = []
  // Bulk entry price. POD-only: an apparel SKU shows its exact unit price in
  // the dedicated price line below, and a second "From" would read as a
  // range that doesn't exist.
  if (showsPrintCommerce.value && fromPrice.value !== null) {
    out.push({ key: 'from-price', text: formatMoney(fromPrice.value) })
  }
  // Minimum, driven by `moq`, NOT by a type branch. See `showsMinimumFact`.
  if (showsMinimumFact.value) {
    out.push({ key: 'moq', text: `MOQ ${moq.value}` })
  }
  // E-proof is a genuine POD-flow promise (we mock the artwork before
  // production); it has no meaning on a buy-as-is SKU.
  if (showsPrintCommerce.value) {
    out.push({ key: 'eproof', text: 'E-proof in 48h' })
  }
  return out
})

const qty = ref<number>(1)

// -------------------------------------------------------------------------
// Quantity notice: say what you did to the buyer's number.
//
// The clamp below is not new; the sentence is. Previously every correction
// was silent: type 5 against a minimum of 25 and the field simply became 25
// on blur, with nothing on the page acknowledging that a value the buyer
// deliberately entered had been overwritten. Silent correction is the same
// failure as silent enforcement, the system knows a rule the buyer doesn't,
// and only ever reveals it by acting.
//
// Rendered into a polite live region under each stepper. Cleared as soon as
// the buyer enters a legal value, so it never becomes permanent chrome.
// -------------------------------------------------------------------------
const qtyNotice = ref<string>('')

// The seeding clamp. Watches `moq`, NOT `qty`.
//
// This was `watchEffect(() => { if (qty < moq) qty = moq })`, which reads
// both refs and therefore re-ran on every keystroke: type "5" into a
// 25-minimum field and `qty` was rewritten to 25 between the `input` event
// and the `blur`, so `enforceMoq` never saw the 5 and had nothing to report.
// The clamp was so eager it hid its own existence, you could not even
// observe the rule being applied, which is the purest form of the defect
// this section is about. (It also made the digit you were mid-way through
// typing jump under the cursor.)
//
// Seeding on `moq` alone still covers every case that needs a silent clamp:
// first paint, a region flip, and a variant swap on a product whose tiers
// differ. Human-entered values are now corrected on blur by `enforceMoq`,
// which narrates, and `onAddToCart` calls it defensively before committing
// so a value that never lost focus can't reach the cart below the minimum.
watch(
  moq,
  (next) => { if (qty.value < next) qty.value = next },
  { immediate: true },
)

const enforceMoq = () => {
  const entered = qty.value
  if (!Number.isFinite(entered) || entered < moq.value) {
    qty.value = moq.value
    // Distinguish "you left it blank" from "you asked for fewer than we can
    // print": they are different mistakes and only one of them needs the
    // minimum explained.
    qtyNotice.value = Number.isFinite(entered)
      ? `Minimum order is ${moq.value}. Quantity set to ${moq.value}.`
      : `Quantity reset to ${moq.value}.`
    return
  }
  qtyNotice.value = ''
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

// -------------------------------------------------------------------------
// ONE pricing function. `priceAt(q)` is the only place on this page that
// turns a quantity into money.
//
// It replaces a two-derivation arrangement that could not help but drift:
// a `role="radiogroup"` tier ladder printed `metadata.quantity_tiers[].
// unit_amount` and a percentage but never a total, while a separate card
// multiplied a differently-derived `effectiveUnit` by `qty`. Picking
// "250 pieces · Save 22%" quoted one number and the cart charged another,
// and nothing in the code made the two agree. Now the <select> options, the
// closed control, the Total figure, the sticky bar and the add-to-cart
// label all call this function, so a quoted number and a charged number
// cannot diverge by construction.
//
// ⚠️ GATE: THE PRICES THIS RETURNS ARE NOT YET THE PRICES THE CART CHARGES.
//
//   Two migrations must run before this control is truthful:
//     1. the quantity-tier migration, which writes `price.min_quantity` /
//        `max_quantity` rows that agree with `metadata.quantity_tiers`;
//     2. `ghostmark/src/scripts/migrate-price-units.ts --apply`, the 100x
//        major-units fix described at the top of `~/utils/money.ts`.
//
//   Until (1) runs, Medusa resolves a tiered line item off the flat variant
//   price, so the total in the dropdown is quoted-but-not-honoured, the
//   same gap that existed before this change, now in a MORE prominent
//   place. Until (2) runs every figure renders 100x high. Neither is a
//   storefront bug and neither can be fixed here.
//
//   Nothing is needed on the add-to-cart side: Medusa's cart injects the
//   line quantity into the pricing context (core-flows
//   get-variants-and-items-with-prices) and the pricing repository filters
//   on min_quantity <= quantity <= max_quantity, so today's plain
//   `{ variant_id, quantity }` payload resolves the tier by itself once the
//   rows exist. The PDP does NOT get this for free, Store product routes
//   build a pricing context of `{ region_id, currency_code }` only, with no
//   `quantity` param, so `calculated_amount` is always the qty-1 price and
//   the per-option maths below must stay client-side.
// -------------------------------------------------------------------------

// Baseline the saving is measured against: the variant's own single-unit
// price. NOT the first tier, and not the previous tier.
//
// The cart's `original_amount` on a tiered line equals the tier price, so
// the server provides no "was £32.00" to hang a Save % on, it has to be
// computed here. Measuring against the previous tier would make every row
// claim a small saving relative to the row above it, which overstates the
// ladder; measuring against the single-unit price answers the question the
// buyer is actually asking ("what does ordering in volume save me?").
// Falls back to the cheapest tier when a variant carries no price, which
// yields 0% on the entry row rather than a fabricated discount.
const baselineUnit = computed<number>(() => {
  const base = selectedVariant.value?.calculated_price?.calculated_amount
    ?? selectedVariant.value?.prices?.[0]?.amount
  if (typeof base === 'number' && Number.isFinite(base) && base > 0) return base
  return tiers.value[0]?.unitAmount ?? 0
})

interface QuantityQuote {
  qty: number
  unitAmount: number
  total: number
  /** Quantity of the tier that applies at this qty (for the "100+ tier" note). */
  tierQty: number
  /** Saving vs `baselineUnit`, whole percent. 0 when there is none. */
  savePct: number
}

const priceAt = (q: number): QuantityQuote => {
  const rows = tiers.value
  // Largest tier whose threshold this quantity has reached; below the first
  // threshold the first tier still applies (the MOQ clamp keeps us at or
  // above it anyway, and quoting nothing would be worse than quoting entry).
  let row = rows[0]
  for (const t of rows) if (q >= t.qty) row = t

  // Apparel: per-unit amount comes straight from the selected variant,
  // tier discounts only apply to POD (B2B bulk pricing). Without this
  // branch, an apparel product with zero tiers would still read
  // `tiers[0].unitAmount` (which falls back to the first variant's
  // calculated amount), correct numerically but semantically misleading.
  const unitAmount = isApparel.value
    ? (unitPrice.value ?? 0)
    : (row?.unitAmount ?? 0)

  const base = baselineUnit.value
  const savePct = base > 0 && unitAmount > 0 && unitAmount < base
    ? Math.round(((base - unitAmount) / base) * 100)
    : 0

  return { qty: q, unitAmount, total: unitAmount * q, tierQty: row?.qty ?? q, savePct }
}

const currentQuote = computed<QuantityQuote>(() => priceAt(qty.value))
const effectiveUnit = computed(() => currentQuote.value.unitAmount)
const effectiveTotal = computed(() => currentQuote.value.total)

// -------------------------------------------------------------------------
// The Faire-pattern quantity <select>.
//
// Faire has no tier ladder: the ladder IS the quantity picker, so there is
// no second surface where a quoted price can drift from a charged one, and
// no sub-minimum value to fall into because illegal quantities simply are
// not in the list. Verified on Mobbin, Faire's control reads "Item
// Quantity" with "Case of 12" right-aligned on the same line, and expands to
// `12 ($180.00)` / `60 ($900.00)` / … / `Custom Quantity` last.
//
// Two deliberate departures from Faire:
//
//   1. Faire's rows carry quantity and TOTAL only, because its constraint is
//      a case multiple at a constant unit price. Ours is a volume-discount
//      ladder where the unit price is the thing that changes, so each row
//      must carry the unit price too or the ladder stops being legible as a
//      ladder. Instacart's size picker does the same (8 oz / $5.19 /
//      $0.65/oz), three facts, one tile.
//
//   2. Faire's "Custom Quantity" swaps the select for a bare input and
//      strands you there with no way back to the list. Ours keeps a
//      "Choose a set quantity" control and prints the applicable tier
//      inline, so a custom value is never a blind spot.
//
// It is a NATIVE <select> on purpose. It buys keyboard interaction,
// typeahead, screen-reader semantics and the platform picker on touch for
// free, and on mobile the platform picker sidesteps the overlapping
// touch-target question that a stack of custom option rows would raise. A
// custom listbox would have to re-implement `aria-activedescendant`, roving
// focus and a focus trap to reach parity, and would buy only the ability to
// right-align a "Save %" column. That is not a good trade, so the saving
// rides in the option string instead.
// -------------------------------------------------------------------------

// Only when there is a genuine ladder to enumerate. With 0 or 1 tier there
// is nothing to pick from and the flat price + stepper below is the honest
// control.
//
// CORRECTED 2026-08-31. This said "no product in the catalogue carries
// `metadata.quantity_tiers`, so this is false everywhere". Measured against
// :9000: 22 of 26 products carry one. This computed is TRUE today on
// cable-organiser and tech-pouch.
//
// AND THE GAP IS THE INTERESTING PART, for whoever does the capability
// migration. TWENTY apparel products carry a real tier ladder, 4 to 7 rows
// each, and every one of them is gated off here by `isPOD`, which reads
// `product.type.value`. So the ladder data exists and is deliberately not
// surfaced for them, exactly as `resolveCardCommerce` scopes apparel's `moq`
// to the studio lane rather than the buy-as-is lane. If the gate ever moves
// from TYPE to CAPABILITY, this line surfaces a priced ladder on 20 products
// at once. That is a pricing change, not a rendering change. Do not flip it
// on its own.
const usesQuantitySelect = computed<boolean>(() => showsPrintCommerce.value && tiers.value.length >= 2)

const tierQtys = computed<number[]>(() => tiers.value.map((t) => t.qty))

// Below `sm` the option string physically cannot carry four tokens.
//
// Measured in situ, not estimated: at a 390 viewport the closed control is
// 279px wide and offers 225px of text box after padding, at 500 14px Inter
// Tight. The full row measures 305px POST-migration (`250 pieces ·
// £24.96/piece · £6,240.00 · Save 22%`) and 342px at today's 100x figures.
// A native <option> cannot wrap or ellipsise gracefully, it just truncates,
// and the token it truncates is the TOTAL, which is the one the buyer came
// for. So the row sheds tokens rather than losing the end of the line:
//
//   >= 640   250 pieces · £24.96/piece · £6,240.00 · Save 22%     (305px)
//   <  640   250 · £24.96/piece · £6,240.00                       (~190px)
//
// Quantity, unit price and total (the three facts that make this a ladder)
// survive at every width. Only the word "pieces" and the derived Save % are
// dropped, and the saving reappears on the quote line under the control,
// which is a <p> and wraps. See `showsQuoteLine`.
//
// SSR renders the wide label and `onMounted` flips narrow clients, so the
// first client render matches the server and the swap is an ordinary
// reactive update rather than a hydration mismatch.
const compactOptions = ref(false)
onMounted(() => {
  const mq = window.matchMedia('(max-width: 639px)')
  const apply = () => { compactOptions.value = mq.matches }
  apply()
  mq.addEventListener('change', apply)
  onUnmounted(() => mq.removeEventListener('change', apply))
})

/** One option row / the closed control's text. Same function as the total. */
const quantityOptionLabel = (q: number): string => {
  const p = priceAt(q)
  const parts = compactOptions.value
    ? [String(q), `${formatMoney(p.unitAmount)}/piece`, formatMoney(p.total)]
    : [
        `${q} ${q === 1 ? 'piece' : 'pieces'}`,
        `${formatMoney(p.unitAmount)}/piece`,
        formatMoney(p.total),
      ]
  if (p.savePct > 0 && !compactOptions.value) parts.push(`Save ${p.savePct}%`)
  return parts.join(' \u00b7 ')
}

// Custom mode: the escape hatch for a quantity between tiers. Naming the
// tier that applies is what stops it being ambiguous, "137 pieces" alone
// leaves the buyer to work out which price band they landed in.
const customQtyMode = ref(false)
const customQtyInput = ref<HTMLInputElement | null>(null)

// The line under the control. It renders exactly when the option row could
// not say everything: in custom mode (where the applicable tier is the whole
// question) and at compact widths (where the saving was dropped). On a wide
// viewport with a tier selected the option already reads as this line does,
// so showing both would be the duplication this change exists to remove.
const showsQuoteLine = computed<boolean>(() => customQtyMode.value || compactOptions.value)

const quoteLine = computed<string>(() => {
  const p = currentQuote.value
  const tierNote = tiers.value.length >= 2 ? ` (${p.tierQty}+ tier)` : ''
  const parts = [
    `${p.qty} ${p.qty === 1 ? 'piece' : 'pieces'}`,
    `${formatMoney(p.unitAmount)}/piece${tierNote}`,
    formatMoney(p.total),
  ]
  if (p.savePct > 0) parts.push(`Save ${p.savePct}%`)
  return parts.join(' \u00b7 ')
})

// A quantity that is not exactly on a tier IS a custom quantity, however the
// buyer got there (the sticky-bar stepper, a restored value, `enforceMoq`).
// Deriving the control's value rather than storing it keeps the select from
// ever displaying a row the quantity is not actually on.
const qtySelectValue = computed<string>({
  get: () => (customQtyMode.value || !tierQtys.value.includes(qty.value))
    ? 'custom'
    : String(qty.value),
  set: (v) => {
    if (v === 'custom') {
      customQtyMode.value = true
      // Move focus to the field that replaced the control the buyer just
      // used, or a keyboard user is left on a node that no longer exists.
      nextTick(() => customQtyInput.value?.focus())
      return
    }
    customQtyMode.value = false
    const n = Number(v)
    if (Number.isFinite(n) && n > 0) {
      qty.value = n
      // The option said what it costs; nothing left to narrate.
      qtyNotice.value = ''
    }
  },
})

// Back to the list. Snaps to the tier the custom value was sitting in rather
// than to the minimum, so returning never silently makes the order smaller.
const exitCustomQty = () => {
  customQtyMode.value = false
  if (!tierQtys.value.includes(qty.value)) {
    qty.value = currentQuote.value.tierQty || moq.value
  }
}

// Tier-boundary crossing, announced into the same polite region the
// minimum-clamp uses. It can now quote the unit price, which the previous
// version deliberately refused to do because the only unit price on the page
// was known to be wrong, `priceAt` is the same function the control renders,
// so there is no second number to get out of step.
//
// Silent in select mode: picking "100 pieces · £27.20/piece · £2,720.00" is
// self-announcing, and re-reading it into a live region is just noise. Fires
// only when the buyer typed their way across a boundary.
watch(activeTierIndex, (next, prev) => {
  if (next === prev) return
  if (tiers.value.length < 2) return
  if (usesQuantitySelect.value && !customQtyMode.value) return
  const tier = tiers.value[next]
  if (!tier) return
  qtyNotice.value = `Volume price for ${tier.qty}+ now applies \u2014 ${formatMoney(priceAt(qty.value).unitAmount)}/piece.`
})

// `commitStage` narrates the two genuinely distinct phases of a POD add:
// preparing the artwork (capture the Konva stage, upload the proof, wait out
// any in-flight original) and then the cart hop itself. They can total the
// better part of a second on a cold connection, and a primary CTA that says
// nothing for that long reads as broken, which is how you get a double
// click and two line items.
type CommitStage = 'idle' | 'preparing' | 'adding'
const commitStage = ref<CommitStage>('idle')
const adding = computed(() => commitStage.value !== 'idle')

const addError = ref<string | null>(null)
const addSuccess = ref(false)
const { addItem, ensureCart, cartId, refresh: refreshCart } = useCart()

// "Has the user actually placed a design on the mockup yet?"
//
// Originally this was `livePreviewUrl !== null`, wrong. DesignEditor's
// Konva stage is capturable as soon as the bare product mockup is loaded,
// so `live-preview` fires with a non-null dataUrl on init. The ATC gate
// silently no-op'd because the proxy was already truthy.
//
// Now driven by the strict `uploaded-state-change` event, which mirrors
// the editor's internal `anyUploaded` computed (true iff at least one
// location has a real uploaded image). `livePreviewUrl` stays untouched,
// it's still the source for the LEFT pane mirror.
interface AttachedDesign { key: string; label: string; filename: string | null }

const attachedDesigns = ref<AttachedDesign[]>([])

const onDesignUploadedStateChange = (
  payload: { anyUploaded: boolean; attached: AttachedDesign[] },
) => {
  anyDesignUploaded.value = payload.anyUploaded
  attachedDesigns.value = payload.attached ?? []
  // A fresh upload invalidates the "upload a design first" refusal the buyer
  // is looking at. Leaving it on screen next to a now-satisfied requirement
  // is how error copy stops being believed.
  if (payload.anyUploaded && addError.value) addError.value = null
}

// One-line summary of what is attached, for the confirmation strip.
//
//   one zone, named file   → "Front · logo.png"
//   one zone, no file name → "Front"
//   two or more zones      → "Front, Back · 2 files"
//
// The zone always leads, because "which side is my logo on" is the question
// a buyer actually re-checks; the filename is corroboration.
const attachedDesignSummary = computed<string>(() => {
  const list = attachedDesigns.value
  if (!list.length) return ''
  const zones = list.map((d) => d.label).join(', ')
  if (list.length === 1) {
    return list[0]!.filename ? `${zones} · ${list[0]!.filename}` : zones
  }
  return `${zones} · ${list.length} files`
})

// Polite announcement text. Held in its own ref rather than derived from
// `attachedDesigns` so that removing a design can say "removed", a computed
// over an empty list could only ever say nothing, which is precisely the
// silence this round is removing.
const designAnnouncement = ref<string>('')
watch(anyDesignUploaded, (attached, wasAttached) => {
  if (attached === wasAttached) return
  designAnnouncement.value = attached
    ? `Design attached to ${attachedDesignSummary.value || 'your product'}.`
    : 'Design removed.'
})

// Mobile-only upload trigger. The actual <input type="file"> lives inside
// DesignEditor's helper panel, which on PDP mobile is rendered inside a
// `transform: scale(0.55)` wrapper, making any visible button there fail
// the 44pt touch-target minimum. We render a native-size button OUTSIDE
// the scale wrapper (see template) and forward the click to the underlying
// file input. CSS transforms do not affect programmatic .click().
//
// We drive the picker through the typed component ref instead of a brittle
// DOM query: DesignEditor exposes `openFilePicker()` via defineExpose, so
// the call is type-checked and survives any future markup refactor inside
// the editor. The ref resolves through <ClientOnly> because defineExpose
// surfaces the method on the resolved instance regardless of the wrapper.
//
// The exposed surface has grown to three methods (see the matching
// defineExpose in DesignEditor.vue): the picker, the payload collector that
// makes the single add-to-cart able to carry artwork, and a whole-line
// remove for the confirmation strip.
interface DesignEditorApi {
  openFilePicker: () => void
  collectDesignPayload: () => Promise<
    | { ok: true; payload: { design_data: Record<string, unknown>; preview_url: string } }
    | { ok: false; error: string }
  >
  removeAllDesigns: () => void
}
const designEditorRef = ref<DesignEditorApi | null>(null)

// -------------------------------------------------------------------------
// SAVED DESIGN DRAFTS (from the dedicated surface at /design/[handle]).
//
// A draft is the OUTPUT of pressing "Save design" over there: it carries the
// already-collected commit payload, proof PNG included. So when one exists,
// this page does not need a mounted Konva stage to add the artwork to the
// cart, it posts what the surface already prepared. That is the whole
// save/commit split: SAVE happens on the surface, COMMIT happens here, and
// neither one does the other's job.
//
// PRECEDENCE: a saved draft beats the inline editor, totally. The template
// renders the strip INSTEAD of the editor and `onAddToCart` reads the same
// flag, so the thing the customer is looking at is always the thing the
// button will commit.
// -------------------------------------------------------------------------
const designDrafts = useDesignDrafts()

// Read on the client only, after mount: sessionStorage does not exist during
// SSR, and reading it in setup would render "no design" on the server and
// "design saved" on the client, i.e. a hydration mismatch on a commit path.
onMounted(() => {
  const id = product.value?.id
  if (id) savedDraft.value = designDrafts.hydrate(id)
})
watch(() => product.value?.id, (id) => {
  if (id) savedDraft.value = designDrafts.hydrate(id)
})
// Keep in step if the surface saves while this page is alive in the same SPA
// session (back/forward navigation does not remount the page in every case).
watch(() => (product.value?.id ? designDrafts.drafts.value[product.value.id] : null), (d) => {
  savedDraft.value = d ?? null
})

const designSurfaceUrl = computed<string>(() => {
  const base = `/design/${handle.value}`
  return finalVariantId.value
    ? `${base}?variant=${encodeURIComponent(finalVariantId.value)}`
    : base
})

// Names the zones the saved draft actually covers. Uses the merchant's labels,
// not the raw keys, for the same reason `activeLabel` does inside the editor.
const savedDesignSummary = computed<string>(() => {
  const slots = savedDraft.value?.slots ?? {}
  const labels = Object.keys(slots)
    .filter((k) => slots[k])
    .map((k) => printLocations.value.find((l) => l.key === k)?.label ?? k)
  if (!labels.length) return 'Ready to add to your cart'
  return `${labels.join(' and ')} · ready to add to your cart`
})

const onRemoveSavedDesign = () => {
  const id = product.value?.id
  if (!id) return
  designDrafts.clear(id)
  savedDraft.value = null
}


function onMobileUploadClick() {
  designEditorRef.value?.openFilePicker()
}

// Bring the customisation card back into view. Used by the "Edit design"
// affordance in both sticky bars, the one place where a jump-back genuinely
// helps, because the buyer is somewhere else on a long page. (The
// confirmation strip inside the card itself has Replace/Remove instead; a
// button that scrolls you to the element you are already looking at is
// theatre, not an affordance.)
const scrollToEditor = () => {
  if (!import.meta.client) return
  document
    .querySelector('[data-test="design-editor-section"]')
    ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

const onReplaceDesign = () => {
  designEditorRef.value?.openFilePicker()
}

const onRemoveDesign = () => {
  // Whole-line remove, not active-zone remove, see `removeAllDesigns` in
  // DesignEditor.vue for why the confirmation strip must clear everything it
  // claims to represent.
  designEditorRef.value?.removeAllDesigns()
}

// -------------------------------------------------------------------------
// Commit labels.
//
// Reference: Blue Apron's configurator ends in ONE button reading
// `Add, $19.98`, sitting beside a summary of what you configured. The money
// belongs on the button because that is the number the buyer is consenting
// to; making them look elsewhere for it is a small act of concealment.
// -------------------------------------------------------------------------
// The INLINE card's button keeps the bare verb, and here is the considered
// deviation from Blue Apron: their button carries the price because their
// sticky bar has no other total on it. This card renders TOTAL at 18px
// semibold directly above/beside the button already, so putting the money in
// the label duplicates it, and at 390px the duplicated label overflowed the
// slab (the favourites button takes 56px of the 318px row) and truncated to
// "ADD TO C…", which is worse than either option. The money-on-the-button
// idea is honoured where it actually earns its place: both sticky bars,
// where the buyer has scrolled away from every other price on the page.
const commitLabel = computed<string>(() => {
  // Kept to two words. The 5.6rem/24px slab this once had to fit is gone
  // (the button is now 48px with a 14px label, matching the sticky-bar
  // mirror of the same action), but short busy copy is still correct: it
  // has to sit on one line beside the favourite button at 390px.
  if (commitStage.value === 'preparing') return 'Attaching design…'
  if (commitStage.value === 'adding') return 'Adding…'
  return 'Add to cart'
})

// The desktop sticky bar's button is narrower and already sits beside the
// total, so it keeps the bare verb, but it still needs the two-phase
// busy copy, or a POD add looks frozen from down there too.
const stickyBusyLabel = computed<string>(() =>
  commitStage.value === 'preparing' ? 'Attaching design…' : 'Adding…',
)

const addSuccessMessage = computed<string>(() =>
  anyDesignUploaded.value
    ? `Added to cart with your design, ${qty.value} ${qty.value === 1 ? 'piece' : 'pieces'}.`
    : 'Added to cart.',
)

// -------------------------------------------------------------------------
// THE commit control. One handler, one network hop, every button on the page
// routed through it.
//
// What this replaces: four commit controls, of which one (DesignEditor's
// "Add customised item") built `design_data` and POSTed it, and three
// (this handler, called from the inline CTA and both sticky bars) called
// `addItem(variantId, qty)`, variant and quantity only. Once artwork was
// uploaded, all three of those happily added a design-less line: the buyer
// positioned their logo, pressed the biggest button on the page, and the
// artwork was discarded without a word. It also meant the cart's artwork
// thumbnail and its "E-proof needed" badge were unreachable in practice,
// since only the one small button nobody presses could populate them.
//
// Now: if the product is POD and artwork is attached, we ask the editor for
// its payload and post the line item WITH it. Otherwise we take the plain
// path. The two paths differ only in which endpoint carries the line.
//
// Why /api/custom-cart rather than `addItem`: the Medusa JS SDK wrapper in
// `useCart` takes `(variantId, quantity)` and has no metadata parameter, and
// `useCart.ts` is out of scope for this change. The server route already
// exists, already attaches `designDataJson` / `previewImageUrl` /
// `isCustomized` to the line item, and now receives the real quantity
// instead of the hard-coded `quantity: 1` the editor used to send, which
// was its own quiet bug: a 25-piece MOQ order committed a single unit.
// -------------------------------------------------------------------------
const onAddToCart = async () => {
  if (!finalVariantId.value) return
  if (adding.value) return

  // Last line of defence on the quantity. The stepper corrects on blur, and
  // clicking any of these buttons blurs the field first, but a keyboard user
  // who types a value and activates the CTA with Enter never fires blur, and
  // the sticky bars' steppers can be left focused too. Run the same check
  // (and the same narration) rather than trusting focus order. If it fires,
  // `qtyNotice` explains the corrected number that is about to be committed.
  enforceMoq()

  // Block ATC when the product is POD, has print zones, and the user
  // hasn't uploaded a design. Apparel (D2C) products skip this gate
  // entirely, they never require a design upload because they're
  // sold ready-to-ship as-is. Previously the button just no-op'd
  // and the user got zero feedback, a P0 abandonment funnel.
  // `needsDesign` used to do two different jobs with one flag, and that is
  // what made the half-migration dangerous: it BLOCKED the sale when no
  // artwork was present, and it also chose the payload route that actually
  // carries the artwork. Wired to type, apparel fell out of both — so an
  // apparel customer could upload a design, see a preview, and have a bare
  // line item posted with no design at all. Measured at the network layer:
  // {variant_id, quantity} and nothing else. Silent loss of customer content,
  // and they are charged for a blank garment.
  //
  // They are two separate questions and are now asked separately:
  //   mustHaveDesign — may this order proceed without artwork?
  //   sendsDesign    — is there artwork that has to reach the cart?
  const mustHaveDesign = requiresDesign.value
  const sendsDesign = canCustomise.value && hasDesign.value

  // A saved draft satisfies the design requirement just as an inline upload
  // does. Without this the gate would refuse a customer who had just finished
  // designing on the dedicated surface, which is the exact dead-end the gate
  // exists to prevent.
  if (mustHaveDesign && !hasDesign.value) {
    addError.value = 'Upload a design before adding to cart.'
    addSuccess.value = false
    scrollToEditor()
    return
  }

  addError.value = null
  addSuccess.value = false

  try {
    if (sendsDesign) {
      commitStage.value = 'preparing'

      // TWO SOURCES, ONE SHAPE. Both branches produce the identical
      // `{ design_data, preview_url }` object, because the saved draft's
      // `commit` field IS a stored `collectDesignPayload()` result, captured
      // on the surface while its stage was mounted. Nothing downstream can
      // tell which path a line item came from, which is the point: the cart
      // route, the admin widget and the proof renderer keep reading one shape.
      let payload: { design_data: Record<string, unknown>; preview_url: string }

      if (hasSavedDesign.value && savedDraft.value?.commit) {
        payload = savedDraft.value.commit
      } else {
        const editor = designEditorRef.value
        if (!editor) {
          // The editor is inside <ClientOnly>; if the ref is missing the
          // component never mounted. Adding the line anyway would silently
          // drop the artwork (the exact failure this refactor exists to
          // remove) so refuse loudly instead.
          throw new Error('The design editor isn’t ready yet. Reload the page and try again.')
        }
        const result = await editor.collectDesignPayload()
        if (!result.ok) throw new Error(result.error)
        payload = result.payload
      }

      commitStage.value = 'adding'

      // Mint / reuse a cart through the composable first, so the line lands
      // on the SAME cart the header badge and drawer read, in the correct
      // region. The server route would happily create its own from the
      // cookie, but then the client's `cart` state would be a version behind.
      const cart = await ensureCart()

      const res = await $fetch<{
        ok: boolean
        cart_id: string | null
        _offline?: boolean
        error?: string
      }>('/api/custom-cart', {
        method: 'POST',
        body: {
          variant_id: finalVariantId.value,
          quantity: qty.value,
          cart_id: cart?.id ?? cartId.value ?? null,
          region_id: regionState.regionId.value ?? null,
          design_data: payload.design_data,
          preview_url: payload.preview_url,
        },
      })

      if (!res.ok) {
        throw new Error(
          res._offline
            ? 'We couldn’t reach the cart service. Your design is saved. Try again in a moment.'
            : res.error || 'Add to cart failed.',
        )
      }

      // The route may have minted a cart of its own (cookie-only path).
      // Adopt it before refreshing so we read back the right one.
      if (res.cart_id && res.cart_id !== cartId.value) cartId.value = res.cart_id
      await refreshCart()
    } else {
      commitStage.value = 'adding'
      await addItem(finalVariantId.value, qty.value)
    }

    addSuccess.value = true
    setTimeout(() => { addSuccess.value = false }, 4000)
  } catch (e) {
    addError.value = e instanceof Error ? e.message : 'Failed to add item.'
  } finally {
    commitStage.value = 'idle'
  }
}

const onBuySample = () => {
  // eslint-disable-next-line no-console
  console.log('TODO: sample request', product.value?.handle)
}

// --- Variant matrix (specifications accordion section) -------------------
//
// Columns are DERIVED from the product's own option axes rather than
// hard-coded to Color / Size / Gender. The hard-coded version rendered a
// four-column table on a product that has one axis: 24 of the 26 catalogue
// products carry nothing but `Size`, so every row read
// "–  Standard  –  £32.00" and two of the four columns were placeholder
// dashes. A dash is a statement that a value is missing; on those
// products nothing was missing, the table was asking the wrong questions.
//
// Titles run through `displayOptionTitle` so the header says "Fit" wherever
// the buy box above says "Fit", the matrix used to be the one place on the
// page that still exposed Medusa's raw "Gender" axis name.
interface VariantMatrixColumn { id: string; label: string }
const variantMatrixColumns = computed<VariantMatrixColumn[]>(() =>
  optionGroups.value
    .filter((og) => og.values.some((v) => v && v.trim()))
    .map((og) => ({ id: og.id, label: displayOptionTitle(og.title) })),
)

// Cells are keyed by `option_id`, which is exactly what `optionGroups`
// uses as its own `id` in both of its derivation paths (product options,
// or variant options when the product carries none). A residual dash is
// therefore a genuine hole (an axis this product declares that this one
// variant has no value for) and worth showing.
interface VariantMatrixRow { id: string; cells: Record<string, string>; price: string }
const variantMatrix = computed<VariantMatrixRow[]>(() =>
  variants.value.map((v) => {
    const cells: Record<string, string> = {}
    for (const o of v.options ?? []) {
      if (o.value) cells[o.option_id] = String(o.value)
    }
    const amt = v.calculated_price?.calculated_amount ?? v.prices?.[0]?.amount ?? null
    return { id: v.id, cells, price: formatMoney(amt ?? undefined) }
  }),
)

// --- Size guide eligibility ----------------------------------------------
//
// A "Size guide and measurements" section only means something when the
// size axis is a run of garment sizes. Medusa models "350ml", "A5",
// "Pack of 8" and "Standard" on the same `Size` option, so the unconditional
// section offered a chest-and-sleeve chart for a ceramic mug and for a
// zip pouch whose only size is "Standard".
//
// The sizes are read off the product's real option values, not asserted.
// The previous copy promised XS through XXL on every product; nothing in
// the catalogue is cut below S or above XL. Rather than invent the two
// missing sizes or quietly drop the claim, the section now names the sizes
// this piece is actually made in.
const GARMENT_SIZES = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']
const garmentSizes = computed<string[]>(() => {
  const sizeAxis = optionGroups.value.find((og) => optionKind(og) === 'size')
  if (!sizeAxis) return []
  const offered = new Set(sizeAxis.values.map((v) => v.trim().toUpperCase()))
  const run = GARMENT_SIZES.filter((s) => offered.has(s))
  // One size is not a size run: there is nothing to compare against.
  return run.length > 1 ? run : []
})

// Oxford-comma-free list, house style: "S, M, L and XL".
const joinList = (items: string[]): string =>
  items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`

// --- Product information accordion ---------------------------------------
//
// Branched on `productType`, not assembled once and shown to everyone.
//
// The five sections used to be a fixed literal, so a buy-as-is tee rendered a
// "Customization" panel offering artwork upload, free vectorisation and
// "sample proofs before bulk runs", none of which the apparel flow provides;
// `isPOD` gates the entire upload step out of the page. It also rendered a
// size guide on a zip pouch whose only size is "Standard", and a production
// lead time counted "from artwork approval" on products where the buyer never
// approves any artwork.
//
// The shape is now: what the thing is (shared) → how it fits (only where
// there are sizes to fit) → how you get it (branched) → the variant table
// (shared). Sections that genuinely apply to both modes stay shared; nothing
// is duplicated between the branches.
//
// `link` is optional and renders as a text link beneath the body. It exists so
// a section can point at the page that owns the promise, /shipping owns the
// delivery windows, instead of restating figures that will drift.
interface InfoSection {
  id: string
  title: string
  body: string
  link?: { to: string; label: string }
}

const infoSections = computed<InfoSection[]>(() => {
  const sections: InfoSection[] = []

  // 1. What it is. The merchant's own description and nothing else.
  //
  // This slot used to append a hard-coded paragraph about brushed-back
  // 380gsm fleece, a two-piece hood and a kangaroo pocket, on a shared
  // template, so a ceramic mug and a sheet of stickers both described
  // themselves as a hoodie. Copy about a specific garment belongs on that
  // garment's record, not in the page that renders all 26 of them.
  if (product.value?.description) {
    sections.push({
      id: 'product-details',
      title: 'Product details',
      body: product.value.description,
    })
  }

  // 2. How it fits: only for products cut in a garment size run.
  if (garmentSizes.value.length) {
    sections.push({
      id: 'size-guide',
      title: 'Size guide',
      body: `Cut in ${joinList(garmentSizes.value)}. Measurements are taken flat and differ from style to style, so the chart is specific to this piece. Ask us and we will send it over.`,
    })
  }

  if (canCustomise.value) {
    // 3a. Custom path: what we need from you, what you get back, how long
    // the run takes. Three steps in the order the buyer meets them.
    //
    // File formats are stated to match what the customiser actually accepts:
    // `image/png,image/jpeg,image/webp`. The old copy advertised "We accept
    // EPS, AI, PDF", which are precisely the three the uploader rejects.
    sections.push({
      id: 'artwork',
      title: 'Artwork and files',
      body: [
        'Upload your artwork as a PNG, JPEG or WebP at the largest size you have.',
        'Vector files (PDF, AI, EPS) go to the artwork team rather than the uploader. Send them over and we will redraw your mark at no charge.',
        techniques.value.length
          ? `Printed on this product by ${joinList(techniques.value.map((t) => t.label.toLowerCase()))}.`
          : '',
      ].filter(Boolean).join(' '),
    })

    sections.push({
      id: 'proofing',
      title: 'Proof and approval',
      body: 'We send a digital proof within 48 hours of your order. Nothing reaches the production floor until you have approved it.',
    })

    sections.push({
      id: 'production',
      title: 'Production',
      body: `Made to order in our partner workshops. A run takes ${leadTime.value} working days from the moment you approve the proof, and every run is checked twice before it leaves.`,
    })
  } else if (!isGiftCard.value) {
    // 3b. Buy-as-is path. One section, and every figure in it is the figure
    // published on /shipping and /returns, the sticky bar above reads the
    // same dispatch window, so the page states one shipping promise instead
    // of two 2,000 pixels apart.
    sections.push({
      id: 'delivery',
      title: 'Delivery and returns',
      body: 'Orders leave the workshop closest to your address, usually within 3 to 5 working days. Delivery then takes 2 to 3 working days in the UK, 3 to 5 across the EU and 5 to 7 to the US and Canada. Unworn stocked pieces go back free within 30 days.',
      link: { to: '/shipping', label: 'Delivery times by region' },
    })
  }

  // 4. The variant table. Shared, and headed by whichever axes this product
  // actually has, see `variantMatrixColumns`.
  sections.push({
    id: 'variant-specificities',
    title: 'Product specifications',
    body: 'Every variant we make of this product, listed with its own price.',
  })

  return sections
})

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
// (otherwise both render simultaneously, confusing). IntersectionObserver
// flips `primaryAtcInView` based on the inline button row's visibility.
//
// Default to TRUE so SSR + first paint assume the inline ATC is in view,
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

// Desktop bottom action bar visibility. Deliberately a SECOND observer on the
// SAME target rather than a shared flag, because the two bars need different
// answers to "is the buy card still reachable?" and the mobile one is tuned
// and load-bearing:
//
//  - The mobile observer uses `rootMargin: '0px 0px -100px 0px'` and
//    `threshold: 0.1`, i.e. it deliberately calls the card "gone" while 100px
//    of it is still on screen, so the mobile bar arrives early. Reusing that
//    here would put this bar on screen while the in-flow Add to cart is still
//    visible, which is the exact defect being fixed.
//  - This observer uses `threshold: 0` (any overlap at all counts as in view)
//    with a NEGATIVE TOP margin only. Consequences, both wanted:
//      * The bar can never coexist with the in-flow CTA. Scrolling down, the
//        card exits through the TOP of the viewport while the bar enters at
//        the BOTTOM, so there is no boundary at which both are painted.
//      * The top margin is the fixed header's height. A button sitting in the
//        top 118px is behind the header band and is not actually reachable, so
//        counting it as "in view" would leave the buyer with no usable CTA.
//
// No flicker: this bar is `position: fixed`, so mounting and unmounting it
// changes no flow height, cannot move the observed element, and therefore
// cannot feed back into its own trigger. That is why `fixed` and not `sticky`.
//
// No transition on appearance, matching the mobile bar, which is the proven
// treatment in this file. The only transition on the element is
// `transition-[bottom]`, for when the consent banner is dismissed and
// `--consent-height` drops to 0, and it carries `motion-reduce:transition-none`.
//
// Defaults to TRUE for the same reason the mobile flag does: SSR and first
// paint must not flash a duplicate CTA before the observer first fires.
const desktopAtcInView = ref(true)

// The bar releases at the footer, and this is a REGRESSION GUARD, not polish.
// Going from `sticky` to `fixed` is what made it necessary: the old bar
// stopped being painted around y=1200 of a 4921px document, so it never
// reached the footer. A fixed bar rides to the last pixel, and at max scroll
// it measured t709-b796 against a footer of t-89-b796, i.e. it sat on the
// footer's final 87px permanently. That strip carries legal and policy links,
// and `body { padding-bottom: var(--consent-height) }` in tokens.css reserves
// room for the consent banner only, not for this.
//
// Releasing at the footer is also what the references do rather than a
// workaround: adidas's pinned buy panel and Airbnb's floating Reserve card
// both let go once the column they belong to ends. A buyer who has reached
// the footer has left the purchase.
//
// The footer is owned by layouts/default.vue, so this reads it with a
// querySelector rather than adding a ref to another lane's markup. If the
// element is absent the guard is simply inert.
const footerInView = ref(false)
let desktopAtcObserver: IntersectionObserver | null = null

// `--header-offset` is `calc(...)` of two other custom properties, and
// `getPropertyValue` on a custom property returns the raw token text, not a
// resolved length, so it cannot be parsed directly. Measuring a throwaway
// element that consumes the token resolves it in px while keeping the token
// as the single definition. Falls back to 0, which is merely less precise.
function resolveHeaderOffset(): number {
  try {
    const probe = document.createElement('div')
    probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;height:var(--header-offset)'
    document.body.appendChild(probe)
    const h = probe.getBoundingClientRect().height
    probe.remove()
    return Number.isFinite(h) ? Math.round(h) : 0
  } catch {
    return 0
  }
}

onMounted(() => {
  if (typeof IntersectionObserver === 'undefined' || !primaryAtcRow.value) return
  const buyCard = primaryAtcRow.value
  const footer = document.querySelector('footer')
  desktopAtcObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.target === buyCard) desktopAtcInView.value = entry.isIntersecting
        else footerInView.value = entry.isIntersecting
      }
    },
    { rootMargin: `-${resolveHeaderOffset()}px 0px 0px 0px`, threshold: 0 },
  )
  desktopAtcObserver.observe(buyCard)
  if (footer) desktopAtcObserver.observe(footer)
})

onBeforeUnmount(() => {
  desktopAtcObserver?.disconnect()
  desktopAtcObserver = null
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
