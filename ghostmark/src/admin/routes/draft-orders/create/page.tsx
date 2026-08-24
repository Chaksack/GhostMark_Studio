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

type InvoiceItemInput = {
  key: string
  description: string
  quantity: number
  unitPriceMajor: string
}

// NOTE: Medusa v2 order/line-item money fields (unit_price, total, subtotal, ...)
// are already decimal amounts in the currency's major unit (e.g. 40.80 means
// £40.80) — NOT integer minor units like cents. Do not multiply/divide by a
// currency factor anywhere in this file; confirmed by inspecting a draft order
// created through this exact form, where a previous version of this code
// multiplied the entered amount by 100 before sending it as `unit_price`,
// silently persisting a 100x-inflated price on every walk-in invoice.
function parseDecimalAmount(value: string): number {
  const raw = String(value || "").trim()
  if (!raw) return 0

  // Allow "1,234.56" or "1234,56". Keep it simple and predictable.
  const normalized = raw
    .replaceAll(/\s/g, "")
    .replaceAll(/,(?=\d{3}(\D|$))/g, "")
    .replaceAll(",", ".")

  const n = Number(normalized)
  return Number.isFinite(n) ? n : 0
}

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

  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [company, setCompany] = useState("")
  const [phone, setPhone] = useState("")
  const [address1, setAddress1] = useState("")
  const [address2, setAddress2] = useState("")
  const [city, setCity] = useState("")
  const [province, setProvince] = useState("")
  const [postalCode, setPostalCode] = useState("")
  const [countryCode, setCountryCode] = useState("US")

  const [paymentMethod, setPaymentMethod] = useState("")

  const [items, setItems] = useState<InvoiceItemInput[]>([
    {
      key: "item-1",
      description: "",
      quantity: 1,
      unitPriceMajor: "",
    },
  ])

  const updateItem = (key: string, update: Partial<InvoiceItemInput>) => {
    setItems((prev) => prev.map((p) => (p.key === key ? { ...p, ...update } : p)))
  }

  const removeItem = (key: string) => {
    setItems((prev) => prev.filter((p) => p.key !== key))
  }

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

  const selectedRegion: Region | undefined = useMemo(() => {
    return regions.find((r: Region) => String(r.id) === String(regionId))
  }, [regions, regionId])

  const currencyCode = selectedRegion?.currency_code || "USD"

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
    const lineItemsCount = items.filter((i) => i.description.trim() && i.quantity > 0).length
    return (
      email.trim().length > 0 &&
      regionId.trim().length > 0 &&
      salesChannelId.trim().length > 0 &&
      lineItemsCount > 0
    )
  }, [email, regionId, salesChannelId, items])

  const subtotalAmount = useMemo(() => {
    return items.reduce((sum, item) => {
      const lineAmount = parseDecimalAmount(item.unitPriceMajor) * Number(item.quantity || 0)
      return sum + Math.max(0, Number(lineAmount || 0))
    }, 0)
  }, [items])

  const createDraftOrder = useMutation({
    mutationFn: async () => {
      const draftItems = items
        .filter((i) => i.description.trim() && i.quantity > 0)
        .map((i) => {
          return {
            title: i.description.trim(),
            quantity: Number(i.quantity || 0),
            unit_price: Math.max(0, parseDecimalAmount(i.unitPriceMajor)),
          }
        })

      const billingAddress: any = {
        first_name: firstName.trim() || undefined,
        last_name: lastName.trim() || undefined,
        company: company.trim() || undefined,
        phone: phone.trim() || undefined,
        address_1: address1.trim() || undefined,
        address_2: address2.trim() || undefined,
        city: city.trim() || undefined,
        province: province.trim() || undefined,
        postal_code: postalCode.trim() || undefined,
        country_code: countryCode.trim().toLowerCase() || undefined,
      }

      const body: any = {
        email: email.trim(),
        region_id: regionId,
        sales_channel_id: salesChannelId,
        billing_address: billingAddress,
        // Invoices typically don't need separate shipping info.
        shipping_address: billingAddress,
        items: draftItems,
        no_notification_order: true,
        metadata: {
          ...(paymentMethod.trim() ? { invoice_payment_method: paymentMethod.trim() } : {}),
        },
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
                <Label>First name</Label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div>
                <Label>Last name</Label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
              <div>
                <Label>Company</Label>
                <Input value={company} onChange={(e) => setCompany(e.target.value)} />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label>Address line 1</Label>
                <Input value={address1} onChange={(e) => setAddress1(e.target.value)} />
              </div>
              <div>
                <Label>Address line 2</Label>
                <Input value={address2} onChange={(e) => setAddress2(e.target.value)} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>City</Label>
                  <Input value={city} onChange={(e) => setCity(e.target.value)} />
                </div>
                <div>
                  <Label>Province / State</Label>
                  <Input value={province} onChange={(e) => setProvince(e.target.value)} />
                </div>
                <div>
                  <Label>Postal code</Label>
                  <Input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
                </div>
                <div>
                  <Label>Country code</Label>
                  <Input
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value.toUpperCase())}
                    placeholder="US"
                  />
                </div>
              </div>
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
                        {r.name || r.id} {r.currency_code ? `(${String(r.currency_code).toUpperCase()})` : ""}
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
              <Heading level="h3">Payment</Heading>
              <Text size="small" className="text-ui-fg-subtle">
                Payment method is shown on the invoice PDF
              </Text>
            </div>

            <div>
              <Label>Payment method</Label>
              <Input
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                placeholder="Bank transfer"
              />
            </div>

            <div className="pt-2">
              <Heading level="h3">Items</Heading>
              <Text size="small" className="text-ui-fg-subtle">
                Description, quantity, and unit price ({String(currencyCode).toUpperCase()})
              </Text>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {items.map((item, idx) => (
                <div
                  key={item.key}
                  className="grid grid-cols-1 md:grid-cols-[1fr_120px_160px_40px] gap-2 items-end"
                >
                  <div>
                    <Label>Item description</Label>
                    <Input
                      value={item.description}
                      onChange={(e) => updateItem(item.key, { description: e.target.value })}
                      placeholder="Design services"
                    />
                  </div>

                  <div>
                    <Label>Qty</Label>
                    <Input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => {
                        const q = Math.max(1, Number(e.target.value || 1))
                        updateItem(item.key, { quantity: q })
                      }}
                    />
                  </div>

                  <div>
                    <Label>Unit price</Label>
                    <Input
                      value={item.unitPriceMajor}
                      onChange={(e) => updateItem(item.key, { unitPriceMajor: e.target.value })}
                      placeholder="100.00"
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button
                      variant="secondary"
                      size="small"
                      disabled={items.length <= 1}
                      onClick={() => removeItem(item.key)}
                    >
                      ×
                    </Button>
                  </div>
                </div>
              ))}

              <div className="flex items-center justify-between">
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => {
                    setItems((prev) => {
                      const nextIdx = prev.length + 1
                      return [
                        ...prev,
                        {
                          key: `item-${nextIdx}`,
                          description: "",
                          quantity: 1,
                          unitPriceMajor: "",
                        },
                      ]
                    })
                  }}
                >
                  Add item
                </Button>

                <Text size="small" className="text-ui-fg-subtle">
                  Subtotal: {formatMoney(subtotalAmount, currencyCode)}
                </Text>
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
