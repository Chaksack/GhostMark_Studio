"use client"

import { usePathname } from "next/navigation"
import Nav from "@modules/layout/templates/nav"

export default function ConditionalNav() {
  const pathname = usePathname()
  // Hide global Nav on the design editor pages
  const hide = pathname?.includes("/design/")
  if (hide) return null
  return <Nav />
}
