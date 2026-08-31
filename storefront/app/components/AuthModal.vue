<script setup lang="ts">
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionRoot,
  TransitionChild,
} from '@headlessui/vue'
import Icon from '~/components/ui/Icon.vue'
import UiField from '~/components/ui/UiField.vue'
import UiInput from '~/components/ui/UiInput.vue'
import UiButton from '~/components/ui/UiButton.vue'

/**
 * AuthModal: sign in / create account, as a real modal dialog.
 *
 * Mounted once by AppHeader:
 *     <AuthModal v-model="isAuthModalOpen" :initial-mode="authModalMode" @success="…" />
 *
 * ── Why Headless UI `Dialog` and not a hand-rolled overlay ──────────────
 *
 * The previous implementation was a bare `<div v-if>` with a full-bleed
 * `<button class="absolute inset-0">` acting as the backdrop. That shipped
 * a WCAG 2.1.1 (Level A) failure that was measured, not theorised:
 *
 *   - `document.activeElement` on open …… BODY (focus never entered)
 *   - tab stops before reaching the dialog …… 16
 *   - what stop 17 landed on …… the backdrop button, whose activation
 *     CLOSED the dialog, so there was no keyboard path to the email field
 *   - role / aria-modal on the wrapper …… null / null (no SR announcement)
 *   - `@keydown.esc` …… never fired, because focus was never inside
 *   - body / html overflow …… visible / visible (page scrolled behind)
 *
 * `Dialog` from @headlessui/vue supplies every one of those, verified
 * against the installed 1.7.23 source rather than from memory:
 *
 *   role="dialog"       …… `role: role.value`, defaults to 'dialog'
 *   aria-modal="true"   …… set while `dialogState === Open`
 *   aria-labelledby     …… wired to `<DialogTitle>`'s generated id
 *   Tab containment     …… a leaf dialog renders `FocusTrap` with
 *                           `features.All & ~FocusLock` = InitialFocus(2) |
 *                           TabLock(4) | RestoreFocus(16). It is FOCUS lock
 *                           that is switched off, not TAB lock, TabLock is
 *                           on, and it works by rendering two `Hidden`
 *                           sentinels either side of the panel that catch Tab
 *                           at the boundary and cycle it. That is a real trap
 *                           and it does not depend on `inert` being honoured.
 *                           Measured: 15 Tabs and 15 Shift-Tabs, every stop
 *                           inside the dialog, wrapping cleanly both ways.
 *   Escape + backdrop   …… both routed through the single `@close` handler
 *   scroll lock         …… `useDocumentOverflowLockedEffect` sets
 *                           documentElement overflow hidden and compensates
 *                           the scrollbar width
 *
 * That is why there is no backdrop `<button>` here any more: the backdrop is
 * `aria-hidden` decoration, and dismissal is `@close` (Escape / outside
 * click) plus one real close button. One close affordance, not two, and
 * critically, nothing focusable that destroys the dialog sits ahead of the
 * form in tab order.
 *
 * ── Initial focus ──
 *
 * `UiInput` exposes its underlying `<input>` as `inputEl` precisely so a
 * parent can hand it to `:initial-focus`. `Dialog` watches that prop
 * (`computed(() => props.initialFocus)`, `flush: 'post'`), so passing a
 * value that resolves one tick after mount is fine, the trap re-runs and
 * lands focus on the email field.
 *
 * ── One form, two modes ──
 *
 * Login and register share the email + password controls rather than
 * rendering two disjoint forms. Two reasons: what the user has typed
 * survives a mode switch, and the email `<input>` is the same DOM node
 * across modes, so `:initial-focus` never goes stale and focus does not
 * jump out of the mode-switch control when it is pressed.
 */

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

/**
 * Password reset does not exist in this codebase: there is no
 * `/account/forgot` route, no reset endpoint, and no reset email. The only
 * trace of one anywhere is a sentence in /terms promising it. A visible
 * link to a 404 is worse than no link: it adds a tab stop that dead-ends
 * and breaks a promise at the exact moment a locked-out user is least able
 * to recover.
 *
 * So the affordance is BUILT (placement, type, tab position and focus ring
 * are all in the markup below, matching the Coursera / MasterClass pattern
 * of sitting inline under the password control rather than at the form foot)
 * and gated behind this one constant. Flip it to `true` in the same PR
 * that lands the route; nothing else needs to change.
 */
const PASSWORD_RESET_ROUTE = '/account/forgot'
const PASSWORD_RESET_AVAILABLE = false

const { login, register } = useCustomer()

const mode = ref<'login' | 'register'>(props.initialMode)
const submitting = ref(false)
const error = ref<string | null>(null)

