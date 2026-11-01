// =============================================================================
// Product page: what a customer pays per side to have their artwork printed.
// Reads and writes /admin/products/:id/print-fees (see that route for rules).
//
// The storefront prices a customised line as the product's tier price plus
// the fee of every side that carries artwork. A side with no fee prints free.
// A side priced in SOME currencies but not all is refused to customers paying
// in the missing one, so the widget flags that state rather than letting it
// ship silently.
// =============================================================================

import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Badge, Button, Container, Heading, Input, Label, Text, toast } from "@medusajs/ui"
import React, { useEffect, useMemo, useState } from "react"
import { apiFetch } from "../lib/sdk"

type Location = { key: string; label: string; surcharge: Record<string, number> | null }
type FeesView = { product_id: string; currencies: string[]; customisable: boolean; locations: Location[] }
type Draft = Record<string, Record<string, string>>

const toDraft = (v: FeesView): Draft =>
  Object.fromEntries(
    v.locations.map((l) => [
      l.key,
      Object.fromEntries(v.currencies.map((c) => [c, l.surcharge?.[c] !== undefined ? String(l.surcharge[c]) : ""])),
    ]),
  )

const PrintFeesWidget = ({ data }: { data: { id?: string } }) => {
  const [view, setView] = useState<FeesView | null>(null)
  const [draft, setDraft] = useState<Draft>({})
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!data?.id) return
    apiFetch<FeesView>(`/admin/products/${encodeURIComponent(data.id)}/print-fees`)
      .then((v) => { setView(v); setDraft(toDraft(v)) })
      .catch((e) => setError(e?.message || "Could not load print fees"))
  }, [data?.id])

  const partial = useMemo(() => {
    if (!view) return [] as string[]
    return view.locations
      .filter((l) => {
        const filled = view.currencies.filter((c) => (draft[l.key]?.[c] ?? "").trim() !== "")
        return filled.length > 0 && filled.length < view.currencies.length
      })
      .map((l) => l.label)
  }, [view, draft])

  if (error) return <Container className="p-4"><Text className="text-ui-fg-error">{error}</Text></Container>
  if (!view || !view.locations.length) return null

  const save = async () => {
    setSaving(true)
    try {
      const fees: Record<string, Record<string, number> | null> = {}
      for (const l of view.locations) {
        const entries = Object.entries(draft[l.key] ?? {}).filter(([, v]) => v.trim() !== "")
        fees[l.key] = entries.length ? Object.fromEntries(entries.map(([c, v]) => [c, Number(v)])) : null
      }
      const next = await apiFetch<FeesView>(`/admin/products/${encodeURIComponent(view.product_id)}/print-fees`, {
        method: "POST",
        body: { fees },
      })
      setView(next)
      setDraft(toDraft(next))
      toast.success("Print fees saved")
    } catch (e: any) {
      toast.error(e?.message || "Could not save print fees")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading level="h2">Print fees</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Added per item for each side the customer prints on. Leave blank to print free.
          </Text>
        </div>
        {!view.customisable && <Badge color="grey">Not customisable</Badge>}
      </div>
      <div className="flex flex-col gap-4 px-6 py-4">
        {view.locations.map((l) => (
          <div key={l.key} className="flex flex-col gap-2">
            <Label weight="plus">{l.label}</Label>
            <div className="grid grid-cols-3 gap-2">
              {view.currencies.map((c) => (
                <div key={c} className="flex flex-col gap-1">
                  <Label size="xsmall" htmlFor={`fee-${l.key}-${c}`} className="text-ui-fg-subtle">{c.toUpperCase()}</Label>
                  <Input
                    id={`fee-${l.key}-${c}`}
                    type="number"
                    min={0}
                    step="0.01"
                    size="small"
                    placeholder="0.00"
                    value={draft[l.key]?.[c] ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, [l.key]: { ...d[l.key], [c]: e.target.value } }))}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
        {partial.length > 0 && (
          <Text size="small" className="text-ui-fg-error">
            {partial.join(", ")}: priced in some currencies only. Customers paying in a missing currency won't be able to
            print on that side.
          </Text>
        )}
        <div className="flex justify-end">
          <Button size="small" onClick={save} isLoading={saving}>Save print fees</Button>
        </div>
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({ zone: "product.details.side.after" })

export default PrintFeesWidget
