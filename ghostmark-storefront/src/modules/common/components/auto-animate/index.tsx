"use client"

import React, { PropsWithChildren, useEffect } from "react"
// Note: We avoid importing "@formkit/auto-animate" directly because the
// dependency might not be present in some environments and Turbopack would
// fail the build with a hard Module Not Found error. Instead, we lazily
// attempt a dynamic import at runtime; if it fails, we simply no-op so the
// app can still build and run without animations.

type AutoAnimateProps = PropsWithChildren<{
  className?: string
  /**
   * Animation duration in ms
   */
  duration?: number
  /**
   * CSS easing function
   */
  easing?: string
}>

/**
 * Lightweight wrapper that enables automatic enter/leave/reorder animations
 * for its direct children using @formkit/auto-animate.
 */
const AutoAnimate: React.FC<AutoAnimateProps> = ({
  children,
  className,
  duration = 200,
  easing = "ease-in-out",
}) => {
  const parentRef = React.useRef<HTMLDivElement | null>(null)

  // Initialize auto-animate on mount and when options change
  useEffect(() => {
    if (!parentRef.current) return

    let cancelled = false

    // Use Function constructor to prevent static analysis from resolving the module at build time
    const dynImport = Function(
      "m",
      // eslint-disable-next-line no-new-func
      "return import(m)"
    ) as (m: string) => Promise<any>

    ;(async () => {
      try {
        const mod = await dynImport("@formkit/auto-animate")
        if (!cancelled && parentRef.current && mod?.default) {
          // Call the default export (autoAnimate)
          mod.default(parentRef.current, { duration, easing })
        }
      } catch {
        // Silently ignore if the module is missing or fails to load.
      }
    })()

    return () => {
      cancelled = true
    }
  }, [duration, easing])

  return (
    <div ref={parentRef} className={className}>
      {children}
    </div>
  )
}

export default AutoAnimate
