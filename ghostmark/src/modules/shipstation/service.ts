import type {
  CalculateShippingOptionPriceDTO,
  CalculatedShippingOptionPrice,
  CreateFulfillmentResult,
  FulfillmentDTO,
  FulfillmentItemDTO,
  FulfillmentOption,
  FulfillmentOrderDTO,
} from "@medusajs/framework/types"
import { AbstractFulfillmentProviderService } from "@medusajs/framework/utils"

type ShipStationOptions = {
  api_key: string
  api_secret: string
  store_id?: string
  base_url?: string
}

const REQUEST_TIMEOUT_MS = 15_000

// Client for the ShipStation HTTP API.
//
// WHAT THIS REPLACED, AND WHY IT MATTERED. The previous version of this class
// made no HTTP request at all. `createOrder` returned
// `{ orderId: Math.floor(Math.random() * 1_000_000) }` and the provider went on
// to attach `tracking_number: "SS-<that random number>"` to the fulfilment.
//
// The consequence of shipping that is specific and bad: Medusa records the
// fulfilment as created, the order leaves the "awaiting fulfilment" queue, the
// customer is emailed a tracking number that resolves to nothing, and no
// warehouse anywhere has been told to pick the order. It fails as a success.
// Nobody finds out until the customer asks where their parcel is, by which
// point the order looks shipped in every internal view.
//
// A fulfilment provider is allowed to fail. It is not allowed to pretend.
class ShipStationClient {
  private readonly authHeader: string | null
  private readonly baseUrl: string

  constructor(opts: ShipStationOptions) {
    const key = opts.api_key?.trim()
    const secret = opts.api_secret?.trim()
    this.baseUrl = (opts.base_url || "https://ssapi.shipstation.com").replace(/\/$/, "")
    this.authHeader =
      key && secret
        ? `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}`
        : null
  }

  get isConfigured(): boolean {
    return this.authHeader !== null
  }

  private async request<T>(path: string, body: unknown): Promise<T> {
    if (!this.authHeader) {
      throw new Error(
        "ShipStation is not configured: SHIPSTATION_API_KEY and " +
          "SHIPSTATION_API_SECRET are empty. Refusing to proceed, because the " +
          "only alternative is to report a shipment that was never booked."
      )
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    let response: Response
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: {
          Authorization: this.authHeader,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
    } catch (e: any) {
      if (e?.name === "AbortError") {
        throw new Error(
          `ShipStation request to ${path} timed out after ${REQUEST_TIMEOUT_MS}ms. ` +
            `The shipment was NOT booked.`
        )
      }
      throw new Error(
        `ShipStation request to ${path} failed: ${e?.message || e}. ` +
          `The shipment was NOT booked.`
      )
    } finally {
      clearTimeout(timer)
    }

    const text = await response.text()

    if (!response.ok) {
      // Include the status and ShipStation's own message. An operator staring
      // at this in the admin needs to know whether it is auth, rate limiting or
      // a bad payload, and truncation keeps a huge HTML error page out of logs.
      throw new Error(
        `ShipStation ${path} returned ${response.status} ${response.statusText}: ` +
          `${text.slice(0, 500)}`
      )
    }

    try {
      return JSON.parse(text) as T
    } catch {
      throw new Error(
        `ShipStation ${path} returned a non-JSON body (${response.status}): ` +
          `${text.slice(0, 200)}`
      )
    }
  }

  async createOrder(payload: any): Promise<{
    orderId: number
    orderKey?: string
    trackingNumber?: string
    labelUrl?: string
  }> {
    const result = await this.request<any>("/orders/createorder", payload)

    // Only trust an id the API actually returned. Anything else is the same
    // fabrication in a new costume.
    const orderId = Number(result?.orderId)
    if (!Number.isFinite(orderId) || orderId <= 0) {
      throw new Error(
        `ShipStation accepted the request but returned no usable orderId ` +
          `(got ${JSON.stringify(result?.orderId)}). Not recording a fulfilment ` +
          `that cannot be traced back to a real ShipStation order.`
      )
    }

    return {
      orderId,
      orderKey: typeof result?.orderKey === "string" ? result.orderKey : undefined,
      trackingNumber:
        typeof result?.trackingNumber === "string" && result.trackingNumber
          ? result.trackingNumber
          : undefined,
      labelUrl:
        typeof result?.labelData === "string" && result.labelData
          ? result.labelData
          : typeof result?.labelUrl === "string" && result.labelUrl
            ? result.labelUrl
            : undefined,
    }
  }

  async cancelOrder(orderId: number): Promise<void> {
    // Cancelling is best-effort in the sense that it is idempotent on
    // ShipStation's side, but a failure must still surface: a fulfilment
    // cancelled in Medusa and still live in ShipStation ships a parcel the
    // customer no longer wants.
    await this.request<any>("/orders/cancelorder", { orderId })
  }
}

export default class ShipStationProviderService extends AbstractFulfillmentProviderService {
  static identifier = "shipstation"

  protected options_: ShipStationOptions
  protected client: ShipStationClient

