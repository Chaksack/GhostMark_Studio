import {
  Badge,
  Button,
  Container,
  Heading,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui"
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useMemo, useState } from "react"
// Avoid react-router-dom hooks to prevent runtime errors when router context
// isn't reliably available in embedded admin routes. We'll resolve params from
// window.location instead.
import { apiFetch } from "../../../lib/sdk"

type SupportTicket = {
  id: number
  case_id: string
  email: string
  subject: string
  status: "open" | "closed" | string
  created_at: string
}

type SupportMessage = {
  id: number
  ticket_id: number
  sender: "customer" | "admin"
  message: string
  created_at: string
}

type TicketResponse = {
  ok: boolean
  ticket: SupportTicket
  messages: SupportMessage[]
}

// Local QueryClient to prevent "No QueryClient set" when the global provider
// isn't present. Safe to nest under any existing provider.
const __supportTicketQueryClient = new QueryClient()

const SupportTicketPageInner = () => {
  // Resolve caseId from location to avoid depending on react-router context.
  const caseId = useMemo(() => {
    if (typeof window === "undefined") return ""
    try {
      const path = window.location.pathname || ""
      // Support both "/app/support/:caseId" and "/support/:caseId"
      const parts = path.split("/").filter(Boolean)
      // Find the index of "support" segment and take the next segment as caseId
      const supportIdx = parts.findIndex((p) => p.toLowerCase() === "support")
      if (supportIdx !== -1 && parts.length > supportIdx + 1) {
        return decodeURIComponent(parts[supportIdx + 1] || "")
      }
      // Fallback: last segment if it looks like a caseId pattern (e.g., GM-...)
      const last = parts[parts.length - 1] || ""
      return decodeURIComponent(last)
    } catch {
      return ""
    }
  }, [])
  const queryClient = useQueryClient()
  const [reply, setReply] = useState("")

  const normalizedCaseId = useMemo(() => (caseId || "").trim(), [caseId])

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["support_ticket", normalizedCaseId],
    queryFn: () =>
      apiFetch<TicketResponse>(
        `/admin/support/tickets/${encodeURIComponent(normalizedCaseId)}`
      ),
    enabled: Boolean(normalizedCaseId),
  })

  const ticket = data?.ticket
  const messages = data?.messages ?? []

  const toggleStatus = useMutation({
    mutationFn: async (nextStatus: "open" | "closed") => {
      if (!ticket) {
        throw new Error("Ticket not loaded")
      }

      await apiFetch(
        `/admin/support/tickets/${encodeURIComponent(ticket.case_id)}`,
        {
          method: "PATCH",
          body: { status: nextStatus },
        }
      )

      return nextStatus
    },
    onSuccess: async (nextStatus) => {
      toast.success(nextStatus === "closed" ? "Ticket closed" : "Ticket reopened")
      await queryClient.invalidateQueries({
        queryKey: ["support_ticket", normalizedCaseId],
      })
      await queryClient.invalidateQueries({ queryKey: ["support_tickets"] })
    },
    onError: (err) => {
      toast.error((err as any)?.message || "Failed to update ticket status")
    },
  })

  const sendReply = useMutation({
    mutationFn: async ({ message }: { message: string }) => {
      if (!normalizedCaseId) {
        throw new Error("Missing case id")
      }

      await apiFetch(
        `/admin/support/tickets/${encodeURIComponent(normalizedCaseId)}/messages`,
        {
          method: "POST",
          body: { message },
        }
      )
    },
    onSuccess: async () => {
      toast.success("Reply sent")
      setReply("")
      await queryClient.invalidateQueries({
        queryKey: ["support_ticket", normalizedCaseId],
      })
    },
    onError: (err) => {
      toast.error((err as any)?.message || "Failed to send reply")
    },
  })

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <a href="/app/support" className="text-ui-fg-subtle">
            ← Back
          </a>
          <div>
            <Heading level="h2">{ticket?.subject || normalizedCaseId}</Heading>
            <Text size="small" className="text-ui-fg-subtle">
              {normalizedCaseId}
              {ticket?.email ? ` • ${ticket.email}` : ""}
            </Text>
          </div>
        </div>

        {ticket && (
          <div className="flex items-center gap-3">
            <Badge color={ticket.status === "closed" ? "grey" : "green"}>
              {ticket.status}
            </Badge>
            <Button
              size="small"
              variant="secondary"
              onClick={() =>
                toggleStatus.mutate(ticket.status === "open" ? "closed" : "open")
              }
              isLoading={toggleStatus.isPending}
            >
              {ticket.status === "open" ? "Close" : "Reopen"}
            </Button>
          </div>
        )}
      </div>

      <div className="px-6 py-4">
        {isLoading && <Text>Loading ticket…</Text>}
        {isError && (
          <Text className="text-ui-fg-error">
            Failed to load ticket: {(error as any)?.message || "Unknown error"}
          </Text>
        )}

        {!isLoading && !isError && ticket && (
          <div className="flex flex-col gap-6">
            <div>
              <Heading level="h3">Messages</Heading>
              <div className="mt-3 flex flex-col gap-3">
                {messages.length === 0 && (
                  <Text size="small" className="text-ui-fg-subtle">
                    No messages.
                  </Text>
                )}

                {messages.map((m) => (
                  <div
                    key={m.id}
                    className="rounded-lg border border-ui-border-base p-4"
                  >
                    <Text size="small" className="text-ui-fg-subtle">
                      {m.sender} •{" "}
                      {m.created_at
                        ? new Date(m.created_at).toLocaleString()
                        : ""}
                    </Text>
                    <Text className="mt-2 whitespace-pre-wrap">{m.message}</Text>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <Heading level="h3">Reply</Heading>
              <Textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Write a reply to the customer…"
                rows={5}
              />
              <div>
                <Button
                  size="small"
                  onClick={() => {
                    const message = reply.trim()
                    if (!message) {
                      toast.info("Write a reply first")
                      return
                    }
                    sendReply.mutate({ message })
                  }}
                  isLoading={sendReply.isPending}
                  disabled={!reply.trim()}
                >
                  Send Reply
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Container>
  )
}

const SupportTicketPage = () => {
  return (
    <QueryClientProvider client={__supportTicketQueryClient}>
      <SupportTicketPageInner />
    </QueryClientProvider>
  )
}

export const handle = {
  breadcrumb: () => "Ticket",
}

export default SupportTicketPage
