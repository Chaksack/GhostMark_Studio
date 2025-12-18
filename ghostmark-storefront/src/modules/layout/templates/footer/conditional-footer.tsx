"use client"

import { usePathname } from "next/navigation"
import Footer from "@modules/layout/templates/footer"

export default function ConditionalFooter() {
  const pathname = usePathname()
  // Hide global Footer on the design editor pages
  const hide = pathname?.includes("/design/")
  if (hide) return null
  return <Footer />
}
