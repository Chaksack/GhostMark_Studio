<template>
  <div ref="rootRef" class="relative">
    <button
      class="relative inline-flex items-center justify-center rounded-full border transition"
      :class="isAuthenticated
        ? 'h-10 gap-2 border-ink-950 bg-ink-950 pl-3 pr-2.5 text-white hover:bg-ink-800'
        : 'h-10 w-10 border-transparent bg-transparent text-ink-950 hover:border-ink-300 hover:bg-ink-100'"
      type="button"
      :aria-label="isAuthenticated ? 'Open account menu' : 'Open account login modal'"
      :aria-expanded="isAuthenticated ? isMenuOpen : undefined"
      @click="onClick"
    >
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M20 21a8 8 0 0 0-16 0" />
        <circle cx="12" cy="7" r="4" />
      </svg>

      <span
        v-if="isAuthenticated"
        class="max-[860px]:hidden max-w-[112px] truncate text-sm font-semibold leading-none"
      >
        {{ customerDisplayName }}
      </span>

      <span
        v-if="isAuthenticated"
        class="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-semantic-success-solid px-1 text-[12px] font-bold leading-none tabular-nums text-white"
        aria-hidden="true"
      >
        {{ accountInitial }}
      </span>
    </button>

    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="translate-y-1 opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="translate-y-0 opacity-100"
      leave-to-class="translate-y-1 opacity-0"
    >
      <div
        v-if="isAuthenticated && isMenuOpen"
        class="absolute right-0 top-full z-[90] mt-2 w-[220px] rounded-2xl border border-ink-200 bg-white p-2 shadow-xl"
      >
        <div class="border-b border-ink-100 px-3 py-2.5">
          <p class="gm-spec text-ink-600">Signed in</p>
          <p class="mt-1 truncate text-sm font-semibold text-ink-950">{{ customerEmail }}</p>
        </div>
        <div class="pt-2">
          <button
            class="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-medium text-ink-950 hover:bg-ink-100"
            type="button"
            @click="emitAccount"
          >
            <span>Account details</span>
            <span class="text-ink-600">→</span>
          </button>
          <button
            class="mt-1 flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            :disabled="isLoggingOut"
            @click="emitLogout"
          >
            <span>{{ isLoggingOut ? 'Signing out…' : 'Logout' }}</span>
            <span class="text-red-400">↗</span>
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  isAuthenticated: boolean
  customerDisplayName: string
  customerEmail: string
  accountInitial: string
  isLoggingOut?: boolean
}>()

const emit = defineEmits<{
  unauthenticatedClick: []
  account: []
  logout: []
}>()

const route = useRoute()
const rootRef = ref<HTMLElement | null>(null)
const isMenuOpen = ref(false)

const closeMenu = () => {
  isMenuOpen.value = false
}

const onClick = () => {
  if (!props.isAuthenticated) {
    emit('unauthenticatedClick')
    return
  }

  isMenuOpen.value = !isMenuOpen.value
}

const emitAccount = () => {
  closeMenu()
  emit('account')
}

const emitLogout = () => {
  closeMenu()
  emit('logout')
}

const onPointerDown = (event: PointerEvent) => {
  if (!isMenuOpen.value) return
  if (rootRef.value?.contains(event.target as Node)) return
  closeMenu()
}

const onEscape = (event: KeyboardEvent) => {
  if (event.key !== 'Escape') return
  closeMenu()
}

onMounted(() => {
  document.addEventListener('pointerdown', onPointerDown)
  document.addEventListener('keydown', onEscape)
})

onUnmounted(() => {
  document.removeEventListener('pointerdown', onPointerDown)
  document.removeEventListener('keydown', onEscape)
})

watch(
  () => props.isAuthenticated,
  (value) => {
    if (!value) closeMenu()
  },
)

watch(
  () => route.fullPath,
  () => {
    closeMenu()
  },
)
</script>