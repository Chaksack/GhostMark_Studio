// Scaffolded event subscriber outline for Medusa backend
// Mirrors the documentation in docs/medusa-customization-guide.md

// Depending on your Medusa setup, you may rely on Medusa's event bus directly
// or a framework like medusa-extender. This file is framework-agnostic and
// demonstrates the intended behavior.

// import { Subscriber } from "medusa-extender" // Uncomment if using medusa-extender
import type PrintGeneratorService from "../services/print-generator"

// Minimal type for OrderService to avoid strict dependency here; in a real
// project import the correct type from your Medusa installation
type OrderService = {
  retrieve: (id: string, config?: { relations?: string[] }) => Promise<{
    id: string
    items: Array<{ id: string; metadata?: Record<string, unknown> }>
  }>
}

export default class OrderPlacedSubscriber /* extends Subscriber */ {
  static identifier = "order-placed-print-generator"

  constructor(
    // In real integration, inject via Medusa's DI container
    readonly printGeneratorService: PrintGeneratorService,
    readonly orderService: OrderService
  ) {
    // super()
    // If using medusa-extender, you would subscribe like:
    // this.subscribe("order.placed", this.handleOrderPlaced)
  }

  // Example handler to be wired with your event bus
  public handleOrderPlaced = async ({ id: orderId }: { id: string }) => {
    const order = await this.orderService.retrieve(orderId, {
      relations: ["items"],
    })

    for (const item of order.items) {
      const metadata = item?.metadata || {}
      try {
        const { url } = await this.printGeneratorService.generatePrintFile(metadata)
        // Persist URL on the line item metadata or a fulfillment entity as needed
        // Example (pseudo-code):
        // await this.orderService.updateLineItem(item.id, {
        //   metadata: { ...metadata, print_url: url },
        // })
        console.log(`Generated print file for item ${item.id}: ${url}`)
      } catch (e) {
        console.error(`Failed to generate print for item ${item.id}`, e)
      }
    }
  }
}
