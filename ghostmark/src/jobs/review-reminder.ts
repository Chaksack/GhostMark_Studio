import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { signReviewToken } from "../services/review-token"

/**
 * Scheduled job: send review reminder emails 2 days after order placement.
 * Links include a signed token that expires in 7 days.
 */
export default async function reviewReminderJob(container: MedusaContainer) {
  const notificationModuleService = container.resolve(Modules.NOTIFICATION)
  const query = container.resolve("query") as any

  // OFF BY DEFAULT, DELIBERATELY. Read this before enabling it.
  //
  // This job emails real customers a link to
  //   {baseUrl}/{country}/reviews/submit?productId=...&email=...&token=...
  // and THAT PAGE DOES NOT EXIST. There is no review route anywhere under
  // storefront/app/pages, and no storefront code posts to the reviews API at
  // all. The link 404s.
  //
  // It was previously safe-by-accident: the `review-reminder` email template
  // did not exist either, so every send fell through to a generic body with no
  // link in it. Adding the missing template (which was the right fix for the
  // blank-email defect) removes that accident: the email now looks polished
  // and leads nowhere, which is worse than obviously broken. So the job is
  // gated until the destination is real.
  //
  // Before setting REVIEW_REMINDERS_ENABLED=true, all three must be true:
  //   1. A storefront page exists at /reviews/submit that reads the token and
  //      POSTs it. The backend already accepts it as `reviewToken` in the POST
  //      body or an `x-review-token` header, so no backend change is needed.
  //   2. The review token is actually enforced. DONE as of this change: the
  //      route now defaults REQUIRE_REVIEW_TOKEN to "true" (fails closed) and
  //      .env sets it explicitly. Re-check it is still true before enabling,
  //      because an explicit "false" is still honoured as an escape hatch.
  //   3. REVIEW_LINK_BASE_URL (or STOREFRONT_URL) points at the real
  //      storefront, and the country segment resolves.
  //
  //      READ THIS BEFORE TUNING DEFAULT_COUNTRY_CODE. The storefront route
  //      tree is FLAT: /cart, /checkout, /products/[handle] and so on, with no
  //      locale or country segment anywhere. So {base}/{country}/... 404s no
  //      matter what the country code is set to. Setting DEFAULT_COUNTRY_CODE
  //      to "gb" looks like a fix and is not one; the URL shape itself has to
  //      change, or the page has to be created under a country segment. This
  //      note exists because "gb" is the plausible-looking value that invites
  //      someone to assume the link builder works.
  const enabled =
    String(process.env.REVIEW_REMINDERS_ENABLED || "false").toLowerCase() === "true"
  if (!enabled) {
    console.warn(
      "[review-reminder] skipped: REVIEW_REMINDERS_ENABLED is not true. The " +
        "storefront has no /reviews/submit page, so enabling this would email " +
        "customers a link that 404s. See the comment in this file.",
    )
    return
  }

  const defaultCountry = process.env.DEFAULT_COUNTRY_CODE || "us"

  // No localhost fallback. Silently defaulting to http://localhost:8000 (a
  // port nothing in this project even runs on; the storefront is :3000) meant
  // a misconfigured production deploy mailed customers unreachable links
  // instead of failing.
  const baseUrl =
    process.env.REVIEW_LINK_BASE_URL ||
    process.env.STOREFRONT_URL ||
    process.env.STOREFRONT_BASE_URL
  if (!baseUrl) {
    console.error(
      "[review-reminder] enabled but no REVIEW_LINK_BASE_URL / STOREFRONT_URL " +
        "is set. Refusing to send links to an unknown host.",
    )
    return
  }

  // Determine the target day (2 days ago) in UTC
  const now = new Date()
  const target = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)
  const start = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate(), 0, 0, 0))
  const end = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate(), 23, 59, 59, 999))

  // Fetch orders created on the target day
  // Note: filter operators may vary by setup. Using $gte/$lt common style.
  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "*",
      "customer.email",
      "items.*",
      "items.variant.product.id",
      "items.variant.product.title",
      "items.variant.product.type.value",
      "items.variant.product.type.title",
      "items.variant.product.type.name",
      "items.variant.product.type.handle",
    ],
    filters: {
      created_at: { $gte: start.toISOString(), $lt: end.toISOString() },
      // Only orders with customers
      "customer.email": { $ne: null },
    },
  })

  if (!Array.isArray(orders) || !orders.length) return

  let sent = 0
  let failed = 0

  for (const order of orders) {
    const customerEmail: string | undefined = order?.customer?.email
    if (!customerEmail) continue

    const items: any[] = order.items || []

    // ONE EMAIL PER PRODUCT PER ORDER, not one per line item.
    //
    // The previous loop fanned out over line items directly, so an order with
    // the same POD product in three sizes sent that customer three identical
    // review requests for the same product, minutes apart. De-duplicating by
    // product id fixes the fan-out at source; the idempotency key below is the
    // second line of defence, for re-runs of the job itself.
    const podProducts = new Map<string, { id: string; title: string }>()
    for (const item of items) {
      const product = item?.variant?.product
      if (!product?.id) continue
      const t = product?.type
      const rawType = (t?.value || t?.title || t?.name || t?.handle || "").toString().toLowerCase()
      const isPOD = rawType.includes("pod") || rawType === "pod"
      if (!isPOD) continue
      if (!podProducts.has(product.id)) {
        podProducts.set(product.id, {
          id: product.id,
          title: product.title || "Product",
        })
      }
    }

    for (const product of podProducts.values()) {
      // PER-SEND TRY/CATCH.
      //
      // This is a scheduled job with a nested loop over live customer data and
      // a network call at the centre of it. Without this, the first Resend
      // hiccup (a rate limit, one malformed address, a transient 5xx) threw
      // out of both loops and killed the entire day's run, silently. Every
      // customer after the failing one simply never heard from us, and because
      // the job runs daily rather than continuously, there is no second attempt
      // for that cohort. One bad address must not cost everyone else their
      // email.
      try {
        // Token expires in 7 days
        const exp = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60
        const token = signReviewToken({
          orderId: order.id,
          productId: product.id,
          email: customerEmail,
          exp,
        })

        const url = `${baseUrl.replace(/\/$/, "")}/${defaultCountry}/reviews/submit?productId=${encodeURIComponent(
          product.id
        )}&email=${encodeURIComponent(customerEmail)}&rating=5&token=${encodeURIComponent(token)}`

        await notificationModuleService.createNotifications({
          to: customerEmail,
          channel: "email",
          template: "review-reminder",
          // Scoped to order + product, NOT to the token: the token embeds a
          // timestamp, so keying on it would let a re-run mail the same
          // customer again. The notification module de-duplicates on this key
          // and re-sends only if the stored attempt is recorded as FAILURE.
          idempotency_key: `review-reminder:${order.id}:${product.id}`,
          data: {
            customer_email: customerEmail,
            order_display_id:
              order?.metadata?.order_number || order.display_id || order.id,
            product_title: product.title,
            review_link: url,
            expires_in_days: 7,
          },
        })
        sent++
      } catch (e) {
        failed++
        // Order id and product id, never the customer's address.
        console.error(
          `[review-reminder] failed to send for order ${order.id} product ` +
            `${product.id}; continuing with the rest of the run:`,
          e,
        )
      }
    }
  }

  console.log(
    `[review-reminder] run complete: ${sent} sent, ${failed} failed, ` +
      `${orders.length} orders considered.`,
  )
}

// Run daily at 08:00 UTC
export const config = {
  name: "send-review-reminders",
  schedule: "0 8 * * *",
}
