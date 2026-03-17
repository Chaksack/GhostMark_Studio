import { redirect } from "next/navigation"

export default function RedirectGiftCardAmounts() {
  // Backward compatibility: some links point to /products/gift-card-amounts
  // Route users to the new Gift Cards landing page instead.
  redirect("/gift-cards")
}
