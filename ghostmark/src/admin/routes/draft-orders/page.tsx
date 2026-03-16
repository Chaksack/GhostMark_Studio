import { defineRouteConfig } from "@medusajs/admin-sdk"
import { DocumentText } from "@medusajs/icons"
import {
  Badge,
  Button,
  Container,
  Heading,
  Table,
  Text,
  toast,
} from "@medusajs/ui"
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query"
import React, { useCallback } from "react"
import { apiFetch } from "../../lib/sdk"

type DraftOrder = {
  id: string
  display_id?: string | number
  status?: string
  created_at?: string
  currency_code?: string
  total?: number
  email?: string
  customer?: {
    email?: string
  }
}

type ListDraftOrdersResponse = {
  draft_orders?: DraftOrder[]
  draftOrders?: DraftOrder[]
  count?: number
  limit?: number
  offset?: number
}

const __draftOrdersQueryClient = new QueryClient()

function statusColor(status?: string): "green" | "blue" | "grey" {
  if (status === "completed") return "green"
  if (status === "open") return "blue"
  return "grey"
}

function formatMoney(amountMinor: number, currencyCode?: string): string {
  const currency = (currencyCode || "USD").toUpperCase()
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format((amountMinor || 0) / 100)
  } catch {
    return `${((amountMinor || 0) / 100).toFixed(2)} ${currency}`
  }
}

const DraftOrdersPageInner = () => {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["draft_orders_recent"],
    queryFn: () => apiFetch<ListDraftOrdersResponse>(`/admin/draft-orders?limit=20&offset=0`),
  })

  const draftOrders: DraftOrder[] =
    (data as any)?.draft_orders || (data as any)?.draftOrders || []

  const refresh = useCallback(async () => {
    try {
      await refetch()
    } catch (e: any) {
      toast.error(e?.message || "Failed to refresh")
    }
  }, [refetch])

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading level="h2">Draft Orders</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            View and manage draft orders
          </Text>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="small"
            onClick={() => (globalThis.location.href = "/app/draft-orders/create")}
          >
            Create invoice
          </Button>
          <Button variant="secondary" size="small" onClick={refresh}>
            Refresh
          </Button>
        </div>
      </div>

      <div className="px-6 py-4">
        {isLoading && <Text>Loading draft orders…</Text>}
        {isError && (
          <Text className="text-ui-fg-error">
            Failed to load draft orders: {(error as any)?.message || "Unknown error"}
          </Text>
        )}

        {!isLoading && !isError && (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Draft</Table.HeaderCell>
                <Table.HeaderCell>Status</Table.HeaderCell>
                <Table.HeaderCell>Customer</Table.HeaderCell>
                <Table.HeaderCell>Total</Table.HeaderCell>
                <Table.HeaderCell>Created</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {draftOrders.length === 0 && (
                <Table.Row>
                  <Table.Cell>
                    <Text size="small" className="text-ui-fg-subtle">
                      No draft orders found.
                    </Text>
                  </Table.Cell>
                  <Table.Cell />
                  <Table.Cell />
                  <Table.Cell />
                  <Table.Cell />
                </Table.Row>
              )}

              {draftOrders.map((d) => {
                const displayId = String(d.display_id || d.id)
                const email = d.customer?.email || d.email || "—"
                const status = d.status || "—"

                return (
                  <Table.Row key={d.id}>
                    <Table.Cell>
                      <a href={`/app/draft-orders/${encodeURIComponent(d.id)}`}>{displayId}</a>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge
                        color={statusColor(status)}
                      >
                        {status}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>{email}</Table.Cell>
                    <Table.Cell>
                      {typeof d.total === "number" ? formatMoney(d.total, d.currency_code) : "—"}
                    </Table.Cell>
                    <Table.Cell>
                      {d.created_at ? new Date(d.created_at).toLocaleString() : "—"}
                    </Table.Cell>
                  </Table.Row>
                )
              })}
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
    console.error("Draft orders page crashed:", err)
  }
  render(): any {
    if (this.state.error) {
      return (
        <div className="p-6">
          <Heading level="h2">Draft Orders</Heading>
          <Text className="text-ui-fg-error mt-2">
            {String(this.state.error?.message || this.state.error)}
          </Text>
        </div>
      )
    }
    return this.props.children as any
  }
}

const DraftOrdersPage = () => {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={__draftOrdersQueryClient}>
        <DraftOrdersPageInner />
      </QueryClientProvider>
    </ErrorBoundary>
  )
}

export const config = defineRouteConfig({
  label: "Draft Orders",
  icon: DocumentText,
})

export const handle = {
  breadcrumb: () => "Draft Orders",
}

export default DraftOrdersPage

