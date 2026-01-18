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

// Very light-weight client stub for ShipStation HTTP API
class ShipStationClient {
  private readonly authHeader: string
  private readonly baseUrl: string

  constructor(opts: ShipStationOptions) {
    const key = opts.api_key?.trim()
    const secret = opts.api_secret?.trim()
    this.baseUrl = (opts.base_url || "https://ssapi.shipstation.com").replace(/\/$/, "")
    this.authHeader = `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}`
  }

  async createOrder(payload: any): Promise<{ orderId: number; orderKey?: string }> {
    // Minimal implementation: we do not actually call ShipStation here to avoid side effects at build time.
    // In a real environment you would POST to `${this.baseUrl}/orders/createorder` with payload and auth header.
    // Touch fields to avoid unused warnings in strict builds.
    if (!this.baseUrl || !this.authHeader) {
      throw new Error("ShipStation client is not configured correctly")
    }
    return { orderId: Math.floor(Math.random() * 1_000_000), orderKey: payload?.orderNumber }
  }

  async cancelOrder(orderId: number): Promise<void> {
    // Real implementation: POST to /orders/cancelorder
    // Touch fields to avoid unused warnings in strict builds.
    void orderId
    void this.baseUrl
    void this.authHeader
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
    // Minimal deterministic pricing: express > standard
    // Reference params to satisfy strict no-unused rules
    void optionData
    void data
    void _context
    const service = (optionData as Record<string, unknown> | undefined)?.["id"] ||
      (data as Record<string, unknown> | undefined)?.["service"] ||
      "standard"
    const amount = service === "express" ? 1500 : 700
    return {
      calculated_amount: amount,
      is_calculated_price_tax_inclusive: false,
    }
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
    const created = await this.client.createOrder(payload)
    return {
      data: {
        ...existingData,
        shipstation_order_id: created.orderId,
        shipstation_order_key: created.orderKey,
        shipstation_service: service,
      },
      // No label is created at this stage in the stub
      labels: [],
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
