import {
  Button,
  Container,
  Heading,
  Input,
  Label,
  Select,
  Text,
  toast,
} from "@medusajs/ui"
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
} from "@tanstack/react-query"
import React, { useEffect, useMemo, useState } from "react"
import { apiFetch } from "../../../lib/sdk"

type Region = {
  id: string
  name?: string
  currency_code?: string
}

type SalesChannel = {
  id: string
  name?: string
}

type ListRegionsResponse = {
  regions: Region[]
}

type ListSalesChannelsResponse = {
  sales_channels: SalesChannel[]
}

type CreateDraftOrderResponse = {
  draft_order?: { id: string }
  draftOrder?: { id: string }
}

const __draftOrderCreateQueryClient = new QueryClient()

const DraftOrderCreatePageInner = () => {
  const [email, setEmail] = useState("")
  const [regionId, setRegionId] = useState<string>("")
  const [salesChannelId, setSalesChannelId] = useState<string>("")

  const [itemTitle, setItemTitle] = useState("")
  const [itemQuantity, setItemQuantity] = useState<number>(1)
  const [itemUnitPrice, setItemUnitPrice] = useState<number>(0)

  const {
    data: regionsData,
    isLoading: isLoadingRegions,
    isError: isRegionsError,
    error: regionsError,
  } = useQuery({
    queryKey: ["regions", "all"],
    queryFn: () => apiFetch<ListRegionsResponse>("/admin/regions?limit=100"),
  })

  const {
    data: salesChannelsData,
    isLoading: isLoadingSalesChannels,
    isError: isSalesChannelsError,
    error: salesChannelsError,
  } = useQuery({
    queryKey: ["sales_channels", "all"],
    queryFn: () => apiFetch<ListSalesChannelsResponse>("/admin/sales-channels?limit=100"),
  })

  const regions = (regionsData as any)?.regions || []
  const salesChannels = (salesChannelsData as any)?.sales_channels || []

  useEffect(() => {
    if (!regionId && regions.length) {
      setRegionId(String(regions[0].id))
    }
  }, [regionId, regions])

  useEffect(() => {
    if (!salesChannelId && salesChannels.length) {
      setSalesChannelId(String(salesChannels[0].id))
    }
  }, [salesChannelId, salesChannels])

  const canSubmit = useMemo(() => {
    return (
      email.trim().length > 0 &&
      regionId.trim().length > 0 &&
      salesChannelId.trim().length > 0 &&
      itemTitle.trim().length > 0 &&
      itemQuantity > 0
    )
  }, [email, regionId, salesChannelId, itemTitle, itemQuantity])

  const createDraftOrder = useMutation({
    mutationFn: async () => {
      const body: any = {
        email: email.trim(),
        region_id: regionId,
        sales_channel_id: salesChannelId,
        items: [
          {
            title: itemTitle.trim(),
            quantity: itemQuantity,
            unit_price: itemUnitPrice,
          },
        ],
      }

      return apiFetch<CreateDraftOrderResponse>("/admin/draft-orders", {
        method: "POST",
        body,
      })
    },
    onSuccess: (res) => {
      const id =
        (res as any)?.draft_order?.id || (res as any)?.draftOrder?.id || null
      toast.success("Invoice created")
      if (id) {
        globalThis.location.href = `/app/draft-orders/${encodeURIComponent(id)}`
      } else {
        globalThis.location.href = "/app/draft-orders"
      }
    },
    onError: (err) => {
      toast.error((err as any)?.message || "Failed to create invoice")
    },
  })

  const isLoading = isLoadingRegions || isLoadingSalesChannels
  const isError = isRegionsError || isSalesChannelsError
  const errorMessage =
    (regionsError as any)?.message ||
    (salesChannelsError as any)?.message ||
    "Unknown error"

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <a href="/app/draft-orders" className="text-ui-fg-subtle">
            ← Back
          </a>
          <div>
            <Heading level="h2">Create Invoice</Heading>
            <Text size="small" className="text-ui-fg-subtle">
              Creates a draft order you can send as an invoice
            </Text>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="small"
            onClick={() => (globalThis.location.href = "/app/draft-orders")}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="small"
            isLoading={createDraftOrder.isPending}
            disabled={!canSubmit || isLoading}
            onClick={() => createDraftOrder.mutate()}
          >
            Create
          </Button>
        </div>
      </div>

      <div className="px-6 py-4">
        {isLoading && <Text>Loading…</Text>}
        {isError && (
          <Text className="text-ui-fg-error">Failed to load: {errorMessage}</Text>
        )}

        {!isLoading && !isError && (
          <div className="grid grid-cols-1 gap-4 max-w-[640px]">
            <div>
              <Label>Customer email</Label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="customer@example.com"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Region</Label>
                <Select
                  value={regionId}
                  onValueChange={(v: any) => setRegionId(String(v))}
                >
                  <Select.Trigger>
                    <Select.Value placeholder="Select region" />
                  </Select.Trigger>
                  <Select.Content>
                    {regions.map((r: Region) => (
                      <Select.Item key={r.id} value={r.id}>
                        {r.name || r.id}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </div>

              <div>
                <Label>Sales channel</Label>
                <Select
                  value={salesChannelId}
                  onValueChange={(v: any) => setSalesChannelId(String(v))}
                >
                  <Select.Trigger>
                    <Select.Value placeholder="Select sales channel" />
                  </Select.Trigger>
                  <Select.Content>
                    {salesChannels.map((sc: SalesChannel) => (
                      <Select.Item key={sc.id} value={sc.id}>
                        {sc.name || sc.id}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </div>
            </div>

            <div className="pt-2">
              <Heading level="h3">Line item</Heading>
              <Text size="small" className="text-ui-fg-subtle">
                Add one custom item (price is in minor units, e.g. cents)
              </Text>
            </div>

            <div>
              <Label>Title</Label>
              <Input
                value={itemTitle}
                onChange={(e) => setItemTitle(e.target.value)}
                placeholder="Design services"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Quantity</Label>
                <Input
                  type="number"
                  min={1}
                  value={itemQuantity}
                  onChange={(e) => setItemQuantity(Number(e.target.value || 1))}
                />
              </div>
              <div>
                <Label>Unit price (minor units)</Label>
                <Input
                  type="number"
                  min={0}
                  value={itemUnitPrice}
                  onChange={(e) => setItemUnitPrice(Number(e.target.value || 0))}
                  placeholder="10000"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </Container>
  )
}

const DraftOrderCreatePage = () => {
  return (
    <QueryClientProvider client={__draftOrderCreateQueryClient}>
      <DraftOrderCreatePageInner />
    </QueryClientProvider>
  )
}

export default DraftOrderCreatePage
