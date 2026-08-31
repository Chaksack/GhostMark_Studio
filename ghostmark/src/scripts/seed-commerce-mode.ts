// =============================================================================
// seed-commerce-mode: write the 3-mode commerce IA taxonomy onto every product
// so the storefront's mode-aware ProductCard / chip catalogue (`chips.ts`) and
// surface routers (`/shop`, `/studio`, `/pod`) have authoritative metadata to
// scope queries and render badges.
//
// Contract (matches storefront/app/utils/chips.ts CHIP_CATALOG keys):
//
//   product.metadata = {
//     ...preserved existing keys,
//     commerce_mode: 'shop' | 'studio' | 'pod',  // routing hint
//     studio_canon?: true,                       // D2C canonical line flag
//     chips: string[],                           // snake_case keys only
//   }
//
// Allowed chip keys (anything else is silently dropped by the storefront):
//   D2C   : best_seller, new_drop, low_stock, studio_canon
//   STUDIO: from_25_units, e_proof_48h, custom_print
//   POD   : pod_ready
//   ANY   : made_in_europe, b_corp
//
// Idempotency: re-running this script over the same products is safe. The
// patch is a structural REPLACE of `commerce_mode`, `studio_canon`, and `chips`
// only; every other key on `metadata` (badges, is_customizable, print_locations,
// techniques, quantity_tiers, mockup_*, etc.) is preserved through a shallow
// merge.
//
// Usage:
//   pnpm exec medusa exec ./src/scripts/seed-commerce-mode.ts
// =============================================================================
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

// -----------------------------------------------------------------------------
// Canonical chip keys: must stay in sync with the storefront's chips.ts.
// Kept as a const tuple so a typo here is a compile-time error.
// -----------------------------------------------------------------------------
const CHIP_KEYS = [
  // D2C
  "best_seller",
  "new_drop",
  "low_stock",
  "studio_canon",
  // B2B Studio + POD
  "from_25_units",
  "e_proof_48h",
  "pod_ready",
  "custom_print",
  // Universal
  "made_in_europe",
  "b_corp",
] as const

type ChipKey = (typeof CHIP_KEYS)[number]
const isChipKey = (s: string): s is ChipKey =>
  (CHIP_KEYS as readonly string[]).includes(s)

type CommerceMode = "shop" | "studio" | "pod"

type ProductSpec = {
  handle: string
  commerce_mode: CommerceMode
  studio_canon?: true
  chips: ChipKey[]
}

