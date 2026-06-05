// =============================================================================
// flag-customizable — exec script to flip `metadata.is_customizable = true`
// on a single product so the Konva DesignEditor renders on the storefront PDP.
//
// Usage:
//   pnpm exec medusa exec ./src/scripts/flag-customizable.ts <handle>
// If <handle> is omitted, the script flags the first product returned by the
// product service (deterministic ordering is not guaranteed; pass an explicit
// handle in CI).
//
// Idempotent — re-running with the same handle just re-writes the same flag,
// merging into any existing metadata (so we never clobber unrelated keys).
// =============================================================================
import { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

export default async function flagCustomizable({ container, args }: ExecArgs) {
  const productService = container.resolve(Modules.PRODUCT)

  const handle = args?.[0]
  const products = handle
    ? await productService.listProducts({ handle: [handle] })
    : await productService.listProducts({}, { take: 1 })

  if (!products.length) {
    console.log(`NO_PRODUCT_FOUND${handle ? ` for handle=${handle}` : ""}`)
    return
  }

  const product = products[0]
  console.log(
    `Flagging product: ${product.title} (handle=${product.handle}, id=${product.id})`,
  )

  await productService.updateProducts(product.id, {
    metadata: { ...(product.metadata ?? {}), is_customizable: true },
  })

  console.log(`Done. metadata.is_customizable = true`)
}
