/**
 * useScrollReveal: composable wrapper around `useIntersectionObserver`.
 *
 * Returns reactive `isVisible` state for a target element. Designed for
 * scroll-into-view fade-and-rise reveals on Nuxt 4 storefront sections.
 *
 * Honors `prefers-reduced-motion`: when reduced motion is requested the
 * element is marked visible immediately and the IntersectionObserver is
 * never wired up, keeping the DOM accessible without animation.
 *
 *   const target = ref<HTMLElement | null>(null)
 *   const { isVisible } = useScrollReveal(target, { delay: 80 })
 *   <section ref="target" :class="isVisible ? 'reveal-visible' : 'reveal-init'" />
 *
 * The `v-reveal` plugin (plugins/v-reveal.client.ts) is the simpler, more
 * common entry point; this composable exists for callers that need the
 * reactive `isVisible` flag (e.g. to drive child stagger logic).
 */
import { useIntersectionObserver, useMediaQuery } from '@vueuse/core'
import { onMounted, onUnmounted, ref, type Ref } from 'vue'

export interface ScrollRevealOptions {
  /** IntersectionObserver threshold (0..1). Default 0.15. */
  threshold?: number
  /** IntersectionObserver rootMargin. Default '0px 0px -10% 0px'. */
  rootMargin?: string
  /** Disconnect after the first reveal. Default true. */
  once?: boolean
  /** Delay (ms) before flipping to visible, used for stagger. Default 0. */
  delay?: number
}

export interface ScrollRevealReturn {
  isVisible: Ref<boolean>
  stop: () => void
}

export function useScrollReveal(
  target: Ref<HTMLElement | null>,
  options: ScrollRevealOptions = {},
): ScrollRevealReturn {
  const {
    threshold = 0.15,
    rootMargin = '0px 0px -10% 0px',
    once = true,
    delay = 0,
  } = options

  const isVisible = ref(false)
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')

  // Track any pending stagger timer so unmount can clear it cleanly.
  let timer: ReturnType<typeof setTimeout> | null = null

  // If reduced motion is on, skip the observer entirely and reveal now.
  // We still create a `stop` no-op so the consumer's contract is uniform.
  if (prefersReducedMotion.value) {
    onMounted(() => {
      isVisible.value = true
    })
    return {
      isVisible,
      stop: () => {
        /* no-op */
      },
    }
  }

  const { stop } = useIntersectionObserver(
    target,
    (entries) => {
      const entry = entries[0]
      if (!entry) return
      if (entry.isIntersecting) {
        if (delay > 0) {
          timer = setTimeout(() => {
            isVisible.value = true
            timer = null
          }, delay)
        } else {
          isVisible.value = true
        }
        if (once) stop()
      } else if (!once) {
        isVisible.value = false
      }
    },
    { threshold, rootMargin },
  )

  onUnmounted(() => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    stop()
  })

  return { isVisible, stop }
}