// -----------------------------------------------------------------------------
// Per-product manifest (24 products, mirrors the live catalogue).
//
// Mode rules:
//   shop   = own-brand D2C SKU. Owns its PDP on /shop. May ALSO be customizable
//            via the studio surface, but its canonical home is /shop.
//   studio = B2B custom-base blank. Sold by-the-batch with print decoration.
//            Listing on /studio.
//   pod    = print-on-demand single-unit SKU (the design IS the product on
//            stickers). Listing on /pod (under /studio in the IA).
//
// Studio Canon (`studio_canon: true`):
//   The 6-piece curated "GhostMark Studio Canon", the flagship own-brand line
//   that anchors the brand. Treated as a hand-picked editorial subset of the
//   /shop catalogue, surfaced via the homepage Studio Canon strip and the
//   `/shop?canon=true` filter.
//
// Chips (snake_case only):
//   - made_in_europe / b_corp: applied broadly to communicate the brand promise.
//   - best_seller: Studio Canon flagship pieces with the strongest sell-through
//     in the original `seed-badges.ts` ("Best sellers" badge).
//   - new_drop: SKUs flagged "New" in the original badge map (panel cap, market
//     tote, steel bottle 750, notebook A6).
//   - studio_canon: applied as a CHIP only on Canon products (mirrors
//     `studio_canon: true` flag; chip is what the card renders).
//   - from_25_units / e_proof_48h: B2B service guarantees on /studio bases.
//   - custom_print: Studio bases that emphasise print decoration as their core
//     value (cable-organiser is a leather-elastic wrap, less print-led, so it
//     gets from_25_units/e_proof_48h but not custom_print).
//   - pod_ready: stickers (print-and-ship single-unit SKUs).
//
// Single source of truth: every other system (chips.ts, /shop scoping,
// /studio scoping, homepage Canon strip) reads from this manifest.
// -----------------------------------------------------------------------------
const SPECS: ProductSpec[] = [
  // ---- Studio Canon (own-brand flagship D2C) -------------------------------
  {
    handle: "studio-tee-cream",
    commerce_mode: "shop",
    studio_canon: true,
    chips: ["studio_canon", "best_seller", "made_in_europe"],
  },
  {
    handle: "studio-tee-charcoal",
    commerce_mode: "shop",
    studio_canon: true,
    chips: ["studio_canon", "best_seller", "made_in_europe"],
  },
  {
    handle: "atelier-hoodie",
    commerce_mode: "shop",
    studio_canon: true,
    chips: ["studio_canon", "best_seller", "b_corp", "made_in_europe"],
  },
  {
    handle: "atelier-hoodie-charcoal",
    commerce_mode: "shop",
    studio_canon: true,
    chips: ["studio_canon", "b_corp", "made_in_europe"],
  },
  {
    handle: "ghostmark-cap",
    commerce_mode: "shop",
    studio_canon: true,
    chips: ["studio_canon", "best_seller", "made_in_europe"],
  },
  {
    handle: "workshop-tote",
    commerce_mode: "shop",
    studio_canon: true,
    chips: ["studio_canon", "best_seller", "b_corp", "made_in_europe"],
  },

  // ---- Shop (own-brand D2C, non-Canon) -------------------------------------
  {
    handle: "heavyweight-sweatshirt-cream",
    commerce_mode: "shop",
    chips: ["b_corp", "made_in_europe"],
  },
  {
    handle: "heavyweight-sweatshirt-black",
    commerce_mode: "shop",
    chips: ["made_in_europe"],
  },
  {
    handle: "panel-cap-black",
    commerce_mode: "shop",
    chips: ["new_drop", "made_in_europe"],
  },
  {
    handle: "market-tote-oat",
    commerce_mode: "shop",
    chips: ["new_drop", "b_corp", "made_in_europe"],
  },
  {
    handle: "ceramic-mug-cream",
    commerce_mode: "shop",
    chips: ["best_seller", "made_in_europe"],
  },
  {
    handle: "ceramic-mug-sage",
    commerce_mode: "shop",
    chips: ["made_in_europe"],
  },
  {
    handle: "steel-bottle-500",
    commerce_mode: "shop",
    chips: ["best_seller", "made_in_europe"],
  },
  {
    handle: "steel-bottle-750",
    commerce_mode: "shop",
    chips: ["new_drop", "made_in_europe"],
  },
  {
    handle: "insulated-tumbler-cream",
    commerce_mode: "shop",
    chips: ["made_in_europe"],
  },
  {
    handle: "insulated-tumbler-black",
    commerce_mode: "shop",
    chips: ["made_in_europe"],
  },
  {
    handle: "studio-notebook-a5",
    commerce_mode: "shop",
    chips: ["best_seller", "made_in_europe"],
  },
  {
    handle: "studio-notebook-a6",
    commerce_mode: "shop",
    chips: ["new_drop", "made_in_europe"],
  },
  {
    handle: "studio-candle",
    commerce_mode: "shop",
    chips: ["made_in_europe"],
  },
  {
    handle: "linen-tea-towel",
    commerce_mode: "shop",
    chips: ["made_in_europe"],
  },

  // ---- Studio (B2B custom-base blanks) -------------------------------------
  {
    handle: "cable-organiser",
    commerce_mode: "studio",
    chips: ["from_25_units", "e_proof_48h", "made_in_europe"],
  },
  {
    handle: "tech-pouch",
    commerce_mode: "studio",
    chips: ["from_25_units", "e_proof_48h", "custom_print", "made_in_europe"],
  },

  // ---- POD (print-on-demand, design IS the product) -----------------------
  {
    handle: "studio-sticker-pack",
    commerce_mode: "pod",
    chips: ["pod_ready", "custom_print"],
  },
  {
    handle: "logo-sticker-sheet",
    commerce_mode: "pod",
    chips: ["pod_ready", "custom_print"],
  },
]

