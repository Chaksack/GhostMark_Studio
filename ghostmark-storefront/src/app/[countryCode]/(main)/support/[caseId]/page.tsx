"use client"
import { useEffect, useState } from "react"
import { useParams, useSearchParams } from "next/navigation"

type Message = { id: number; ticket_id: number; sender: 'customer'|'admin'; message: string; created_at: string }

export default function SupportThreadPage() {
  const params = useParams<{ caseId: string }>()
  const search = useSearchParams()
  const [email, setEmail] = useState(search.get('email') || '')
  const [secret, setSecret] = useState(search.get('secret') || '')
  const [loading, setLoading] = useState(false)
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ticketInfo, setTicketInfo] = useState<{ caseId: string; subject: string; status: string; created_at: string } | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [reply, setReply] = useState('')

  async function fetchThread() {
    if (!email || !secret) return
    setLoading(true)
    setError(null)
    try {
      const base = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"
      const resp = await fetch(`${base}/store/support/tickets/${params.caseId}?email=${encodeURIComponent(email)}&secret=${encodeURIComponent(secret)}`)
      const data = await resp.json()
      if (!resp.ok || !data?.ok) throw new Error(data?.message || 'Failed to load ticket')
      setTicketInfo(data.ticket)
      setMessages(data.messages)
    } catch (e: any) {
      setError(e?.message || 'Failed to load ticket')
    } finally {
      setLoading(false)
    }
  }

  async function postReply() {
    setPosting(true)
    setError(null)
    try {
      const base = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"
      const resp = await fetch(`${base}/store/support/tickets/${params.caseId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, secret, message: reply }),
      })
      const data = await resp.json()
      if (!resp.ok || !data?.ok) throw new Error(data?.message || 'Failed to send reply')
      setReply('')
      await fetchThread()
    } catch (e: any) {
      setError(e?.message || 'Failed to send reply')
    } finally {
      setPosting(false)
    }
  }

  useEffect(() => {
    // optional auto load if query contains email/secret
    if (email && secret) fetchThread()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="container mx-auto max-w-2xl py-10 px-4">
      <h1 className="text-2xl font-semibold mb-6">Support Case {params.caseId}</h1>
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input className="w-full border rounded px-3 py-2" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Secret</label>
            <input className="w-full border rounded px-3 py-2" value={secret} onChange={(e)=>setSecret(e.target.value)} placeholder="Your secret code" />
          </div>
        </div>
        <button onClick={fetchThread} disabled={loading || !email || !secret} className="bg-black text-white rounded px-4 py-2 disabled:opacity-50">{loading ? 'Loading...' : 'Load Conversation'}</button>
        {error && <p className="text-red-600 text-sm">{error}</p>}

        {ticketInfo && (
          <div className="border rounded p-4 bg-gray-50">
            <p className="font-medium">Subject: {ticketInfo.subject}</p>
            <p className="text-sm text-gray-600">Status: {ticketInfo.status} • Opened: {new Date(ticketInfo.created_at).toLocaleString()}</p>
          </div>
        )}

        {messages.length > 0 && (
          <div className="space-y-3">
            {messages.map(m => (
              <div key={m.id} className={`p-3 rounded border ${m.sender==='admin' ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'}`}>
                <div className="text-xs text-gray-500 mb-1">{m.sender} • {new Date(m.created_at).toLocaleString()}</div>
                <div className="whitespace-pre-wrap">{m.message}</div>
              </div>
            ))}
          </div>
        )}

        {ticketInfo && (
          <div className="space-y-2">
            <label className="block text-sm font-medium mb-1">Your reply</label>
            <textarea className="w-full border rounded px-3 py-2 min-h-[120px]" value={reply} onChange={(e)=>setReply(e.target.value)} placeholder="Write your message..." />
            <button onClick={postReply} disabled={posting || !reply} className="bg-black text-white rounded px-4 py-2 disabled:opacity-50">{posting ? 'Sending...' : 'Send reply'}</button>
          </div>
        )}
      </div>
    </div>
  )
}
