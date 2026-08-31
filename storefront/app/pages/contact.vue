<template>
  <div>
    <!-- Hero -->
    <div class="bg-[#f5f1ec] py-14 text-center">
      <h1 class="font-serif text-[36px] leading-tight text-ink-950 sm:text-[48px]">Get in touch</h1>
      <p class="mx-auto mt-3 max-w-[50ch] text-[15px] text-ink-700">
        Tell us about your project and we'll get back to you within 24 hours.
      </p>
    </div>

    <div class="mx-auto w-full max-w-rail px-gutter py-12">
      <div class="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <!-- Form -->
        <form class="rounded-2xl border border-ink-200 bg-white p-6 sm:p-8" @submit.prevent="onSubmit">
          <div class="grid gap-5 sm:grid-cols-2">
            <div>
              <label class="text-[13px] text-ink-600" for="c-firstname">First name *</label>
              <input id="c-firstname" v-model="form.firstName" class="mt-1.5 h-11 w-full border border-ink-400 bg-white px-3 text-[14px] text-ink-950 placeholder:text-ink-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-white" type="text" autocomplete="given-name" required />
            </div>
            <div>
              <label class="text-[13px] text-ink-600" for="c-lastname">Last name *</label>
              <input id="c-lastname" v-model="form.lastName" class="mt-1.5 h-11 w-full border border-ink-400 bg-white px-3 text-[14px] text-ink-950 placeholder:text-ink-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-white" type="text" autocomplete="family-name" required />
            </div>
          </div>

          <div class="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <label class="text-[13px] text-ink-600" for="c-email">Company email *</label>
              <input id="c-email" v-model="form.email" class="mt-1.5 h-11 w-full border border-ink-400 bg-white px-3 text-[14px] text-ink-950 placeholder:text-ink-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-white" type="email" autocomplete="email" required />
            </div>
            <div>
              <label class="text-[13px] text-ink-600" for="c-phone">Phone number</label>
              <input id="c-phone" v-model="form.phone" class="mt-1.5 h-11 w-full border border-ink-400 bg-white px-3 text-[14px] text-ink-950 placeholder:text-ink-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-white" type="tel" autocomplete="tel" />
            </div>
          </div>

          <div class="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <label class="text-[13px] text-ink-600" for="c-company">Company name</label>
              <input id="c-company" v-model="form.company" class="mt-1.5 h-11 w-full border border-ink-400 bg-white px-3 text-[14px] text-ink-950 placeholder:text-ink-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-white" type="text" autocomplete="organization" />
            </div>
            <div>
              <label class="text-[13px] text-ink-600" for="c-jobtitle">Job title</label>
              <input id="c-jobtitle" v-model="form.jobTitle" class="mt-1.5 h-11 w-full border border-ink-400 bg-white px-3 text-[14px] text-ink-950 placeholder:text-ink-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-white" type="text" />
            </div>
          </div>

          <div class="mt-5">
            <label class="text-[13px] text-ink-600" for="c-hear">Where did you hear about us?</label>
            <select id="c-hear" v-model="form.hearAboutUs" class="mt-1.5 h-11 w-full border border-ink-400 bg-white px-3 text-[14px] text-ink-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-white">
              <option value="">Select an option</option>
              <option value="google">Google search</option>
              <option value="social">Social media</option>
              <option value="referral">Referral</option>
              <option value="event">Event / Conference</option>
              <option value="press">Press / Blog</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div class="mt-5 grid gap-5 sm:grid-cols-3">
            <div>
              <label class="text-[13px] text-ink-600" for="c-budget">Budget range</label>
              <select id="c-budget" v-model="form.budget" class="mt-1.5 h-11 w-full border border-ink-400 bg-white px-3 text-[14px] text-ink-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-white">
                <option value="">Select</option>
                <option value="under-1k">Under $1,000</option>
                <option value="1k-5k">$1,000 - $5,000</option>
                <option value="5k-10k">$5,000 - $10,000</option>
                <option value="10k-25k">$10,000 - $25,000</option>
                <option value="25k+">$25,000+</option>
              </select>
            </div>
            <div>
              <label class="text-[13px] text-ink-600" for="c-units">Number of units</label>
              <input id="c-units" v-model="form.units" class="mt-1.5 h-11 w-full border border-ink-400 bg-white px-3 text-[14px] text-ink-950 placeholder:text-ink-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-white" type="text" placeholder="e.g. 500" />
            </div>
            <div>
              <label class="text-[13px] text-ink-600" for="c-deadline">Deadline</label>
              <input id="c-deadline" v-model="form.deadline" class="mt-1.5 h-11 w-full border border-ink-400 bg-white px-3 text-[14px] text-ink-950 placeholder:text-ink-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-white" type="date" />
            </div>
          </div>

          <div class="mt-5">
            <label class="text-[13px] text-ink-600" for="c-destination">Ship destination</label>
            <input id="c-destination" v-model="form.destination" class="mt-1.5 h-11 w-full border border-ink-400 bg-white px-3 text-[14px] text-ink-950 placeholder:text-ink-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-white" type="text" placeholder="e.g. UK, EU, USA" />
          </div>

          <div class="mt-5">
            <label class="text-[13px] text-ink-600" for="c-message">Message *</label>
            <textarea id="c-message" v-model="form.message" class="mt-1.5 w-full border border-ink-400 bg-white px-3 py-2.5 text-[14px] text-ink-950 placeholder:text-ink-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-white" rows="5" placeholder="Tell us about your project..." required />
          </div>

          <button
            class="mt-5 inline-flex h-[48px] w-full items-center justify-center bg-ink-950 text-[14px] font-medium tracking-wide text-white hover:bg-ink-800 sm:w-auto sm:px-10"
            type="submit"
            :disabled="submitted"
          >
            {{ submitted ? 'Sent!' : 'Send message' }}
          </button>
          <p v-if="submitted" class="mt-3 text-[14px] text-emerald-700">Thanks! We'll get back to you within 24 hours.</p>
        </form>

        <!-- Right column -->
        <div class="space-y-8">
          <div class="rounded-2xl border border-ink-200 bg-white p-6">
            <h3 class="text-[14px] font-semibold uppercase tracking-wider text-ink-600">Trusted by 2,000+ brands</h3>
            <div class="mt-5 grid grid-cols-3 gap-4">
              <div v-for="brand in trustBrands" :key="brand" class="flex h-14 items-center justify-center rounded-lg bg-cream-50 px-3">
                <span class="text-[13px] font-semibold text-ink-600">{{ brand }}</span>
              </div>
            </div>
          </div>

          <!-- Agency partnership -->
          <div class="rounded-2xl border border-ink-200 bg-white p-6">
            <h3 class="font-serif text-[22px] text-ink-950">Agency partnership</h3>
            <p class="mt-2 text-[14px] leading-relaxed text-ink-700">
              Are you an agency looking for a reliable merch partner for your clients? We offer white-label solutions, dedicated account management, and competitive agency pricing.
            </p>
            <NuxtLink to="/contact" class="mt-4 inline-flex items-center gap-1 text-[14px] font-medium text-ink-950 hover:underline">
              Learn more
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </NuxtLink>
          </div>

          <!-- Platform integration -->
          <div class="rounded-2xl border border-ink-200 bg-white p-6">
            <h3 class="font-serif text-[22px] text-ink-950">Platform integration</h3>
            <p class="mt-2 text-[14px] leading-relaxed text-ink-700">
              Need to connect your merch store to Shopify, Slack, or your HRIS? Our API and integrations make it easy to automate gifting and branded swag programs.
            </p>
            <NuxtLink to="/integrations" class="mt-4 inline-flex items-center gap-1 text-[14px] font-medium text-ink-950 hover:underline">
              View integrations
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </NuxtLink>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'Contact' })

const submitted = ref(false)
const form = reactive({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  company: '',
  jobTitle: '',
  hearAboutUs: '',
  budget: '',
  units: '',
  deadline: '',
  destination: '',
  message: '',
})

const onSubmit = () => {
  submitted.value = true
}

const trustBrands = [
  'Spotify', 'Stripe', 'Notion',
  'Linear', 'Figma', 'Vercel',
  'Framer', 'Webflow', 'Loom',
]
</script>
