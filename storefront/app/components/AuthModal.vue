<template>
  <div
    v-if="modelValue"
    class="fixed inset-0 z-[120] flex items-center justify-center p-4"
    aria-labelledby="auth-modal-title"
    @keydown.esc="close"
  >
    <button class="absolute inset-0 bg-zinc-950/45 backdrop-blur-[2px]" type="button" aria-label="Close sign in modal" @click="close" />

    <div class="relative z-10 w-full max-w-[560px] overflow-hidden rounded-[28px] border border-zinc-200 bg-[#f8f5f0] shadow-2xl">
        <div class="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-5">
          <div>
            <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">GhostMark Account</p>
            <h2 id="auth-modal-title" class="mt-1 font-serif text-[28px] text-zinc-950">
              {{ mode === 'login' ? 'Sign in to continue' : 'Create your account' }}
            </h2>
          </div>
          <button
            class="inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950"
            type="button"
            aria-label="Close sign in modal"
            @click="close"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="px-6 pt-5">
          <div class="grid grid-cols-2 rounded-full border border-zinc-200 bg-white p-1">
            <button
              class="rounded-full px-4 py-2.5 text-sm font-semibold transition"
              :class="mode === 'login' ? 'bg-zinc-950 text-white' : 'text-zinc-600 hover:text-zinc-950'"
              type="button"
              @click="switchMode('login')"
            >
              Login
            </button>
            <button
              class="rounded-full px-4 py-2.5 text-sm font-semibold transition"
              :class="mode === 'register' ? 'bg-zinc-950 text-white' : 'text-zinc-600 hover:text-zinc-950'"
              type="button"
              @click="switchMode('register')"
            >
              Create account
            </button>
          </div>
        </div>

        <div class="px-6 py-6">
          <form v-if="mode === 'login'" class="rounded-[24px] border border-zinc-200 bg-white p-5" @submit.prevent="onLogin">
            <div class="grid gap-1.5">
              <label class="text-sm text-zinc-500" for="auth-login-email">Email</label>
              <input
                id="auth-login-email"
                v-model="loginEmail"
                class="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-zinc-950 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300 focus:ring-offset-2 focus:ring-offset-zinc-50"
                name="email"
                type="email"
                autocomplete="email"
                required
              />
            </div>
            <div class="mt-3 grid gap-1.5">
              <label class="text-sm text-zinc-500" for="auth-login-password">Password</label>
              <input
                id="auth-login-password"
                v-model="loginPassword"
                class="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-zinc-950 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300 focus:ring-offset-2 focus:ring-offset-zinc-50"
                name="password"
                type="password"
                autocomplete="current-password"
                required
              />
            </div>
            <button
              class="mt-5 inline-flex w-full items-center justify-center rounded-full bg-zinc-950 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
              :disabled="submitting"
            >
              {{ submitting ? 'Signing in…' : 'Sign in' }}
            </button>
            <p v-if="error" class="mt-3 text-sm text-red-700">{{ error }}</p>
          </form>

          <form v-else class="rounded-[24px] border border-zinc-200 bg-white p-5" @submit.prevent="onRegister">
            <div class="grid gap-3 sm:grid-cols-2">
              <div class="grid gap-1.5">
                <label class="text-sm text-zinc-500" for="auth-register-first-name">First name</label>
                <input
                  id="auth-register-first-name"
                  v-model="firstName"
                  class="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-zinc-950 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300 focus:ring-offset-2 focus:ring-offset-zinc-50"
                  name="first_name"
                  type="text"
                  autocomplete="given-name"
                />
              </div>
              <div class="grid gap-1.5">
                <label class="text-sm text-zinc-500" for="auth-register-last-name">Last name</label>
                <input
                  id="auth-register-last-name"
                  v-model="lastName"
                  class="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-zinc-950 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300 focus:ring-offset-2 focus:ring-offset-zinc-50"
                  name="last_name"
                  type="text"
                  autocomplete="family-name"
                />
              </div>
            </div>
            <div class="mt-3 grid gap-1.5">
              <label class="text-sm text-zinc-500" for="auth-register-email">Email</label>
              <input
                id="auth-register-email"
                v-model="registerEmail"
                class="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-zinc-950 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300 focus:ring-offset-2 focus:ring-offset-zinc-50"
                name="email"
                type="email"
                autocomplete="email"
                required
              />
            </div>
            <div class="mt-3 grid gap-1.5">
              <label class="text-sm text-zinc-500" for="auth-register-password">Password</label>
              <input
                id="auth-register-password"
                v-model="registerPassword"
                class="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-zinc-950 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300 focus:ring-offset-2 focus:ring-offset-zinc-50"
                name="password"
                type="password"
                autocomplete="new-password"
                required
              />
            </div>
            <button
              class="mt-5 inline-flex w-full items-center justify-center rounded-full bg-zinc-950 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
              :disabled="submitting"
            >
              {{ submitting ? 'Creating…' : 'Create account' }}
            </button>
            <p v-if="error" class="mt-3 text-sm text-red-700">{{ error }}</p>
          </form>
        </div>
      </div>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  modelValue: boolean
  initialMode?: 'login' | 'register'
}>(), {
  initialMode: 'login',
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  success: []
}>()

const { login, register } = useCustomer()

const mode = ref<'login' | 'register'>(props.initialMode)
const submitting = ref(false)
const error = ref<string | null>(null)

const loginEmail = ref('')
const loginPassword = ref('')
const firstName = ref('')
const lastName = ref('')
const registerEmail = ref('')
const registerPassword = ref('')

watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) {
      mode.value = props.initialMode
      error.value = null
    }
  },
)

watch(
  () => props.initialMode,
  (value) => {
    mode.value = value
  },
)

const close = () => emit('update:modelValue', false)

const switchMode = (value: 'login' | 'register') => {
  mode.value = value
  error.value = null
}

const onLogin = async () => {
  submitting.value = true
  error.value = null

  try {
    const res = await login(loginEmail.value, loginPassword.value)
    if (!res.ok) {
      error.value = `Authentication requires redirect: ${res.location}`
      return
    }

    close()
    emit('success')
  } catch (e: any) {
    error.value = e?.message || 'Login failed.'
  } finally {
    submitting.value = false
  }
}

const onRegister = async () => {
  submitting.value = true
  error.value = null

  try {
    await register(registerEmail.value, registerPassword.value, firstName.value, lastName.value)
    close()
    emit('success')
  } catch (e: any) {
    error.value = e?.message || 'Registration failed.'
  } finally {
    submitting.value = false
  }
}
</script>