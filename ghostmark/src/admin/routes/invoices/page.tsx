import { defineRouteConfig } from "@medusajs/admin-sdk"
import { DocumentText } from "@medusajs/icons"
import {
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
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import React, { useCallback, useEffect } from "react"
import { apiFetch } from "../../lib/sdk"

type AdminOrder = {
  id: string
  display_id?: string | number
  created_at?: string
  currency_code?: string
  total?: number
  email?: string
  customer?: {
    email?: string
  }
}

type ListOrdersResponse = {
  orders?: AdminOrder[]
  order?: AdminOrder[]
  count?: number
  limit?: number
  offset?: number
}

const __invoiceQueryClient = new QueryClient()

// Medusa v2 order totals are already decimal major-unit amounts (e.g. 42.00
// means £42.00), not integer cents — do not divide by 100 here.
function formatMoney(amount: number, currencyCode?: string): string {
  const currency = (currencyCode || "USD").toUpperCase()
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(amount || 0)
  } catch {
    return `${(amount || 0).toFixed(2)} ${currency}`
  }
}

async function downloadInvoicePdf(order: AdminOrder) {
  const displayId = String(order.display_id || order.id)
  const res = await fetch(`/admin/invoices/${encodeURIComponent(order.id)}/pdf`, {
    method: "GET",
    credentials: "include",
  })

  if (!res.ok) {
    let msg = "Failed to download invoice"
    try {
      msg = (await res.text()) || msg
    } catch {}
    throw new Error(msg)
  }

  const blob = await res.blob()
  const url = URL.createObjectURL(blob)

  try {
    const a = document.createElement("a")
    a.href = url
    a.download = `invoice-${displayId}.pdf`
    document.body.appendChild(a)
    a.click()
    a.remove()
  } finally {
    URL.revokeObjectURL(url)
  }
}

const InvoicesPageInner = () => {
  const queryClient = useQueryClient()

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["orders_recent"],
    queryFn: () => apiFetch<ListOrdersResponse>(`/admin/orders?limit=20&offset=0`),
  })

  const orders: AdminOrder[] = (data as any)?.orders || (data as any)?.order || []

  const sendInvoice = useMutation({
    mutationFn: async (order: AdminOrder) => {
      const to = order.customer?.email || order.email
      if (!to) {
        throw new Error("Order has no customer email")
      }

      await apiFetch(`/admin/invoices/${encodeURIComponent(order.id)}/send`, {
        method: "POST",
        body: { to },
      })

      return to
    },
    onSuccess: (to) => {
      toast.success(`Invoice sent to ${to}`)
    },
    onError: (err) => {
      toast.error((err as any)?.message || "Failed to send invoice")
    },
  })

  const onDownload = useCallback(async (order: AdminOrder) => {
    try {
      await downloadInvoicePdf(order)
      toast.success("Invoice downloaded")
    } catch (err: any) {
      toast.error(err?.message || "Failed to download invoice")
    }
  }, [])

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["orders_recent"] })
  }, [queryClient])

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading level="h2">Invoices</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Download or email invoice PDFs for recent orders
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
        {isLoading && <Text>Loading orders…</Text>}
        {isError && (
          <Text className="text-ui-fg-error">
            Failed to load orders: {(error as any)?.message || "Unknown error"}
          </Text>
        )}

        {!isLoading && !isError && (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Order</Table.HeaderCell>
                <Table.HeaderCell>Customer</Table.HeaderCell>
                <Table.HeaderCell>Total</Table.HeaderCell>
                <Table.HeaderCell>Created</Table.HeaderCell>
                <Table.HeaderCell className="w-[240px]">Actions</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {orders.length === 0 && (
                <Table.Row>
                  <Table.Cell>
                    <Text size="small" className="text-ui-fg-subtle">
                      No orders found.
                    </Text>
                  </Table.Cell>
                  <Table.Cell />
                  <Table.Cell />
                  <Table.Cell />
                  <Table.Cell />
                </Table.Row>
              )}

              {orders.map((o) => {
                const displayId = String(o.display_id || o.id)
                const email = o.customer?.email || o.email || "—"
                return (
                  <Table.Row key={o.id}>
                    <Table.Cell>
                      <a href={`/app/orders/${encodeURIComponent(o.id)}`}>{displayId}</a>
                    </Table.Cell>
                    <Table.Cell>{email}</Table.Cell>
                    <Table.Cell>
                      {typeof o.total === "number"
                        ? formatMoney(o.total, o.currency_code)
                        : "—"}
                    </Table.Cell>
                    <Table.Cell>
                      {o.created_at ? new Date(o.created_at).toLocaleString() : "—"}
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="small"
                          variant="secondary"
                          onClick={() => onDownload(o)}
                        >
                          Download PDF
                        </Button>
                        <Button
                          size="small"
                          variant="primary"
                          disabled={sendInvoice.isPending || !(o.customer?.email || o.email)}
                          onClick={() => sendInvoice.mutate(o)}
                        >
                          Send to customer
                        </Button>
                      </div>
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

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: any }
> {
  constructor(props: any) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error: any) {
    return { error }
  }
  componentDidCatch(err: any) {
    console.error("Invoices page crashed:", err)
  }
  render(): any {
    if (this.state.error) {
      return (
        <div className="p-6">
          <Heading level="h2">Invoices</Heading>
          <Text className="text-ui-fg-error mt-2">
            {String(this.state.error?.message || this.state.error)}
          </Text>
        </div>
      )
    }
    return this.props.children as any
  }
}

const InvoicesPage = () => {
  // Redirect to Draft Orders to merge Invoice page into Drafts
  useEffect(() => {
    try {
      globalThis.location?.replace?.("/app/draft-orders")
    } catch {
      globalThis.location.href = "/app/draft-orders"
    }
  }, [])

  return (
    <ErrorBoundary>
      <QueryClientProvider client={__invoiceQueryClient}>
        <div className="p-6">
          <Heading level="h2">Draft Orders</Heading>
          <Text className="text-ui-fg-subtle mt-2">
            You are being redirected to Draft Orders…
          </Text>
          <div className="mt-2">
            <a href="/app/draft-orders" className="text-ui-fg-interactive">Go now</a>
          </div>
        </div>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}

// Route has been merged into Draft Orders — remove from navigation by omitting route config
// export const config = defineRouteConfig({
//   label: "Invoices",
//   icon: DocumentText,
// })

// export const handle = {
//   breadcrumb: () => "Invoices",
// }

export default InvoicesPage
