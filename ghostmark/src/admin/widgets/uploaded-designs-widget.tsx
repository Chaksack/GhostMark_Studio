// =============================================================================
// uploaded-designs-widget: surface customer-uploaded POD designs on the
// admin order detail page.
//
// Why this widget exists
// ----------------------
// When a customer customises a POD product (apparel with print zones,
// drinkware, etc.), the storefront's DesignEditor uploads:
//   1. A *preview* PNG of the final composition (mockup + design overlay)
//   2. The *original* file the customer dropped in, one per print location
//
// Both URLs land on the line item's `metadata`:
//   - `metadata.previewImageUrl`: top-level convenience thumbnail
//   - `metadata.designDataJson`:  JSON string, contains
//       `{ designs: { front: { originalUrl, originalFilename, ... }, … } }`
//
// Without this widget, ops sees a normal-looking line item in /app/orders/{id}
// with no clue there's customer artwork attached, and the customer's email
// already promised "we'll start production after the e-proof", so ops needs
// to be able to pull the design immediately on order open.
//
// What it renders
// ---------------
// For every line item where `metadata.isCustomized === true`:
//   - Product title + qty
//   - Preview thumbnail (clickable, opens full size in a new tab)
//   - One row per print location with: name, technique, original file
//     download link, mock dimensions
//   - A bare badge if the original upload failed and only the preview
//     exists (rare, usually a flaky-network customer)
//
// If there are no customised items on the order, the widget renders
// nothing (`return null`) so non-POD orders aren't cluttered.
//
// URL prefixing
// -------------
// Uploads are stored on the storefront server (e.g. localhost:3000 in dev,
// production storefront origin in prod). URLs in metadata are relative
// (`/uploads/designs/…`). The admin runs at a different origin, so we
// prefix with `STOREFRONT_PUBLIC_URL` if set, else a sensible dev default.
// =============================================================================
import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Text, Badge, Button } from "@medusajs/ui"

// Vite exposes env vars prefixed with VITE_ at build time. Set
// VITE_STOREFRONT_PUBLIC_URL=https://shop.ghostmark.studio in
// production; the dev fallback assumes the storefront runs on :3000
// (which is what the rest of this codebase assumes via the Medusa
// STORE_CORS list; see ghostmark/.env).
const STOREFRONT_ORIGIN: string =
  // @ts-expect-error: VITE_ env types are provided by Medusa's bundler
  (import.meta?.env?.VITE_STOREFRONT_PUBLIC_URL as string | undefined) ??
  "http://localhost:3000"

const absoluteUploadUrl = (url: string | null | undefined): string | null => {
  if (!url) return null
  // Already absolute (http(s):// or //): leave alone.
  if (/^(?:https?:)?\/\//.test(url)) return url
  // Relative path uploaded by the storefront: prefix with the
  // storefront origin so the admin browser can fetch it.
  if (url.startsWith("/")) return `${STOREFRONT_ORIGIN}${url}`
  return url
}

type DesignSlot = {
  imageUrl?: string | null
  originalUrl?: string | null
  originalFilename?: string | null
  originalMimeType?: string | null
  position?: { x: number; y: number } | null
  scale?: number | null
  rotation?: number | null
  mockupUrl?: string | null
  area?: { x: number; y: number; width: number; height: number } | null
}

type DesignData = {
  designs?: Record<string, DesignSlot | null>
  activeLocation?: string | null
  technique?: string | null
}

type LineItem = {
  id: string
  title?: string | null
  product_title?: string | null
  variant_title?: string | null
  quantity?: number | null
  thumbnail?: string | null
  metadata?: Record<string, unknown> | null
}

type AdminOrderShape = {
  id?: string
  items?: LineItem[] | null
}

const parseDesignData = (raw: unknown): DesignData | null => {
  if (typeof raw !== "string" || !raw.trim()) return null
  try {
    return JSON.parse(raw) as DesignData
  } catch {
    return null
  }
}

const UploadedDesignsWidget = ({ data }: { data: AdminOrderShape }) => {
  const items = data?.items ?? []
  // Filter to customised line items. Non-POD orders skip the widget
  // entirely so the order detail page stays clean.
  const podItems = items.filter(
    (i) => (i.metadata as any)?.isCustomized === true,
  )

  if (!podItems.length) return null

  return (
    <Container className="p-0 divide-y">
      <div className="flex flex-col gap-y-1 px-6 py-4">
        <Heading level="h2">Uploaded designs</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Customer-uploaded artwork for each POD line item. Click a thumbnail
          to preview, or download the original file to send into production.
        </Text>
      </div>

      {podItems.map((item) => {
        const md = (item.metadata ?? {}) as Record<string, any>
        const previewUrl = absoluteUploadUrl(md.previewImageUrl)
        const designData = parseDesignData(md.designDataJson)
        const designs = designData?.designs ?? {}
        const designKeys = Object.keys(designs).filter((k) => designs[k])
        const technique = designData?.technique ?? null

        return (
          <div key={item.id} className="flex flex-col gap-y-3 px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-y-0.5">
                <Text className="font-semibold">
                  {item.product_title ?? item.title ?? "Untitled line item"}
                </Text>
                <Text size="small" className="text-ui-fg-subtle">
                  {item.variant_title ?? "default"} · qty {item.quantity ?? 1}
                  {technique ? ` · ${technique}` : ""}
                </Text>
              </div>
              {previewUrl ? (
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="block"
                >
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="h-24 w-24 rounded-md border border-ui-border-base object-cover"
                  />
                </a>
              ) : (
                <Badge size="2xsmall" color="orange">
                  No preview captured
                </Badge>
              )}
            </div>

            {designKeys.length ? (
              <div className="flex flex-col gap-y-2">
                {designKeys.map((key) => {
                  const slot = designs[key]!
                  const originalUrl = absoluteUploadUrl(slot.originalUrl)
                  const area = slot.area
                  return (
                    <div
                      key={key}
                      className="flex items-center justify-between gap-3 rounded-md border border-ui-border-base px-3 py-2"
                    >
                      <div className="flex flex-col gap-y-0.5">
                        <Text size="small" className="font-medium">
                          {key.charAt(0).toUpperCase() + key.slice(1)}
                        </Text>
                        <Text size="xsmall" className="text-ui-fg-subtle">
                          {slot.originalFilename ?? "original.png"}
                          {area
                            ? ` · area ${Math.round(area.width)}×${Math.round(
                                area.height,
                              )}px`
                            : ""}
                          {typeof slot.scale === "number"
                            ? ` · scale ${Math.round(slot.scale * 100)}%`
                            : ""}
                        </Text>
                      </div>
                      {originalUrl ? (
                        <Button
                          asChild
                          variant="secondary"
                          size="small"
                        >
                          <a
                            href={originalUrl}
                            target="_blank"
                            rel="noreferrer noopener"
                            download={slot.originalFilename ?? undefined}
                          >
                            Download original
                          </a>
                        </Button>
                      ) : (
                        <Badge size="2xsmall" color="orange">
                          Original not uploaded
                        </Badge>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <Text size="small" className="text-ui-fg-muted">
                No per-location design data on this item.
              </Text>
            )}
          </div>
        )
      })}
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "order.details.before",
})

export default UploadedDesignsWidget
