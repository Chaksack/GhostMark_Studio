import React, { useEffect, useMemo, useState } from 'react'
import { defineRouteConfig } from '@medusajs/admin-sdk'
import { ChatBubbleLeftRight } from '@medusajs/icons'
import { Button, Input, Select, Heading, Label } from '@medusajs/ui'
import { apiFetch } from '../../../lib/sdk'

type Product = {
  id: string
  title: string
  type?: { value?: string } | null
  metadata?: any
  images?: { url: string; id: string }[]
}

type SideKey = 'front' | 'back' | 'left_sleeve' | 'right_sleeve' | 'neck'

const SIDES: { key: SideKey; label: string }[] = [
  { key: 'front', label: 'Front' },
  { key: 'back', label: 'Back' },
  { key: 'left_sleeve', label: 'Left Sleeve' },
  { key: 'right_sleeve', label: 'Right Sleeve' },
  { key: 'neck', label: 'Neck' },
]

type AreaForm = {
  x_cm: number
  y_cm: number
  width_cm: number
  height_cm: number
  dpi?: number
  version?: number
  print_price_minor?: number
  print_price_minor_by_currency?: Record<string, number>
}

export const config = defineRouteConfig({
  label: 'POD Print Areas',
  icon: ChatBubbleLeftRight,
})

export const handle = {
  breadcrumb: () => 'POD Print Areas',
}

