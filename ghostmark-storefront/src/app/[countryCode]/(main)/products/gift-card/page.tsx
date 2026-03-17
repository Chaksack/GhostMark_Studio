import { redirect } from "next/navigation"

export default function RedirectGiftCard() {
  // Backward compatibility: old link pointed to a product handle at /products/gift-card
  // Route users to the new Gift Cards landing page instead.
  redirect("/gift-cards")
}
