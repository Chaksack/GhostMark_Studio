// =============================================================================
// analyze-quantity-tiers: READ ONLY. Never writes. No flags, no env var, no
// confirmation, because there is nothing to confirm.
//
//     npx medusa exec ./src/scripts/analyze-quantity-tiers.ts
//
// -----------------------------------------------------------------------------
// WHAT IT ANSWERS
// -----------------------------------------------------------------------------
// 1. Which products carry `metadata.quantity_tiers`, how many variants each
//    has, and therefore how many `price` rows a tier migration would create.
// 2. Which unit convention the live variant prices are currently in, decided
//    by an exact oracle rather than by magnitude (see UNIT REGIME below).
// 3. Whether the FX derivation used to seed EUR/USD base prices still holds
//    exactly, which is the only thing that makes deriving EUR/USD tier prices
//    a reproduction of existing arithmetic rather than an invention.
// 4. A SIMULATION of Medusa's own price resolver at each tier boundary, so the
//    claim "the cart will charge the tier price" is demonstrated against the
//    real selection rules rather than asserted.
//
// -----------------------------------------------------------------------------
// UNIT REGIME: the oracle
// -----------------------------------------------------------------------------
// This catalogue has an unresolved 100x unit defect (see migrate-price-units.ts).
// A tier migration must write its rows in whatever convention the sibling
// variant prices are CURRENTLY in, and magnitude cannot tell the conventions
// apart, that is the whole lesson of migrate-price-units.ts, where a
// `100 ghs` price is genuinely major-unit while a `1000 gbp` one is minor.
//
// For THIS population we do not need magnitude, because we have an exact
// reference value. seed-merchery-metadata.ts built the ladder from the live
// GBP base price:
//
//     quantity_tiers = ladder.map(([quantity, discount]) => ({
//       quantity, unit_amount: Math.round(baseUnitAmount * (1 - discount))
//     }))
//
// with the first ladder entry always at discount 0. So for every product:
//
//     metadata.quantity_tiers[0].unit_amount === <GBP base price, as seeded>
//
// That metadata is a frozen photograph of the base price in its ORIGINAL
// (minor) convention, and metadata is not touched by migrate-price-units.ts.
// Therefore:
//
//     ratio = tiers[0].unit_amount / live_gbp_base_amount
//       ratio === 1   -> live prices still MINOR  (price-units NOT applied)
//       ratio === 100 -> live prices now  MAJOR   (price-units HAS been applied)
//       anything else -> we do not know. Abort. Do not guess.
//
// This is provenance, not magnitude: the answer comes from a recorded original
// value, not from how big a number looks.
// =============================================================================

import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/** FX factors seed-curated.ts used to derive EUR/USD from GBP. */
const FX_FROM_GBP: Record<string, number> = { gbp: 1, eur: 1.15, usd: 1.27 }

/** Ledger written by migrate-price-units.ts. Its presence is a second signal. */
const PRICE_UNIT_LEDGER = "gms_price_unit_migration"

type TierEntry = { quantity: number; unit_amount: number }