function PodPrintAreasPageInner() {
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProductId, setSelectedProductId] = useState<string>('')
  const [product, setProduct] = useState<Product | null>(null)
  const [mockupUrl, setMockupUrl] = useState<string>('')
  const [podCurrency, setPodCurrency] = useState<string>('USD')
  const [podDpi, setPodDpi] = useState<number>(300)
  const [podVersion, setPodVersion] = useState<number>(1)
  const [areas, setAreas] = useState<Record<SideKey, AreaForm>>({
    front: { x_cm: 5, y_cm: 7, width_cm: 28, height_cm: 36, dpi: 300, version: 1, print_price_minor: 0, print_price_minor_by_currency: { USD: 0 } },
    back: { x_cm: 5, y_cm: 7, width_cm: 28, height_cm: 36, dpi: 300, version: 1, print_price_minor: 0, print_price_minor_by_currency: { USD: 0 } },
    left_sleeve: { x_cm: 2, y_cm: 10, width_cm: 10, height_cm: 12, dpi: 300, version: 1, print_price_minor: 0, print_price_minor_by_currency: { USD: 0 } },
    right_sleeve: { x_cm: 2, y_cm: 10, width_cm: 10, height_cm: 12, dpi: 300, version: 1, print_price_minor: 0, print_price_minor_by_currency: { USD: 0 } },
    neck: { x_cm: 1, y_cm: 2, width_cm: 8, height_cm: 4, dpi: 300, version: 1, print_price_minor: 0, print_price_minor_by_currency: { USD: 0 } },
  })
  const [activeSide, setActiveSide] = useState<SideKey>('front')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Visual editing helpers
  const [mockupWidthCm, setMockupWidthCm] = useState<number>(50) // Real-life width that the mockup image represents
  const [imgDims, setImgDims] = useState<{ w: number; h: number }>({ w: 0, h: 0 }) // displayed size in px
  const [dragging, setDragging] = useState<{ startX: number; startY: number; startXcm: number; startYcm: number } | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const data = await apiFetch<any>('/admin/products?limit=100')
        const pods = (data.products || []).filter((p: Product) => p?.type?.value?.toLowerCase() === 'pod' || p?.metadata?.isPOD === true)
        setProducts(pods)
      } catch (e: any) {
        setError(e?.message || 'Failed to load products')
      }
    })()
  }, [])

  useEffect(() => {
    if (!selectedProductId) return
    ;(async () => {
      try {
        setMessage(null)
        setError(null)
        const data = await apiFetch<any>(`/admin/products/${selectedProductId}`)
        const p: Product = data.product || data
        setProduct(p)
        const images = p.images || []
        if (!mockupUrl && images.length > 0) setMockupUrl(images[0].url)

        // Load existing POD metadata if present
        const pod = p?.metadata?.pod
        if (pod) {
          setPodCurrency(pod.currency || 'USD')
          setPodDpi(Number(pod.dpi || 300))
          setPodVersion(Number(pod.version || 1))
          // Ensure mockup-to-real scale reflects backend so canvas matches saved areas
          if (typeof pod.mockup_width_cm !== 'undefined' && pod.mockup_width_cm !== null) {
            setMockupWidthCm(Number(pod.mockup_width_cm) || 50)
          }
          const pa = pod.print_areas || {}
          setAreas((prev) => {
            const next = { ...prev }
            SIDES.forEach(({ key }) => {
              if (pa[key]) {
                next[key] = {
                  x_cm: Number(pa[key].x_cm ?? prev[key].x_cm),
                  y_cm: Number(pa[key].y_cm ?? prev[key].y_cm),
                  width_cm: Number(pa[key].width_cm ?? prev[key].width_cm),
                  height_cm: Number(pa[key].height_cm ?? prev[key].height_cm),
                  dpi: Number(pa[key].dpi ?? pod.dpi ?? prev[key].dpi ?? 300),
                  version: Number(pa[key].version ?? pod.version ?? prev[key].version ?? 1),
                  print_price_minor: Number(pa[key].print_price_minor ?? prev[key].print_price_minor ?? 0),
                  print_price_minor_by_currency: pa[key].print_price_minor_by_currency || prev[key].print_price_minor_by_currency || { [pod.currency || 'USD']: Number(pa[key].print_price_minor ?? 0) }
                }
              }
            })
            return next
          })
        }
      } catch (e: any) {
        setError(e?.message || 'Failed to load product details')
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProductId])

  const area = areas[activeSide]

  const handlePriceMapChange = (val: string) => {
    // Expect input like: USD:500, EUR:450, GBP:400
    const map: Record<string, number> = {}
    val.split(',').forEach((pair) => {
      const [k, v] = pair.split(':').map((s) => s?.trim())
      if (k && v && !isNaN(Number(v))) map[k.toUpperCase()] = Number(v)
    })
    setAreas({ ...areas, [activeSide]: { ...area, print_price_minor_by_currency: map } })
  }

  const priceMapString = useMemo(() => {
    const m = area.print_price_minor_by_currency || {}
    return Object.keys(m).map((k) => `${k}:${m[k]}`).join(', ')
  }, [area.print_price_minor_by_currency])

  const canSave = !!product?.id

  const handleSave = async () => {
    if (!product?.id) return
    setSaving(true)
    setMessage(null)
    setError(null)
    try {
      // Compose metadata payload
      const payload = {
        metadata: {
          pod: {
            version: Number(podVersion || 1),
            dpi: Number(podDpi || 300),
            currency: podCurrency || 'USD',
            // Persist the mockup width used for converting cm->px so preview stays consistent
            mockup_width_cm: Number(mockupWidthCm || 0),
            print_areas: Object.fromEntries(
              SIDES.map(({ key }) => [
                key,
                {
                  x_cm: Number(areas[key].x_cm || 0),
                  y_cm: Number(areas[key].y_cm || 0),
                  width_cm: Number(areas[key].width_cm || 0),
                  height_cm: Number(areas[key].height_cm || 0),
                  dpi: Number(areas[key].dpi || podDpi || 300),
                  version: Number(areas[key].version || podVersion || 1),
                  print_price_minor: Number(areas[key].print_price_minor || 0),
                  print_price_minor_by_currency: areas[key].print_price_minor_by_currency || { [podCurrency]: Number(areas[key].print_price_minor || 0) }
                }
              ])
            )
          }
        }
      }

      await apiFetch(`/admin/products/${product.id}`, {
        method: 'PATCH',
        body: payload,
      })
      setMessage('Saved POD print areas successfully')
    } catch (e: any) {
      setError(e?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      <Heading level="h1">POD Print Areas</Heading>
      <p className="text-ui-fg-subtle mt-1">Select a POD product, pick a mockup image, and define printable areas in centimeters with per-print pricing.</p>

      {error && <div className="mt-3 text-red-600">{error}</div>}
      {message && <div className="mt-3 text-green-600">{message}</div>}

      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        <div>
          <Label>Product</Label>
          <Select value={selectedProductId} onValueChange={(v: any) => setSelectedProductId(String(v))}>
            <Select.Trigger>
              <Select.Value placeholder="Choose a POD product" />
            </Select.Trigger>
            <Select.Content>
              {products.map((p) => (
                <Select.Item key={p.id} value={p.id}>
                  {p.title}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
        </div>

        <div>
          <Label>Mockup image URL</Label>
          <Input value={mockupUrl} onChange={(e) => setMockupUrl(e.target.value)} placeholder="https://..." />
          {product?.images?.length ? (
            <div className="flex gap-2 mt-2 flex-wrap">
              {product.images.map((img) => (
                <button key={img.id} className={`border rounded p-1 ${mockupUrl === img.url ? 'border-blue-600' : 'border-transparent'}`} onClick={() => setMockupUrl(img.url)} title="Use this image">
                  <img src={img.url} alt="mockup" className="h-12 w-12 object-cover" />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Default DPI</Label>
            <Input type="number" value={podDpi} onChange={(e) => setPodDpi(Number(e.target.value || 0))} />
          </div>
          <div>
            <Label>Version</Label>
            <Input type="number" value={podVersion} onChange={(e) => setPodVersion(Number(e.target.value || 0))} />
          </div>
          <div className="col-span-2">
            <Label>Default Currency</Label>
            <Input value={podCurrency} onChange={(e) => setPodCurrency(e.target.value.toUpperCase())} placeholder="USD" />
          </div>
        </div>
      </div>

      {/* Preview and side editor */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <div className="flex gap-2 mb-3 flex-wrap">
            {SIDES.map((s) => (
              <Button key={s.key} size="small" variant={activeSide === s.key ? 'primary' : 'secondary'} onClick={() => setActiveSide(s.key)}>
                {s.label}
              </Button>
            ))}
          </div>
          <div className="relative border rounded-lg overflow-hidden bg-ui-bg-base min-h-[360px]">
            {mockupUrl ? (
              <div className="relative">
                <img
                  src={mockupUrl}
                  alt="mockup"
                  className="w-full h-auto max-h-[520px] object-contain"
                  onLoad={(e) => {
                    const el = e.currentTarget
                    // After layout, read the displayed size
                    setTimeout(() => {
                      setImgDims({ w: el.clientWidth, h: el.clientHeight })
                    }, 0)
                  }}
                  onResize={(e: any) => {
                    const el = e.currentTarget
                    setImgDims({ w: el.clientWidth, h: el.clientHeight })
                  }}
                />
                {(() => {
                  const pxPerCm = imgDims.w > 0 && mockupWidthCm > 0 ? imgDims.w / mockupWidthCm : 0
                  const mockupHeightCm = pxPerCm > 0 ? imgDims.h / pxPerCm : 0
                  const leftPx = Math.max(0, area.x_cm * pxPerCm)
                  const topPx = Math.max(0, area.y_cm * pxPerCm)
                  const widthPx = Math.max(1, area.width_cm * pxPerCm)
                  const heightPx = Math.max(1, area.height_cm * pxPerCm)

                  const onMouseDown: React.MouseEventHandler<HTMLDivElement> = (ev) => {
                    ev.preventDefault()
                    if (!pxPerCm) return
                    setDragging({ startX: ev.clientX, startY: ev.clientY, startXcm: area.x_cm, startYcm: area.y_cm })
                  }

                  const onMouseMove: React.MouseEventHandler<HTMLDivElement> = (ev) => {
                    if (!dragging || !pxPerCm) return
                    const dxPx = ev.clientX - dragging.startX
                    const dyPx = ev.clientY - dragging.startY
                    let nx = dragging.startXcm + dxPx / pxPerCm
                    let ny = dragging.startYcm + dyPx / pxPerCm
                    // Clamp to image bounds in cm
                    const maxX = Math.max(0, (mockupWidthCm || 0) - area.width_cm)
                    const maxY = Math.max(0, (mockupHeightCm || 0) - area.height_cm)
                    nx = Math.min(Math.max(0, nx), maxX)
                    ny = Math.min(Math.max(0, ny), maxY)
                    setAreas((prev) => ({ ...prev, [activeSide]: { ...prev[activeSide], x_cm: nx, y_cm: ny } }))
                  }

                  const onMouseUp: React.MouseEventHandler<HTMLDivElement> = () => {
                    setDragging(null)
                  }

                  return (
                    <div
                      title={`${activeSide} area`}
                      style={{
                        position: 'absolute',
                        left: `${leftPx}px`,
                        top: `${topPx}px`,
                        width: `${widthPx}px`,
                        height: `${heightPx}px`,
                        border: '2px dashed #2563eb',
                        boxShadow: 'inset 0 0 0 2px rgba(37,99,235,0.3)',
                        cursor: 'move',
                        background: 'rgba(37,99,235,0.08)',
                      }}
                      onMouseDown={onMouseDown}
                      onMouseMove={onMouseMove}
                      onMouseUp={onMouseUp}
                      onMouseLeave={onMouseUp}
                    />
                  )
                })()}
              </div>
            ) : (
              <div className="p-8 text-ui-fg-muted">Select a mockup image to preview areas.</div>
            )}
          </div>
        </div>

        <div>
          <Heading level="h3" className="mb-3">{SIDES.find((s) => s.key === activeSide)?.label} settings</Heading>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Mockup width (cm)</Label>
              <Input type="number" value={mockupWidthCm} onChange={(e) => setMockupWidthCm(Number(e.target.value || 0))} />
              <div className="text-ui-fg-subtle text-xs mt-1">Used to convert cm to pixels for dragging. Height is inferred from image ratio.</div>
            </div>
            <div>
              <Label>X (cm)</Label>
              <Input type="number" value={area.x_cm} onChange={(e) => setAreas({ ...areas, [activeSide]: { ...area, x_cm: Number(e.target.value || 0) } })} />
            </div>
            <div>
              <Label>Y (cm)</Label>
              <Input type="number" value={area.y_cm} onChange={(e) => setAreas({ ...areas, [activeSide]: { ...area, y_cm: Number(e.target.value || 0) } })} />
            </div>
            <div>
              <Label>Width (cm)</Label>
              <Input type="number" value={area.width_cm} onChange={(e) => setAreas({ ...areas, [activeSide]: { ...area, width_cm: Number(e.target.value || 0) } })} />
            </div>
            <div>
              <Label>Height (cm)</Label>
              <Input type="number" value={area.height_cm} onChange={(e) => setAreas({ ...areas, [activeSide]: { ...area, height_cm: Number(e.target.value || 0) } })} />
            </div>
            <div>
              <Label>DPI (override)</Label>
              <Input type="number" value={area.dpi || podDpi} onChange={(e) => setAreas({ ...areas, [activeSide]: { ...area, dpi: Number(e.target.value || 0) } })} />
            </div>
            {/* DPI helper: show resulting pixel dimensions at the effective DPI */}
            {(() => {
              const effectiveDpi = Number(area.dpi || podDpi || 0)
              const widthInches = (Number(area.width_cm || 0) / 2.54) || 0
              const heightInches = (Number(area.height_cm || 0) / 2.54) || 0
              const pxW = Math.max(0, Math.round(widthInches * effectiveDpi))
              const pxH = Math.max(0, Math.round(heightInches * effectiveDpi))
              const lowDpi = effectiveDpi > 0 && effectiveDpi < 150
              const tinyPixels = (pxW > 0 && pxW < 500) || (pxH > 0 && pxH < 500)
              return (
                <div className="col-span-2 text-xs text-ui-fg-subtle -mt-2">
                  <div className="mt-1">
                    Output at {effectiveDpi || 0} DPI: {pxW} × {pxH} px
                  </div>
                  {(lowDpi || tinyPixels) && (
                    <div className="mt-1 text-ui-fg-warning">
                      {lowDpi && 'Warning: Effective DPI below 150 may look blurry. '}
                      {tinyPixels && 'Warning: Resulting pixel dimensions are quite small.'}
                    </div>
                  )}
                </div>
              )
            })()}
            <div>
              <Label>Version (override)</Label>
              <Input type="number" value={area.version || podVersion} onChange={(e) => setAreas({ ...areas, [activeSide]: { ...area, version: Number(e.target.value || 0) } })} />
            </div>
            <div>
              <Label>Print price (minor units)</Label>
              <Input type="number" value={area.print_price_minor || 0} onChange={(e) => setAreas({ ...areas, [activeSide]: { ...area, print_price_minor: Number(e.target.value || 0) } })} />
            </div>
            <div className="col-span-2">
              <Label>Per-currency overrides (e.g., USD:500, EUR:450)</Label>
              <Input value={priceMapString} onChange={(e) => handlePriceMapChange(e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end mt-8">
        <Button disabled={!canSave || saving} onClick={handleSave} variant="primary">
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  )
}

// Simple error boundary to prevent full white screen and surface errors
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: any }> {
  constructor(props: any) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error: any) { return { error } }
  componentDidCatch(err: any) { console.error('POD Print Areas crashed:', err) }
  render() {
    if (this.state.error) {
      return (
        <div className="p-6">
          <Heading level="h2">POD Print Areas</Heading>
          <div className="mt-4 text-ui-fg-error">{String(this.state.error?.message || this.state.error)}</div>
        </div>
      )
    }
    return this.props.children as any
  }
}

export default function PodPrintAreasPage() {
  return (
    <ErrorBoundary>
      <PodPrintAreasPageInner />
    </ErrorBoundary>
  )
}
