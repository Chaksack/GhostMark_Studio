// =============================================================================
// add-mockup-metadata: set per-side mockup URLs on customizable apparel.
//
// The DesignEditor on the storefront looks for `metadata.mockup_front` and
// `metadata.mockup_back` so the Konva stage can swap the background image
// when the user toggles the Front/Back tabs. seed-curated.ts already loads
// 4 images per product; this script picks the first as front and the second
// as back (falling back to front if only one exists).
//
// Idempotent: re-running merges into existing metadata, never clobbers.
//
// Usage:
//   pnpm exec medusa exec ./src/scripts/add-mockup-metadata.ts
// =============================================================================
import { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

const CUSTOMIZABLE_HANDLES = [
  "studio-tee-cream",
  "studio-tee-charcoal",
  "atelier-hoodie",
  "atelier-hoodie-charcoal",
  "heavyweight-sweatshirt-cream",
  "heavyweight-sweatshirt-black",
  "ghostmark-cap",
  "panel-cap-black",
] as const

export default async function addMockupMetadata({ container }: ExecArgs) {
  const productService = container.resolve(Modules.PRODUCT)

  let updated = 0
  let skipped = 0

  for (const handle of CUSTOMIZABLE_HANDLES) {
    const products = await productService.listProducts(
      { handle: [handle] },
      { relations: ["images"] },
    )
    if (!products.length) {
      console.log(`skip ${handle} (not found)`)
      skipped++
      continue
    }
    const p = products[0]
    const front = p.images?.[0]?.url
    const back = p.images?.[1]?.url ?? p.images?.[0]?.url
    if (!front) {
      console.log(`skip ${handle} (no images)`)
      skipped++
      continue
    }

    await productService.updateProducts(p.id, {
      metadata: {
        ...(p.metadata ?? {}),
        mockup_front: front,
        mockup_back: back,
        is_customizable: true,
      },
    })

    console.log(
      `updated ${handle} -> front=${front.slice(-40)} back=${back?.slice(-40) ?? "(none)"}`,
    )
    updated++
  }

  console.log(`\nDone. updated=${updated} skipped=${skipped}`)
}
