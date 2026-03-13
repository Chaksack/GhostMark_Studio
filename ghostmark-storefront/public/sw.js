/* Basic service worker for PWA + notification click handling */
self.addEventListener('install', (event) => {
  // Activate immediately on update
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// Minimal fetch handler (passthrough). You can add caching here if needed.
self.addEventListener('fetch', () => {
  // no-op; rely on network
})

// Ensure notification clicks focus/open the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const urlToOpen = event.notification?.data?.url || '/'
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const client = allClients.find((c) => c.url.includes(self.origin || '') )
      if (client) {
        client.focus()
        client.postMessage({ type: 'notification-clicked', url: urlToOpen })
        return
      }
      await self.clients.openWindow(urlToOpen)
    })()
  )
})

// Handle incoming push events (e.g., from Novu or other providers)
self.addEventListener('push', (event) => {
  if (!event.data) return
  let payload
  try {
    payload = event.data.json()
  } catch {
    payload = { title: 'Notification', body: event.data.text?.() || '' }
  }
  const title = payload.title || 'Notification'
  const options = {
    body: payload.body,
    icon: payload.icon || '/android-chrome-192x192.png',
    badge: payload.badge || '/android-chrome-192x192.png',
    data: { url: payload.url || '/', ...payload.data },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})
