"use client"

import React, { useEffect, useRef, useState } from "react"

// Keys for localStorage/cookie to avoid re-showing when dismissed/subscribed
const NL_KEY = "gm_newsletter_status" // values: subscribed | dismissed

function setCookie(name: string, value: string, days = 365) {
  try {
    const date = new Date()
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000)
    const expires = "; expires=" + date.toUTCString()
    document.cookie = `${name}=${encodeURIComponent(value || "")} ${expires}; path=/; SameSite=Lax`
  } catch {}
}

function getCookie(name: string) {
  try {
    const nameEQ = name + "="
    const ca = document.cookie.split(";")
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i]
      while (c.charAt(0) === " ") c = c.substring(1)
      if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length))
    }
  } catch {}
  return null
}

const hasOptedOut = (): boolean => {
  if (typeof window === "undefined") return true
  try {
    const ls = localStorage.getItem(NL_KEY)
    const ck = getCookie(NL_KEY)
    return ls === "dismissed" || ck === "dismissed" || ls === "subscribed" || ck === "subscribed"
  } catch {
    return false
  }
}

type Interest = { id: string; label: string }

type Props = {
  delayMs?: number
  imageAlt?: string
  imageSrc?: string
  title?: string
  subtitle?: string
  ctaLabel?: string
  interests?: Interest[]
}

