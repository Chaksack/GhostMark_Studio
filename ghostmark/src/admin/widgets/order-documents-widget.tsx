import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Text, Button, toast } from "@medusajs/ui"
import React, { useCallback, useState } from "react"
import { apiFetch } from "../lib/sdk"

type AdminOrderShape = {
  id?: string
  display_id?: string | number
  email?: string
  customer?: {
    email?: string
  }
}

async function downloadPdf(kind: "receipts" | "dispatch-notes", order: AdminOrderShape, filenamePrefix: string) {
  const displayId = String(order.display_id || order.id)
  const res = await fetch(`/admin/${kind}/${encodeURIComponent(order.id as string)}/pdf`, {
    method: "GET",
    credentials: "include",
  })

  if (!res.ok) {
    let msg = `Failed to download ${filenamePrefix}`
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
    a.download = `${filenamePrefix}-${displayId}.pdf`
    document.body.appendChild(a)
    a.click()
    a.remove()
  } finally {
    URL.revokeObjectURL(url)
  }
}

const OrderDocumentsWidget = ({ data }: { data: AdminOrderShape }) => {
  const [isDownloadingReceipt, setIsDownloadingReceipt] = useState(false)
  const [isDownloadingDispatch, setIsDownloadingDispatch] = useState(false)
  const [isSendingReceipt, setIsSendingReceipt] = useState(false)
  const [isSendingDispatch, setIsSendingDispatch] = useState(false)

  const onDownloadReceipt = useCallback(async () => {
    setIsDownloadingReceipt(true)
    try {
      await downloadPdf("receipts", data, "receipt")
      toast.success("Receipt downloaded")
    } catch (err: any) {
      toast.error(err?.message || "Failed to download receipt")
    } finally {
      setIsDownloadingReceipt(false)
    }
  }, [data])

  const onDownloadDispatchNote = useCallback(async () => {
    setIsDownloadingDispatch(true)
    try {
      await downloadPdf("dispatch-notes", data, "dispatch-note")
      toast.success("Dispatch note downloaded")
    } catch (err: any) {
      toast.error(err?.message || "Failed to download dispatch note")
    } finally {
      setIsDownloadingDispatch(false)
    }
  }, [data])

  const onSendReceipt = useCallback(async () => {
    const to = data.customer?.email || data.email
    if (!to) {
      toast.error("Order has no customer email")
      return
    }
    setIsSendingReceipt(true)
    try {
      await apiFetch(`/admin/receipts/${encodeURIComponent(data.id as string)}/send`, {
        method: "POST",
        body: { to },
      })
      toast.success(`Receipt sent to ${to}`)
    } catch (err: any) {
      toast.error(err?.message || "Failed to send receipt")
    } finally {
      setIsSendingReceipt(false)
    }
  }, [data])

  const onSendDispatchNote = useCallback(async () => {
    setIsSendingDispatch(true)
    try {
      const res = await apiFetch<{ to?: string }>(
        `/admin/dispatch-notes/${encodeURIComponent(data.id as string)}/send`,
        { method: "POST" }
      )
      toast.success(`Dispatch note sent to ${res?.to || "fulfilment"}`)
    } catch (err: any) {
      toast.error(err?.message || "Failed to send dispatch note")
    } finally {
      setIsSendingDispatch(false)
    }
  }, [data])

  if (!data?.id) return null

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading level="h2">Documents</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Download or email a receipt or dispatch note for this order
          </Text>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 px-6 py-4">
        <Button size="small" variant="secondary" isLoading={isDownloadingReceipt} onClick={onDownloadReceipt}>
          Download receipt
        </Button>
        <Button size="small" variant="secondary" isLoading={isSendingReceipt} onClick={onSendReceipt}>
          Send receipt to customer
        </Button>
        <Button size="small" variant="secondary" isLoading={isDownloadingDispatch} onClick={onDownloadDispatchNote}>
          Download dispatch note
        </Button>
        <Button size="small" variant="secondary" isLoading={isSendingDispatch} onClick={onSendDispatchNote}>
          Send dispatch note to fulfilment
        </Button>
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "order.details.before",
})

export default OrderDocumentsWidget
