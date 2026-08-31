import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ChatBubbleLeftRight } from "@medusajs/icons"
import {
  Badge,
  Container,
  Heading,
  Table,
  Text,
} from "@medusajs/ui"
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query"
import React from "react"
// Avoid react-router-dom's Link to prevent LinkWithRef runtime errors when
// router context isn't reliably available in embedded admin routes.
import { apiFetch } from "../../lib/sdk"

type SupportTicket = {
  id: number
  case_id: string
  email: string
  subject: string
  status: "open" | "closed" | string
  created_at: string
}

type ListTicketsResponse = {
  ok: boolean
  tickets: SupportTicket[]
}

// Create a module-scoped QueryClient so the page works even if the app didn't
// set a global provider. This avoids the runtime error: "No QueryClient set".
// If a parent provider exists, nesting providers is safe; this page will use
// its own cache without affecting the global one.
const __supportQueryClient = new QueryClient()

const SupportPageInner = () => {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["support_tickets"],
    queryFn: () => apiFetch<ListTicketsResponse>(`/admin/support/tickets`),
  })

  const tickets = data?.tickets ?? []

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading level="h2">Support</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Manage customer support tickets
          </Text>
        </div>
      </div>

      <div className="px-6 py-4">
        {isLoading && <Text>Loading tickets…</Text>}
        {isError && (
          <Text className="text-ui-fg-error">
            Failed to load tickets: {(error as any)?.message || "Unknown error"}
          </Text>
        )}

        {!isLoading && !isError && (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Case</Table.HeaderCell>
                <Table.HeaderCell>Subject</Table.HeaderCell>
                <Table.HeaderCell>Status</Table.HeaderCell>
                <Table.HeaderCell>Customer</Table.HeaderCell>
                <Table.HeaderCell>Created</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {tickets.length === 0 && (
                <Table.Row>
                  <Table.Cell>
                    <Text size="small" className="text-ui-fg-subtle">
                      No tickets found.
                    </Text>
                  </Table.Cell>
                  <Table.Cell />
                  <Table.Cell />
                  <Table.Cell />
                  <Table.Cell />
                </Table.Row>
              )}

              {tickets.map((t) => (
                <Table.Row key={t.case_id}>
                  <Table.Cell>
                    <a href={`/app/support/${encodeURIComponent(t.case_id)}`}>
                      {t.case_id}
                    </a>
                  </Table.Cell>
                  <Table.Cell>{t.subject}</Table.Cell>
                  <Table.Cell>
                    <Badge color={t.status === "closed" ? "grey" : "green"}>
                      {t.status}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>{t.email}</Table.Cell>
                  <Table.Cell>
                    {t.created_at ? new Date(t.created_at).toLocaleString() : "–"}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </div>
    </Container>
  )
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: any }> {
  constructor(props: any) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error: any) {
    return { error }
  }
  componentDidCatch(err: any) {
    console.error("Support page crashed:", err)
  }
  render(): any {
    if (this.state.error) {
      return (
        <div className="p-6">
          <Heading level="h2">Support</Heading>
          <Text className="text-ui-fg-error mt-2">{String(this.state.error?.message || this.state.error)}</Text>
        </div>
      )
    }
    return this.props.children as any
  }
}

const SupportPage = () => {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={__supportQueryClient}>
        <SupportPageInner />
      </QueryClientProvider>
    </ErrorBoundary>
  )
}

export const config = defineRouteConfig({
  label: "Support",
  icon: ChatBubbleLeftRight,
})

export const handle = {
  breadcrumb: () => "Support",
}

export default SupportPage