export default function NewsletterPopup({
  delayMs = 3000,
  imageAlt = "Newsletter image",
  imageSrc,
  title = "Thanks for stopping by!",
  subtitle = "Sign up to learn more about what we do and get yourself a cheeky 10% discount at the same time.",
  ctaLabel = "Submit",
  interests = [
    { id: "done-merch", label: "Done London Merch" },
    { id: "garment-printing", label: "Garment Printing Services" },
    { id: "sticker-printing", label: "Sticker Printing Services" },
    { id: "screen-workshops", label: "Screen Printing Workshops" },
  ],
}: Props) {
  const [visible, setVisible] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [email, setEmail] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [errorMsg, setErrorMsg] = useState<string>("")
  const dialogRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (typeof window === "undefined") return
    if (hasOptedOut()) return
    const t = setTimeout(() => setVisible(true), Math.max(0, delayMs))
    return () => clearTimeout(t)
  }, [delayMs])

  useEffect(() => {
    if (!visible) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setVisible(false)
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [visible])

  const persist = (value: "dismissed" | "subscribed") => {
    try { localStorage.setItem(NL_KEY, value) } catch {}
    setCookie(NL_KEY, value, value === "subscribed" ? 365 * 2 : 90)
  }

  const close = () => {
    persist("dismissed")
    setVisible(false)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || submitting) return
    setSubmitting(true)
    try {
      setErrorMsg("")
      // Prefer explicit endpoint; otherwise fall back to Medusa backend public URL
      const base = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"
      const endpoint = (process.env.NEXT_PUBLIC_NEWSLETTER_ENDPOINT && process.env.NEXT_PUBLIC_NEWSLETTER_ENDPOINT.trim()) || `${base.replace(/\/$/, "")}/store/newsletter/subscribe`

      // Attach Medusa publishable API key in header if available
      const pub = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string | undefined
      const headers: Record<string, string> = { "Content-Type": "application/json" }
      if (pub) headers["x-publishable-api-key"] = pub

      const resp = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          email,
          first_name: firstName,
          last_name: lastName,
          interests: interests.filter((i) => selected[i.id]).map((i) => i.label),
          send_welcome: true,
        }),
      })

      if (!resp.ok) {
        const t = await resp.text().catch(() => "")
        const msg = (() => {
          try { return JSON.parse(t)?.message || t || "Failed to subscribe" } catch { return t || "Failed to subscribe" }
        })()
        setErrorMsg(typeof msg === "string" ? msg : "Failed to subscribe")
        console.warn("Newsletter subscribe failed:", msg)
        return
      }

      persist("subscribed")
      setVisible(false)
    } catch (err) {
      // Keep the popup open to allow retry, but don't crash
      console.error("Newsletter subscribe error:", err)
      setErrorMsg("Something went wrong while subscribing. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="nl-title"
      aria-describedby="nl-subtitle"
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
    >
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={close} />

      {/* modal */}
      <div
        ref={dialogRef}
        className="relative z-10 w-full max-w-3xl overflow-hidden rounded-2xl border border-mono-200 bg-white shadow-[0_20px_80px_rgba(0,0,0,0.15)]"
      >
        <button
          aria-label="Close"
          onClick={close}
          className="absolute right-3 top-3 rounded p-1 text-ui-fg-subtle hover:bg-mono-100"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Decorative glass layers removed to keep a clean white background */}

        <div className="relative grid grid-cols-1 md:grid-cols-2">
          {/* Left: image */}
          <div className="relative hidden md:block bg-white">
            {imageSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageSrc} alt={imageAlt} className="h-full w-full object-cover" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                {/* inline SVG placeholder */}
                <svg aria-hidden="true" width="220" height="220" viewBox="0 0 220 220" fill="none">
                  <rect x="10" y="40" width="200" height="140" rx="16" fill="white" opacity="0.9" />
                  <rect x="20" y="60" width="180" height="6" rx="3" fill="#f87171" />
                  <rect x="20" y="80" width="140" height="10" rx="5" fill="#111827" opacity="0.8" />
                  <rect x="20" y="100" width="170" height="10" rx="5" fill="#111827" opacity="0.6" />
                  <rect x="20" y="120" width="120" height="10" rx="5" fill="#111827" opacity="0.4" />
                  <circle cx="110" cy="170" r="24" fill="#111827" opacity="0.85" />
                  <path d="M102 170l6 6 12-14" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            )}
            <span className="sr-only">{imageAlt}</span>
          </div>

          {/* Right: CTA/form */}
          <div className="relative p-6 md:p-8">
            <h2 id="nl-title" className="text-2xl font-semibold text-black/90 text-center md:text-left">{title}</h2>
            <p id="nl-subtitle" className="mt-2 text-sm text-black/70 text-center md:text-left">
              {subtitle}
            </p>

            <form onSubmit={submit} className="mt-5 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="sr-only" htmlFor="nl-first">First name</label>
                <input
                  id="nl-first"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name"
                  className="w-full rounded-md border border-black/10 bg-white/70 supports-[backdrop-filter]:bg-white/60 backdrop-blur-sm px-3 py-2 text-sm text-black/90 placeholder-black/50 outline-none focus:ring-2 focus:ring-black/20 focus:border-black/20"
                />
                <label className="sr-only" htmlFor="nl-last">Last name</label>
                <input
                  id="nl-last"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name"
                  className="w-full rounded-md border border-black/10 bg-white/70 supports-[backdrop-filter]:bg-white/60 backdrop-blur-sm px-3 py-2 text-sm text-black/90 placeholder-black/50 outline-none focus:ring-2 focus:ring-black/20 focus:border-black/20"
                />
              </div>

              <label className="sr-only" htmlFor="nl-email">Email address</label>
              <input
                id="nl-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="w-full rounded-md border border-black/10 bg-white/70 supports-[backdrop-filter]:bg-white/60 backdrop-blur-sm px-3 py-2 text-sm text-black/90 placeholder-black/50 outline-none focus:ring-2 focus:ring-black/20 focus:border-black/20"
              />

              {/* Interests */}
              {interests?.length ? (
                <div className="pt-1">
                  <div className="text-sm font-medium text-black/80 mb-2">What are you interested in?</div>
                  <div className="space-y-2">
                    {interests.map((opt) => (
                      <label key={opt.id} className="flex items-center gap-3 text-sm text-black/80 select-none">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border border-black/30"
                          checked={!!selected[opt.id]}
                          onChange={(e) => setSelected((s) => ({ ...s, [opt.id]: e.target.checked }))}
                        />
                        <span>{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center rounded-md bg-black text-white px-4 py-2.5 text-sm font-medium hover:bg-black/90 disabled:opacity-60"
              >
                {submitting ? "Submitting…" : ctaLabel}
              </button>
              {errorMsg ? (
                <p role="alert" className="text-sm text-red-600">{errorMsg}</p>
              ) : null}
            </form>

            <p className="mt-3 text-[11px] leading-relaxed text-black/60 text-center md:text-left">
              By signing up, you agree to receive marketing emails. View our privacy policy and terms of service for more info.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
