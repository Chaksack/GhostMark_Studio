<script setup lang="ts">
import { computed, ref } from 'vue'
import type { HttpTypes } from '@medusajs/types'

/**
 * /account/addresses: saved shipping address book.
 *
 * CRUD lives entirely in the Medusa SDK:
 *   - createAddress(body)            POST /store/customers/me/addresses
 *   - updateAddress(addressId, body) POST /store/customers/me/addresses/:id
 *   - deleteAddress(addressId)       DELETE /store/customers/me/addresses/:id
 *
 * After every mutation we re-run `useCustomer().refresh()` because the
 * canonical address list lives on the embedded `customer.addresses` array.
 * This keeps the rest of the app (cart prefill, account overview)
 * consistent without juggling a second store.
 *
 * The "add" + "edit" flow shares one `<UiModal>` panel; we toggle between
 * the two by setting `editingId` to either `null` (create) or the address
 * id (update).
 */

definePageMeta({ middleware: ['auth'] })
useHead({ title: 'Addresses' })

const sdk = useMedusaClient()
const { customer, refresh } = useCustomer()

type AddressForm = {
  address_name: string
  first_name: string
  last_name: string
  company: string
  address_1: string
  address_2: string
  city: string
  province: string
  postal_code: string
  country_code: string
  phone: string
}

const emptyForm = (): AddressForm => ({
  address_name: '',
  first_name: '',
  last_name: '',
  company: '',
  address_1: '',
  address_2: '',
  city: '',
  province: '',
  postal_code: '',
  country_code: '',
  phone: '',
})

const addresses = computed(() => customer.value?.addresses ?? [])

const isOpen = ref(false)
const editingId = ref<string | null>(null)
const form = ref<AddressForm>(emptyForm())
const submitting = ref(false)
const deletingId = ref<string | null>(null)
const error = ref<string | null>(null)

const modalTitle = computed(() =>
  editingId.value ? 'Edit address' : 'Add a new address',
)

const openCreate = () => {
  editingId.value = null
  form.value = emptyForm()
  error.value = null
  isOpen.value = true
}

const openEdit = (a: HttpTypes.StoreCustomerAddress) => {
  editingId.value = a.id
  form.value = {
    address_name: a.address_name ?? '',
    first_name: a.first_name ?? '',
    last_name: a.last_name ?? '',
    company: a.company ?? '',
    address_1: a.address_1 ?? '',
    address_2: a.address_2 ?? '',
    city: a.city ?? '',
    province: a.province ?? '',
    postal_code: a.postal_code ?? '',
    country_code: a.country_code ?? '',
    phone: a.phone ?? '',
  }
  error.value = null
  isOpen.value = true
}

const onClose = () => {
  if (submitting.value) return
  isOpen.value = false
}

const buildPayload = () => {
  const trim = (v: string) => v.trim()
  return {
    address_name: trim(form.value.address_name) || undefined,
    first_name: trim(form.value.first_name) || undefined,
    last_name: trim(form.value.last_name) || undefined,
    company: trim(form.value.company) || undefined,
    address_1: trim(form.value.address_1) || undefined,
    address_2: trim(form.value.address_2) || undefined,
    city: trim(form.value.city) || undefined,
    province: trim(form.value.province) || undefined,
    postal_code: trim(form.value.postal_code) || undefined,
    country_code: trim(form.value.country_code).toLowerCase() || undefined,
    phone: trim(form.value.phone) || undefined,
  }
}

const onSubmit = async () => {
  if (submitting.value) return
  submitting.value = true
  error.value = null

  try {
    const payload = buildPayload()
    if (editingId.value) {
      await sdk.store.customer.updateAddress(editingId.value, payload)
    }
    else {
      await sdk.store.customer.createAddress(payload)
    }
    await refresh()
    isOpen.value = false
  }
  catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Could not save the address.'
  }
  finally {
    submitting.value = false
  }
}

const onDelete = async (id: string) => {
  if (deletingId.value) return
  if (typeof window !== 'undefined' && !window.confirm('Delete this address?')) return
  deletingId.value = id
  try {
    await sdk.store.customer.deleteAddress(id)
    await refresh()
  }
  catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Could not delete the address.'
  }
  finally {
    deletingId.value = null
  }
}

const formatAddressLine = (a: HttpTypes.StoreCustomerAddress) => {
  return [a.address_1, a.address_2].filter(Boolean).join(', ')
}

const formatCityLine = (a: HttpTypes.StoreCustomerAddress) => {
  return [a.city, a.province, a.postal_code].filter(Boolean).join(', ')
}
</script>

