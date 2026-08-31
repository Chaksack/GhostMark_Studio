// =============================================================================
// verify-tier-resolution: READ ONLY. Proves, through Medusa's OWN pricing
// module, what the cart will actually charge at each quantity.
//
//     npx medusa exec ./src/scripts/verify-tier-resolution.ts
//     npx medusa exec ./src/scripts/verify-tier-resolution.ts -- --currencies=gbp,eur,usd
//     npx medusa exec ./src/scripts/verify-tier-resolution.ts -- --only=tech-pouch
//
// -----------------------------------------------------------------------------
// WHY THIS EXISTS
// -----------------------------------------------------------------------------
// Every agent on this effort was forbidden from writing, so "250 of tech-pouch
// resolves to GBP 24.96" was established by READING the pricing repository, not
// by observing it. This closes that gap without a single write:
// `pricingModule.calculatePrices()` is a pure SELECT, the repository builds a
// knex query, orders it, and returns rows. No INSERT, no UPDATE.
//
// It is end-to-end for PRICE RESOLUTION because the cart does nothing cleverer.
// @medusajs/core-flows/dist/cart/workflows/get-variants-and-items-with-prices.js:
//
//     context: { ...baseContext, quantity: item.quantity }
//     const calculatedPriceSets = await pricingService.calculatePrices({ id: priceSetIds }, { context })
//     input.unitPrice = calculatedPriceSet.calculated_amount
//
// `calculated_amount` IS the line's unit_price. We call the same method with the
// same context shape and assert on the same field.
//
// -----------------------------------------------------------------------------
// !! NO FX CONSTANT. NO ARITHMETIC ASSUMPTION. READ THIS BEFORE "SIMPLIFYING" !!
// -----------------------------------------------------------------------------
// An earlier version of this script derived the expected EUR/USD figure as
// Math.round(gbp * FX_FROM_GBP[cur]) with FX_FROM_GBP = { eur: 1.15, usd: 1.27 }.
// That was wrong twice over, and it produced a 500-failure false alarm:
//
//   1. MAGNITUDE. Math.round() is rounding to the penny while amounts are
//      MINOR-unit integers, and rounding to the whole POUND once they are
//      MAJOR. After the metadata migration, Math.round(32 * 1.15) = 37, not
//      36.80, the checker failed correct data by 0.20. This is the same
//      rounding-at-the-wrong-magnitude defect that was fixed in
//      seed-merchery-metadata.ts buildTiers(), reproduced in the checker.
//
//   2. WORSE, AND THE REAL LESSON. Those EUR and USD amounts are not a
//      derivation at all, they are REAL ROWS in the `price` table. A verifier
//      that reconstructs its expected value from a hardcoded constant is
//      verifying the constant, not the catalogue, and it silently goes wrong
//      the day a real rate changes.
//
// So this version asks the database what the rows ARE, independently re-derives
// which row should win using the documented selection rule, and compares that
// to what the pricing module returned. Nothing is multiplied by anything.
//
// SELECTION RULE, transcribed from @medusajs/pricing 2.11.3
// (dist/repositories/pricing.js, eligibility, then ordering):
//
//     eligible(q) = (min <= q AND max >= q)
//                OR (min <= q AND max IS NULL)
//                OR (min IS NULL AND max IS NULL)
//                OR (min IS NULL AND max >= q)
//
//     ORDER BY price_list_id IS NOT NULL DESC,
//              rules_count + COALESCE(pl.rules_count, 0) DESC,
//              amount ASC
//
// and dist/services/pricing-module.js takes the first non-price-list row as the
// calculated price. With no price lists and no rules in play (this catalogue)
// that reduces to CHEAPEST ELIGIBLE ROW WINS. Re-deriving it here rather than
// trusting it is the point: if Medusa ever changes the rule, this test fails
// and tells us, instead of agreeing with whatever the module does.
//
// TWO INDEPENDENT CHECKS PER PROBE:
//   A. RESOLVER vs ROWS : every currency. Does calculatePrices return the row
//      the documented rule says should win?
//   B. METADATA vs RESOLVER: GBP only, because the ladder is authored in GBP.
//      Does metadata.quantity_tiers[i].unit_amount equal what the cart charges
//      at that rung? This is the check that migrate-tier-metadata-units.ts
//      exists to make pass.
//
// The GBP-to-EUR/USD relationship is REPORTED as an observation at the end, not
// asserted, precisely so a real rate change is visible without failing a test
// that is about tier resolution.
//
// WHAT THIS STILL DOES NOT PROVE, stated plainly:
//   * That a real POST /store/carts/:id/line-items succeeds, that needs a write.
//   * Tax, promotions, or shipping on top of the line price.
//   * That the storefront sends the quantity it means to send.
// =============================================================================

