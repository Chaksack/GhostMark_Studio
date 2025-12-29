"use client"
import { useState } from "react"

export default function SupportPage() {
  const [email, setEmail] = useState("")
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ caseId: string; secret: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setLoading(true)
    setError(null)
    try {
      const base = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"
      const resp = await fetch(`${base}/store/support/tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, subject, message }),
      })
      const data = await resp.json()
      if (!resp.ok || !data?.ok) throw new Error(data?.message || "Failed to submit")
      setResult({ caseId: data.caseId, secret: data.secret })
    } catch (e: any) {
      setError(e?.message || "Failed to submit")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto max-w-2xl py-10 px-4">
      <h1 className="text-2xl font-semibold mb-6">Customer Support</h1>
      {!result ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input className="w-full border rounded px-3 py-2" type="email" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Subject</label>
            <input className="w-full border rounded px-3 py-2" value={subject} onChange={(e)=>setSubject(e.target.value)} placeholder="Tell us briefly what's wrong" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Message</label>
            <textarea className="w-full border rounded px-3 py-2 min-h-[140px]" value={message} onChange={(e)=>setMessage(e.target.value)} placeholder="Describe your issue or complaint..." />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button disabled={loading || !email || !subject || !message} onClick={submit} className="bg-black text-white rounded px-4 py-2 disabled:opacity-50">
            {loading ? "Submitting..." : "Submit"}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-green-700">Your ticket has been created.</p>
          <div className="border rounded p-4 bg-gray-50">
            <p><span className="font-medium">Case ID:</span> {result.caseId}</p>
            <p><span className="font-medium">Secret:</span> {result.secret}</p>
          </div>
          <p className="text-sm text-gray-700">Please save your Case ID and Secret. You will need them to view replies and respond. You will also receive an email confirmation.</p>
        </div>
      )}
    </div>
  )
}
