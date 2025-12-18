import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Customer stories",
  description: "Read how creators and brands succeed with GhostMark Studio.",
}

export default function CustomerStoriesPage() {
  return (
    <div className="content-container py-10">
      <h1 className="text-3xl font-semibold mb-3">Customer stories</h1>
      <p className="text-ui-fg-subtle max-w-2xl">
        Explore real-world stories and case studies from our customers.
      </p>
    </div>
  )
}