import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

type TierEntry = { quantity: number; unit_amount: number }
type PriceRow = {
  amount: number
  min_quantity: number | null
  max_quantity: number | null
}

/** Eligibility + ordering, transcribed from the pricing repository. */
function winningRow(rows: PriceRow[], q: number): PriceRow | null {
  const eligible = rows.filter(
    (r) =>
      (r.min_quantity !== null && r.min_quantity <= q && r.max_quantity !== null && r.max_quantity >= q) ||
      (r.min_quantity !== null && r.min_quantity <= q && r.max_quantity === null) ||
      (r.min_quantity === null && r.max_quantity === null) ||
      (r.min_quantity === null && r.max_quantity !== null && r.max_quantity >= q),
  )
  if (!eligible.length) return null
  return eligible.slice().sort((a, b) => a.amount - b.amount)[0]
}

export default async function verifyTierResolution({ container, args }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const knex: any = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const pricing: any = container.resolve(Modules.PRICING)
  const say = (m = "") => logger.info(`[verify-tier-resolution] ${m}`)

  // `medusa exec` does not forward `--` flags into ExecArgs.args (the CLI
  // declares `exec [file] [args..]`, a yargs variadic positional, and yargs
  // routes anything after `--` into argv["--"]). Read process.argv too.
  const argv: string[] = [...(args ?? []), ...process.argv.slice(2)]
  const readOpt = (n: string): string | null => {
    const hit = argv.find((a) => a.startsWith(`--${n}=`) || a.startsWith(`${n}=`))
    return hit ? hit.slice(hit.indexOf("=") + 1) : null
  }
  const only = (readOpt("only") ?? "").split(",").map((s) => s.trim()).filter(Boolean)
  const currencies = (readOpt("currencies") ?? "gbp")
    .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)

  say("=".repeat(100))
  say("READ-ONLY VERIFICATION: drives Medusa's own pricing module. Writes nothing.")
  say(`currencies: ${currencies.join(", ")}${only.length ? `   only: ${only.join(", ")}` : ""}`)
  say("=".repeat(100))

  const { rows: products } = await knex.raw(`
    SELECT p.id, p.handle, p.metadata->'quantity_tiers' AS tiers
      FROM product p
     WHERE p.deleted_at IS NULL AND p.metadata ? 'quantity_tiers'
     ORDER BY p.handle
  `)
  const scoped = only.length
    ? products.filter((p: any) => only.includes(p.handle))
    : products
  if (!scoped.length) {
    say("nothing in scope.")
    return
  }

  const { rows: variantRows } = await knex.raw(`
    SELECT p.handle, v.id AS variant_id, vps.price_set_id
      FROM product p
      JOIN product_variant v             ON v.product_id = p.id AND v.deleted_at IS NULL
      JOIN product_variant_price_set vps ON vps.variant_id = v.id AND vps.deleted_at IS NULL
     WHERE p.deleted_at IS NULL AND p.metadata ? 'quantity_tiers'
     ORDER BY p.handle, v.id
  `)

  // Every non-price-list price row, grouped by price_set + currency. This is
  // the ground truth the resolver is checked against.
  const { rows: allPrices } = await knex.raw(`
    SELECT pr.price_set_id, pr.currency_code,
           pr.amount::float8 AS amount, pr.min_quantity, pr.max_quantity
      FROM price pr
     WHERE pr.deleted_at IS NULL AND pr.price_list_id IS NULL
  `)
  const rowsFor = (psId: string, cur: string): PriceRow[] =>
    allPrices
      .filter((r: any) => r.price_set_id === psId && r.currency_code === cur)
      .map((r: any) => ({
        amount: Number(r.amount),
        min_quantity: r.min_quantity === null ? null : Number(r.min_quantity),
        max_quantity: r.max_quantity === null ? null : Number(r.max_quantity),
      }))

  let checkA = 0, passA = 0
  let checkB = 0, passB = 0
  const failures: string[] = []
  const fxObserved: Array<{ handle: string; cur: string; ratio: number }> = []

  for (const p of scoped) {
    const tiers = ((p.tiers ?? []) as TierEntry[]).slice().sort((a, b) => a.quantity - b.quantity)
    if (!tiers.length) continue
    const vrows = variantRows.filter((r: any) => r.handle === p.handle)
    if (!vrows.length) continue
    const v = vrows[0]

    say("")
    say("-".repeat(100))
    say(`${p.handle}   variant ${v.variant_id}`)
    say("-".repeat(100))
    say("  cur  qty     resolved   row says   window        metadata   A:rows  B:meta")

    const probes = new Set<number>([1])
    for (const t of tiers) {
      probes.add(t.quantity)
      if (t.quantity > 1) probes.add(t.quantity - 1)
    }
    const sortedProbes = [...probes].sort((a, b) => a - b)

    for (const cur of currencies) {
      const dbRows = rowsFor(v.price_set_id, cur)
      if (!dbRows.length) {
        say(`  ${cur} , no ${cur.toUpperCase()} price rows on this variant, skipped`)
        continue
      }

      for (const q of sortedProbes) {
        const res = await pricing.calculatePrices(
          { id: [v.price_set_id] },
          { context: { currency_code: cur, quantity: q } },
        )
        const row = res?.[0]
        if (!row) {
          failures.push(`${p.handle} ${cur} q=${q}: no price resolved`)
          continue
        }
        const resolved = Number(row.calculated_amount)

        // -- CHECK A: resolver vs the actual rows, no arithmetic assumption ---
        const expectRow = winningRow(dbRows, q)
        checkA++
        const okA = expectRow !== null && Math.abs(resolved - expectRow.amount) < 1e-9
        if (okA) passA++
        else {
          failures.push(
            `${p.handle} ${cur} q=${q}: resolver returned ${resolved}, ` +
              `documented rule says ${expectRow ? expectRow.amount : "no eligible row"}`,
          )
        }

        // -- CHECK B: metadata vs resolver, GBP only ---------------------------
        let bMark = "  -"
        if (cur === "gbp") {
          const applicable = tiers.filter((t) => t.quantity <= q)
          const rung = applicable.length ? applicable[applicable.length - 1] : null
          if (rung) {
            checkB++
            const okB = Math.abs(Number(rung.unit_amount) - resolved) < 1e-9
            if (okB) passB++
            else {
              failures.push(
                `${p.handle} metadata q=${q}: metadata says ${rung.unit_amount}, ` +
                  `cart will charge ${resolved}`,
              )
            }
            bMark = okB ? " OK" : "FAIL"
          }
        }

        const win = `${expectRow?.min_quantity ?? "null"}/${expectRow?.max_quantity ?? "null"}`
        const metaRung = tiers.filter((t) => t.quantity <= q).slice(-1)[0]
        say(
          `  ${cur}  ${String(q).padStart(4)} ${resolved.toFixed(2).padStart(12)} ` +
            `${(expectRow ? expectRow.amount.toFixed(2) : "–").padStart(10)}   ${win.padEnd(12)} ` +
            `${String(metaRung ? metaRung.unit_amount : "–").padStart(9)}   ` +
            `${okA ? " OK " : "FAIL"}    ${bMark}`,
        )
      }
    }

    // Observation only, never an assertion: how EUR/USD relate to GBP today.
    const gbpBase = rowsFor(v.price_set_id, "gbp").find((r) => r.min_quantity === null)
    for (const cur of currencies.filter((c) => c !== "gbp")) {
      const b = rowsFor(v.price_set_id, cur).find((r) => r.min_quantity === null)
      if (gbpBase && b && gbpBase.amount > 0) {
        fxObserved.push({ handle: p.handle, cur, ratio: b.amount / gbpBase.amount })
      }
    }
  }

  say("")
  say("=".repeat(100))
  say(`CHECK A  resolver vs price rows   : ${passA}/${checkA}`)
  say(`CHECK B  metadata vs resolver     : ${passB}/${checkB}   (GBP only, the ladder is authored in GBP)`)
  say("")
  if (failures.length) {
    say(`FAILURES (${failures.length}):`)
    for (const f of failures.slice(0, 40)) say(`  ${f}`)
    if (failures.length > 40) say(`  ... and ${failures.length - 40} more`)
  } else {
    say("NO FAILURES.")
  }

  // FX is observed, not asserted, see the header.
  if (fxObserved.length) {
    say("")
    say("OBSERVED base-price ratios to GBP (reported, NOT asserted):")
    for (const cur of [...new Set(fxObserved.map((f) => f.cur))]) {
      const rs = fxObserved.filter((f) => f.cur === cur).map((f) => f.ratio)
      const distinct = [...new Set(rs.map((r) => r.toFixed(4)))]
      say(`  ${cur}: ${distinct.join(", ")}   across ${rs.length} product(s)`)
    }
    say("  A single value here means one consistent rate; several means the")
    say("  catalogue holds mixed rates, which is worth knowing but is not a")
    say("  tier-resolution failure.")
  }

  say("")
  say("VERIFICATION COMPLETE: nothing was written.")
}
