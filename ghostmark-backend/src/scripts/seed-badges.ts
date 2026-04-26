// =============================================================================
// seed-badges — write a `metadata.badges` string array onto a curated subset of
// products so the storefront ProductCard chip strip (mirrors merchery.co)
// actually has data to render. Idempotent: shallow-merges into existing
// metadata, replacing only the `badges` key on each pass.
//
// Usage:
//   pnpm exec medusa exec ./src/scripts/seed-badges.ts
// =============================================================================
import { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

// Per-handle badge map. Cap of 5 honored upstream by ProductCardChips.vue, but
// we keep manifests sane (1-4 per product) so the strip never crowds the card.
const BADGE_MAP: Record<string, string[]> = {
  'atelier-hoodie':                ['B Corp', 'Best sellers', 'Made in Europe', 'GhostMark studio'],
  'atelier-hoodie-charcoal':       ['B Corp', 'Made in Europe'],
  'studio-tee-cream':              ['Best sellers', 'GhostMark studio'],
  'studio-tee-charcoal':           ['Best sellers', 'Fast shipping'],
  'heavyweight-sweatshirt-cream':  ['B Corp', 'Made in Europe'],
  'heavyweight-sweatshirt-black':  ['Made in Europe'],
  'ghostmark-cap':                 ['Best sellers', 'GhostMark studio'],
  'panel-cap-black':               ['New'],
  'workshop-tote':                 ['B Corp', 'Made in Europe', 'Best sellers'],
  'market-tote-oat':               ['B Corp', 'New'],
  'ceramic-mug-cream':             ['Made in Europe', 'Best sellers'],
  'ceramic-mug-sage':              ['Made in Europe'],
  'steel-bottle-500':              ['Best sellers'],
  'steel-bottle-750':              ['New'],
  'studio-notebook-a5':            ['Best sellers', 'GhostMark studio'],
  'studio-notebook-a6':            ['New'],
  'studio-candle':                 ['Made in Europe', 'GhostMark studio'],
  'linen-tea-towel':               ['Made in Europe'],
}

export default async function seedBadges({ container }: ExecArgs) {
  const productService = container.resolve(Modules.PRODUCT)
  let updated = 0
  let skipped = 0
  for (const [handle, badges] of Object.entries(BADGE_MAP)) {
    const ps = await productService.listProducts({ handle: [handle] })
    if (!ps.length) {
      console.log('skip', handle, '(not found)')
      skipped++
      continue
    }
    const p = ps[0]
    const existing = (p.metadata ?? {}) as Record<string, unknown>
    await productService.updateProducts(p.id, {
      metadata: { ...existing, badges },
    })
    updated++
    console.log('updated', handle, '->', badges.join(', '))
  }
  console.log(`Done. Updated ${updated}, skipped ${skipped}, total ${Object.keys(BADGE_MAP).length} products.`)
}
