// Scaffolded service outline for Medusa backend
// This file follows the documentation in docs/medusa-customization-guide.md

// Depending on your Medusa setup, you may extend from Medusa's base service.
// NOTE: `konva` and `canvas` are optional native deps in many environments.
// Using runtime `require` keeps TypeScript builds green even when they're not installed.

type LineItemCustomization = {
  designDataJson: string
  previewImageUrl: string
  isCustomized: true
}

export default class PrintGeneratorService /* extends Service */ {
  static identifier = "print-generator"

  async generatePrintFile(lineItemMetadata: any): Promise<{ url: string }> {
    // Lazy-load optional dependencies.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Konva = require("konva") as any
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createCanvas } = require("canvas") as any

    const customization =
      (lineItemMetadata?.customization as LineItemCustomization | undefined) || undefined
    if (!customization?.designDataJson) {
      throw new Error("Missing customization.designDataJson")
    }

    // High-resolution canvas (e.g., ~300 DPI for 12x16 inches)
    const width = 3600
    const height = 4800

    // Prepare a node-canvas instance and bind it to Konva
    const canvas = createCanvas(width, height)
    // Konva consumes the 2D context implicitly when drawing nodes
    canvas.getContext("2d")

    // Konva Stage in Node
    const stage = new Konva.Stage({
      width,
      height,
      container: undefined as any, // not used in Node
    })

    const layer = new Konva.Layer()
    stage.add(layer)

    // Rehydrate Konva JSON exported from the storefront design editor
    const parsed = JSON.parse(customization.designDataJson)
    const tmpStage = Konva.Node.create(parsed, undefined)
    tmpStage.getChildren().forEach((child: any) => layer.add(child))
    layer.draw()

    // Optionally composite a mockup
    // const img = await loadImage(customization.previewImageUrl)
    // const bg = new Konva.Image({ image: img, x: 0, y: 0, width, height })
    // layer.add(bg)
    // layer.draw()

    // Export as high-res transparent PNG
    // In a real implementation you'd draw the Konva stage into the canvas; this is a scaffold.
    const buffer = canvas.toBuffer("image/png")
    void buffer // silence unused var in scaffold

    // Upload to storage (mock)
    const mockUrl = `https://example-bucket.s3.amazonaws.com/prints/${Date.now()}.png`
    return { url: mockUrl }
  }
}
