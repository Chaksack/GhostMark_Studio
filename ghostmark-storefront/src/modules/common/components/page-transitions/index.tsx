"use client"

import React, { PropsWithChildren } from "react"
import { usePathname } from "next/navigation"
import AutoAnimate from "@modules/common/components/auto-animate"

/**
 * Wraps the application children and animates route changes using AutoAnimate.
 */
const PageTransitions: React.FC<PropsWithChildren<{}>> = ({ children }) => {
  const pathname = usePathname()

  return (
    <AutoAnimate className="min-h-screen" duration={220} easing="cubic-bezier(0.22, 1, 0.36, 1)">
      {/* The key forces a small enter/leave animation on route change */}
      <div key={pathname}>{children}</div>
    </AutoAnimate>
  )
}

export default PageTransitions
