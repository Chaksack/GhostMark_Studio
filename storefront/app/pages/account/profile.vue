<script setup lang="ts">
/**
 * /account/profile — editable customer profile.
 *
 * The form is hydrated from `useCustomer().customer` and writes through
 * `sdk.store.customer.update`. Email is intentionally read-only — Medusa's
 * email-change ceremony requires a verification round trip we haven't built
 * yet (and silently mutating it via `update` is a footgun).
 *
 * After a successful save we re-run `refresh()` so the header / sidebar
 * pick up the new name without a hard reload.
 */

definePageMeta({ middleware: ['auth'] })
useHead({ title: 'Profile' })

const sdk = useMedusaClient()
const { customer, refresh } = useCustomer()

const firstName = ref('')
const lastName = ref('')
const phone = ref('')

const submitting = ref(false)
const saved = ref(false)
const error = ref<string | null>(null)

const hydrate = () => {
  firstName.value = customer.value?.first_name ?? ''
  lastName.value = customer.value?.last_name ?? ''
  phone.value = customer.value?.phone ?? ''
}

watch(customer, hydrate, { immediate: true })

const onSubmit = async () => {
  if (submitting.value) return
  submitting.value = true
  saved.value = false
  error.value = null

  try {
    await sdk.store.customer.update({
      first_name: firstName.value.trim() || undefined,
      last_name: lastName.value.trim() || undefined,
      phone: phone.value.trim() || undefined,
    })
    await refresh()
    saved.value = true
  }
  catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Could not save your profile.'
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <AccountShell
    page-title="Profile"
    intro="Personal details we use for orders, support, and shipping receipts."
  >
    <form
      class="max-w-2xl border border-ink-200 bg-white p-6 sm:p-8"
      novalidate
      @submit.prevent="onSubmit"
    >
      <div class="grid gap-5 sm:grid-cols-2">
        <UiField label="First name">
          <UiInput
            v-model="firstName"
            type="text"
            name="first_name"
            autocomplete="given-name"
          />
        </UiField>
        <UiField label="Last name">
          <UiInput
            v-model="lastName"
            type="text"
            name="last_name"
            autocomplete="family-name"
          />
        </UiField>
      </div>

      <div class="mt-5">
        <UiField label="Email" help="Email changes coming soon.">
          <UiInput
            :model-value="customer?.email ?? ''"
            type="email"
            name="email"
            autocomplete="email"
            disabled
          />
        </UiField>
      </div>

      <div class="mt-5">
        <UiField label="Phone" help="We use this for delivery updates only.">
          <UiInput
            v-model="phone"
            type="tel"
            name="phone"
            autocomplete="tel"
          />
        </UiField>
      </div>

      <div
        v-if="error"
        role="alert"
        class="mt-5 border border-red-200 bg-red-50 px-3 py-2 font-body text-caption text-red-700"
      >
        {{ error }}
      </div>

      <div
        v-if="saved"
        role="status"
        class="mt-5 border border-sage-200 bg-sage-50 px-3 py-2 font-body text-caption text-sage-600"
      >
        Profile saved.
      </div>

      <div class="mt-7 flex items-center gap-3">
        <UiButton
          variant="merchery"
          size="md"
          type="submit"
          :loading="submitting"
        >
          {{ submitting ? 'Saving' : 'Save changes' }}
        </UiButton>
        <UiButton
          variant="ghost"
          size="md"
          type="button"
          @click="hydrate"
        >
          Reset
        </UiButton>
      </div>
    </form>
  </AccountShell>
</template>