export default async function analyzeQuantityTiers({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const knex: any = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const say = (m = "") => logger.info(`[analyze-quantity-tiers] ${m}`)

  say("=".repeat(96))
  say("READ-ONLY ANALYSIS: this script never writes.")
  say("=".repeat(96))

  // ---------------------------------------------------------------------------
  // 1) Every product carrying tiers, with its variants and live prices.
  // ---------------------------------------------------------------------------
  const { rows: products } = await knex.raw(`
    SELECT p.id, p.handle, p.metadata->'quantity_tiers' AS tiers, p.metadata->>'moq' AS moq
      FROM product p
     WHERE p.deleted_at IS NULL
       AND p.metadata ? 'quantity_tiers'
     ORDER BY p.handle
  `)

  if (!products.length) {
    say("no product carries metadata.quantity_tiers, nothing to analyse.")
    return
  }

  const { rows: priceRows } = await knex.raw(
    `
    SELECT p.handle,
           v.id  AS variant_id,
           v.title AS variant_title,
           vps.price_set_id,
           pr.id AS price_id,
           pr.currency_code,
           pr.amount::numeric AS amount,
           pr.min_quantity,
           pr.max_quantity,
           pr.price_list_id
      FROM product p
      JOIN product_variant v            ON v.product_id = p.id AND v.deleted_at IS NULL
      JOIN product_variant_price_set vps ON vps.variant_id = v.id AND vps.deleted_at IS NULL
      JOIN price pr                      ON pr.price_set_id = vps.price_set_id AND pr.deleted_at IS NULL
     WHERE p.deleted_at IS NULL AND p.metadata ? 'quantity_tiers'
     ORDER BY p.handle, v.id, pr.currency_code
  `,
  )

  // ---------------------------------------------------------------------------
  // 2) Unit regime, by the exact oracle described in the header.
  // ---------------------------------------------------------------------------
  const ledgerReg = await knex.raw(`SELECT to_regclass(?) AS t`, [
    `public.${PRICE_UNIT_LEDGER}`,
  ])
  let priceUnitsApplied = false
  if (ledgerReg?.rows?.[0]?.t) {
    const { rows } = await knex.raw(
      `SELECT count(*)::int AS n FROM ${PRICE_UNIT_LEDGER} WHERE rolled_back_at IS NULL`,
    )
    priceUnitsApplied = (rows?.[0]?.n ?? 0) > 0
  }

  const ratios = new Map<string, number | null>()
  for (const p of products) {
    const tiers = (p.tiers ?? []) as TierEntry[]
    const gbp = priceRows.filter(
      (r: any) =>
        r.handle === p.handle && r.currency_code === "gbp" && !r.price_list_id,
    )
    const bases = new Set(gbp.map((r: any) => Number(r.amount)))
    if (!tiers.length || bases.size !== 1) {
      ratios.set(p.handle, null)
      continue
    }
    const base = [...bases][0] as number
    ratios.set(p.handle, base === 0 ? null : Number(tiers[0].unit_amount) / base)
  }

  const distinctRatios = [...new Set([...ratios.values()])]
  const regime =
    distinctRatios.length === 1 && distinctRatios[0] === 1
      ? "MINOR"
      : distinctRatios.length === 1 && distinctRatios[0] === 100
        ? "MAJOR"
        : "INDETERMINATE"

  say("")
  say("-".repeat(96))
  say("UNIT REGIME")
  say("-".repeat(96))
  say(`  ${PRICE_UNIT_LEDGER} ledger says price-units applied : ${priceUnitsApplied}`)
  say(`  tiers[0].unit_amount / live gbp base, distinct values : ${JSON.stringify(distinctRatios)}`)
  say(`  => live variant prices are in ${regime} units`)
  const consistent =
    (regime === "MINOR" && !priceUnitsApplied) ||
    (regime === "MAJOR" && priceUnitsApplied)
  say(
    `  => oracle and ledger ${consistent ? "AGREE" : "DISAGREE, a migration must refuse to run"}`,
  )
  if (regime !== "INDETERMINATE") {
    say(
      `  => tier amounts must be written ${regime === "MINOR" ? "AS-IS (no scaling)" : "DIVIDED BY 100"}`,
    )
  }

  // ---------------------------------------------------------------------------
  // 3) FX check, is deriving EUR/USD tiers reproduction, or invention?
  // ---------------------------------------------------------------------------
  const byVariant = new Map<string, any[]>()
  for (const r of priceRows) {
    if (r.price_list_id) continue
    if (!byVariant.has(r.variant_id)) byVariant.set(r.variant_id, [])
    byVariant.get(r.variant_id)!.push(r)
  }
  let fxOk = 0
  const fxBad: string[] = []
  for (const [vid, rs] of byVariant) {
    const g = rs.find((r) => r.currency_code === "gbp")
    if (!g) continue
    let ok = true
    for (const cur of ["eur", "usd"]) {
      const row = rs.find((r) => r.currency_code === cur)
      if (!row) continue
      if (Number(row.amount) !== Math.round(Number(g.amount) * FX_FROM_GBP[cur])) {
        ok = false
      }
    }
    ok ? fxOk++ : fxBad.push(vid)
  }
  say("")
  say("-".repeat(96))
  say("FX DERIVATION (seed-curated.ts: FX_FROM_GBP = { eur: 1.15, usd: 1.27 })")
  say("-".repeat(96))
  say(`  variants whose EUR/USD base == round(GBP base * FX) : ${fxOk}/${byVariant.size}`)
  if (fxBad.length) {
    say(`  MISMATCHES (deriving tier prices for these would be invention, not reproduction):`)
    for (const v of fxBad.slice(0, 20)) say(`    ${v}`)
  } else {
    say(`  exact for every variant, EUR/USD tier prices are reproducible by the`)
    say(`  same formula that produced the EUR/USD base prices.`)
  }

  // ---------------------------------------------------------------------------
  // 4) Per-product breakdown + projected row counts.
  // ---------------------------------------------------------------------------
  say("")
  say("-".repeat(96))
  say("PER-PRODUCT SCOPE")
  say("-".repeat(96))
  say(
    "  handle                        moq  tiers  eff  vars  gbp base   new rows  ladder",
  )
  say("  " + "-".repeat(92))

  let totalNewRows = 0
  let totalEff = 0
  let totalNoop = 0
  let totalVariants = 0
  const ladderProblems: string[] = []

  for (const p of products) {
    const tiers = ((p.tiers ?? []) as TierEntry[])
      .slice()
      .sort((a, b) => a.quantity - b.quantity)
    const rows = priceRows.filter(
      (r: any) => r.handle === p.handle && !r.price_list_id,
    )
    const variantIds = new Set(rows.map((r: any) => r.variant_id))
    const gbpBases = new Set(
      rows.filter((r: any) => r.currency_code === "gbp").map((r: any) => Number(r.amount)),
    )
    const base = gbpBases.size === 1 ? ([...gbpBases][0] as number) : null
    const scale = regime === "MAJOR" ? 100 : 1

    // Effective = strictly cheaper than base once put on the same scale.
    const effective = base === null
      ? []
      : tiers.filter((t) => Number(t.unit_amount) / scale < base)
    const noop = tiers.length - effective.length

    // Ladder must be strictly decreasing: Medusa breaks ties with
    // `ORDER BY price.amount ASC` and the base row stays eligible at every
    // quantity, so a tier priced at or above base can never win.
    let monotonic = true
    for (let i = 1; i < effective.length; i++) {
      if (Number(effective[i].unit_amount) >= Number(effective[i - 1].unit_amount)) {
        monotonic = false
      }
      if (effective[i].quantity <= effective[i - 1].quantity) monotonic = false
    }
    if (!monotonic) ladderProblems.push(p.handle)

    const newRows = effective.length * variantIds.size * 3
    totalNewRows += newRows
    totalEff += effective.length
    totalNoop += noop
    totalVariants += variantIds.size

    const ladder = effective
      .map((t) => `${t.quantity}+@${t.unit_amount}`)
      .join(" ")
    say(
      `  ${String(p.handle).padEnd(29)} ${String(p.moq ?? "–").padStart(3)} ` +
        `${String(tiers.length).padStart(6)} ${String(effective.length).padStart(4)} ` +
        `${String(variantIds.size).padStart(5)} ${String(base ?? "??").padStart(9)} ` +
        `${String(newRows).padStart(10)}  ${monotonic ? "" : "NON-MONOTONIC "}${ladder}`,
    )
  }

  say("")
  say(`  products                      ${products.length}`)
  say(`  variants                      ${totalVariants}`)
  say(`  tier entries (effective)      ${totalEff}`)
  say(`  tier entries (no-op == base)  ${totalNoop}   <- first ladder rung is discount 0`)
  say(`  price rows a migration adds   ${totalNewRows}   (effective tiers x variants x 3 currencies)`)
  if (ladderProblems.length) {
    say(`  NON-MONOTONIC LADDERS: ${ladderProblems.join(", ")}`)
    say(`  These cannot be expressed as plain quantity-scoped prices, see the`)
    say(`  resolver simulation below for why.`)
  }

  // ---------------------------------------------------------------------------
  // 5) Existing quantity-scoped rows, is this already applied, or hand-made?
  // ---------------------------------------------------------------------------
  const alreadyScoped = priceRows.filter(
    (r: any) => r.min_quantity !== null || r.max_quantity !== null,
  )
  say("")
  say("-".repeat(96))
  say("EXISTING QUANTITY-SCOPED PRICE ROWS ON THESE PRODUCTS")
  say("-".repeat(96))
  say(`  ${alreadyScoped.length} row(s)`)
  for (const r of alreadyScoped.slice(0, 20)) {
    say(
      `    ${r.handle} ${r.currency_code} ${r.amount} min=${r.min_quantity} max=${r.max_quantity} ${r.price_id}`,
    )
  }
  if (!alreadyScoped.length) {
    say(`  none, every price is flat. This is the defect: the ladder the PDP`)
    say(`  advertises has no representation in the pricing system.`)
  }

  // ---------------------------------------------------------------------------
  // 6) Resolver simulation. Reproduces Medusa 2.11.3's own selection rules:
  //
  //    @medusajs/pricing/dist/repositories/pricing.js
  //      eligible rows are those where
  //        (min <= q AND max >= q) OR (min <= q AND max IS NULL)
  //        OR (min IS NULL AND max IS NULL) OR (min IS NULL AND max >= q)
  //      ordered by  price_list_id IS NOT NULL DESC,
  //                  rules_count + COALESCE(pl.rules_count,0) DESC,
  //                  amount ASC
  //
  //    @medusajs/pricing/dist/services/pricing-module.js
  //      defaultPrice = first row with no price_list_id  ->  calculated_amount
  //
  //    i.e. with no price lists and no rules in play, THE CHEAPEST ELIGIBLE
  //    ROW WINS. That is why the ladder must be strictly decreasing.
  // ---------------------------------------------------------------------------
  say("")
  say("-".repeat(96))
  say("RESOLVER SIMULATION: GBP, what calculated_amount WOULD be after migration")
  say("-".repeat(96))
  say("  handle                        qty     today    after   line total today ->    after")
  say("  " + "-".repeat(92))

  const simulate = (
    rows: Array<{ amount: number; min: number | null; max: number | null }>,
    q: number,
  ): number | null => {
    const eligible = rows.filter(
      (r) =>
        (r.min !== null && r.min <= q && r.max !== null && r.max >= q) ||
        (r.min !== null && r.min <= q && r.max === null) ||
        (r.min === null && r.max === null) ||
        (r.min === null && r.max !== null && r.max >= q),
    )
    if (!eligible.length) return null
    return eligible.sort((a, b) => a.amount - b.amount)[0].amount
  }

  for (const p of products.slice(0, 6)) {
    const tiers = ((p.tiers ?? []) as TierEntry[])
      .slice()
      .sort((a, b) => a.quantity - b.quantity)
    const rows = priceRows.filter(
      (r: any) =>
        r.handle === p.handle && r.currency_code === "gbp" && !r.price_list_id,
    )
    if (!rows.length || !tiers.length) continue
    const base = Number(rows[0].amount)
    const scale = regime === "MAJOR" ? 100 : 1

    const effective = tiers.filter((t) => Number(t.unit_amount) / scale < base)
    const after: Array<{ amount: number; min: number | null; max: number | null }> = [
      { amount: base, min: null, max: null },
    ]
    effective.forEach((t, i) => {
      const next = effective[i + 1]
      after.push({
        amount: Number(t.unit_amount) / scale,
        min: t.quantity,
        max: next ? next.quantity - 1 : null,
      })
    })
    const before = [{ amount: base, min: null, max: null }]

    for (const t of tiers) {
      const q = t.quantity
      const nowAmt = simulate(before, q)!
      const newAmt = simulate(after, q)!
      say(
        `  ${String(p.handle).padEnd(29)} ${String(q).padStart(4)} ` +
          `${nowAmt.toFixed(2).padStart(9)} ${newAmt.toFixed(2).padStart(8)}   ` +
          `${(nowAmt * q).toFixed(2).padStart(14)} -> ${(newAmt * q).toFixed(2).padStart(9)}` +
          `${nowAmt === newAmt ? "   (no change)" : ""}`,
      )
    }
    say("")
  }
  say(`  (first 6 products shown; the rest follow the same shape)`)
  say("")
  say("ANALYSIS COMPLETE: nothing was written.")
}
