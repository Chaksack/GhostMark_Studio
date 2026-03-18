"use client"

import React, { useMemo, useState } from "react"

type Status = "idle" | "submitting" | "success" | "error"

function buildNewsletterEndpoint(): string {
  const base = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"
  const explicit = process.env.NEXT_PUBLIC_NEWSLETTER_ENDPOINT
  if (explicit && explicit.trim()) return explicit.trim()
  return `${base.replace(/\/$/, "")}/store/newsletter/subscribe`
}

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  const pub = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string | undefined
  if (pub) headers["x-publishable-api-key"] = pub
  return headers
}

export default function SubscribeInline() {
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<Status>("idle")
  const [message, setMessage] = useState<string>("")

  const endpoint = useMemo(() => buildNewsletterEndpoint(), [])
  const headers = useMemo(() => buildHeaders(), [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || status === "submitting") return

    setStatus("submitting")
    setMessage("")

    try {
      const resp = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          email,
          send_welcome: true,
        }),
      })

      if (!resp.ok) {
        const t = await resp.text().catch(() => "")
        const msg = (() => {
          try {
            return JSON.parse(t)?.message || t || "Failed to subscribe"
          } catch {
            return t || "Failed to subscribe"
          }
        })()
        setStatus("error")
        setMessage(typeof msg === "string" ? msg : "Failed to subscribe")
        return
      }

      setStatus("success")
      setMessage("Thanks — you’re subscribed.")
      setEmail("")
    } catch {
      setStatus("error")
      setMessage("Something went wrong. Please try again.")
    }
  }

  return (
    <div className="rounded-large border border-mono-200 bg-mono-0 p-6">
      <form onSubmit={submit} className="flex flex-col small:flex-row gap-3">
        <label className="sr-only" htmlFor="subscribe-email">
          Email
        </label>
        <input
          id="subscribe-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email address"
          className="h-11 w-full rounded-full border border-mono-200 bg-mono-0 px-4 text-sm text-mono-1000 placeholder:text-mono-500 outline-none focus:ring-2 focus:ring-mono-300"
        />
        <button
          type="submit"
          disabled={status === "submitting"}
          className="h-11 shrink-0 rounded-full bg-mono-1000 text-mono-0 px-6 text-sm font-medium hover:bg-mono-900 disabled:opacity-60"
        >
          {status === "submitting" ? "Submitting…" : "Subscribe"}
        </button>
      </form>

      {message ? (
        <p
          role={status === "error" ? "alert" : undefined}
          className={
            "mt-3 text-sm " +
            (status === "error" ? "text-red-600" : "text-mono-700")
          }
        >
          {message}
        </p>
      ) : (
        <p className="mt-3 text-xs text-mono-500">
          No spam — unsubscribe any time.
        </p>
      )}
    </div>
  )
}
