"use client"

import { useState } from "react"
import { ChevronDownIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline"
import { clx } from "@medusajs/ui"

type FAQItem = {
  question: string
  answer: string
  category: string
}

type GuideSection = {
  title: string
  content: string[]
}

const faqData: FAQItem[] = [
  {
    question: "How do I place an order?",
    answer: "Browse our products, select your preferred options (size, color, etc.), add items to your cart, and proceed to checkout. You can pay securely with various payment methods.",
    category: "ordering"
  },
  {
    question: "What is print-on-demand (POD)?",
    answer: "Print-on-demand means your custom designs are printed only after you place an order. This ensures fresh, high-quality products made specifically for you with no waste.",
    category: "customization"
  },
  {
    question: "How do I customize a product?",
    answer: "Select a customizable product, choose your options (size, color, etc.), then click 'Customize & Checkout' to access our design editor where you can upload images, add text, and create your perfect design.",
    category: "customization"
  },
  {
    question: "Can I order multiple quantities?",
    answer: "Yes! Use the quantity selector to order multiple items. For orders over 25 pieces, you'll automatically get bulk pricing and can request a quote for even better rates.",
    category: "ordering"
  },
  {
    question: "What are the shipping times?",
    answer: "Standard products ship in 3-5 business days. Custom print-on-demand products may take 7-10 business days as they're made to order.",
    category: "shipping"
  },
  {
    question: "Do you offer international shipping?",
    answer: "Yes, we ship to many countries worldwide. Shipping costs and times vary by location. You can see available options during checkout.",
    category: "shipping"
  },
  {
    question: "What is your return policy?",
    answer: "We offer returns within 30 days of delivery for standard products. Custom/personalized items are non-returnable unless there's a defect or error on our part.",
    category: "returns"
  },
  {
    question: "How can I track my order?",
    answer: "Once your order ships, you'll receive a tracking number via email. You can also check your order status in your account dashboard.",
    category: "shipping"
  },
  {
    question: "What file formats do you accept for custom designs?",
    answer: "We accept JPG, PNG, PDF, and SVG files. For best results, use high-resolution images (300 DPI or higher) and vector files when possible.",
    category: "customization"
  },
  {
    question: "Do you offer design services?",
    answer: "Yes! If you need help with your design, our team can assist you. Contact support with your requirements for custom design services.",
    category: "customization"
  }
]

const siteGuide: GuideSection[] = [
  {
    title: "Getting Started",
    content: [
      "Create an account to save your orders and track shipments",
      "Browse products by category or use the search function",
      "Use filters to find products by type, color, size, or price range",
      "Add multiple items to your cart before checking out"
    ]
  },
  {
    title: "Customizing Products",
    content: [
      "Look for products marked as 'customizable' or 'POD'",
      "Select your base product options (size, color, etc.)",
      "Click 'Customize & Checkout' to open the design editor",
      "Upload your designs, add text, or use our templates",
      "Preview your design before placing the order"
    ]
  },
  {
    title: "Managing Orders",
    content: [
      "View all your orders in the 'My Account' section",
      "Track order status and shipping information",
      "Download invoices and order confirmations",
      "Contact support if you need to make changes"
    ]
  },
  {
    title: "Account Features",
    content: [
      "Save favorite products to your wishlist",
      "Store multiple shipping addresses",
      "View order history and reorder easily",
      "Leave reviews for products you've purchased",
      "Update your profile and preferences"
    ]
  }
]

const categories = [
  { id: "all", label: "All Questions" },
  { id: "ordering", label: "Ordering" },
  { id: "customization", label: "Customization" },
  { id: "shipping", label: "Shipping" },
  { id: "returns", label: "Returns" }
]

function FAQAccordion({ items }: { items: FAQItem[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <div key={index} className="border border-ui-border-base rounded-lg">
          <button
            className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-ui-bg-subtle transition-colors"
            onClick={() => setActiveIndex(activeIndex === index ? null : index)}
          >
            <span className="font-medium text-ui-fg-base pr-4">{item.question}</span>
            <ChevronDownIcon
              className={clx(
                "w-5 h-5 text-ui-fg-muted transition-transform flex-shrink-0",
                activeIndex === index ? "rotate-180" : ""
              )}
            />
          </button>
          {activeIndex === index && (
            <div className="px-6 pb-4">
              <p className="text-ui-fg-subtle leading-relaxed">{item.answer}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function SiteGuide() {
  const [activeSection, setActiveSection] = useState<number | null>(0)

  return (
    <div className="space-y-4">
      {siteGuide.map((section, index) => (
        <div key={index} className="border border-ui-border-base rounded-lg">
          <button
            className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-ui-bg-subtle transition-colors"
            onClick={() => setActiveSection(activeSection === index ? null : index)}
          >
            <span className="font-medium text-ui-fg-base pr-4">{section.title}</span>
            <ChevronDownIcon
              className={clx(
                "w-5 h-5 text-ui-fg-muted transition-transform flex-shrink-0",
                activeSection === index ? "rotate-180" : ""
              )}
            />
          </button>
          {activeSection === index && (
            <div className="px-6 pb-4">
              <ul className="space-y-2">
                {section.content.map((item, itemIndex) => (
                  <li key={itemIndex} className="flex items-start">
                    <span className="w-2 h-2 bg-ui-border-interactive rounded-full mt-2 mr-3 flex-shrink-0"></span>
                    <span className="text-ui-fg-subtle leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export default function HelpCenterContent() {
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [activeTab, setActiveTab] = useState<"faq" | "guide">("faq")
  const [searchQuery, setSearchQuery] = useState("")

  const filteredFAQs = faqData
    .filter(item => {
      const matchesCategory = selectedCategory === "all" || item.category === selectedCategory
      const matchesSearch = searchQuery === "" || 
        item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.answer.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesCategory && matchesSearch
    })

  return (
    <div className="space-y-8">
      {/* Tab Navigation */}
      <div className="flex justify-center">
        <div className="bg-gray-100 rounded-lg p-1 inline-flex">
          <button
            onClick={() => setActiveTab("faq")}
            className={clx(
              "px-6 py-2 rounded-md font-medium transition-colors",
              activeTab === "faq"
                ? "bg-black text-white shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            )}
          >
            Frequently Asked Questions
          </button>
          <button
            onClick={() => setActiveTab("guide")}
            className={clx(
              "px-6 py-2 rounded-md font-medium transition-colors",
              activeTab === "guide"
                ? "bg-black text-white shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            )}
          >
            How to Use This Site
          </button>
        </div>
      </div>

      {/* FAQ Section */}
      {activeTab === "faq" && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-semibold mb-4 text-ui-fg-base">Frequently Asked Questions</h2>
            <p className="text-ui-fg-subtle mb-6">
              Find quick answers to the most common questions about ordering, customization, and shipping.
            </p>
          </div>

          {/* Search Bar */}
          <div className="max-w-md mx-auto mb-6">
            <div className="relative">
              <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-ui-fg-muted" />
              <input
                type="text"
                placeholder="Search questions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-ui-border-base rounded-lg focus:outline-none focus:ring-2 focus:ring-ui-border-interactive focus:border-transparent"
              />
            </div>
          </div>

          {/* Category Filters */}
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={clx(
                  "px-4 py-2 rounded-full text-sm font-medium transition-colors border",
                  selectedCategory === category.id
                    ? "bg-black text-white border-black"
                    : "bg-white text-black border-gray-300 hover:border-gray-400 hover:bg-gray-50"
                )}
              >
                {category.label}
              </button>
            ))}
          </div>

          {filteredFAQs.length > 0 ? (
            <FAQAccordion items={filteredFAQs} />
          ) : (
            <div className="text-center py-12">
              <div className="text-ui-fg-muted mb-4">
                <MagnifyingGlassIcon className="w-16 h-16 mx-auto mb-4 text-ui-fg-disabled" />
                <h3 className="text-lg font-medium text-ui-fg-base mb-2">No results found</h3>
                <p className="text-ui-fg-subtle">
                  {searchQuery ? 
                    `No questions match "${searchQuery}". Try a different search term or browse by category.` :
                    "No questions in this category. Try selecting a different category."
                  }
                </p>
              </div>
              <button
                onClick={() => {
                  setSearchQuery("")
                  setSelectedCategory("all")
                }}
                className="bg-black text-white hover:bg-black/90 px-4 py-2 rounded-lg transition-colors"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* Site Guide Section */}
      {activeTab === "guide" && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-semibold mb-4 text-ui-fg-base">How to Use This Site</h2>
            <p className="text-ui-fg-subtle mb-6">
              Learn how to make the most of our platform, from browsing products to customizing designs.
            </p>
          </div>

          <SiteGuide />
        </div>
      )}

      {/* Contact Support Section */}
      <div className="mt-12 bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <h3 className="text-xl font-semibold mb-4 text-ui-fg-base">Still Need Help?</h3>
        <p className="text-ui-fg-subtle mb-6 max-w-2xl mx-auto">
          Can't find the answer you're looking for? Our support team is here to help you with any questions about orders, customization, or technical issues.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href="mailto:support@example.com"
            className="inline-flex items-center justify-center px-6 py-3 bg-black text-white rounded-lg hover:bg-black/90 transition-colors"
          >
            Email Support
          </a>
          <a
            href="/support"
            className="inline-flex items-center justify-center px-6 py-3 border border-black text-black bg-white rounded-lg hover:bg-gray-50 transition-colors"
          >
            Visit Support Center
          </a>
        </div>
        <div className="mt-6 pt-6 border-t border-gray-300">
          <p className="text-sm text-ui-fg-muted">
            📞 Phone Support: Monday-Friday, 9 AM - 6 PM EST<br/>
            📧 Email Response: Within 24 hours<br/>
            💬 Live Chat: Available during business hours
          </p>
        </div>
      </div>
    </div>
  )
}