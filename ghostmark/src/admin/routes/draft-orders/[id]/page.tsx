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
import React, { useMemo, useState } from "react"
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

type DocumentAction = {
  key: string
  label: string
  // Same routes for orders and draft orders except invoices, which keep their
  // original draft-specific path.
  pdfUrl: (id: string) => string
  sendUrl: (id: string) => string
  filenamePrefix: string
}

const DOCUMENTS: DocumentAction[] = [
  {
    key: "invoice",
    label: "Invoice",
    pdfUrl: (id) => `/admin/invoices/draft-orders/${encodeURIComponent(id)}/pdf`,
    sendUrl: (id) => `/admin/invoices/draft-orders/${encodeURIComponent(id)}/send`,
    filenamePrefix: "invoice",
  },
  {
    key: "receipt",
    label: "Receipt",
    pdfUrl: (id) => `/admin/receipts/${encodeURIComponent(id)}/pdf`,
    sendUrl: (id) => `/admin/receipts/${encodeURIComponent(id)}/send`,
    filenamePrefix: "receipt",
  },
  {
    key: "dispatch",
    label: "Dispatch note",
    pdfUrl: (id) => `/admin/dispatch-notes/${encodeURIComponent(id)}/pdf`,
    sendUrl: (id) => `/admin/dispatch-notes/${encodeURIComponent(id)}/send`,
    filenamePrefix: "dispatch-note",
  },
]

async function downloadDocumentPdf(doc: DocumentAction, draftOrder: DraftOrder) {
  const displayId = String(draftOrder.display_id || draftOrder.id)
  const res = await fetch(doc.pdfUrl(draftOrder.id), {
    method: "GET",
    credentials: "include",
  })

  if (!res.ok) {
    let msg = `Failed to download ${doc.label.toLowerCase()}`
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
    a.download = `${doc.filenamePrefix}-${displayId}.pdf`
    document.body.appendChild(a)
    a.click()
    a.remove()
  } finally {
    URL.revokeObjectURL(url)
  }
}

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

  const customerEmail = draft?.customer?.email || draft?.email || ""
  // Which document action is in flight, e.g. "send-receipt" / "download-invoice"
  const [busy, setBusy] = useState<string | null>(null)

  const runDownload = async (doc: DocumentAction) => {
    if (!draft) return
    setBusy(`download-${doc.key}`)
    try {
      await downloadDocumentPdf(doc, draft)
      toast.success(`${doc.label} downloaded`)
    } catch (e: any) {
      toast.error(e?.message || `Failed to download ${doc.label.toLowerCase()}`)
    } finally {
      setBusy(null)
    }
  }

  const runSend = async (doc: DocumentAction) => {
    if (!draft) return
    if (!customerEmail) {
      toast.error("Draft order has no customer email")
      return
    }
    setBusy(`send-${doc.key}`)
    try {
      await apiFetch(doc.sendUrl(draft.id), { method: "POST", body: { to: customerEmail } })
      toast.success(`${doc.label} sent to ${customerEmail}`)
    } catch (e: any) {
      toast.error(e?.message || `Failed to send ${doc.label.toLowerCase()}`)
    } finally {
      setBusy(null)
    }
  }

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

      {draft && (
        <div className="px-6 py-4">
          <Heading level="h3">Documents</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            {customerEmail
              ? `Emailed documents are sent to ${customerEmail}`
              : "Add a customer email to this draft order to enable sending"}
          </Text>

          <div className="mt-3 divide-y rounded-lg border">
            {DOCUMENTS.map((doc) => (
              <div key={doc.key} className="flex items-center justify-between gap-4 px-4 py-3">
                <Text weight="plus">{doc.label}</Text>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="small"
                    isLoading={busy === `download-${doc.key}`}
                    disabled={busy !== null}
                    onClick={() => runDownload(doc)}
                  >
                    Download PDF
                  </Button>
                  <Button
                    variant="primary"
                    size="small"
                    isLoading={busy === `send-${doc.key}`}
                    disabled={busy !== null || !customerEmail}
                    onClick={() => runSend(doc)}
                  >
                    Send via email
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
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
