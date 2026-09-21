// =============================================================================
// order-alerts-widget — opt this browser in/out of Web Push (VAPID) alerts for
// new orders. Sits above the orders list. The push itself is sent by
// src/subscribers/order-push.ts; the service worker that displays it is served
// by src/api/push/sw.js/route.ts.
// =============================================================================
import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Badge, Button, Container, Heading, Text, toast } from "@medusajs/ui"
import React, { useCallback, useEffect, useState } from "react"
import { apiFetch } from "../lib/sdk"

const SW_URL = "/push/sw.js"
const SW_SCOPE = "/app/"

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replaceAll("-", "+").replaceAll("_", "/"))
  return Uint8Array.from(raw, (c) => c.codePointAt(0) as number)
}

const pushSupported = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window

const OrderAlertsWidget = () => {
  const [supported] = useState(pushSupported)
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [subscribed, setSubscribed] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification === "undefined" ? "default" : Notification.permission
  )
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!supported) return
    let cancelled = false
    ;(async () => {
      try {
        const { configured: isConfigured } = await apiFetch<{ configured: boolean }>(
          "/admin/push/public-key"
        )
        if (cancelled) return
        setConfigured(isConfigured)
        if (!isConfigured) return
        const reg = await navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE })
        const existing = await reg.pushManager.getSubscription()
        if (!cancelled) setSubscribed(Boolean(existing))
      } catch (err) {
        console.error("Order alerts init failed:", err)
        if (!cancelled) setConfigured(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [supported])

  const enable = useCallback(async () => {
    setBusy(true)
    try {
      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== "granted") {
        toast.error("Notifications are blocked for this site in your browser settings")
        return
      }
      const { publicKey } = await apiFetch<{ publicKey: string }>("/admin/push/public-key")
      const reg = await navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE })
      await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      })
      await apiFetch("/admin/push/subscribe", { method: "POST", body: sub.toJSON() })
      setSubscribed(true)
      toast.success("Order alerts enabled on this device")
    } catch (err: any) {
      toast.error(err?.message || "Failed to enable order alerts")
    } finally {
      setBusy(false)
    }
  }, [])

  const disable = useCallback(async () => {
    setBusy(true)
    try {
      const reg = await navigator.serviceWorker.getRegistration(SW_SCOPE)
      const sub = await reg?.pushManager.getSubscription()
      if (sub) {
        await apiFetch("/admin/push/subscribe", { method: "DELETE", body: { endpoint: sub.endpoint } })
        await sub.unsubscribe()
      }
      setSubscribed(false)
      toast.success("Order alerts disabled on this device")
    } catch (err: any) {
      toast.error(err?.message || "Failed to disable order alerts")
    } finally {
      setBusy(false)
    }
  }, [])

  const sendTest = useCallback(async () => {
    setBusy(true)
    try {
      const res = await apiFetch<{ sent: number; failed: number }>("/admin/push/test", { method: "POST" })
      toast.success(`Test sent to ${res.sent} device${res.sent === 1 ? "" : "s"}`)
    } catch (err: any) {
      toast.error(err?.message || "Failed to send test notification")
    } finally {
      setBusy(false)
    }
  }, [])

  let status: React.ReactNode
  if (!supported) {
    status = <Badge color="grey">Not supported in this browser</Badge>
  } else if (configured === false) {
    status = <Badge color="orange">Server not configured (VAPID keys missing)</Badge>
  } else if (permission === "denied") {
    status = <Badge color="red">Blocked in browser settings</Badge>
  } else if (subscribed) {
    status = <Badge color="green">Enabled on this device</Badge>
  } else {
    status = <Badge color="grey">Off</Badge>
  }

  const canToggle = supported && configured === true && permission !== "denied"

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between gap-4 px-6 py-4">
        <div>
          <Heading level="h2">Order alerts</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Get a browser notification on this device whenever a customer places an order.
          </Text>
        </div>
        <div className="flex items-center gap-2">
          {status}
          {canToggle && subscribed && (
            <Button size="small" variant="secondary" isLoading={busy} onClick={sendTest}>
              Send test
            </Button>
          )}
          {canToggle && (
            <Button
              size="small"
              variant={subscribed ? "secondary" : "primary"}
              isLoading={busy}
              onClick={subscribed ? disable : enable}
            >
              {subscribed ? "Disable" : "Enable alerts"}
            </Button>
          )}
        </div>
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "order.list.before",
})

export default OrderAlertsWidget
