import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

// Service worker for admin order alerts. Served by the backend (rather than
// from static/) so it deploys with the API and is same-origin with the admin
// dashboard at /app. `Service-Worker-Allowed: /` lets the admin register it
// with scope "/app/" even though the script lives under /push/.
const SW_SOURCE = `
self.addEventListener("install", () => self.skipWaiting())
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()))

self.addEventListener("push", (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch (_) {}
  const title = data.title || "GhostMark"
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      tag: data.tag,
      icon: "/static/admin/icon.png",
      data: { url: data.url || "/app/orders" },
    })
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.url || "/app/orders", self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url.startsWith(self.location.origin + "/app") && "focus" in w) {
          return w.navigate(target).then((c) => c && c.focus())
        }
      }
      return self.clients.openWindow(target)
    })
  )
})
`

export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  res.setHeader("Content-Type", "application/javascript; charset=utf-8")
  res.setHeader("Service-Worker-Allowed", "/")
  res.setHeader("Cache-Control", "no-cache")
  return res.status(200).send(SW_SOURCE)
}
