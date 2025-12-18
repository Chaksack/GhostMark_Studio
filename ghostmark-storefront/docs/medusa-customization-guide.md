
This guide provides all the critical code pieces and architecture outlines to integrate a Konva-based product customizer with a Medusa storefront and a Medusa backend service.

0. Front-End Setup and Integration (Next.js)

- Dependency Installation
  - Install Konva libraries for React:
    - npm install konva react-konva
    - yarn add konva react-konva
    - pnpm add konva react-konva

- Component Usage on a Product Detail Page
  The example below shows how to render a customizer component (e.g., ProductCustomizer/DesignEditor), pass in the mockup image sourced from the selected variant, and connect the onAddToCart callback to the reusable Medusa cart function from Section 1.

  Example (app/[countryCode]/(main)/products/[handle]/page.tsx – simplified excerpt):

  import { useCallback } from "react"
  // Client helper that posts to /api/custom-cart
  import { addToCustomProductCart } from "@lib/client/add-to-custom-cart"
  import DesignEditor from "@modules/products/components/design-editor"

  // Inside your client component on the PDP where you have product and selected variant:
  function ProductCustomizerWrapper({ product, countryCode, selectedVariantId }) {
    const selectedVariant = product.variants?.find(v => v.id === selectedVariantId) || product.variants?.[0]
    const productMockupUrl = selectedVariant?.images?.[0]?.url || product?.images?.[0]?.url || "/placeholder.png"

    const handleAddToCart = useCallback(async ({ designDataJson, previewImageUrl }) => {
      // This payload mirrors handleFinalizeAndAddToCart output:
      const designMetadata = {
        designDataJson,
        previewImageUrl,
        isCustomized: true,
      }

      await addToCustomProductCart({
        variantId: selectedVariant?.id,
        designMetadata,
        countryCode, // used to create a cart if one doesn't exist
        quantity: 1,
      })
    }, [countryCode, selectedVariant?.id])

    return (
      <DesignEditor
        product={product}
        images={product.images}
        selectedVariantId={selectedVariant?.id}
        countryCode={countryCode}
        productMockupUrl={productMockupUrl}
        onAddToCart={handleAddToCart}
      />
    )
  }

1. Next.js Client-Side Cart Integration (Medusa Storefront)

Add a reusable client function to create a new line item with design metadata. This repository already includes two complementary implementations (choose the one that fits your usage):

- Client helper (recommended from components):
  - File: src/lib/client/add-to-custom-cart.ts
  - Function: addToCustomProductCart(cartId?, variantId, designMetadata, quantity?, countryCode?)

- Server utility (can be called from server actions/API routes):
  - File: src/lib/data/cart.ts
  - Function: addToCustomProductCart(cartId?, variantId, designMetadata, quantity?, countryCode?)

Signature and behavior:

- Accepts a cartId (optional), the target variantId, and a designMetadata object that includes the Konva JSON string and preview URL.
- Creates or reuses a cart, and calls the Medusa Store API to create a line item with metadata.customization populated.
- Includes robust error handling and cache revalidation.

Usage example (client side):

  import { addToCustomProductCart } from "@lib/client/add-to-custom-cart"

  await addToCustomProductCart({
    variantId: "variant_123",
    designMetadata: {
      designDataJson: serializedKonvaJson,
      previewImageUrl: previewUrl,
      isCustomized: true,
    },
    quantity: 1,
    countryCode: "us",
  })

2. Medusa Server-Side Fulfillment Service Architecture

Create a custom Medusa service that renders a print-ready PNG from the saved Konva JSON and uploads it for fulfillment access.

- Service File Structure
  - medusa-backend/
    - src/services/print-generator.ts
    - src/subscribers/order-placed-subscriber.ts
  - Dependencies:
    - npm install konva canvas
    - yarn add konva canvas
    - pnpm add konva canvas