const email = ref('')
const password = ref('')
const firstName = ref('')
const lastName = ref('')

const isLogin = computed(() => mode.value === 'login')

// Handle on the email <input> DOM node, forwarded to `<Dialog :initial-focus>`.
// A template ref on <UiInput> alone resolves to the component proxy, not the
// element, `inputEl` is the exposed escape hatch.
const emailField = ref<InstanceType<typeof UiInput> | null>(null)
const initialFocusEl = computed<HTMLElement | null>(
  () => (emailField.value?.inputEl as HTMLInputElement | undefined) ?? null,
)

const title = computed(() => (isLogin.value ? 'Sign in to continue' : 'Create your account'))
const submitLabel = computed(() => {
  if (submitting.value) return isLogin.value ? 'Signing in…' : 'Creating account…'
  return isLogin.value ? 'Sign in' : 'Create account'
})

const close = () => emit('update:modelValue', false)

const switchMode = () => {
  mode.value = isLogin.value ? 'register' : 'login'
  error.value = null
}

/**
 * Focus restoration (WCAG 2.4.3 Focus Order).
 *
 * Headless UI's FocusTrap nominally covers this, the leaf dialog is built
 * with `FocusTrap.features.All & ~FocusLock`, which leaves RestoreFocus (16)
 * switched on. In practice it does not fire: `useRestoreFocus` restores from
 * an `onUnmounted` hook guarded by `if (!enabled.value) return`, and by the
 * time that hook runs the trap's own `mounted` ref has already flipped false.
 *
 * Measured, not assumed, focus the header account button, press Enter, press
 * Escape, and `document.activeElement` is BODY. Confirmed independently by
 * whoever wrote the same note in UiModal, which is why both files carry it.
 *
 * Without this the keyboard is dumped at the top of the document and the user
 * has to tab all the way back to where they were.
 */
const restoreTarget = ref<HTMLElement | null>(null)
const restoreOnClose = ref(true)

watch(
  () => props.modelValue,
  (isOpen, wasOpen) => {
    if (typeof document === 'undefined') return

    if (isOpen && !wasOpen) {
      mode.value = props.initialMode
      error.value = null
      restoreOnClose.value = true
      const active = document.activeElement
      restoreTarget.value = active instanceof HTMLElement && active !== document.body ? active : null
      return
    }

    if (!isOpen && wasOpen) {
      const target = restoreTarget.value
      restoreTarget.value = null
      // A successful sign in navigates to /account, sending focus back to
      // the header trigger there would fight the new page, so skip it.
      if (!target || !restoreOnClose.value) return
      // Deferred past the 150ms leave transition: restoring while the panel
      // is still unmounting lets the trap's teardown steal focus back.
      window.setTimeout(() => {
        if (target.isConnected) target.focus()
      }, 220)
    }
  },
)

watch(
  () => props.initialMode,
  (value) => {
    mode.value = value
  },
)