<template>
  <AccountShell
    page-title="Addresses"
    intro="Saved shipping addresses for faster checkout."
  >
    <div class="mb-6 flex items-center justify-between gap-4">
      <p class="font-body text-caption text-ink-500">
        {{ addresses.length }} saved address{{ addresses.length === 1 ? '' : 'es' }}
      </p>
      <UiButton
        variant="merchery"
        size="md"
        type="button"
        @click="openCreate"
      >
        Add new address
      </UiButton>
    </div>

    <div
      v-if="!addresses.length"
      class="border border-ink-200 bg-white px-6 py-16 text-center"
    >
      <p class="font-display text-[24px] leading-tight text-ink-950">
        No addresses saved.
      </p>
      <p class="mx-auto mt-2 max-w-md font-body text-caption text-ink-500">
        Add a delivery address now and it'll be available at checkout the
        next time you order.
      </p>
      <UiButton
        variant="outline"
        size="md"
        type="button"
        class="mt-6"
        @click="openCreate"
      >
        Add an address
      </UiButton>
    </div>

    <ul v-else class="grid gap-4 sm:grid-cols-2">
      <li
        v-for="a in addresses"
        :key="a.id"
        class="flex flex-col gap-4 border border-ink-200 bg-white p-6"
      >
        <div class="min-w-0">
          <div class="flex items-baseline justify-between gap-3">
            <p class="truncate font-body text-body text-ink-950">
              {{ a.address_name || `${a.first_name ?? ''} ${a.last_name ?? ''}`.trim() || 'Address' }}
            </p>
            <span
              v-if="a.is_default_shipping"
              class="gm-spec shrink-0 border border-ink-200 bg-cream-warm px-2 py-0.5 text-ink-700"
            >
              Default
            </span>
          </div>

          <p
            v-if="a.company"
            class="mt-2 font-body text-caption text-ink-500"
          >
            {{ a.company }}
          </p>
          <p class="mt-2 font-body text-caption text-ink-700">
            {{ formatAddressLine(a) }}
          </p>
          <p class="font-body text-caption text-ink-700">
            {{ formatCityLine(a) }}
          </p>
          <p
            v-if="a.country_code"
            class="font-body text-caption text-ink-700"
          >
            {{ a.country_code.toUpperCase() }}
          </p>
          <p
            v-if="a.phone"
            class="mt-1 font-body text-caption text-ink-500"
          >
            {{ a.phone }}
          </p>
        </div>

        <div class="mt-auto flex items-center gap-2">
          <UiButton
            variant="outline"
            size="sm"
            type="button"
            @click="openEdit(a)"
          >
            Edit
          </UiButton>
          <UiButton
            variant="ghost"
            size="sm"
            type="button"
            :loading="deletingId === a.id"
            @click="onDelete(a.id)"
          >
            Delete
          </UiButton>
        </div>
      </li>
    </ul>

    <!-- Add / edit modal -------------------------------------------------- -->
    <UiModal
      :open="isOpen"
      size="lg"
      :title="modalTitle"
      @update:open="(v) => (isOpen = v)"
    >
      <div class="-m-6">
        <header class="flex items-start justify-between gap-4 border-b border-ink-200 bg-white px-6 py-5">
          <div>
            <p class="text-eyebrow font-body uppercase text-ink-500">
              Address
            </p>
            <h2 class="mt-1 font-display text-[24px] leading-tight text-ink-950">
              {{ modalTitle }}
            </h2>
          </div>
          <UiButton
            variant="ghost"
            size="sm"
            shape="pill"
            aria-label="Close address dialog"
            @click="onClose"
          >
            <span aria-hidden="true" class="text-base leading-none">&times;</span>
          </UiButton>
        </header>

        <form
          class="flex flex-col gap-4 bg-cream-50 px-6 py-6"
          novalidate
          @submit.prevent="onSubmit"
        >
          <UiField label="Label" help="Optional: e.g. Home, Office.">
            <UiInput v-model="form.address_name" type="text" name="address_name" />
          </UiField>

          <div class="grid gap-4 sm:grid-cols-2">
            <UiField label="First name">
              <UiInput v-model="form.first_name" type="text" name="first_name" autocomplete="given-name" />
            </UiField>
            <UiField label="Last name">
              <UiInput v-model="form.last_name" type="text" name="last_name" autocomplete="family-name" />
            </UiField>
          </div>

          <UiField label="Company">
            <UiInput v-model="form.company" type="text" name="company" autocomplete="organization" />
          </UiField>

          <UiField label="Address line 1" required>
            <UiInput v-model="form.address_1" type="text" name="address_1" autocomplete="address-line1" />
          </UiField>

          <UiField label="Address line 2">
            <UiInput v-model="form.address_2" type="text" name="address_2" autocomplete="address-line2" />
          </UiField>

          <div class="grid gap-4 sm:grid-cols-2">
            <UiField label="City">
              <UiInput v-model="form.city" type="text" name="city" autocomplete="address-level2" />
            </UiField>
            <UiField label="Province / state">
              <UiInput v-model="form.province" type="text" name="province" autocomplete="address-level1" />
            </UiField>
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <UiField label="Postal code">
              <UiInput v-model="form.postal_code" type="text" name="postal_code" autocomplete="postal-code" />
            </UiField>
            <UiField label="Country code" help="Two-letter ISO (e.g. US, GB, FR).">
              <UiInput v-model="form.country_code" type="text" name="country_code" autocomplete="country" />
            </UiField>
          </div>

          <UiField label="Phone">
            <UiInput v-model="form.phone" type="tel" name="phone" autocomplete="tel" />
          </UiField>

          <div
            v-if="error"
            role="alert"
            class="border border-red-200 bg-red-50 px-3 py-2 font-body text-caption text-red-700"
          >
            {{ error }}
          </div>

          <div class="mt-2 flex items-center justify-end gap-3">
            <UiButton
              variant="ghost"
              size="md"
              type="button"
              :disabled="submitting"
              @click="onClose"
            >
              Cancel
            </UiButton>
            <UiButton
              variant="merchery"
              size="md"
              type="submit"
              :loading="submitting"
            >
              {{ editingId ? 'Save changes' : 'Add address' }}
            </UiButton>
          </div>
        </form>
      </div>
    </UiModal>
  </AccountShell>
</template>
