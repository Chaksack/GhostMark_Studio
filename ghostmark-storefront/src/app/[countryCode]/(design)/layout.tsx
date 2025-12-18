import { Metadata } from "next"
import { getBaseURL } from "@lib/util/env"

export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
}

// Isolated route group for Design pages. Intentionally omits Nav/Footer.
export default function DesignIsolatedLayout(props: { children: React.ReactNode }) {
  return <>{props.children}</>
}