// -----------------------------------------------------------------------------
// Defensive validation: fail loudly if a spec references an unknown chip key
// (catches typos before they get written to the database).
// -----------------------------------------------------------------------------
function validateSpecs(specs: ProductSpec[]): void {
  const errors: string[] = []
  const seen = new Set<string>()
  for (const s of specs) {
    if (seen.has(s.handle)) {
      errors.push(`duplicate handle in manifest: ${s.handle}`)
    }
    seen.add(s.handle)
    for (const c of s.chips) {
      if (!isChipKey(c)) {
        errors.push(`${s.handle}: unknown chip key '${c}'`)
      }
    }
    if (s.commerce_mode !== "shop" && s.studio_canon) {
      errors.push(
        `${s.handle}: studio_canon=true requires commerce_mode='shop' (got '${s.commerce_mode}')`,
      )
    }
    if (s.studio_canon && !s.chips.includes("studio_canon")) {
      errors.push(
        `${s.handle}: studio_canon=true must also include 'studio_canon' in chips[] for the badge to render`,
      )
    }
  }
  if (errors.length) {
    throw new Error(
      `seed-commerce-mode validation failed:\n  - ${errors.join("\n  - ")}`,
    )
  }
}

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------
export default async function seedCommerceMode({ container }: ExecArgs) {
  const productService = container.resolve(Modules.PRODUCT)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  validateSpecs(SPECS)

  type RowReport = {
    handle: string
    commerce_mode: CommerceMode | "–"
    canon: boolean
    chips: number
    status: "updated" | "missing"
  }
  const report: RowReport[] = []

  // Cross-check the manifest against the live catalogue so missing / extra
  // products are surfaced in the report (an unflagged product becomes
  // invisible to the mode router on the storefront).
  const { data: liveProducts } = await query.graph({
    entity: "product",
    fields: ["id", "handle"],
  })
  const liveHandles = new Set(
    (liveProducts as Array<{ id: string; handle: string }>).map((p) => p.handle),
  )
  const manifestHandles = new Set(SPECS.map((s) => s.handle))

  const unflagged = [...liveHandles].filter((h) => !manifestHandles.has(h))
  if (unflagged.length) {
    logger.warn(
      `[seed-commerce-mode] ${unflagged.length} live product(s) NOT in manifest ` +
        `(no commerce_mode will be set, storefront mode router will skip them): ` +
        unflagged.join(", "),
    )
  }

  for (const spec of SPECS) {
    const products = await productService.listProducts({ handle: [spec.handle] })
    if (!products.length) {
      logger.warn(`[seed-commerce-mode] missing product handle=${spec.handle}`)
      report.push({
        handle: spec.handle,
        commerce_mode: "–",
        canon: false,
        chips: 0,
        status: "missing",
      })
      continue
    }
    const p = products[0]
    const existing = (p.metadata ?? {}) as Record<string, unknown>

    // Build the patch. We deliberately drop `studio_canon` from the spread when
    // not set so the key isn't written as `false` (cleaner JSON in the API
    // response and cleaner queries on the storefront).
    const patch: Record<string, unknown> = {
      commerce_mode: spec.commerce_mode,
      chips: spec.chips,
    }
    if (spec.studio_canon) {
      patch.studio_canon = true
    } else if ("studio_canon" in existing) {
      // Idempotent removal: a previous run flagged this handle as Canon and
      // the manifest no longer does, so strip the stale flag.
      patch.studio_canon = undefined
    }

    // Shallow merge: preserves badges, is_customizable, print_locations, etc.
    const merged: Record<string, unknown> = { ...existing, ...patch }
    // Remove keys explicitly set to undefined so we don't write `null`s.
    for (const k of Object.keys(merged)) {
      if (merged[k] === undefined) delete merged[k]
    }

    await productService.updateProducts(p.id, { metadata: merged })

    report.push({
      handle: spec.handle,
      commerce_mode: spec.commerce_mode,
      canon: !!spec.studio_canon,
      chips: spec.chips.length,
      status: "updated",
    })
  }

  // ---------------------------------------------------------------------------
  // Final report
  // ---------------------------------------------------------------------------
  logger.info("\n=== seed-commerce-mode report ===")
  const header =
    "handle".padEnd(34) +
    "mode".padEnd(8) +
    "canon".padEnd(7) +
    "chips".padEnd(7) +
    "status"
  logger.info(header)
  logger.info("-".repeat(header.length + 8))

  const counts = { shop: 0, studio: 0, pod: 0, canon: 0, missing: 0 }
  for (const r of report) {
    logger.info(
      r.handle.padEnd(34) +
        String(r.commerce_mode).padEnd(8) +
        (r.canon ? "yes" : "no").padEnd(7) +
        String(r.chips).padEnd(7) +
        r.status,
    )
    if (r.status === "missing") counts.missing++
    else {
      counts[r.commerce_mode as CommerceMode]++
      if (r.canon) counts.canon++
    }
  }

  logger.info(
    `\nTotals: shop=${counts.shop} studio=${counts.studio} pod=${counts.pod} ` +
      `studio_canon=${counts.canon} missing=${counts.missing}`,
  )
  if (unflagged.length) {
    logger.info(
      `Live products NOT in manifest (${unflagged.length}): ${unflagged.join(", ")}`,
    )
  }
  logger.info("==================================\n")
}
