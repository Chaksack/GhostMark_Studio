import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Help center",
  description: "Find answers to common questions and get support.",
}

export default function HelpCenterPage() {
  return (
    <div className="content-container py-10">
      <h1 className="text-3xl font-semibold mb-3">Help center</h1>
      <p className="text-ui-fg-subtle max-w-2xl">
        Welcome to the Help center. Browse FAQs, shipping and returns info, or contact support.
      </p>
    </div>
  )
}
