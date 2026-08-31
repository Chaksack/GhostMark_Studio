<template>
  <div class="bg-cream-tile min-h-screen">
    <!-- Step indicator -->
    <div class="border-b border-ink-200 bg-white">
      <div class="mx-auto flex w-full max-w-rail flex-wrap items-center justify-center gap-x-6 gap-y-2 px-gutter py-4 sm:gap-x-10">
        <NuxtLink
          to="/cart"
          class="gm-spec flex items-center gap-2 rounded-none text-ink-600 hover:text-ink-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-white"
        >
          <span class="flex h-6 w-6 items-center justify-center rounded-full border border-ink-400 gm-spec !text-[12px] font-bold">1</span>
          Cart
        </NuxtLink>
        <span class="h-px w-6 bg-ink-300" />
        <span
          class="gm-spec flex items-center gap-2"
          :class="step >= 1 ? 'font-semibold text-ink-950' : 'text-ink-600'"
        >
          <span
            class="flex h-6 w-6 items-center justify-center rounded-full gm-spec !text-[12px] font-bold"
            :class="step >= 1 ? 'bg-ink-950 text-white' : 'border border-ink-400'"
          >2</span>
          Shipping
        </span>
        <span class="h-px w-6 bg-ink-300" />
        <span
          class="gm-spec flex items-center gap-2"
          :class="step >= 2 ? 'font-semibold text-ink-950' : 'text-ink-600'"
        >
          <span
            class="flex h-6 w-6 items-center justify-center rounded-full gm-spec !text-[12px] font-bold"
            :class="step >= 2 ? 'bg-ink-950 text-white' : 'border border-ink-400'"
          >3</span>
          Payment
        </span>
        <span class="h-px w-6 bg-ink-300" />
        <span
          class="gm-spec flex items-center gap-2"
          :class="step >= 3 ? 'font-semibold text-ink-950' : 'text-ink-600'"
        >
          <span
            class="flex h-6 w-6 items-center justify-center rounded-full gm-spec !text-[12px] font-bold"
            :class="step >= 3 ? 'bg-ink-950 text-white' : 'border border-ink-400'"
          >4</span>
          Confirmation
        </span>
      </div>
    </div>

    <div class="mx-auto w-full max-w-rail px-gutter py-10">
      <div v-if="!cart" class="py-20 text-center text-ink-600">Loading&hellip;</div>

      <div v-else class="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
        <!-- Main form area -->
        <div>
          <!--
            THIS FILE DECLARES THREE LEVEL-1 HEADINGS (shipping, payment,
            thank-you). That is NOT a document-outline bug: the three blocks
            below form a single v-if / v-else-if / v-else-if chain on `step`,
            all siblings of one parent, so exactly one is ever in the DOM.
            Verified in-browser at every step:
            document.querySelectorAll('h1').length === 1 throughout.
            If you ever split this chain into independent v-ifs, collapse the
            headings to one level-1 plus level-2s BEFORE you do.
          -->
          <!-- Step 1: Shipping -->
          <div v-if="step === 1">
            <h1 class="font-serif text-[28px] font-semibold text-ink-950">Shipping details</h1>
            <p class="mt-1 text-[14px] text-ink-600">Where should we send your order?</p>

            <form class="mt-6 rounded-2xl border border-ink-200 bg-white p-6" @submit.prevent="onSaveShipping">
              <div class="grid gap-4 sm:grid-cols-2">
                <div>
                  <label class="text-[13px] text-ink-600" for="ship-email">Email</label>
                  <input id="ship-email" v-model="email" class="mt-1.5 h-11 w-full border border-ink-400 bg-white px-3 text-[14px] text-ink-950 placeholder:text-ink-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-white" type="email" autocomplete="email" required />
                </div>
                <div>
                  <label class="text-[13px] text-ink-600" for="ship-phone">Phone</label>
                  <input id="ship-phone" v-model="ship.phone" class="mt-1.5 h-11 w-full border border-ink-400 bg-white px-3 text-[14px] text-ink-950 placeholder:text-ink-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-white" type="tel" autocomplete="tel" />
                </div>
              </div>

              <div class="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label class="text-[13px] text-ink-600" for="ship-first">First name</label>
                  <input id="ship-first" v-model="ship.first_name" class="mt-1.5 h-11 w-full border border-ink-400 bg-white px-3 text-[14px] text-ink-950 placeholder:text-ink-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-white" type="text" autocomplete="given-name" required />
                </div>
                <div>
                  <label class="text-[13px] text-ink-600" for="ship-last">Last name</label>
                  <input id="ship-last" v-model="ship.last_name" class="mt-1.5 h-11 w-full border border-ink-400 bg-white px-3 text-[14px] text-ink-950 placeholder:text-ink-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-white" type="text" autocomplete="family-name" required />
                </div>
              </div>

              <div class="mt-4">
                <label class="text-[13px] text-ink-600" for="ship-address">Address</label>
                <input id="ship-address" v-model="ship.address_1" class="mt-1.5 h-11 w-full border border-ink-400 bg-white px-3 text-[14px] text-ink-950 placeholder:text-ink-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-white" type="text" autocomplete="address-line1" required />
              </div>

              <div class="mt-4 grid gap-4 sm:grid-cols-3">
                <div>
                  <label class="text-[13px] text-ink-600" for="ship-city">City</label>
                  <input id="ship-city" v-model="ship.city" class="mt-1.5 h-11 w-full border border-ink-400 bg-white px-3 text-[14px] text-ink-950 placeholder:text-ink-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-white" type="text" autocomplete="address-level2" required />
                </div>
                <div>
                  <label class="text-[13px] text-ink-600" for="ship-postal">Postal code</label>
                  <input id="ship-postal" v-model="ship.postal_code" class="mt-1.5 h-11 w-full border border-ink-400 bg-white px-3 text-[14px] text-ink-950 placeholder:text-ink-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-white" type="text" autocomplete="postal-code" required />
                </div>
                <div>
                  <label class="text-[13px] text-ink-600" for="ship-country">Country</label>
                  <!--
                    A SELECT BOUND TO THE REGION, not a free-text field.

                    This field used to be `type="text"` with `placeholder="us"`,
                    and the model defaulted to the literal 'us'. The store's live
                    region is United Kingdom and contains exactly one country,
                    `gb`, so 'us' could never validate: every first-time visitor
                    who filled this form got
                        "Country with code us is not within region United Kingdom"
                    from the API on first submit. Checkout was blocked end to end
                    on the live region. Reproduced in-browser before changing it.

                    Seeding the VALUE from the region fixed that instance. It did
                    not fix the SHAPE that produced it: a free-text country code
                    can always drift out of step with the region, by a typo, by a
                    stale placeholder, or by a region switch mid-session, and the
                    only thing that catches it is a 400 after the customer has
                    already filled the form.

                    The region already declares exactly which countries it
                    accepts (`region.countries[]`, the same source RegionSelector
                    and GeoModal read). Binding the control to that list makes the
                    whole failure class unrepresentable: there is no value the
                    customer can pick that the region will reject. That is worth
                    more than the validation message it replaces.

                    A native <select> rather than a combobox: the longest region
                    here has nine countries, and native gives us keyboard support,
                    mobile's own picker, and autofill for free.
                  -->
                  <select
                    v-if="regionCountries.length"
                    id="ship-country"
                    v-model="ship.country_code"
                    class="mt-1.5 h-11 w-full border border-ink-400 bg-white px-3 text-[14px] text-ink-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                    autocomplete="country"
                    required
                  >
                    <option
                      v-for="c in regionCountries"
                      :key="c.value"
                      :value="c.value"
                    >{{ c.label }}</option>
                  </select>
                  <!--
                    Fallback for the degraded case ONLY: the region failed to
                    resolve, so we do not know its country list. useRegion's
                    documented posture is "zero hardcoded fallbacks", so we do not
                    invent one here either; the customer types it and the API
                    validates. No placeholder: the old `placeholder="us"` was the
                    same wrong-country hint as the old default, just in a slot
                    where it survived the fix to the value.
                  -->
                  <input
                    v-else
                    id="ship-country"
                    v-model="ship.country_code"
                    class="mt-1.5 h-11 w-full border border-ink-400 bg-white px-3 text-[14px] text-ink-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-white placeholder:text-ink-500"
                    type="text"
                    autocomplete="country"
                    required
                  />
                </div>
              </div>

              <!-- Shipping options -->
              <div v-if="shippingOptions.length" class="mt-6 border-t border-ink-200 pt-5">
                <h3 class="text-[14px] font-semibold text-ink-950">Shipping method</h3>
                <div class="mt-3 grid gap-2">
                  <label
                    v-for="opt in shippingOptions"
                    :key="opt.id"
                    class="flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition"
                    :class="selectedShippingOptionId === opt.id ? 'border-ink-950 bg-cream-50' : 'border-ink-200 hover:border-ink-400'"
                  >
                    <input
                      type="radio"
                      name="shipping-option"
                      :value="opt.id"
                      v-model="selectedShippingOptionId"
                      class="accent-ink-950"
                    />
                    <span class="text-[14px] text-ink-950">{{ opt.name || opt.id }}</span>
                  </label>
                </div>
              </div>

              <p v-if="shipError" role="alert" class="mt-3 text-[13px] text-semantic-danger-fg">{{ shipError }}</p>

              <div class="mt-5 flex flex-wrap gap-3">
                <button
                  class="inline-flex h-[48px] items-center justify-center bg-ink-950 px-7 text-[14px] font-medium tracking-wide text-white hover:bg-ink-800 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                  type="submit"
                  :disabled="savingShip"
                >
                  {{ savingShip ? 'Saving...' : 'Continue to payment' }}
                </button>
                <NuxtLink to="/cart" class="inline-flex h-[48px] items-center justify-center border border-ink-400 bg-white px-6 text-[14px] text-ink-700 hover:bg-cream-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-white">
                  Back to cart
                </NuxtLink>
              </div>
            </form>
          </div>

          <!-- Step 2: Payment -->
          <div v-else-if="step === 2">
            <h1 class="font-serif text-[28px] font-semibold text-ink-950">Payment</h1>
            <p class="mt-1 text-[14px] text-ink-600">Choose your payment method to complete your order.</p>

            <div class="mt-6 rounded-2xl border border-ink-200 bg-white p-6">
              <div v-if="providersLoading" class="text-ink-600">Loading payment methods&hellip;</div>

              <!--
                Zero-provider case. Previously this said "we can't take payment
                online right now" in a bare <p> with no role, which was wrong in
                three ways at once: it was never ANNOUNCED (a screen reader user
                heard nothing on arriving at a step that cannot take payment), it
                blamed a transient "right now" for what is actually a permanent
                property of the chosen region, and it never named the region, so
                the one action that fixes it -- switch region -- was invisible.

                role="alert" (not role="status") is deliberate and is the only
                place on this step that earns it. This branch renders when the
                customer has just advanced to Payment and cannot pay at all; that
                is assertive news. The advisory band below stays polite because
                it describes a partial degradation the customer can route around.

                The mailto is the escape hatch and stays: it works with no
                backend, no configuration and no JS beyond the href, and it
                carries the basket reference so we can quote the right order.

                Layout: no px-*, no mx-*, no max-w-* of its own. It sits inside
                the step's existing content column and inherits the rail, per the
                container system in assets/css/tokens.css. Colours are the
                documented tinted-alert recipe (surface/fg/border from the
                semantic.danger group, measured 6.61-7.82:1) rather than a stock
                red ramp, which this page is currently free of.
              -->
              <div
                v-else-if="!paymentOptions.length"
                role="alert"
                class="border border-semantic-danger-border bg-semantic-danger-surface p-4"
              >
                <p class="text-[14px] font-semibold text-semantic-danger-fg">
                  {{ regionPaymentMessage }}
                </p>
                <p class="mt-1.5 text-[13px] leading-[1.55] text-semantic-danger-fg">
                  No payment method is set up for this region yet, so this order can&rsquo;t be
                  completed here. Your basket is saved &mdash; switch to a region we support using
                  the region picker in the footer, or email us and we&rsquo;ll send you a payment
                  link for this order.
                </p>
                <a
                  class="mt-3 inline-flex min-h-11 items-center justify-center rounded-none border border-semantic-danger-border bg-white px-5 text-[14px] font-medium text-semantic-danger-fg hover:bg-cream-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2"
                  :href="paymentLinkMailto"
                >
                  Email us for a payment link
                </a>
              </div>

              <div v-else>
                <!--
                  Advisory band: Instacart's checkout pattern. When an option in
                  the group is unavailable we explain it ONCE, above the group, in
                  neutral (not amber/alarm) styling: nothing has gone wrong for the
                  customer, a choice is simply missing. Individual rows then carry
                  only a one-line reason, so the explanation isn't repeated per row.

                  role="status" + aria-live="polite" because this band appears
                  *after* first paint in the common case, Stripe's key check and
                  its init failure both resolve asynchronously, so a screen-reader
                  user who is already on this step needs to be told. Matches the
                  precedent in components/cart/CartModeBanner.vue.

                  Surface colour is the page's own ground (#f5f1ec) rather than a
                  new token, so the band reads as an inset shelf inside the white
                  card instead of a warning.
                -->
                <div
                  v-if="paymentAdvisory"
                  id="payment-advisory"
                  role="status"
                  aria-live="polite"
                  class="mb-4 rounded-lg border border-ink-200 bg-cream-tile px-4 py-3.5"
                >
                  <p class="text-[13px] font-medium text-ink-950">{{ paymentAdvisory.title }}</p>
                  <p class="mt-1 text-[13px] leading-[1.55] text-ink-700">{{ paymentAdvisory.body }}</p>
                  <a
                    class="mt-2.5 inline-flex min-h-11 items-center justify-center rounded-none border border-ink-400 bg-white px-4 text-[13px] font-medium text-ink-950 hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-cream-tile"
                    :href="paymentLinkMailto"
                  >
                    Email us for a payment link
                  </a>
                </div>

                <!--
                  <fieldset>/<legend> rather than an <h3> + <div>: the native
                  grouping is what makes a screen reader announce "Payment method,
                  group" as focus enters the radios, and it costs no styling
                  because Tailwind preflight already strips the default chrome.
                -->
                <fieldset :aria-describedby="paymentAdvisory ? 'payment-advisory' : undefined">
                  <legend class="text-[14px] font-semibold text-ink-950">Payment method</legend>

                  <div class="mt-3 grid gap-2">
                    <!--
                      One card per method. The radio row is the disclosure header
                      and the panel below it is the disclosure body, selecting a
                      method reveals only that method's fields, in place.

                      Deliberately NOT a separate +/- toggle (lululemon's affordance,
                      because their rows are buttons). Here the row is a radio, and a
                      radio already carries "chosen / not chosen"; adding a second
                      control that opens a row without choosing it would let a
                      customer sit in an expanded panel they haven't actually selected.

                      The panel is a SIBLING of the <label>, never a child: a Stripe
                      iframe nested inside a <label> would forward clicks on the card
                      field to the radio and steal focus out of the input.
                    -->
                    <div
                      v-for="opt in paymentOptions"
                      :key="opt.id"
                      class="rounded-lg border transition"
                      :class="[
                        !opt.available
                          ? 'border-ink-200 bg-cream-50/60'
                          : selectedProviderId === opt.id
                            ? 'border-ink-950 bg-cream-50'
                            : 'border-ink-200 hover:border-ink-400',
                      ]"
                    >
                      <label
                        class="flex items-start gap-3 px-4 py-3"
                        :class="opt.available ? 'cursor-pointer' : 'cursor-not-allowed'"
                      >
                        <!--
                          Native `disabled`, not `aria-disabled`. An aria-disabled
                          radio is still a live radio: arrow-keying through the group
                          would *select* it, which is exactly the outcome we're
                          preventing. `disabled` guarantees non-selectable and makes
                          roving focus skip it (Instacart: shown, explained, skipped).

                          The "why" is not lost to that: the reason text below lives
                          inside this <label>, so it is part of the radio's accessible
                          NAME, not a description. Disabled controls stay in the
                          accessibility tree and are reachable with the virtual cursor,
                          so the announcement is "Card, Visa Mastercard and American
                          Express accepted, Unavailable, <reason>, radio button, dimmed".
                          The reason travels with the control even though aria
                          description support on disabled inputs is inconsistent.
                        -->
                        <input
                          type="radio"
                          name="payment-provider"
                          class="mt-[3px] accent-ink-950 disabled:cursor-not-allowed"
                          :value="opt.id"
                          :disabled="!opt.available"
                          v-model="selectedProviderId"
                        />

                        <span class="min-w-0 flex-1">
                          <span class="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <!--
                              ink-600, not a paler step, for the unavailable state.
                              WCAG 1.4.3 exempts the labels of inactive components from
                              the contrast minimum, so a pale grey would be *permitted*,
                              but a customer still has to be able to read which method is
                              down in order to act on it.
                              Measured on this row's fill (cream-50): ink-400 = 3.51:1,
                              ink-600 = 7.37:1. The palette has no legal 4th text tier on
                              a warm ground (ART measured every candidate between #706A5F
                              and #767065 and all fail on offWhite), so recession here is
                              carried by the row fill and the Unavailable badge, NOT by
                              making the text paler. Same reasoning as the stepper's
                              inactive steps.
                            -->
                            <span
                              class="text-[14px]"
                              :class="opt.available ? 'text-ink-950' : 'text-ink-600'"
                            >{{ opt.label }}</span>

                            <!--
                              Text brand marks, not vendor SVGs. This mirrors the
                              documented policy in AppFooter.vue: we don't hold usage
                              rights for the Visa / Mastercard / Amex glyphs yet, so
                              the site renders their names in neutral chips instead.
                              Reusing that decision here keeps the two surfaces
                              consistent and adds no icon dependency.

                              Chips are aria-hidden and paired with an sr-only phrase,
                              because "MC" is a visual abbreviation, not something a
                              screen reader should read aloud.
                            -->
                            <span
                              v-if="opt.marks.length"
                              class="flex items-center gap-1"
                              aria-hidden="true"
                            >
                              <span
                                v-for="mark in opt.marks"
                                :key="mark"
                                class="border px-1.5 py-0.5 text-[12px] font-bold tracking-wide"
                                :class="opt.available ? 'border-ink-400 text-ink-700' : 'border-ink-200 text-ink-600'"
                              >{{ mark }}</span>
                            </span>
                            <span v-if="opt.marksSrText" class="sr-only">{{ opt.marksSrText }}</span>

                            <span
                              v-if="!opt.available"
                              class="gm-spec border border-ink-400 px-1.5 py-0.5 text-ink-600"
                            >Unavailable</span>
                          </span>

                          <!--
                            One-line explanation carried by the row itself, lululemon's
                            "Afterpay / 4 payments, every two weeks" convention: the
                            terms travel with the choice so nobody has to expand a row
                            to find out what it commits them to.

                            Both variants sit inside the <label>, so both are folded into
                            the radio's accessible NAME. Verified announcement:
                              "Card, Visa Mastercard and American Express accepted,
                               Unavailable, Temporarily unavailable. Use bank transfer
                               below, radio button, dimmed"
                            No `aria-describedby` here on purpose, it would point at
                            this same node and make a screen reader read the line twice.
                          -->
                          <span
                            v-if="opt.available && opt.hint"
                            class="mt-0.5 block text-[12px] leading-[1.5] text-ink-600"
                          >{{ opt.hint }}</span>
                          <span
                            v-else-if="!opt.available"
                            class="mt-0.5 block text-[12px] leading-[1.5] text-ink-600"
                          >{{ opt.unavailableReason }}</span>
                        </span>
                      </label>

                      <!--
                        Disclosure panel. `v-show`, never `v-if`: the Stripe mount
                        node must survive collapse/expand as the same DOM element or
                        the mounted iframe is orphaned. (mountCard() below also
                        re-mounts defensively if the node identity ever does change.)
                      -->
                      <div
                        v-show="opt.available && selectedProviderId === opt.id"
                        class="border-t border-ink-200 px-4 pb-4 pt-3.5"
                      >
                        <template v-if="isStripeProvider(opt.id)">
                          <!--
                            A <p>, not a <label>: the actual card input lives inside a
                            cross-origin Stripe iframe, so a <label> here could never
                            have a `for` target and would be a label labelling nothing.
                            Stripe supplies the field's own accessible name.
                          -->
                          <p class="text-[13px] font-medium text-ink-700">Card details</p>
                          <!--
                            Function ref, not `ref="stripeMountEl"`. A string template ref
                            inside `v-for` is collected into an ARRAY by Vue 3, which would
                            silently hand `mount()` an array instead of a node. The callback
                            form is unambiguous and also fires with `null` on unmount, which
                            is exactly the signal mountCard() needs.
                          -->
                          <div
                            v-show="stripeReady"
                            :ref="setStripeMountEl"
                            class="mt-1.5 rounded-md border border-ink-200 bg-white px-4 py-3"
                          />
                          <div v-if="!stripeReady" class="mt-2 flex items-center gap-2 text-[13px] text-ink-600">
                            <UiSpinner :size="14" /> Setting up the secure card form&hellip;
                          </div>
                          <!--
                            The specific half of the trust signal, placed where
                            adidas places theirs: inside the Payment section,
                            beside the field it is talking about, as copy rather
                            than as a badge.
                            https://mobbin.com/screens/59e91e1b-8997-43f5-86e6-d449b5090237

                            Body face, NOT `.gm-spec`. The mono voice is scoped to
                            metadata and labels and must never set a sentence,
                            that constraint comes from the art direction and this
                            is a sentence.

                            Factually exact rather than reassuring-sounding: the
                            card field is a cross-origin Stripe iframe, so the
                            number genuinely never reaches this origin. That is a
                            property of the architecture documented above, which
                            is why it can be stated plainly.
                          -->
                          <p v-if="stripeReady" class="mt-2 text-[12px] leading-[1.5] text-ink-600">
                            Card details go straight to Stripe and never reach our servers.
                          </p>
                          <!--
                            We cannot point `aria-describedby` at this message from the
                            input it describes, that input is inside Stripe's iframe and
                            no id in this document can reach it. role="alert" is the only
                            mechanism left that announces a card validation failure to a
                            screen reader, so the message stays adjacent to the field
                            visually and is announced on change.
                          -->
                          <p v-if="cardError" role="alert" class="mt-2 text-[12px] text-semantic-danger-fg">
                            {{ cardError }}
                          </p>
                        </template>

                        <template v-else-if="isManualProvider(opt.id)">
                          <p class="text-[13px] leading-[1.55] text-ink-700">
                            Place the order now and we&rsquo;ll email an invoice with our bank details and this
                            order&rsquo;s reference. Nothing is charged to a card. For print-on-demand items we
                            start your e-proof straight away and begin production once payment clears.
                          </p>
                        </template>
                      </div>
                    </div>
                  </div>
                </fieldset>
              </div>

              <p v-if="payError" role="alert" class="mt-3 text-[13px] text-semantic-danger-fg">{{ payError }}</p>
              <p v-if="orderResult" role="status" class="mt-3 text-[13px] text-semantic-success-fg">{{ orderResult }}</p>

              <div class="mt-5 flex flex-wrap gap-3">
                <!--
                  The amount rides on the commit button (Walmart: "Place order for
                  $1.06"). On a 250-unit POD run the total is four figures and this
                  is the last place the customer sees it before it is taken, and
                  this codebase has a live defect class where the quoted total and
                  the charged total diverge, so restating it at the point of
                  commitment is a real check, not decoration.
                -->
                <!--
                  Hidden outright when the region has no payment method, rather
                  than merely disabled. This block is a SIBLING of the
                  zero-provider branch above, not a child of it, so before this
                  `v-if` the commit button rendered on a step that provably
                  cannot take payment: permanently greyed out, with no
                  explanation attached to it and nothing that could ever enable
                  it. A disabled control implies "not yet"; the truth here is
                  "not at all, not in this region". "Back to shipping" is
                  deliberately left in place so the customer is never trapped on
                  this step with no way out.
                -->
                <button
                  v-if="paymentOptions.length"
                  class="inline-flex h-[48px] items-center justify-center gap-2 bg-ink-950 px-7 text-[14px] font-medium tracking-wide text-white hover:bg-ink-800 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                  type="button"
                  :disabled="placeDisabled"
                  :aria-describedby="commitBlock?.text ? 'commit-block-reason' : undefined"
                  @click="onPlaceOrder"
                >
                  <UiSpinner v-if="placing" :size="16" />
                  {{ placing ? 'Placing order…' : placeOrderLabel }}
                </button>
                <button
                  class="inline-flex h-[48px] items-center justify-center border border-ink-400 bg-white px-6 text-[14px] text-ink-700 hover:bg-cream-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                  type="button"
                  @click="step = 1"
                >
                  Back to shipping
                </button>
              </div>

              <!--
                THE REASON THE BUTTON ABOVE IS DISABLED. Never absent while it is.

                Placed AFTER the button row rather than before it so it reads as a
                caption on the control it explains, and so it cannot push the CTA
                down the page as states change — the button stays where the eye
                left it.

                `aria-describedby` on the button points here, which covers a mouse
                or screen-reader user who reaches for the control. But a `disabled`
                button is removed from the tab order entirely, so a keyboard user
                will never land on it and never hear that description. That is why
                this is ALSO a live region in its own right: it is the only channel
                that reaches someone who tabs straight past a dead control.

                `v-if` on `text`, not on `commitBlock`: the card-invalid block
                deliberately carries no text because `cardError` already renders it
                against the field itself.
              -->
              <p
                v-if="commitBlock?.text"
                id="commit-block-reason"
                :role="commitBlock.role"
                class="mt-3 text-[13px] leading-[1.5]"
                :class="commitBlock.role === 'alert' ? 'text-semantic-danger-fg' : 'text-ink-700'"
              >{{ commitBlock.text }}</p>
            </div>
          </div>

          <!-- Step 3: Confirmation -->
          <div v-else-if="step === 3" class="flex flex-col items-center py-10 text-center">
            <svg class="h-16 w-16 text-semantic-success-solid" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <h1 class="mt-6 font-serif text-[32px] font-semibold text-ink-950">Thank you!</h1>
            <p class="mt-2 text-[15px] text-ink-700">Your order has been placed successfully.</p>
            <p v-if="confirmationDisplayId" class="mt-1 text-[14px] text-ink-600">Order ID: {{ confirmationDisplayId }}</p>
            <NuxtLink to="/products" class="mt-8 inline-flex h-[48px] items-center justify-center bg-ink-950 px-8 text-[14px] font-medium tracking-wide text-white hover:bg-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-cream-tile">
              Continue shopping
            </NuxtLink>
          </div>
        </div>

        <!-- Order summary sidebar (steps 1 & 2) -->
        <aside v-if="step < 3" class="rounded-2xl border border-ink-200 bg-white p-6 lg:sticky lg:top-28">
          <h2 class="text-[18px] font-semibold text-ink-950">Order summary</h2>

          <!-- Mixed-mode delivery banner: renders only when the cart spans POD + apparel -->
          <CartModeBanner :items="cartItems" class="mt-4 mb-0" />

          <div class="mt-4 max-h-[300px] divide-y divide-ink-100 overflow-y-auto">
            <div v-for="item in cartItems" :key="item.id" class="flex gap-3 py-3">
              <div class="h-[56px] w-[56px] flex-shrink-0 overflow-hidden rounded-lg bg-ink-100">
                <img
                  v-if="item.thumbnail"
                  class="h-full w-full object-cover"
                  :src="item.thumbnail"
                  :alt="item.title"
                />
              </div>
              <div class="flex-1">
                <div class="text-[13px] font-medium text-ink-950 line-clamp-1">{{ item.title }}</div>
                <div class="text-[12px] text-ink-600">Qty: {{ item.quantity }}</div>
              </div>
              <div class="text-[13px] font-medium text-ink-950">{{ formatMoney(item.total ?? item.subtotal) }}</div>
            </div>
          </div>

          <div class="mt-4 space-y-2 border-t border-ink-200 pt-4">
            <div class="flex items-baseline justify-between text-[14px]">
              <span class="text-ink-600">Subtotal</span>
              <span class="font-medium text-ink-950">{{ cartSubtotal }}</span>
            </div>
            <div class="flex items-baseline justify-between text-[14px]">
              <span class="text-ink-600">Shipping</span>
              <span class="text-ink-600">{{ cartShipping || 'Calculated at next step' }}</span>
            </div>
            <div class="flex items-baseline justify-between text-[14px]">
              <span class="text-ink-600">Taxes</span>
              <span class="text-ink-600">{{ cartTax || 'Included' }}</span>
            </div>
            <!-- Estimated delivery: copy branches on cart mode (all-apparel / all-pod / mixed) -->
            <div v-if="cartItems.length" class="flex items-baseline justify-between gap-3 text-[14px]">
              <span class="text-ink-600">Estimated delivery</span>
              <span class="text-right text-ink-700">{{ estimatedDeliveryText }}</span>
            </div>
          </div>

          <div class="mt-3 flex items-baseline justify-between border-t border-ink-200 pt-3">
            <span class="text-[16px] font-semibold text-ink-950">Total</span>
            <span class="text-[18px] font-bold text-ink-950">{{ cartTotal }}</span>
          </div>

          <!--
            TRUST SIGNAL: one line, in the summary, in the mono spec voice.

            Checkout previously carried no security cue at all, on the only page
            of the site where a customer types card details.

            Deliberately the QUIET version of this pattern. Mobbin splits the
            indexed field cleanly in two, and the split is about containment:

              woven in:   Squarespace sets "SSL ENCRYPTED PAYMENT" as microcaps
                          at the foot of the order summary
                          https://mobbin.com/screens/30dbfa3f-0351-442e-93f9-c104342faa79
                        - Shop/Shopify: one grey sub-line, no icon at all,
                          "All transactions are secure and encrypted"
                          https://mobbin.com/screens/8c1b4495-cc4a-4999-bcaf-4e64f29d94d8
                        - adidas: a single tinted strip inside the Payment
                          section, copy doing the work, one small padlock
                          https://mobbin.com/screens/59e91e1b-8997-43f5-86e6-d449b5090237
                        - FARFETCH / Etsy: hairline padlock + "Secure checkout"
                          set as header furniture
                          https://mobbin.com/screens/6d8c71a9-ccca-47c0-a933-5151beacd78b

              bolted on:  Selfridges floats a Norton seal in a foreign visual
                          language + a 9-mark logo grid
                          https://mobbin.com/screens/b7a4f332-5c9b-4d1c-8eb9-df566bada89e
                        - Uvodo's three-item trust block occupies more of the
                          column than the summary it is attached to
                          https://mobbin.com/screens/09b19774-b35e-4a65-9fa9-beba530fb5c2
                        - Unity ships SecureTrust + 8 card logos + a floating
                          TrustedSite badge on one page
                          https://mobbin.com/screens/4985b4b5-1a1c-4f80-9620-3442b2f9b84b

            So: no seal, no logo grid, no second opinion about what "secure"
            looks like. `.gm-spec` is the one expressive device checkout takes
            from the art direction, so the cue arrives in the site's own voice
            rather than a vendor's.

            SPLIT ACROSS TWO PLACES, deliberately, and measured:
              here          the short FARFETCH / Etsy form, two words, because
                            .gm-spec's 0.08em tracking made anything longer wrap
                            to 2 lines at 1440 and 3 at 390 in the narrow summary
                            column. A wrapped microcaps line reads as an accident.
              payment step  the specific claim, next to the card field, which is
                            where adidas puts theirs. See the note by the Stripe
                            mount below.

            Both claims are literally true and neither asserts a badge, a
            certification or a guarantee we cannot evidence.
          -->
          <p class="gm-spec mt-4 flex items-center gap-1.5 border-t border-ink-200 pt-3 text-ink-600">
            <svg class="h-3.5 w-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Secure checkout
          </p>
        </aside>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, watch } from 'vue'
import type {
  Stripe,
  StripeElements,
  StripeCardElement,
  StripeCardElementChangeEvent,
} from '@stripe/stripe-js'
import UiSpinner from '~/components/ui/UiSpinner.vue'
import CartModeBanner from '~/components/cart/CartModeBanner.vue'
import { inferCartMode } from '~/utils/cartMode'
import { formatMoneyOrNull } from '~/utils/money'
import { formatOrderNumber } from '~/utils/orderNumber'

useHead({ title: 'Checkout' })
const sdk = useMedusaClient()
const regionState = useRegion()
const { cart, cartId, ensureCart, updateCart, listShippingOptions, addShippingMethod, complete, refresh } = useCart()
const { stripePromise, isConfigured: stripeConfigured } = useStripe()
await ensureCart()

const STRIPE_PROVIDER_ID = 'pp_stripe_stripe'
const isProd = import.meta.env.PROD

// Single source of truth for the address we tell customers to write to when the
// online path fails. Matches the one published in AppFooter.vue / accessibility.vue.
const SUPPORT_EMAIL = 'hello@ghostmark.studio'

const isStripeProvider = (id: string | undefined | null) => {
  if (!id) return false
  return id === STRIPE_PROVIDER_ID || id.startsWith('pp_stripe_')
}

const isManualProvider = (id: string | undefined | null) => {
  if (!id) return false
  return id === 'pp_system_default' || id === 'manual' || id.includes('system_default')
}

const providerLabel = (id: string) => {
  // "Card" alone, because the accepted networks are carried beside it as the
  // text chips AppFooter.vue established (see providerMarks). Repeating
  // "(Visa, Mastercard, Amex)" in the label as well would say it twice.
  if (isStripeProvider(id)) return 'Card'
  // Renamed from "Manual / Cash on delivery". `pp_system_default` in Medusa means
  // "record the order, settle payment out of band", cash on delivery is one way
  // to do that, but it is not the one this business actually offers. The FAQ
  // already promises "bank transfers, and purchase orders for established
  // business accounts", which is the same mechanism and the true one. Naming it
  // accurately matters more than usual here: this is the row a customer falls
  // back to when cards are down, and they must not think they are agreeing to
  // hand cash to a courier.
  if (isManualProvider(id)) return 'Bank transfer / invoice'
  return id
}

// Visual brand chips. Text, not vendor SVGs, AppFooter.vue documents why
// (no signed usage rights for the Visa / Mastercard / Amex glyphs yet), and
// this page should not be the one place that quietly breaks that policy.
const providerMarks = (id: string): string[] => (isStripeProvider(id) ? ['VISA', 'MC', 'AMEX'] : [])

// Spoken counterpart to the chips above. "MC" is a space-saving abbreviation
// for the eye; a screen reader should hear the network names in full.
const providerMarksSrText = (id: string) =>
  isStripeProvider(id) ? 'Visa, Mastercard and American Express accepted' : ''

// The lululemon convention: each row explains its own terms in one line, in the
// row, so the customer never has to expand a method to learn what it commits
// them to. Kept to a single clause each.
const providerHint = (id: string) => {
  if (isStripeProvider(id)) return 'Charged now. 3-D Secure where your bank requires it.'
  if (isManualProvider(id)) return 'Invoiced on confirmation: pay within 14 days, no card needed.'
  return ''
}

const step = ref(1)
const email = ref('')
const ship = reactive({
  first_name: '',
  last_name: '',
  address_1: '',
  city: '',
  postal_code: '',
  // Seeded from the ACTIVE REGION, not a hardcoded 'us'.
  //
  // This field used to ship the literal 'us'. The store's live region is
  // United Kingdom, so every first-time visitor who filled the form and
  // pressed Continue was told
  //     "Country with code us is not within region United Kingdom"
  // by the API, an error produced entirely by our own default value, on the
  // first submit, before they had typed anything wrong. Reproduced in-browser
  // at 1440 before changing it.
  //
  // `''` rather than a different hardcoded guess: useRegion's documented
  // posture is "zero hardcoded fallbacks, faking a region corrupts pricing",
  // and the same reasoning applies to the country. If the region resolves we
  // seed its first country below; if it does not, the field stays empty and
  // the customer fills it in, which is honest. It is `required`, so an empty
  // value cannot be submitted silently.
  country_code: '',
  phone: '',
})

/**
 * The active region's accepted countries, normalised for the <select>.
 *
 * Same source RegionSelector.vue and GeoModal.vue read (`region.countries[]`
 * with `iso_2` / `display_name`), so all three surfaces agree about what the
 * store actually ships to. Falls back to the cart's own region when the
 * composable has not resolved yet; during checkout the cart is authoritative
 * and is usually loaded first.
 *
 * Sorted by label so the list is scannable; the region's own array order is
 * "whatever the API sorted first", which RegionSelector.vue:46 already warns
 * about relying on.
 */
const regionCountries = computed(() => {
  const fromCart = (cart.value as any)?.region?.countries
  const fromRegion = (regionState.region.value as any)?.countries
  const list = (Array.isArray(fromCart) && fromCart.length ? fromCart : fromRegion) ?? []
  return (list as any[])
    .map((c) => ({
      value: String(c?.iso_2 ?? c?.iso2 ?? '').toLowerCase(),
      label: c?.display_name || c?.name || String(c?.iso_2 ?? '').toUpperCase(),
    }))
    .filter((c) => c.value)
    .sort((a, b) => a.label.localeCompare(b.label))
})

/**
 * Keep `ship.country_code` VALID FOR THE ACTIVE REGION at all times.
 *
 * Three jobs, and the second and third only exist because RegionSelector is
 * mounted in the footer, so a customer can change region mid-checkout:
 *
 *   1. SEED a blank field once the region resolves.
 *   2. REPAIR a value the region no longer accepts. Switching UK -> EU with
 *      'gb' selected would otherwise leave an invalid code sitting in a field
 *      that now has no matching <option>. A <select> whose v-model does not
 *      match any option renders BLANK while still holding the stale value, so
 *      the customer sees an empty box, submits, and gets the same
 *      "not within region" 400 this whole rework exists to delete.
 *   3. PREFER the cart's own address when it has one, so returning to
 *      checkout does not discard what the customer already entered.
 *
 * Watched rather than computed because this is a real form field the customer
 * must be able to change; a computed would fight them on every keystroke.
 * A VALID value is never touched.
 *
 * When the value has to be replaced and the region offers a genuine choice, it
 * is set to '' rather than guessed. Picking `countries[0]` there would be the
 * original sin of this field in a new costume: RegionSelector.vue:46 already
 * warns that array order is "just whatever the API sorted first". The field is
 * `required`, so a blank forces a deliberate choice instead of shipping a
 * plausible-looking wrong country to the payment step.
 */
watch(
  () => [regionCountries.value, cart.value] as const,
  () => {
    const codes = regionCountries.value.map((c) => c.value)
    if (!codes.length) return

    const current = (ship.country_code || '').toLowerCase()
    if (current && codes.includes(current)) return

    const fromCart = String((cart.value as any)?.shipping_address?.country_code ?? '').toLowerCase()
    if (fromCart && codes.includes(fromCart)) {
      ship.country_code = fromCart
      return
    }
    // Exactly one country: there is no choice to make, so make it.
    // More than one: blank, and let the customer choose.
    ship.country_code = codes.length === 1 ? codes[0] : ''
  },
  { immediate: true },
)

const currencyCode = computed(() => {
  const c = cart.value as any
  return (c?.currency_code || c?.region?.currency_code || 'gbp') as string
})

// Adapter over the shared `~/utils/money` helper. Returns `null` for
// unrenderable amounts so optional rows (shipping, tax) can be v-if'd out.
//
// This is the screen where the old local shadow did the most damage: it
// divided by 100 for display only, so checkout showed £340.00 while the
// PaymentIntent handed to Stripe carried the unscaled 34000 -> £34,000.00.
// Amounts are Medusa v2 major units and are NOT scaled here.
const formatMoney = (amount: number | null | undefined) =>
  formatMoneyOrNull({ amount, currency_code: currencyCode.value })

const cartItems = computed(() => (cart.value?.items ?? []) as any[])
const cartSubtotal = computed(() => formatMoney((cart.value as any)?.subtotal) || '-')
// Shipping / tax are only QUOTED once there is something to quote them from.
//
// Both of these used to be `formatMoney(total) || null`, and the template then
// did `{{ cartShipping || 'Calculated at checkout' }}`. That fallback was dead
// code: `formatMoney(0)` returns the STRING '£0.00', which is truthy, so the
// `||` branch could never be taken. The visible result was that checkout
// asserted "Shipping £0.00" before the customer had chosen a shipping method:
// i.e. it stated free delivery, on the page where the customer commits, and
// then the number changed after they picked a method.
//
// /cart already words this correctly ("Calculated at next step"), so this was
// also the two pages disagreeing about the same cart. Now both only show a
// figure once the underlying thing exists:
//   shipping -> a shipping method has actually been added to the cart
// Returning null lets the template's fallback copy do its job for real.
//
// Tax is left alone, see the note on cartTax below for why it is not the
// same defect.
const hasShippingMethod = computed(() => ((cart.value as any)?.shipping_methods?.length ?? 0) > 0)
const cartShipping = computed(() =>
  hasShippingMethod.value ? formatMoney((cart.value as any)?.shipping_total) : null,
)
// Tax deliberately keeps its original 'Included' fallback rather than joining
// shipping's gating. It is NOT the same defect: this is a VAT-inclusive UK
// store, so `tax_total === 0` legitimately means "already in the price", and
// "Included" states that correctly. Saying "Calculated at next step" here
// would be actively wrong on the payment step, where there IS no next step.
const cartTax = computed(() => {
  const t = (cart.value as any)?.tax_total
  return typeof t === 'number' && t > 0 ? formatMoney(t) : null
})
const cartTotal = computed(() => formatMoney((cart.value as any)?.total) || cartSubtotal.value)

// Cart mode classification routes through ~/utils/cartMode (`inferCartMode`).
// Drives the estimated-delivery copy below: all-apparel cart shows the fast
// D2C ETA, all-POD cart shows the e-proof + production ETA, mixed defers to
// the banner above the line items so we don't double-narrate.
const cartMode = computed(() => inferCartMode(cartItems.value))

const estimatedDeliveryText = computed(() => {
  switch (cartMode.value) {
    case 'apparel':
      return '2-5 business days'
    case 'pod':
      return '3-5 weeks (48h e-proof + 2-4 weeks production)'
    case 'mixed':
      return 'Two delivery tracks - see banner above'
    default:
      return ''
  }
})

// Shipping
const savingShip = ref(false)
const shipError = ref<string | null>(null)
const shippingOptions = ref<any[]>([])
const selectedShippingOptionId = ref('')

const onSaveShipping = async () => {
  savingShip.value = true
  shipError.value = null
  try {
    await updateCart({
      email: email.value,
      shipping_address: { ...ship },
      billing_address: { ...ship },
    })
    await refresh()
    // Load shipping options for the now-known destination. Medusa filters by
    // service-zone country + price resolvability against the cart's currency
    // or region, so this can legitimately return zero (e.g. an unsupported
    // country, or a region with no shipping rates configured yet).
    shippingOptions.value = await listShippingOptions()
    if (!shippingOptions.value.length) {
      // Hard-block advance. Previously the flow silently jumped to payment,
      // user paid, and `cart.complete()` returned 400 ("No shipping method
      // selected but the cart contains items that require shipping"). Better
      // to surface the gap here than after card auth.
      shipError.value =
        'No shipping options are available for this address. Please double-check the country/postcode, or contact us. We may not deliver here yet.'
      selectedShippingOptionId.value = ''
      return
    }
    if (shippingOptions.value.length === 1) {
      selectedShippingOptionId.value = shippingOptions.value[0].id
    } else if (
      selectedShippingOptionId.value &&
      !shippingOptions.value.some((o: any) => o.id === selectedShippingOptionId.value)
    ) {
      // Previously-selected option no longer applies to this address, clear
      // it so the radio re-renders unselected and the user must pick again.
      selectedShippingOptionId.value = ''
    }
    if (!selectedShippingOptionId.value) {
      // Multiple options and none chosen yet, keep the user on the shipping
      // step so they pick one. The radio block above already rendered.
      shipError.value = 'Please select a shipping method to continue.'
      return
    }
    await addShippingMethod(selectedShippingOptionId.value)
    await refresh()
    // Load payment providers and advance
    await loadProviders()
    step.value = 2
  } catch (e: any) {
    shipError.value = e?.message || 'Failed to save shipping details.'
  } finally {
    savingShip.value = false
  }
}

// Payment
const providers = ref<any[]>([])
const providersLoading = ref(false)
const selectedProviderId = ref('')

const isStripeSelected = computed(() => isStripeProvider(selectedProviderId.value))

// NOTE: `paymentOptions` (the annotated, availability-aware view of `providers`
// that the template renders) is defined further down, after the Stripe lifecycle
// block, because it depends on `stripeInitError`. It is safe to reference here:
// `loadProviders` only ever runs on a user action, long after setup has finished.

const loadProviders = async () => {
  providersLoading.value = true
  try {
    const regionId = cart.value?.region_id || (regionState.regionId.value as any)
    const res = await sdk.store.payment.listPaymentProviders({ region_id: regionId } as any)
    providers.value = (res as any).payment_providers ?? []
    // Land the customer on something they can actually use. Preference order is
    // Stripe (the method most people want) then whatever else is selectable,
    // but never an unavailable row, which would leave the step looking answered
    // while the commit button stayed dead.
    const selectable = paymentOptions.value.filter((o) => o.available)
    const stripeOption = selectable.find((o) => isStripeProvider(o.id))
    selectedProviderId.value = stripeOption?.id ?? selectable[0]?.id ?? ''
  } finally {
    providersLoading.value = false
  }
}

// ---------------------------------------------------------------------------
// Stripe Elements lifecycle
//
// Stripe instances embed cross-origin iframes with internal mutable state.
// They MUST NOT be wrapped in `reactive()` / `ref()`, Vue's Proxy machinery
// breaks Stripe's internal `===` identity checks (same trap as Konva nodes).
// We hold them in module-scoped `let` bindings and surface only primitives
// (booleans, strings) via refs to the template.
// ---------------------------------------------------------------------------
let stripeInstance: Stripe | null = null
let stripeElements: StripeElements | null = null
let cardElement: StripeCardElement | null = null
let stripeClientSecret: string | null = null
let stripeInitInFlight = false
// The node the card iframe is currently attached to. Tracked separately from the
// template ref so mountCard() can tell "not yet mounted" from "mounted somewhere
// else" and stay idempotent, Stripe throws if you mount an already-mounted
// element, and silently orphans the iframe if you forget to unmount the old one.
let cardMountedEl: HTMLElement | null = null

const stripeMountEl = ref<HTMLDivElement | null>(null)
const stripeReady = ref(false)
const stripeInitError = ref<string | null>(null)
const cardError = ref<string | null>(null)
const cardComplete = ref(false)
// Stripe's `change` event carries `empty`, `complete` and `error`. We keep all
// three, because they are three different sentences to the customer. See the
// `commitBlock` computed for how they are spent.
const cardEmpty = ref(true)

// Callback template ref for the mount target (see the template comment for why a
// string ref would be wrong inside `v-for`). Vue calls this with the element on
// mount and with `null` on unmount, which is the whole state machine we need.
const setStripeMountEl = (el: any) => {
  stripeMountEl.value = (el as HTMLDivElement | null) ?? null
  if (stripeMountEl.value) mountCard(stripeMountEl.value)
}

const mountCard = (el: HTMLElement | null) => {
  if (!cardElement || !el) return
  if (cardMountedEl === el) return
  if (cardMountedEl) {
    try { cardElement.unmount() } catch {}
  }
  cardElement.mount(el)
  cardMountedEl = el
}

const extractClientSecret = (): string | null => {
  const sessions = (cart.value as any)?.payment_collection?.payment_sessions ?? []
  const stripeSession = sessions.find((s: any) => isStripeProvider(s?.provider_id))
  return stripeSession?.data?.client_secret ?? null
}

const teardownStripe = () => {
  if (cardElement) {
    try { cardElement.unmount() } catch {}
    try { cardElement.destroy() } catch {}
    cardElement = null
  }
  cardMountedEl = null
  stripeElements = null
  stripeClientSecret = null
  stripeReady.value = false
  cardError.value = null
  cardComplete.value = false
}

const initStripe = async () => {
  if (stripeInitInFlight) return
  if (cardElement) return // already mounted
  if (!stripeConfigured) {
    // Unreachable in practice, the card row is marked unavailable before it can
    // be selected, so nothing calls this. Kept as a guard, with the developer
    // diagnostic emitted from warnIfStripeMisconfigured() on entering the step
    // instead, where it fires whether or not anyone touches the radio.
    // `stripeConfigured` already drives availability, so `stripeInitError` stays
    // reserved for runtime init failures.
    return
  }
  stripeInitInFlight = true
  stripeInitError.value = null
  try {
    // 1) Load Stripe.js once (singleton in useStripe()).
    if (!stripeInstance) {
      stripeInstance = await stripePromise
      if (!stripeInstance) {
        throw new Error('Failed to load Stripe.js.')
      }
    }

    // 2) Initiate payment session on the cart so Medusa creates the
    //    PaymentIntent and exposes its client_secret.
    await sdk.store.payment.initiatePaymentSession(
      cart.value as any,
      { provider_id: STRIPE_PROVIDER_ID, data: {} } as any,
    )
    await refresh()
    stripeClientSecret = extractClientSecret()
    if (!stripeClientSecret) {
      throw new Error('Stripe payment session was created but no client_secret was returned.')
    }

    // Dev-only debug hook for headless E2E verification. Stripped from prod.
    if (import.meta.dev && import.meta.client) {
      ;(window as any).__gmsStripeDebug = {
        provider: STRIPE_PROVIDER_ID,
        clientSecretPrefix: stripeClientSecret.slice(0, 18),
        hasClientSecret: true,
        elementsMounted: true,
      }
    }

    // 3) Create Elements + Card Element. Note: we do NOT pass `clientSecret`
    //    to elements(), that switches Elements into Payment-Element mode.
    //    For the standalone Card Element + confirmCardPayment flow we hand
    //    the secret directly to confirmCardPayment().
    stripeElements = stripeInstance.elements()
    cardElement = stripeElements.create('card', {
      // ---------------------------------------------------------------------
      // `true`, and this is the entire fix for "Place order is permanently
      // greyed out on a valid card".
      //
      // WHAT ACTUALLY HAPPENED (measured, not inferred)
      //   The card Element does NOT render a postal field when it mounts. It
      //   reveals one LATER, the instant the card number identifies an issuing
      //   country that uses postal-code AVS. Measured on this page, character
      //   by character:
      //
      //     step                       postal field   cardComplete   cardError
      //     empty element              ABSENT         false          null
      //     after typing 4242…4242     APPEARS empty  false          null
      //     + expiry + CVC             still empty    false          null
      //
      //   4242…4242 is a US-issued test Visa, so the revealed field is
      //   validated as a US ZIP — on a GBP store whose live region is the
      //   United Kingdom. A British customer typing SW1A 1AA is silently
      //   rejected. Measured end state: `10001` -> button ENABLED;
      //   `SW1A1AA` -> button DISABLED.
      //
      //   And it is INVISIBLE, because an empty required field is *incomplete*,
      //   not *invalid*: `event.error` stays null, so the `change` handler
      //   below had nothing to show. The customer got a dead button, no
      //   message, and a field they never saw appear.
      //
      // WHY HIDING IT IS CORRECT, NOT A WORKAROUND
      //   1. It is duplicate data entry. The shipping step already collects
      //      `#ship-postal` as a REQUIRED field, and `onSaveShipping` writes it
      //      to BOTH `shipping_address` and `billing_address` on the cart.
      //   2. Stripe still gets it. `buildBillingDetails()` reads that same
      //      postal code onto `billing_details.address.postal_code`, which is
      //      handed to `confirmCardPayment()` below — so AVS and Radar receive
      //      a postal code exactly as before. This is Stripe's own documented
      //      pairing for a hidden postal field ("Collect Postal Code
      //      Separately", stripe-js card-elements docs): hide it here, supply
      //      it in billing_details there. Both halves were already present;
      //      only the hiding was missing.
      //   3. Nothing downstream reads the Element's postal field. The only
      //      postal codes in this app come from the address forms.
      //
      //   So this removes the whole bug class rather than teaching one widget
      //   about one country: there is no format left for the Element to reject,
      //   and the postal code the customer actually typed — in their own
      //   country's format, into a field they can see — is the one Stripe
      //   receives.
      // ---------------------------------------------------------------------
      hidePostalCode: true,
      style: {
        base: {
          fontFamily: 'Inter Tight, system-ui, sans-serif',
          fontSize: '15px',
          color: '#171717',
          '::placeholder': { color: '#73777E' },
        },
        invalid: { color: '#D43A2F' },
      },
    })

    cardElement.on('change', (event: StripeCardElementChangeEvent) => {
      cardError.value = event.error?.message ?? null
      cardComplete.value = event.complete
      // `empty` is the third state and the reason this line exists. Stripe
      // distinguishes "you have not started" (empty) from "you are part-way"
      // (!empty && !complete) from "this is wrong" (error). Without `empty` the
      // first two collapse into one, and the customer who has typed nothing
      // gets told to "complete" details they have not begun.
      cardEmpty.value = event.empty
    })

    // 4) Reveal the mount target (v-show flips), then wait for the DOM to
    //    flush before calling .mount() so Stripe sees a real, sized node.
    stripeReady.value = true
    await nextTick()
    if (stripeMountEl.value) {
      mountCard(stripeMountEl.value)
    } else {
      throw new Error('Stripe mount target not found.')
    }
  } catch (e: any) {
    // Technical detail, for the console only. Every message that can land here
    // is developer-facing ("no client_secret was returned", "Failed to load
    // Stripe.js") and none of it tells a customer anything they can act on. The
    // customer-facing consequence is expressed once, as row availability.
    stripeInitError.value = e?.message || 'Failed to initialize Stripe.'
    console.error('[checkout] Stripe initialisation failed; card payments are being presented as unavailable.', e)
    teardownStripe()
  } finally {
    stripeInitInFlight = false
  }
}

// React to provider radio changes. Selecting Stripe initializes (idempotent);
// selecting anything else tears down so the iframe doesn't linger.
watch(selectedProviderId, (next, prev) => {
  if (isStripeProvider(next)) {
    void initStripe()
  } else if (isStripeProvider(prev)) {
    teardownStripe()
  }
})

// The developer half of Task 1. The customer sees "card payments are temporarily
// unavailable, here is another way through"; the missing configuration is named
// here, once, on the console, for whoever can actually fix it.
//
// Fired on entering the payment step rather than from initStripe(), because the
// card row is now marked unavailable *before* it can be selected, so initStripe()
// never runs in the misconfigured case and a warning parked there would never be
// seen. `import.meta.client` guards it off the SSR log.
let warnedAboutStripeConfig = false
const warnIfStripeMisconfigured = () => {
  if (warnedAboutStripeConfig || stripeConfigured || !import.meta.client) return
  warnedAboutStripeConfig = true
  console.warn(
    '[checkout] Stripe is not configured: NUXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is empty. ' +
      'Card payments are being presented to customers as unavailable. ' +
      (hasBankTransferFallback.value
        ? 'The bank-transfer fallback has been unlocked in its place.'
        : 'No other payment provider is registered in Medusa, so the only route left for ' +
          'the customer is emailing us for a payment link, register the manual provider ' +
          '(pp_system_default) if you want a self-serve fallback.') +
      ' Set the key and redeploy to restore card payments.',
  )
}

// Tear down on step change away from payment + on unmount.
watch(step, (next) => {
  if (next === 2) warnIfStripeMisconfigured()
  else teardownStripe()
})

onBeforeUnmount(() => {
  teardownStripe()
})

// ---------------------------------------------------------------------------
// Payment method availability
//
// Previously `visibleProviders` FILTERED unavailable providers out. Two things
// went wrong with that:
//
//  1. The customer could not tell "we don't offer this" from "this is down right
//     now". Absence carries no information, so a temporary outage read as a
//     permanent product decision.
//  2. With one provider configured, a filtered list renders as a single lonely
//     radio (the form of a choice with none of the substance) and when that
//     one provider was misconfigured the list emptied and the step dead-ended.
//
// So: return EVERY provider, annotated. Unavailable rows render in position,
// greyed, labelled, non-selectable, each carrying its own one-line reason
// (Instacart's delivery-slot pattern; Shopify's Dawn theme does the same with
// struck-through sold-out variants rather than removing them).
//
// Declared here, after the Stripe lifecycle block, because availability for the
// card row is a function of `stripeConfigured` and `stripeInitError`.
// ---------------------------------------------------------------------------

// Cards are unavailable if the key was never configured (deployment fault) or if
// Stripe.js / the payment session failed to come up (runtime fault). Both are
// invisible to the customer as causes; only the consequence is shown.
const cardUnavailable = computed(() => !stripeConfigured || Boolean(stripeInitError.value))

// Manual/system_default is normally kept out of production: it books an order
// against a promise to pay rather than a captured payment, and we don't want it
// sitting next to a working card form as a casual one-click option.
//
// But when cards are down it is the only thing standing between a 250-unit POD
// order and an abandoned basket, and it is a payment route this business already
// advertises in the FAQ ("bank transfers, and purchase orders"). So it unlocks
// as the fallback rather than staying hidden. The exposure is one invoiced order
// during an outage; the alternative is a checkout with no path through it.
const bankTransferAvailable = computed(() => !isProd || cardUnavailable.value)
const bankTransferUnavailableReason =
  'Available for trade and bulk accounts. Contact us to set one up.'

// Whether a bank-transfer row will actually be sitting there to fall back to.
// This deployment currently has ONLY the Stripe provider registered in Medusa,
// so the honest answer is usually "no", and the copy has to know that. Pointing
// a customer at a "bank transfer below" that isn't below is worse than saying
// nothing. Derived from `providers` rather than `paymentOptions` to avoid a
// circular computed.
const hasBankTransferFallback = computed(
  () => bankTransferAvailable.value && providers.value.some((p: any) => isManualProvider(p?.id)),
)

// Written from the customer's side of the screen: what happened, and what they
// can do next. No apology, no cause, no internal vocabulary, and above all no
// environment variable, the developer diagnostic goes to the console in
// warnIfStripeMisconfigured() instead.
const cardUnavailableReason = computed(() =>
  hasBankTransferFallback.value
    ? 'Temporarily unavailable. Use bank transfer below.'
    : 'Temporarily unavailable. Email us and we’ll send you a payment link.',
)

interface PaymentOption {
  id: string
  label: string
  hint: string
  marks: string[]
  marksSrText: string
  available: boolean
  unavailableReason: string
}

const paymentOptions = computed<PaymentOption[]>(() =>
  providers.value
    .filter((p: any) => Boolean(p?.id))
    .map((p: any) => {
      const id = p.id as string
      const available = isStripeProvider(id)
        ? !cardUnavailable.value
        : isManualProvider(id)
          ? bankTransferAvailable.value
          : true
      return {
        id,
        label: providerLabel(id),
        hint: providerHint(id),
        marks: providerMarks(id),
        marksSrText: providerMarksSrText(id),
        available,
        unavailableReason: isStripeProvider(id)
          ? cardUnavailableReason.value
          : isManualProvider(id)
            ? bankTransferUnavailableReason
            : 'Temporarily unavailable.',
      }
    }),
)

const selectedOption = computed(() => paymentOptions.value.find((o) => o.id === selectedProviderId.value) ?? null)

// ---------------------------------------------------------------------------
// Region-level payment availability
//
// Distinct from `paymentAdvisory` below, and the distinction is the whole point.
// The advisory is for "one of several methods is down" -- the customer still has
// a way to pay. This is for "this region has NO payment provider linked at all",
// which is a store configuration gap, not an outage and not customer error. No
// amount of retrying, re-entering card details or waiting will help.
//
// This was a live defect: the EU and US regions had no row in
// `region_payment_provider`, so `/store/payment-providers` returned an empty
// array and the customer reached a Payment step that could not take payment.
// Region switching only became reachable when RegionSelector moved into the
// footer, which is why it surfaced when it did.
//
// Keyed off `providers` (the raw API response) rather than `paymentOptions`
// (the availability-annotated view). An empty `paymentOptions` can also mean
// "providers exist but Stripe failed to initialise", which is a DIFFERENT
// condition that the advisory band already explains correctly. Conflating them
// would tell a customer their region is unsupported when Stripe was merely slow.
// ---------------------------------------------------------------------------
const activeRegionName = computed(
  () =>
    ((cart.value as any)?.region?.name as string | undefined) ||
    ((regionState.region.value as any)?.name as string | undefined) ||
    '',
)

const noPaymentMethodsForRegion = computed(
  () => !providersLoading.value && providers.value.length === 0,
)

const regionPaymentMessage = computed(() =>
  activeRegionName.value
    ? `We can’t take online payment for ${activeRegionName.value} yet.`
    : 'We can’t take online payment for your selected region yet.',
)

// Group-level advisory, shown once above the radios rather than repeated per row
// (Instacart: "Some delivery options are affected by store operating hours").
// It exists to keep the flow moving, it names the alternative that is sitting
// directly below it, so the customer's next action is visible without scrolling
// or interpreting. Returns null when everything is selectable, so the band
// never occupies space it hasn't earned.
const paymentAdvisory = computed(() => {
  if (!paymentOptions.value.some((o) => !o.available)) return null
  if (cardUnavailable.value) {
    return {
      title: 'Card payments are temporarily unavailable',
      body: hasBankTransferFallback.value
        ? 'You can pay by bank transfer below. We’ll email an invoice with our bank details as soon as you place the order. Or email us and we’ll send you a payment link instead.'
        : 'Email us and we’ll send you a payment link for this order. Your basket is saved, so nothing is lost.',
    }
  }
  return {
    title: 'One payment method isn’t available for this order',
    body: 'The methods below are the ones you can use today. If you need a different one, email us and we’ll arrange it.',
  }
})

// Prefilled so the customer doesn't have to describe their own basket, and so
// support can price the payment link without a round trip. `cartId` is the
// basket reference we can look the order up by.
const paymentLinkMailto = computed(() => {
  const body = [
    'Hi GhostMark,',
    '',
    'Card payments weren’t available at checkout. Please send me a payment link for this order.',
    '',
    `Order total: ${cartTotal.value}`,
    // Only the basket reference is conditional, the blank lines above are
    // deliberate paragraph breaks and must survive.
    ...(cartId.value ? [`Basket reference: ${cartId.value}`] : []),
  ].join('\n')
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Payment link request')}&body=${encodeURIComponent(body)}`
})

// If the currently-selected method becomes unavailable underneath the customer,
// which is the normal case, because Stripe's failure resolves asynchronously
// after we've already defaulted the selection to it, move them onto something
// they can actually use rather than leaving a checked radio wired to a dead
// button. Clearing to '' when nothing is selectable is deliberate: the advisory
// band and the email action then carry the whole flow.
watch(
  () => [selectedOption.value?.available, paymentOptions.value.length] as const,
  () => {
    if (selectedOption.value?.available) return
    selectedProviderId.value = paymentOptions.value.find((o) => o.available)?.id ?? ''
  },
)

const placing = ref(false)
const payError = ref<string | null>(null)
const orderResult = ref<string | null>(null)
// Customer-facing order number (`GMS-<ULID>`) now comes from `~/utils/orderNumber`.
//
// It used to be declared right here, inline, which meant it was not exported and
// therefore could not be reused — so the new confirmation route would have had to
// copy it, adding a fifth hand-synced copy of the function this repo already
// cites as its standing example of hand-synced duplication (see the header of
// `~/utils/printMetadata`). Lifting it instead makes the storefront count go
// DOWN: checkout.vue and /order/confirmed/[number] now share one definition.
//
// Still hand-synced, and still CRITICAL, are the two backend copies in
// `ghostmark/` — a storefront util cannot be imported across that package
// boundary. The email and this page must render the same string.
const confirmationDisplayId = ref<string | null>(null)
const confirmationOrderId = ref<string | null>(null)

/**
 * WHY THIS REPLACED A BARE BOOLEAN
 * -----------------------------------------------------------------------------
 * `placeDisabled` used to be a computed that returned `true` for five unrelated
 * reasons and told the customer none of them. Every one of the five rendered the
 * SAME thing: a greyed-out "Place order" with nothing beside it. A disabled
 * primary CTA with no explanation is indistinguishable from a broken site, and
 * that is exactly how the live postal-code defect presented — the customer typed
 * a valid card and the button simply never woke up.
 *
 * So the reason is now the primary value and the boolean is DERIVED from it.
 * That inversion is the point: it is structurally impossible to add a new way of
 * disabling this button without also writing the sentence that explains it,
 * because the only way to disable it is to return a block object.
 *
 * Two rules for the copy, both deliberate:
 *
 *   role  — `alert` for a genuine fault the customer must react to (assertive,
 *           interrupts). `status` for a "not yet" state that is simply the flow
 *           working normally (polite, waits its turn). Announcing "you have not
 *           filled the card in yet" assertively, on arrival, would be hostile.
 *
 *   text  — says what to DO, not what is wrong. "Complete your card details to
 *           continue", never "Card incomplete". The customer is not filing a bug
 *           report; they are trying to finish buying something.
 *
 * `text: null` is a real case, not an oversight: the card-invalid block still
 * disables the button, but its message is already rendered against the card
 * field itself by `cardError`. Repeating it under the button would say the same
 * thing twice and put it further from the field it is about.
 *
 * NOTE ON REACTIVITY: `cardElement` and `stripeClientSecret` are plain `let`s,
 * not refs, so they do not themselves trigger re-evaluation. This is safe for
 * the same reason it was safe in the boolean this replaced: `stripeReady` is a
 * ref and is flipped in the same tick those two are assigned, so the computed
 * re-runs at exactly the moment their values change. They are kept in the
 * condition as a genuine belt-and-braces against a half-initialised Stripe.
 */
type CommitBlock = {
  code: 'placing' | 'no-method' | 'method-unavailable' | 'stripe-loading' | 'card-empty' | 'card-partial' | 'card-invalid'
  role: 'alert' | 'status'
  text: string | null
}

const commitBlock = computed<CommitBlock | null>(() => {
  if (placing.value) {
    return {
      code: 'placing',
      role: 'status',
      text: 'Placing your order. This can take a few seconds — please don’t refresh or go back.',
    }
  }
  if (!selectedProviderId.value) {
    // Two very different situations wear this same condition, and telling them
    // apart is the difference between useful and insulting.
    //
    //   Methods exist and one is selectable -> the customer simply hasn't picked
    //   one. Ask them to pick.
    //
    //   NOTHING is selectable -> the auto-reselect watcher cleared the selection
    //   because there was nothing to move to. Telling that customer to "choose a
    //   payment method" asks them to do something the page has made impossible.
    //   Measured live by blocking js.stripe.com: that is exactly what this said.
    //
    // In the second case the explanation is already on screen and is already an
    // alert: `paymentAdvisory` renders whenever ANY option is unavailable, so
    // when NONE is available it is guaranteed to be showing, naming the cause
    // and offering the email fallback. Repeating it under the button would say
    // the same thing twice, two inches apart. So the block carries no text — and
    // the "never a silent disabled CTA" rule still holds, because the advisory
    // band IS the visible explanation. (If there are no payment options at all,
    // this button is `v-if`'d out entirely and the zero-provider alert takes
    // over, so there is no third case hiding here.)
    const anySelectable = paymentOptions.value.some((o) => o.available)
    return anySelectable
      ? { code: 'no-method', role: 'status', text: 'Choose a payment method to continue.' }
      : { code: 'no-method', role: 'status', text: null }
  }
  // A method that has gone unavailable must never be committable, even if it was
  // selected before it went down. The auto-reselect watcher should already have
  // moved off it; this is the belt to that pair of braces.
  if (!selectedOption.value?.available) {
    const reason = selectedOption.value?.unavailableReason
    return {
      code: 'method-unavailable',
      role: 'alert',
      text: reason
        ? `That payment method isn’t available right now: ${reason} Choose another method above, or email us for a payment link.`
        : 'That payment method isn’t available right now. Choose another method above, or email us for a payment link.',
    }
  }
  if (isStripeSelected.value) {
    if (!stripeReady.value || !cardElement || !stripeClientSecret) {
      return {
        code: 'stripe-loading',
        role: 'status',
        text: 'Setting up secure card payment. One moment.',
      }
    }
    // Invalid beats incomplete: if Stripe has an actual complaint, that is the
    // thing to act on, and it is already on screen next to the field.
    if (cardError.value) {
      return { code: 'card-invalid', role: 'alert', text: null }
    }
    if (!cardComplete.value) {
      return cardEmpty.value
        ? { code: 'card-empty', role: 'status', text: 'Enter your card details to continue.' }
        : { code: 'card-partial', role: 'status', text: 'Complete your card details to continue.' }
    }
  }
  return null
})

/**
 * Derived, never authored. If this is true there is always a `commitBlock`
 * carrying the reason, and the template renders it.
 */
const placeDisabled = computed(() => commitBlock.value !== null)

// Walmart's "Place order for $1.06". The amount is restated at the exact moment
// of commitment, which is worth more here than on a typical consumer checkout,
// because a POD run of 250 units puts a four-figure number behind this button
// and this codebase has had the quoted total and the charged total diverge.
//
// Falls back to the bare label when the total can't be rendered (`cartTotal`
// returns '-' for an unformattable amount): a button reading "Place order for -"
// would be worse than one that simply says "Place order".
const placeOrderLabel = computed(() => {
  const total = cartTotal.value
  if (!total || total === '-') return 'Place order'
  return `Place order for ${total}`
})

const buildBillingDetails = () => {
  const c = cart.value as any
  const billing = c?.billing_address ?? c?.shipping_address ?? {}
  return {
    name: [billing.first_name, billing.last_name].filter(Boolean).join(' ') || undefined,
    email: c?.email || undefined,
    phone: billing.phone || undefined,
    address: {
      city: billing.city || undefined,
      country: billing.country_code || undefined,
      line1: billing.address_1 || undefined,
      line2: billing.address_2 || undefined,
      postal_code: billing.postal_code || undefined,
      state: billing.province || undefined,
    },
  }
}

const finalizeOrder = async () => {
  const result: any = await complete()
  // Medusa V2 returns either { type: 'order', order } on success or
  // { type: 'cart', cart, error } when payment finalisation fails.
  if (result?.type === 'cart' && result?.error) {
    throw new Error(result.error?.message || 'Cart could not be completed.')
  }
  const order = result?.order ?? (result?.type === 'order' ? result?.order : null) ?? result
  confirmationOrderId.value = order?.id || result?.id || null
  confirmationDisplayId.value = formatOrderNumber(confirmationOrderId.value)

  // ---------------------------------------------------------------------------
  // CAPABILITY TOKEN for the confirmation page.
  //
  // `GET /store/orders/:id` used to be open — an order id plus the publishable
  // key returned the customer's email, name and delivery address to anyone.
  // It is now gated (ghostmark/src/api/middlewares.ts), which would have broken
  // this hand-off, because the customer who just paid is a GUEST with no
  // account and nothing to authenticate with.
  //
  // So the backend mints a short-lived token bound to this one order and
  // appends it to THIS response — the completion response, the one request in
  // the system where possession of the cart id already proves the caller is the
  // person placing the order. We are the only caller who ever sees it.
  //
  // If it is absent we still navigate. A guest then lands on a 401 and is shown
  // the calm "we can't find that order" state, which is bad — but the
  // alternative, refusing to navigate at all, would strand a customer whose
  // money has already moved on a payment form they might pay from twice. Same
  // reasoning as the navigation fallback immediately below.
  // ---------------------------------------------------------------------------
  const orderAccessToken: string | null
    = typeof result?.order_access_token === 'string' && result.order_access_token
      ? result.order_access_token
      : null
  if (!orderAccessToken) {
    console.warn('[checkout] No order access token on the completion response; the confirmation page will fall back to authenticated access only.')
  }

  // Clear the cart cookie so a fresh cart is created on the next visit.
  cartId.value = null

  // -------------------------------------------------------------------------
  // HAND OFF TO THE REAL CONFIRMATION ROUTE.
  //
  // The confirmation used to be step 3 of this component, rendered at /checkout
  // with the order held only in memory. That meant: a refresh or a back-button
  // landed the customer on a checkout for a cart that no longer exists, the
  // order had no shareable or bookmarkable URL, and analytics had no distinct
  // page view to fire a purchase event on. /order/confirmed/<GMS-…> fixes all
  // four by being an actual address that re-fetches the actual order.
  //
  // FALLBACK, NOT DEAD CODE: if navigation fails for any reason, we fall
  // through to `step = 3`. The money has already moved by the time we are here.
  // A router failure must never be able to swallow "your order was placed" and
  // leave the customer staring at a payment form they might pay from twice.
  // -------------------------------------------------------------------------
  if (confirmationDisplayId.value) {
    try {
      // `?t=` carries the capability token minted above. The confirmation page
      // forwards it as the `x-order-access-token` header on its own fetch; see
      // the ACCESS MODEL block in /order/confirmed/[number].vue for why the URL
      // is the carrier (that page is server-rendered, so a cookie would not be
      // attached to its fetch).
      const confirmedPath = `/order/confirmed/${encodeURIComponent(confirmationDisplayId.value)}`
      await navigateTo(
        orderAccessToken
          ? `${confirmedPath}?t=${encodeURIComponent(orderAccessToken)}`
          : confirmedPath,
      )
      return
    } catch (e) {
      console.error('[checkout] Order placed but navigation to the confirmation route failed; falling back to the in-page confirmation.', e)
    }
  }
  step.value = 3
}

const onPlaceOrder = async () => {
  // BOTH of these guards used to `return` in silence, and silence on the screen
  // where someone is trying to pay is the worst possible failure mode: the
  // customer presses the button, nothing moves, and there is nothing to read.
  //
  // The first one is the guard that actually fired in the live defect. With no
  // provider linked to the region, `loadProviders()` sets `selectedProviderId`
  // to `''`, so this line was reached on every attempt and returned without a
  // word. A guard that refuses to act MUST say why, in the place the customer
  // is acting. Setting `payError` renders the existing role="alert" further up.
  if (!selectedProviderId.value) {
    payError.value = noPaymentMethodsForRegion.value
      ? `${regionPaymentMessage.value} Switch to a region we support, or email us and we’ll send you a payment link for this order.`
      : 'Choose a payment method to continue.'
    return
  }
  // Refuse an unavailable method at the call site too, not just in the disabled
  // computed. `disabled` is a UI affordance; this is the actual gate.
  // `unavailableReason` is already computed per option, so reuse it rather than
  // inventing a second, vaguer wording for the same condition.
  if (!selectedOption.value?.available) {
    const reason = selectedOption.value?.unavailableReason
    payError.value = reason
      ? `That payment method isn’t available right now: ${reason}`
      : 'That payment method isn’t available right now. Choose another method, or email us for a payment link.'
    return
  }
  placing.value = true
  payError.value = null
  try {
    if (isStripeSelected.value) {
      // Stripe branch: confirmCardPayment, then Medusa cart.complete().
      if (!stripeInstance || !cardElement || !stripeClientSecret) {
        throw new Error('Stripe is not ready. Please wait a moment and try again.')
      }
      const { error, paymentIntent } = await stripeInstance.confirmCardPayment(
        stripeClientSecret,
        {
          payment_method: {
            card: cardElement,
            billing_details: buildBillingDetails(),
          },
        },
      )
      if (error) {
        cardError.value = error.message ?? 'Card was declined.'
        return
      }
      if (paymentIntent?.status !== 'succeeded' && paymentIntent?.status !== 'requires_capture') {
        cardError.value = `Payment status: ${paymentIntent?.status ?? 'unknown'}.`
        return
      }
      await finalizeOrder()
    } else {
      // Manual / system_default branch: legacy flow.
      await sdk.store.payment.initiatePaymentSession(
        cart.value as any,
        { provider_id: selectedProviderId.value, data: {} } as any,
      )
      await refresh()
      await finalizeOrder()
    }
  } catch (e: any) {
    payError.value = e?.message || 'Failed to place order.'
  } finally {
    placing.value = false
  }
}
</script>
