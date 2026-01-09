"use client"

import React, { useEffect, useState } from "react"

// Simple cookie helpers (client-only)
function setCookie(name: string, value: string, days = 365) {
  try {
    const date = new Date()
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000)
    const expires = "; expires=" + date.toUTCString()
    document.cookie = `${name}=${encodeURIComponent(value || "")}${expires}; path=/; SameSite=Lax`
  } catch {}
}

function getCookie(name: string) {
  try {
    const nameEQ = name + "="
    const ca = document.cookie.split(";")
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i]
      while (c.charAt(0) === " ") c = c.substring(1, c.length)
      if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length, c.length))
    }
  } catch {}
  return null
}

const CONSENT_KEY = "gm_cookie_consent"

export default function CookieConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Guard for client-side only
    if (typeof window === "undefined") return
    const consent = getCookie(CONSENT_KEY) || (typeof localStorage !== "undefined" ? localStorage.getItem(CONSENT_KEY) : null)
    setVisible(!consent)
  }, [])

  const accept = () => {
    setCookie(CONSENT_KEY, "accepted", 365)
    try { localStorage.setItem(CONSENT_KEY, "accepted") } catch {}
    setVisible(false)
  }

  const decline = () => {
    setCookie(CONSENT_KEY, "declined", 180)
    try { localStorage.setItem(CONSENT_KEY, "declined") } catch {}
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-50 px-4 pb-6"
    >
      <div className="mx-auto max-w-3xl rounded-lg border bg-mono-0/95 backdrop-blur supports-[backdrop-filter]:bg-mono-0/80 shadow-lg">
        <div className="p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-start gap-3">
            <div className="flex-1">
              <p className="text-sm text-ui-fg-muted">
                We use cookies to enhance your experience, provide essential site functionality, and analyze traffic. By clicking
                Accept, you consent to our use of cookies. Read more in our Privacy Policy.
              </p>
            </div>
            <div className="flex gap-2 sm:self-center">
              <button
                onClick={decline}
                className="px-3 py-2 text-sm rounded-md border text-ui-fg-subtle hover:bg-mono-100"
              >
                Decline
              </button>
              <button
                onClick={accept}
                className="px-3 py-2 text-sm rounded-md bg-ui-bg-base text-ui-fg-base border border-transparent hover:opacity-90"
              >
                Accept
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
