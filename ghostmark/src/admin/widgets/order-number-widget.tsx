// =============================================================================
// order-number-widget — surface the customer-facing `GMS-<ULID>` order
// number at the top of every admin order detail page.
//
// Why this widget exists
// ----------------------
// The storefront confirmation page and the Resend order-confirmation email
// both display a `GMS-<ULID>` identifier (e.g. `GMS-01KTD49XXBWM5NW5GNEWDF802N`)
// derived from Medusa's internal `order.id`. Medusa's admin, by default, only
// surfaces the auto-increment `display_id` (e.g. `#4`). When a customer
// emails support quoting their GMS number, the support agent has no way to
// match it against an order in admin — a real "logistic hell".
//
// This widget injects into `order.details.before` so the GMS number is
// the first thing visible on the order detail page, alongside a one-line
// hint that confirms it's the same string the customer received.
//
// How the value is resolved
// -------------------------
// Persisted on `order.metadata.order_number` by the `order.placed`
// subscriber (`src/subscribers/order-notifications.ts`). For orders
// placed BEFORE that subscriber was wired in (or if the metadata write
// failed), we compute the same value client-side from `data.id` — the
// derivation rule is deterministic and side-effect-free, so the fallback
// renders the exact same string the customer would see, just without
// a guarantee that the value is persisted server-side.
// =============================================================================
import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Text, Badge } from "@medusajs/ui"

// Mirror of `formatOrderNumber()` in
//   - src/subscribers/order-notifications.ts (backend)
//   - storefront/app/pages/checkout.vue (frontend)
// Keep all three byte-for-byte identical: a divergence here means support
// sees a different string from the customer, defeating the widget's purpose.
const formatOrderNumber = (internalId: string | null | undefined): string => {
  if (!internalId) return "—"
  if (internalId.startsWith("GMS-")) return internalId
  return `GMS-${internalId.replace(/^order_/, "")}`
}

type AdminOrderShape = {
  id?: string
  display_id?: number
  metadata?: Record<string, unknown> | null
}

const OrderNumberWidget = ({ data }: { data: AdminOrderShape }) => {
  const persisted = (data?.metadata?.order_number as string | undefined) ?? null
  const fallback = formatOrderNumber(data?.id)
  // Prefer the persisted value (covers any future format change that hasn't
  // been mirrored into this file yet); fall back to the deterministic
  // computation for legacy/never-persisted orders.
  const orderNumber = persisted ?? fallback
  const isLegacy = !persisted

  return (
    <Container className="divide-y p-0">
      <div className="flex items-start justify-between gap-4 px-6 py-4">
        <div className="flex flex-col gap-y-1">
          <Heading level="h2">Order number</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            This is the identifier the customer sees on their confirmation
            email and storefront receipt. Quote this back to them in support.
          </Text>
        </div>
        <div className="flex flex-col items-end gap-y-1">
          <Text className="font-mono text-lg font-semibold text-ui-fg-base">
            {orderNumber}
          </Text>
          {isLegacy && (
            <Badge size="2xsmall" color="orange">
              Derived from order.id (not persisted)
            </Badge>
          )}
        </div>
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "order.details.before",
})

export default OrderNumberWidget