- Core Service (src/services/print-generator.ts)

  import { Service } from "medusa-extender" // or Medusa's service base depending on your setup
  import Konva from "konva"
  // node-canvas is used by Konva in a Node environment
  import { createCanvas, loadImage } from "canvas"

  type LineItemCustomization = {
    designDataJson: string
    previewImageUrl: string
    isCustomized: true
  }

  export default class PrintGeneratorService extends Service {
    static identifier = "print-generator"

    async generatePrintFile(lineItemMetadata: any): Promise<{ url: string }> {
      const customization = lineItemMetadata?.customization as LineItemCustomization | undefined
      if (!customization?.designDataJson) {
        throw new Error("Missing customization.designDataJson")
      }

      // High-resolution canvas (e.g., for 300 DPI on 12x16 inches ≈ 3600x4800 px)
      const width = 3600
      const height = 4800

      // Prepare a node-canvas instance and bind it to Konva
      const canvas = createCanvas(width, height)
      const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D

      // Konva Stage in Node
      const stage = new Konva.Stage({
        width,
        height,
        container: undefined as any, // not used in Node
      })

      const layer = new Konva.Layer()
      stage.add(layer)

      // Rehydrate Konva JSON
      const parsed = JSON.parse(customization.designDataJson)
      const tmpStage = Konva.Node.create(parsed, undefined)
      // Move children from tmpStage to our layer
      tmpStage.getChildren().forEach((child: any) => layer.add(child))
      layer.draw()

      // Optional: composite a mockup or background if required
      // const img = await loadImage(customization.previewImageUrl)
      // const bg = new Konva.Image({ image: img, x: 0, y: 0, width, height })
      // layer.add(bg)
      // layer.draw()

      // Export as high-res transparent PNG
      const buffer = canvas.toBuffer("image/png")

      // Upload to storage (mock)
      // In production, upload to S3/GCS and return the real URL
      const mockUrl = `https://example-bucket.s3.amazonaws.com/prints/${Date.now()}.png`
      return { url: mockUrl }
    }
  }

- Event Subscriber (src/subscribers/order-placed-subscriber.ts)

  import { Subscriber } from "medusa-extender" // or Medusa's event bus types
  import type { OrderService } from "@medusajs/medusa"
  import PrintGeneratorService from "../services/print-generator"

  export default class OrderPlacedSubscriber extends Subscriber {
    static identifier = "order-placed-print-generator"

    constructor(
      readonly printGeneratorService: PrintGeneratorService,
      readonly orderService: OrderService
    ) {
      super()
      this.subscribe("order.placed", this.handleOrderPlaced)
    }

    private handleOrderPlaced = async ({ id: orderId }: { id: string }) => {
      const order = await this.orderService.retrieve(orderId, {
        relations: ["items"],
      })

      for (const item of order.items) {
        const metadata = item?.metadata || {}
        try {
          const { url } = await this.printGeneratorService.generatePrintFile(metadata)
          // Persist URL on the line item metadata or a fulfillment record as needed
          // await this.orderService.updateLineItem(item.id, { metadata: { ...metadata, print_url: url } })
          console.log(`Generated print file for item ${item.id}: ${url}`)
        } catch (e) {
          console.error(`Failed to generate print for item ${item.id}`, e)
        }
      }
    }
  }

Usage Trigger

- The subscriber listens to the order.placed event and invokes the PrintGeneratorService for each line item, using the saved metadata.customization to reconstruct and render the print asset.

Notes

- For real deployments, replace the mock upload with S3/GCS upload logic and save the resulting URL back to the order/line item metadata.
- Ensure node-canvas prerequisites (system libraries) are installed in the server environment.

3. Google Authentication (Medusa Auth) – Quick Setup

- Backend (ghostmark):
  - Ensure the Auth module is configured with the Google provider in medusa-config.ts. This repository includes it by default:
    - Module: @medusajs/medusa/auth
    - Provider: @medusajs/auth-google with env-driven options
  - Set the following environment variables in ghostmark/.env (see .env.template):
    - GOOGLE_CLIENT_ID
    - GOOGLE_CLIENT_SECRET
    - AUTH_GOOGLE_STORE_CALLBACK_URL (e.g., http://localhost:8000/api/auth/google/callback)
    - AUTH_GOOGLE_ADMIN_CALLBACK_URL (optional)
    - AUTH_CORS must include your storefront origin (e.g., http://localhost:8000)
  - In Google Cloud Console -> OAuth 2.0 Client IDs, add authorized redirect URIs:
    - http://localhost:9000/auth/customer/google/cb
    - http://localhost:9000/auth/admin/google/cb (optional)

- Storefront (ghostmark-storefront):
  - A start route redirects to Medusa’s Google start URL:
    - /api/auth/google/start -> {MEDUSA_BACKEND_URL}/auth/customer/google
  - A callback route receives token from Medusa and stores it in the _medusa_jwt cookie:
    - /api/auth/google/callback?token=...&next=/us/account
  - Login UI includes a "Continue with Google" button that links to /api/auth/google/start.

- URLs
  - MEDUSA_BACKEND_URL must point to your backend (default http://localhost:9000)
  - Default post-login redirect is /us/account; change in callback route if your default region differs.
