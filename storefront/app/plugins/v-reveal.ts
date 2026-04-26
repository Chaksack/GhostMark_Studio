/**
 * v-reveal — global Vue directive for scroll-into-view fade+rise.
 *
 *   <BrandShowcase v-reveal />
 *   <BestSellers v-reveal="80" />   <!-- 80ms stagger -->
 *
 * Registered on BOTH server and client (the file intentionally is NOT
 * `.client.ts`). Reason: Vue's SSR renderer calls `directive.getSSRProps`
 * for every directive used in a template; if the directive isn't even
 * registered on the server, `getSSRProps` is `undefined` and SSR crashes
 * with `Cannot read properties of undefined (reading 'getSSRProps')`. We
 * therefore register the directive in both environments, but the actual
 * IntersectionObserver wiring only runs inside `mounted`, which Vue 3
 * never invokes during SSR — so server output stays inert (no observer,
 * no `reveal-init` class), and the client takes over post-hydration.
 *
 * Honors `prefers-reduced-motion`: when reduced motion is requested the
 * element is flagged visible immediately (still fully accessible, just no
 * animation).
 */
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.directive('reveal', {
    /**
     * Inject `reveal-init` into the *VNode* before render, on BOTH server
     * and client. This is the canonical fix for the SSR/CSR hydration
     * mismatch caused by `getSSRProps`.
     *
     * Why: `getSSRProps` only patches the server-rendered HTML string —
     * the *client* VNode tree never learns about that class. During
     * hydration, Vue compares the client VNode's `props.class` against
     * the SSR markup; if the directive added `reveal-init` only on the
     * server, the comparison sees a mismatch and logs
     * `Hydration completed but contains mismatches`.
     *
     * Mutating `vnode.props.class` in `created` (which runs before the
     * element is rendered, in BOTH SSR and CSR paths) keeps both sides
     * in lock-step: the client VNode now carries the same class the
     * server emitted, so hydration is a no-op diff.
     *
     * We still keep `getSSRProps` as belt-and-braces: in environments
     * where Vue's SSR renderer reads getSSRProps before the created hook
     * runs (it normally doesn't, but this hardens against future renderer
     * changes), the class is still emitted server-side.
     */
    created(_el, _binding, vnode) {
      if (!vnode.props) vnode.props = {}
      const existing = vnode.props.class
      if (typeof existing === 'string') {
        vnode.props.class = existing.includes('reveal-init')
          ? existing
          : `${existing} reveal-init`
      } else if (Array.isArray(existing)) {
        if (!existing.includes('reveal-init')) existing.push('reveal-init')
      } else if (existing && typeof existing === 'object') {
        ;(existing as Record<string, boolean>)['reveal-init'] = true
      } else {
        vnode.props.class = 'reveal-init'
      }
    },

    /**
     * Server-side rendering hook. Retained as a defensive fallback only —
     * the real hydration-safe class injection happens in `created` above,
     * which runs in both SSR and CSR and keeps the client VNode in sync
     * with the server-rendered HTML.
     */
    getSSRProps() {
      return { class: 'reveal-init' }
    },

    mounted(el: HTMLElement, binding) {
      // Defensive: `mounted` only fires on the client in Vue 3, but
      // matchMedia / IntersectionObserver still only exist in window
      // contexts, so we keep the explicit guard for robustness.
      if (typeof window === 'undefined') return

      // Binding value is the optional stagger delay (ms). Accepts numbers,
      // numeric strings, or undefined.
      const raw = binding.value
      const delay =
        typeof raw === 'number'
          ? raw
          : typeof raw === 'string'
            ? parseInt(raw, 10) || 0
            : 0

      const prefersReducedMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches

      if (prefersReducedMotion) {
        el.classList.add('reveal-visible')
        return
      }

      // `reveal-init` is already on the element via the `created` hook
      // (which mutated vnode.props.class). No need to re-add it here —
      // doing so was previously safe but redundant.

      const observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0]
          if (entry?.isIntersecting) {
            if (delay > 0) {
              window.setTimeout(() => el.classList.add('reveal-visible'), delay)
            } else {
              el.classList.add('reveal-visible')
            }
            observer.disconnect()
          }
        },
        { threshold: 0.15, rootMargin: '0px 0px -10% 0px' },
      )

      observer.observe(el)

      // Stash the observer on the element so `unmounted` can disconnect it
      // even if the element is removed before it ever became visible. This
      // is the canonical Vue 3 directive cleanup pattern.
      ;(el as unknown as { _revealObserver?: IntersectionObserver })._revealObserver =
        observer
    },

    unmounted(el: HTMLElement) {
      const ref = el as unknown as { _revealObserver?: IntersectionObserver }
      ref._revealObserver?.disconnect()
      ref._revealObserver = undefined
    },
  })
})
