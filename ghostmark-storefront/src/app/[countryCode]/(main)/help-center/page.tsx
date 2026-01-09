import { Metadata } from "next"
import HelpCenterContent from "./components/help-center-content"

export const metadata: Metadata = {
  title: "Help Center - Frequently Asked Questions & Site Guide",
  description: "Find answers to common questions, learn how to use our site, and get support for orders, customization, and more.",
}

export default function HelpCenterPage() {
  return (
    <div className="content-container py-10">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4 text-ui-fg-base">Help Center</h1>
          <p className="text-lg text-ui-fg-subtle max-w-2xl mx-auto">
            Find answers to common questions, learn how to use our site, and get the help you need for a great shopping experience.
          </p>
        </div>
        
        <HelpCenterContent />
      </div>
    </div>
  )
}
