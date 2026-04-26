<script setup lang="ts">
/**
 * /swatches — Material swatch packs.
 *
 * Editorial sample-request page:
 *   - Hero: eyebrow "Materials" + serif "Order a free swatch pack"
 *   - 3-up grid of swatch types (cream-tile cards, placeholder swatch)
 *   - Request form (UiField + UiInput + UiButton merchery)
 *   - Policy note about lead time + free of charge
 */
import { reactive, ref } from 'vue'

defineOptions({ name: 'PageSwatches' })

useHead({
  title: 'Material swatches · GhostMark Studio',
  meta: [
    {
      name: 'description',
      content:
        'Order a free GhostMark Studio swatch pack — apparel cottons, hoodie blends and drinkware finishes, posted to your door inside five working days.',
    },
  ],
})

interface SwatchPack {
  id: 'apparel' | 'hoodie' | 'drinkware'
  title: string
  body: string
  swatchClass: string
}

const packs: SwatchPack[] = [
  {
    id: 'apparel',
    title: 'Apparel cottons',
    body:
      'Six weights of GOTS-certified cotton — single-jersey 160 gsm through to garment-dyed 240 gsm — labelled with composition, weave and a square inch of every print method we offer on it.',
    swatchClass: 'bg-cream-tile',
  },
  {
    id: 'hoodie',
    title: 'Hoodie blends',
    body:
      'Brushed cotton-poly blends, French terry and recycled fleece. Four colourways per blend, each tagged with shrink rate, drape and the embroidery substrate we recommend for it.',
    swatchClass: 'bg-cream-warm',
  },
  {
    id: 'drinkware',
    title: 'Drinkware finishes',
    body:
      'Ceramic, stainless and double-walled glass with the four finishes we offer — matte glaze, gloss glaze, etched and screened. A mini set, but enough to commit to a colour and a method.',
    swatchClass: 'bg-merchery-sage',
  },
]

const submitted = ref(false)
const form = reactive({
  name: '',
  email: '',
  company: '',
  address: '',
  postal: '',
  country: '',
  pack: 'apparel' as SwatchPack['id'],
})

const onSubmit = () => {
  // Hand-off to the real fulfilment endpoint will land in a later phase.
  // For now we mark the form as submitted so the success state is visible
  // and the button reflects the post-submit copy.
  submitted.value = true
}
</script>