const onSubmit = async () => {
  if (submitting.value) return
  submitting.value = true
  error.value = null

  try {
    if (isLogin.value) {
      const res = await login(email.value, password.value)
      if (!res.ok) {
        error.value = `Authentication requires redirect: ${res.location}`
        return
      }
    }
    else {
      await register(email.value, password.value, firstName.value, lastName.value)
    }

    restoreOnClose.value = false
    close()
    emit('success')
  }
  catch (e: any) {
    error.value = e?.message || (isLogin.value ? 'Sign in failed.' : 'Could not create your account.')
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <TransitionRoot :show="modelValue" as="template">
    <Dialog class="relative z-modal" :initial-focus="initialFocusEl ?? undefined" @close="close">
      <!--
        Decorative scrim. `aria-hidden` and NOT focusable, the previous
        implementation made this a <button>, which put a dialog-destroying
        control ahead of every form field in tab order. Outside-click
        dismissal is handled by Dialog's own `@close`.
      -->
      <TransitionChild
        as="template"
        enter="duration-200 ease-emphasis motion-reduce:duration-0"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="duration-150 ease-emphasis motion-reduce:duration-0"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <div class="fixed inset-0 bg-ink-900/50 backdrop-blur-[2px]" aria-hidden="true" />
      </TransitionChild>

      <div class="fixed inset-0 overflow-y-auto">
        <div class="flex min-h-full items-center justify-center p-4 sm:p-6">
          <TransitionChild
            as="template"
            enter="duration-200 ease-emphasis motion-reduce:duration-0"
            enter-from="opacity-0 translate-y-2 scale-[0.98] motion-reduce:translate-y-0 motion-reduce:scale-100"
            enter-to="opacity-100 translate-y-0 scale-100"
            leave="duration-150 ease-emphasis motion-reduce:duration-0"
            leave-from="opacity-100 translate-y-0 scale-100"
            leave-to="opacity-0 translate-y-2 scale-[0.98] motion-reduce:translate-y-0 motion-reduce:scale-100"
          >
            <DialogPanel
              class="relative w-full max-w-[480px] overflow-hidden rounded-xl border border-ink-200 bg-cream-50 shadow-elev-3"
            >
              <!-- Header band: eyebrow, accessible name, single close affordance -->
              <div class="flex items-start justify-between gap-4 border-b border-ink-200 px-6 py-5">
                <div class="min-w-0">
                  <p class="text-eyebrow uppercase text-ink-500">
                    GhostMark account
                  </p>
                  <DialogTitle class="mt-1 font-display text-display-sm text-ink-950">
                    {{ title }}
                  </DialogTitle>
                </div>

                <button
                  type="button"
                  class="-m-2 grid h-11 w-11 shrink-0 place-items-center rounded-md text-ink-500 transition-colors duration-fast ease-emphasis hover:bg-ink-50 hover:text-ink-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-cream-50 motion-reduce:transition-none"
                  aria-label="Close"
                  @click="close"
                >
                  <Icon name="close" :size="18" />
                </button>
              </div>

              <div class="px-6 py-6">
                <!--
                  Failure message. `role="alert"` so a failed sign in is
                  actually announced, previously this was a bare <p> and
                  silent to assistive tech. The icon carries the same signal
                  as the tint so meaning is never colour-only (WCAG 1.4.1).
                  Placed above the fields, ahead of the controls it refers
                  to, matching the Coursera pattern.
                -->
                <p
                  v-if="error"
                  role="alert"
                  class="mb-5 flex items-start gap-2 rounded-md border border-semantic-danger-border bg-semantic-danger-surface px-3 py-2.5 text-caption text-semantic-danger-fg"
                >
                  <svg
                    class="mt-px shrink-0"
                    viewBox="0 0 20 20"
                    width="16"
                    height="16"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.6"
                    stroke-linecap="round"
                    aria-hidden="true"
                  >
                    <circle cx="10" cy="10" r="7.5" />
                    <path d="M10 6.5v4.25M10 13.6v.2" />
                  </svg>
                  <span>{{ error }}</span>
                </p>

                <form class="grid gap-4" @submit.prevent="onSubmit">
                  <div v-if="!isLogin" class="grid gap-4 sm:grid-cols-2">
                    <UiField label="First name">
                      <UiInput
                        v-model="firstName"
                        name="first_name"
                        type="text"
                        autocomplete="given-name"
                      />
                    </UiField>
                    <UiField label="Last name">
                      <UiInput
                        v-model="lastName"
                        name="last_name"
                        type="text"
                        autocomplete="family-name"
                      />
                    </UiField>
                  </div>

                  <UiField label="Email" required>
                    <UiInput
                      ref="emailField"
                      v-model="email"
                      name="email"
                      type="email"
                      autocomplete="email"
                      placeholder="you@company.com"
                    />
                  </UiField>

                  <UiField label="Password" required>
                    <UiInput
                      v-model="password"
                      name="password"
                      type="password"
                      :autocomplete="isLogin ? 'current-password' : 'new-password'"
                    />
                    <!--
                      Inline under the password control (Coursera / MasterClass
                      placement) rather than at the form foot, so it reads as
                      part of the password affordance. Gated, see
                      PASSWORD_RESET_AVAILABLE above; the route does not exist yet.
                    -->
                    <NuxtLink
                      v-if="isLogin && PASSWORD_RESET_AVAILABLE"
                      :to="PASSWORD_RESET_ROUTE"
                      class="self-start rounded-sm text-micro text-ink-500 underline underline-offset-2 transition-colors duration-fast ease-emphasis hover:text-ink-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-cream-50 motion-reduce:transition-none"
                    >
                      Forgot password?
                    </NuxtLink>
                  </UiField>

                  <UiButton
                    class="mt-1"
                    type="submit"
                    variant="merchery"
                    size="lg"
                    block
                    :loading="submitting"
                  >
                    {{ submitLabel }}
                  </UiButton>
                </form>

                <p class="mt-5 text-center text-caption text-ink-500">
                  {{ isLogin ? 'New to GhostMark?' : 'Already have an account?' }}
                  <button
                    type="button"
                    class="rounded-sm font-medium text-ink-950 underline underline-offset-2 transition-colors duration-fast ease-emphasis hover:text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-focus focus-visible:ring-offset-2 focus-visible:ring-offset-cream-50 motion-reduce:transition-none"
                    @click="switchMode"
                  >
                    {{ isLogin ? 'Create an account' : 'Sign in' }}
                  </button>
                </p>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>
