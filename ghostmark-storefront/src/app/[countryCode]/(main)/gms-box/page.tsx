import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "GMS Box | GhostMark Studio",
  description: "Curated GhostMark Studio box. Coming soon.",
}

export default function GmsBoxPage() {
  return (
    <div className="content-container py-16">
      <h1 className="text-3xl font-bold mb-4">GMS Box</h1>
      <p className="text-gray-600 max-w-2xl">
        The GMS Box is a curated GhostMark Studio experience. We’re putting the finishing touches on it.
        Check back soon or subscribe to our newsletter for updates.
      </p>
    </div>
  )
}
