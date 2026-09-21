import webpush from 'web-push'
import { deleteSubscription, listSubscriptions } from './push-db'

// Web Push (VAPID) sender for admin/staff notifications.
// Generate keys once with:  npx web-push generate-vapid-keys
// and set VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT.

export type AdminPushPayload = {
  title: string
  body: string
  // Path or URL opened when the notification is clicked (e.g. /app/orders/order_123)
  url?: string
  // Same tag replaces an earlier notification instead of stacking
  tag?: string
}

let configured = false

export function isPushConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)
}

export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null
}

function configure() {
  if (configured) return
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@ghostmarkstudio.com',
    process.env.VAPID_PUBLIC_KEY as string,
    process.env.VAPID_PRIVATE_KEY as string
  )
  configured = true
}

// Sends to every stored admin subscription. Never throws: a push failure must
// not break the caller (e.g. the order.placed subscriber). Subscriptions the
// push service reports as gone (404/410) are pruned.
export async function sendPushToAdmins(
  payload: AdminPushPayload
): Promise<{ sent: number; failed: number; removed: number }> {
  const result = { sent: 0, failed: 0, removed: 0 }
  if (!isPushConfigured()) return result

  configure()
  const subs = await listSubscriptions()
  const body = JSON.stringify(payload)

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
          { TTL: 60 * 60 }
        )
        result.sent++
      } catch (err: any) {
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await deleteSubscription(s.endpoint).catch(() => {})
          result.removed++
        } else {
          result.failed++
          console.warn(`[push] send failed (${err?.statusCode ?? 'n/a'}):`, err?.body || err?.message)
        }
      }
    })
  )

  return result
}
