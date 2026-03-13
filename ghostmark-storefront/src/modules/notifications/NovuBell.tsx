"use client"

import { useEffect, useMemo, useState } from 'react'
import { NovuProvider, PopoverNotificationCenter, NotificationBell } from '@novu/notification-center-react'

function getOrCreateSubscriberId() {
  if (typeof window === 'undefined') return undefined
  try {
    const key = 'novu-subscriber-id'
    let id = localStorage.getItem(key)
    if (!id) {
      id = crypto.randomUUID?.() || Math.random().toString(36).slice(2)
      localStorage.setItem(key, id)
    }
    return id
  } catch {
    return undefined
  }
}

export default function NovuBell({ initialSubscriberId }: { initialSubscriberId?: string }) {
  const appId = process.env.NEXT_PUBLIC_NOVU_APP_ID
  const subscriberIdFromEnv = process.env.NEXT_PUBLIC_NOVU_SUBSCRIBER_ID
  const [mounted, setMounted] = useState(false)
  const subscriberId = useMemo(() => initialSubscriberId || subscriberIdFromEnv || getOrCreateSubscriberId(), [initialSubscriberId, subscriberIdFromEnv])

  useEffect(() => setMounted(true), [])

  if (!mounted) return null
  if (!appId || !subscriberId) return null

  return (
    <NovuProvider
      subscriberId={subscriberId}
      applicationIdentifier={appId}
    >
      <PopoverNotificationCenter colorScheme="light">
        {({ unseenCount }) => <NotificationBell unseenCount={unseenCount} />}
      </PopoverNotificationCenter>
    </NovuProvider>
  )
}
