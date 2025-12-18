"use client"

import { Button, Heading } from "@medusajs/ui"

import CartTotals from "@modules/common/components/cart-totals"
import Divider from "@modules/common/components/divider"
import DiscountCode from "@modules/checkout/components/discount-code"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { HttpTypes } from "@medusajs/types"
import { loadStripe } from "@stripe/stripe-js"
import { useState } from "react"
import { usePathname } from "next/navigation"

type SummaryProps = {
  cart: HttpTypes.StoreCart & {
    promotions: HttpTypes.StorePromotion[]
  }
}

function getCheckoutStep(cart: HttpTypes.StoreCart) {
  if (!cart?.shipping_address?.address_1 || !cart.email) {
    return "address"
  } else if (cart?.shipping_methods?.length === 0) {
    return "delivery"
  } else {
    return "payment"
  }
}

const Summary = ({ cart }: SummaryProps) => {
  const step = getCheckoutStep(cart)
  const [isLoading, setIsLoading] = useState(false)
  const pathname = usePathname()

  const handleStripeCheckout = async () => {
    // Always open the in-site checkout form, do not redirect to Stripe-hosted checkout
    setIsLoading(true)
    try {
      // Try to preserve current country prefix from pathname (e.g., /gb)
      const segments = (pathname || "").split("/").filter(Boolean)
      const country = segments[0]
      const prefix = country ? `/${country}` : ""
      window.location.href = `${prefix}/checkout?step=${step}`
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-y-4">
      <Heading level="h2" className="text-[2rem] leading-[2.75rem]">
        Summary
      </Heading>
      <DiscountCode cart={cart} />
      <Divider />
      <CartTotals totals={cart} />
      {/* Primary action: go to on-site checkout form (Stripe card entry happens there). */}
      <Button
        className="w-full h-10"
        onClick={handleStripeCheckout}
        isLoading={isLoading}
        data-testid="checkout-button"
      >
        Go to checkout
      </Button>
      <span className="sr-only">
        <LocalizedClientLink href={"/checkout?step=" + step}>
          Continue to on-site checkout
        </LocalizedClientLink>
      </span>
    </div>
  )
}

export default Summary
