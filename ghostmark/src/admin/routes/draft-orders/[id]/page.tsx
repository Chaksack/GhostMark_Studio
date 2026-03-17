import {
  Button,
  Container,
  Heading,
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
import React, { useMemo } from "react"
import { apiFetch } from "../../../lib/sdk"

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

type RetrieveDraftOrderResponse = {
  draft_order?: DraftOrder
  draftOrder?: DraftOrder
}

const __draftOrderQueryClient = new QueryClient()

async function downloadDraftInvoicePdf(draftOrder: DraftOrder) {
  const displayId = String(draftOrder.display_id || draftOrder.id)
  const res = await fetch(
    `/admin/invoices/draft-orders/${encodeURIComponent(draftOrder.id)}/pdf`,
    {
      method: "GET",
      credentials: "include",
    }
  )

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

const DraftOrderPageInner = () => {
  const id = useMemo(() => {
    if (typeof globalThis.window === "undefined") return ""
    const parts = (globalThis.location.pathname || "").split("/").filter(Boolean)
    const idx = parts.findIndex((p) => p.toLowerCase() === "draft-orders")
    if (idx !== -1 && parts[idx + 1]) {
      return decodeURIComponent(parts[idx + 1])
    }
    return decodeURIComponent(parts[parts.length - 1] || "")
  }, [])

  const queryClient = useQueryClient()

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["draft_order", id],
    queryFn: () => apiFetch<RetrieveDraftOrderResponse>(`/admin/draft-orders/${encodeURIComponent(id)}`),
    enabled: Boolean(id),
  })

  const draft: DraftOrder | undefined = (data as any)?.draft_order || (data as any)?.draftOrder

  const convertToOrder = useMutation({
    mutationFn: async () => {
      await apiFetch(`/admin/draft-orders/${encodeURIComponent(id)}/convert-to-order`, {
        method: "POST",
      })
    },
    onSuccess: async () => {
      toast.success("Draft order converted to order")
      await queryClient.invalidateQueries({ queryKey: ["draft_order", id] })
    },
    onError: (err) => {
      toast.error((err as any)?.message || "Failed to convert")
    },
  })

  const deleteDraft = useMutation({
    mutationFn: async () => {
      await apiFetch(`/admin/draft-orders/${encodeURIComponent(id)}`, {
        method: "DELETE",
      })
    },
    onSuccess: () => {
      toast.success("Draft order deleted")
      globalThis.location.href = "/app/draft-orders"
    },
    onError: (err) => {
      toast.error((err as any)?.message || "Failed to delete")
    },
  })

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <a href="/app/draft-orders" className="text-ui-fg-subtle">
            ← Back
          </a>
          <div>
            <Heading level="h2">Draft Order</Heading>
            <Text size="small" className="text-ui-fg-subtle">
              {draft ? String(draft.display_id || draft.id) : id || "—"}
            </Text>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="small"
            disabled={!draft || isLoading}
            onClick={async () => {
              if (!draft) return
              try {
                await downloadDraftInvoicePdf(draft)
                toast.success("Invoice downloaded")
              } catch (e: any) {
                toast.error(e?.message || "Failed to download invoice")
              }
            }}
          >
            Download PDF
          </Button>

          <Button
            variant="primary"
            size="small"
            disabled={!draft || isLoading}
            onClick={async () => {
              if (!draft) return
              const to = draft.customer?.email || draft.email
              if (!to) {
                toast.error("Draft order has no customer email")
                return
              }
              try {
                await apiFetch(
                  `/admin/invoices/draft-orders/${encodeURIComponent(draft.id)}/send`,
                  { method: "POST" }
                )
                toast.success(`Invoice sent to ${to}`)
              } catch (e: any) {
                toast.error(e?.message || "Failed to send invoice")
              }
            }}
          >
            Send invoice
          </Button>

          <Button
            variant="secondary"
            size="small"
            onClick={() => deleteDraft.mutate()}
            disabled={deleteDraft.isPending || !id}
          >
            Delete
          </Button>
          <Button
            variant="secondary"
            size="small"
            onClick={() => convertToOrder.mutate()}
            disabled={convertToOrder.isPending || !id}
          >
            Convert to order
          </Button>
        </div>
      </div>

      <div className="px-6 py-4">
        {isLoading && <Text>Loading draft order…</Text>}
        {isError && (
          <Text className="text-ui-fg-error">
            Failed to load draft order: {(error as any)?.message || "Unknown error"}
          </Text>
        )}

        {!isLoading && !isError && !draft && (
          <Text className="text-ui-fg-subtle">Draft order not found.</Text>
        )}

        {!isLoading && !isError && draft && (
          <div className="space-y-2">
            <Text>
              <strong>Status:</strong> {draft.status || "—"}
            </Text>
            <Text>
              <strong>Customer:</strong> {draft.customer?.email || draft.email || "—"}
            </Text>
            <Text>
              <strong>Total:</strong>{" "}
              {typeof draft.total === "number"
                ? formatMoney(draft.total, draft.currency_code)
                : "—"}
            </Text>
            <Text>
              <strong>Created:</strong>{" "}
              {draft.created_at ? new Date(draft.created_at).toLocaleString() : "—"}
            </Text>
          </div>
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
    console.error("Draft order page crashed:", err)
  }
  render(): any {
    if (this.state.error) {
      return (
        <div className="p-6">
          <Heading level="h2">Draft Order</Heading>
          <Text className="text-ui-fg-error mt-2">
            {String(this.state.error?.message || this.state.error)}
          </Text>
        </div>
      )
    }
    return this.props.children as any
  }
}

const DraftOrderPage = () => {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={__draftOrderQueryClient}>
        <DraftOrderPageInner />
      </QueryClientProvider>
    </ErrorBoundary>
  )
}

export default DraftOrderPage