<template>
  <div class="bg-white text-ink-950">
    <!-- ============================================================
         1. Hero
         ============================================================ -->
    <section
      class="bg-merchery-tile"
      aria-labelledby="swatches-hero-heading"
    >
      <div class="mx-auto grid max-w-[1320px] grid-cols-1 gap-x-[30px] gap-y-10 px-gutter py-section lg:grid-cols-2 lg:items-center">
        <div class="flex flex-col gap-6">
          <p class="text-eyebrow font-body uppercase text-ink-500">
            Materials
          </p>
          <h1
            id="swatches-hero-heading"
            class="font-display text-display-lg font-normal text-ink-950"
          >
            Order a free swatch pack.
          </h1>
          <p class="max-w-[48ch] font-body text-body text-ink-700">
            Hold the cotton, see the colour against daylight, scratch the
            glaze with a thumbnail. We post a curated swatch pack to
            anyone weighing a real production run — no card required.
          </p>
          <div class="flex flex-wrap gap-3 pt-2">
            <UiButton
              variant="merchery"
              size="lg"
              as="a"
              to="#request"
            >
              Request a pack
            </UiButton>
            <UiButton
              variant="outline"
              size="lg"
              as="NuxtLink"
              to="/categories"
            >
              Browse the catalog
            </UiButton>
          </div>
        </div>

        <div class="aspect-[4/5] w-full overflow-hidden bg-cream-tile">
          <div class="flex h-full w-full items-center justify-center">
            <span
              class="font-body text-caption text-ink-400"
              aria-label="Image placeholder"
            >Image &mdash; swatch pack laid out</span>
          </div>
        </div>
      </div>
    </section>

    <!-- ============================================================
         2. Three swatch packs
         ============================================================ -->
    <section
      class="bg-white"
      aria-labelledby="swatches-packs-heading"
    >
      <div class="mx-auto max-w-[1320px] px-gutter py-section">
        <div class="flex flex-col gap-3 pb-12 lg:max-w-[44rem]">
          <p class="text-eyebrow font-body uppercase text-ink-500">
            What's in the pack
          </p>
          <h2
            id="swatches-packs-heading"
            class="font-display text-display-md font-normal text-ink-950"
          >
            Three packs, pick the one that fits your brief.
          </h2>
        </div>

        <ul class="grid grid-cols-1 gap-x-[30px] gap-y-12 md:grid-cols-3">
          <li
            v-for="pack in packs"
            :key="pack.id"
            class="flex flex-col gap-4"
          >
            <div :class="[pack.swatchClass, 'aspect-[4/5] w-full overflow-hidden']">
              <div class="flex h-full w-full items-center justify-center">
                <span
                  class="font-body text-caption text-ink-500"
                  aria-label="Swatch placeholder"
                >Swatch &mdash; {{ pack.title }}</span>
              </div>
            </div>
            <h3 class="font-display text-display-sm font-normal text-ink-950">
              {{ pack.title }}
            </h3>
            <p class="font-body text-body text-ink-700">
              {{ pack.body }}
            </p>
          </li>
        </ul>
      </div>
    </section>

    <!-- ============================================================
         3. Request a swatch — form
         ============================================================ -->
    <section
      id="request"
      class="bg-cream-warm"
      aria-labelledby="swatches-form-heading"
    >
      <div class="mx-auto grid max-w-[1320px] grid-cols-1 gap-x-[30px] gap-y-12 px-gutter py-section lg:grid-cols-[minmax(0,0.4fr)_minmax(0,0.6fr)]">
        <div class="flex flex-col gap-3">
          <p class="text-eyebrow font-body uppercase text-ink-500">
            Request a swatch
          </p>
          <h2
            id="swatches-form-heading"
            class="font-display text-display-md font-normal text-ink-950"
          >
            Where shall we send it?
          </h2>
          <p class="max-w-[44ch] font-body text-body text-ink-700">
            We post Monday through Thursday. Anything ordered before
            Wednesday lunchtime is usually on a doormat by the end of
            the week.
          </p>
        </div>

        <form
          class="flex flex-col gap-5 bg-white p-8 lg:p-10"
          novalidate
          @submit.prevent="onSubmit"
        >
          <UiField label="Pack" required>
            <select
              v-model="form.pack"
              class="h-11 w-full rounded-md border border-ink-200 bg-white px-3.5 text-sm text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-300 focus-visible:ring-offset-2 focus-visible:ring-offset-cream-50 transition-[border-color,box-shadow] duration-fast ease-emphasis motion-reduce:transition-none"
            >
              <option
                v-for="pack in packs"
                :key="pack.id"
                :value="pack.id"
              >
                {{ pack.title }}
              </option>
            </select>
          </UiField>

          <div class="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <UiField label="Name" required>
              <UiInput
                v-model="form.name"
                type="text"
                autocomplete="name"
                placeholder="Mira Lefevre"
              />
            </UiField>
            <UiField label="Email" required>
              <UiInput
                v-model="form.email"
                type="email"
                autocomplete="email"
                placeholder="hello@example.com"
              />
            </UiField>
          </div>

          <UiField label="Company">
            <UiInput
              v-model="form.company"
              type="text"
              autocomplete="organization"
              placeholder="Studio name (optional)"
            />
          </UiField>

          <UiField label="Shipping address" required>
            <UiInput
              v-model="form.address"
              type="text"
              autocomplete="street-address"
              placeholder="Street, number, apt"
            />
          </UiField>

          <div class="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <UiField label="Postal code" required>
              <UiInput
                v-model="form.postal"
                type="text"
                autocomplete="postal-code"
                placeholder="1050"
              />
            </UiField>
            <UiField label="Country" required>
              <UiInput
                v-model="form.country"
                type="text"
                autocomplete="country-name"
                placeholder="Belgium"
              />
            </UiField>
          </div>

          <UiButton
            variant="merchery"
            size="lg"
            type="submit"
            block
            :disabled="submitted"
          >
            {{ submitted ? 'Pack on its way' : 'Send me the swatches' }}
          </UiButton>

          <p
            v-if="submitted"
            class="font-body text-caption text-ink-700"
            role="status"
          >
            Thanks — we've logged your request and will dispatch within
            five working days.
          </p>
        </form>
      </div>
    </section>

    <!-- ============================================================
         4. Policy note
         ============================================================ -->
    <section
      class="bg-white"
      aria-labelledby="swatches-policy-heading"
    >
      <div class="mx-auto max-w-[1320px] px-gutter py-section">
        <div class="bg-merchery-tile p-10 lg:p-14">
          <h2
            id="swatches-policy-heading"
            class="font-display text-display-md font-normal leading-tight text-ink-950"
          >
            Free, posted within five working days.
          </h2>
          <p class="mt-4 max-w-[60ch] font-body text-body text-ink-700">
            Swatch packs ship within five working days, free of charge,
            anywhere we deliver finished orders. One pack per address —
            if you need multiple for a team review, drop us a line at
            <a
              href="mailto:hello@ghostmark.studio"
              class="underline decoration-dashed decoration-ink-400 underline-offset-4 transition-colors duration-base ease-emphasis hover:decoration-ink-950"
            >hello@ghostmark.studio</a>
            and we'll bundle them.
          </p>
        </div>
      </div>
    </section>
  </div>
</template>
