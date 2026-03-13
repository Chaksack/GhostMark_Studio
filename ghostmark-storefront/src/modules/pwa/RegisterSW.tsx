"use client"

import { useEffect } from 'react'

export default function RegisterSW() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    const controller = new AbortController()
    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js')
        // Optionally listen for updates
        reg.addEventListener?.('updatefound', () => {
          // no-op minimal
        })
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('SW registration failed', e)
      }
    }

    register()

    // Ask permission for notifications if not determined
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => void 0)
    }

    return () => controller.abort()
  }, [])

  return null
}