  constructor(container: any, options: ShipStationOptions) {
    super()
    this.options_ = options
    this.client = new ShipStationClient(options)

    // Registration stays soft: throwing here would take the whole Medusa boot
    // down over an unconfigured optional integration, and an operator cannot
    // fix a server that will not start. The hard failure happens at the point
    // of use instead, `createFulfillment` throws rather than inventing a
    // shipment, so an unconfigured provider is inert, not dangerous.
    const missing: string[] = []
    if (!options.api_key?.trim()) missing.push("SHIPSTATION_API_KEY")
    if (!options.api_secret?.trim()) missing.push("SHIPSTATION_API_SECRET")
    if (missing.length) {
      // eslint-disable-next-line no-console
      console.warn(
        `[ShipStation] Missing credentials: ${missing.join(", ")}. The provider ` +
          `is registered and appears enabled, but ANY attempt to fulfil through ` +
          `it will now throw rather than silently fabricate a shipment. If you ` +
          `do not intend to use ShipStation, remove it from the fulfillment ` +
          `module providers in medusa-config.ts instead of leaving it listed.`
      )
    }
  }

  getIdentifier(): string {
    return ShipStationProviderService.identifier
  }

  async getFulfillmentOptions(): Promise<FulfillmentOption[]> {
    // You can fetch live services from ShipStation. We'll expose a couple of common choices.
    return [
      { id: "standard", name: "ShipStation Standard" },
      { id: "express", name: "ShipStation Express" },
    ]
  }

  async calculatePrice(
    optionData: CalculateShippingOptionPriceDTO["optionData"],
    data: CalculateShippingOptionPriceDTO["data"],
    _context: CalculateShippingOptionPriceDTO["context"]
  ): Promise<CalculatedShippingOptionPrice> {
    void optionData
    void data
    void _context

    // NOT IMPLEMENTED, and deliberately not faked.
    //
    // This used to return a hardcoded 700 or 1500 depending on whether the
    // service string was "express". That is a shipping price the customer is
    // charged at checkout, invented by a provider that has never spoken to a
    // carrier. It is the same class of defect as the fabricated tracking
    // number: a number that looks authoritative and is not.
    //
    // Implementing it means calling ShipStation's rate endpoint
    // (/shipments/getrates) with real package dimensions, weight and
    // destination, none of which are plumbed through here. Until that exists,
    // a calculated-rate shipping option on this provider must not resolve.
    //
    // This is safe to throw today: no shipping option in this store uses the
    // shipstation provider (both live options are manual_manual with
    // price_type "flat"), so nothing reaches this method. Use a flat-rate
    // shipping option for ShipStation services in the meantime.
    throw new Error(
      "ShipStation live rate calculation is not implemented. Configure this " +
        "shipping option with a flat rate instead of a calculated one, or " +
        "implement /shipments/getrates in src/modules/shipstation/service.ts. " +
        "Returning an invented shipping price is not an acceptable fallback."
    )
  }

  async createFulfillment(
    data: Record<string, unknown>,
    items: Partial<Omit<FulfillmentItemDTO, "fulfillment">>[],
    order: Partial<FulfillmentOrderDTO> | undefined,
    fulfillment: Partial<Omit<FulfillmentDTO, "provider_id" | "data" | "items">>
  ): Promise<CreateFulfillmentResult> {
    // Build minimal ShipStation order payload
    const orderNumber = String(order?.id || fulfillment?.id || Date.now())
    const service = (data?.["service"] as string | undefined) || "standard"
    const fulfillmentAny = fulfillment as any
    const existingData = (fulfillmentAny?.data && typeof fulfillmentAny.data === "object"
      ? (fulfillmentAny.data as Record<string, unknown>)
      : {})
    const payload = {
      orderNumber,
      orderStatus: "awaiting_shipment",
      items: items.map((it) => ({
        sku:
          (it as Record<string, unknown> | undefined)?.["variant_sku"] as string | undefined ||
          (it as Record<string, unknown> | undefined)?.["title"] as string | undefined ||
          "item",
        quantity: it.quantity || 1,
      })),
      advancedOptions: {
        storeId: this.options_.store_id ? Number(this.options_.store_id) : undefined,
      },
    }
    // Fails loudly if credentials are absent or the API rejects the request.
    // It does not return until ShipStation has confirmed an order id.
    const created = await this.client.createOrder(payload)

    // LABELS. A label entry carries a tracking number, and a tracking number is
    // a promise to the customer that a specific parcel exists and can be
    // followed. We therefore emit one ONLY if ShipStation returned a real
    // tracking number for this order.
    //
    // The previous code synthesised `SS-<random>` and pointed `label_url` at
    // shipstation.com/docs so that "Admin shows a clickable link". That link
    // was the documentation homepage, and the tracking number was a random
    // integer. Creating an order in ShipStation is not the same event as
    // buying a label, and `/orders/createorder` does not generally return one,
    // so the honest result here is usually no label at all, the fulfilment is
    // booked, and the tracking number arrives later by whatever mechanism
    // actually purchases the label.
    //
    // Medusa's `CreateFulfillmentResult` requires a label entry to carry a
    // `label_url` alongside the tracking number, so both must come back from
    // the API before we record one. Half a label is not better than none: a
    // tracking number with a made-up document link is precisely the pattern
    // being removed here.
    const labels =
      created.trackingNumber && created.labelUrl
        ? [
            {
              tracking_number: created.trackingNumber,
              tracking_url: `https://www.shipstation.com/track?number=${encodeURIComponent(
                created.trackingNumber
              )}`,
              label_url: created.labelUrl,
            },
          ]
        : []

    return {
      data: {
        ...existingData,
        shipstation_order_id: created.orderId,
        shipstation_order_key: created.orderKey,
        shipstation_service: service,
      },
      labels,
    }
  }

  async cancelFulfillment(data: Record<string, unknown>): Promise<void> {
    const { shipstation_order_id } = (data || {}) as { shipstation_order_id?: number }
    if (shipstation_order_id) {
      await this.client.cancelOrder(shipstation_order_id)
    }
    return
  }
}
