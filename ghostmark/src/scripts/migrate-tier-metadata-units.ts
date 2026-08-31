// =============================================================================
// migrate-tier-metadata-units: rewrites `product.metadata.quantity_tiers[]
// .unit_amount` so the ladder the PDP renders equals the price the cart charges.
//
//   DRY RUN (default, safe):
//     npx medusa exec ./src/scripts/migrate-tier-metadata-units.ts
//
//   APPLY (requires BOTH the flag and the env var):
//     MIGRATE_TIER_METADATA_CONFIRM=I-UNDERSTAND-THIS-REWRITES-PRODUCT-METADATA \
//       npx medusa exec ./src/scripts/migrate-tier-metadata-units.ts -- --apply
//
//   ROLLBACK (restores each product's recorded original array verbatim):
//     MIGRATE_TIER_METADATA_CONFIRM=I-UNDERSTAND-THIS-REWRITES-PRODUCT-METADATA \
//       npx medusa exec ./src/scripts/migrate-tier-metadata-units.ts -- --rollback
//
//   Optional narrowing:  -- --only=tech-pouch,studio-tee-cream
//
//   Flags work with or without dashes. `medusa exec` does NOT forward `--`
//   flags into ExecArgs.args, the CLI declares `exec [file] [args..]`, a yargs
//   variadic positional, and yargs routes anything after `--` into argv["--"].
//   A script reading only `args` dry-runs forever while appearing to accept the
//   flag. This one reads process.argv as well.
//
// -----------------------------------------------------------------------------
// THE DEFECT
// -----------------------------------------------------------------------------
// Two migrations have landed:
//   migrate-quantity-tiers  1,110 quantity-scoped price rows created
//   migrate-price-units     1,338 price rows divided by 100
//
// Neither touched `product.metadata`. quantity_tiers was deliberately excluded
// from both, migrate-quantity-tiers USED it as its unit oracle precisely
// because it was known to be untouched. Correct for that purpose, but nobody
// traced it forward. The result:
//
//   tech-pouch  variant calculated_amount : 32.00                    MAJOR
//               metadata.quantity_tiers   : [3200, 2944, 2720, 2496] MINOR
//
// The PDP computes its quantity-select display prices from that metadata, so it
// advertises GBP 3,200.00/piece while the cart charges GBP 32.00. Same class of
// defect the whole effort removed, relocated into metadata, across 22 products.
//
// -----------------------------------------------------------------------------
// HOW THE NEW VALUES ARE DERIVED: NOT BY DIVIDING BY 100
// -----------------------------------------------------------------------------
// A blind divide-by-100 would be one more unverified arithmetic assumption on a
// catalogue that has now produced three unit defects. Instead each rung's new
// value is ASKED OF THE PRICING MODULE, at that rung's own quantity, through
// the same call the cart makes:
//
//     pricing.calculatePrices(
//       { id: [priceSetId] },
//       { context: { currency_code: "gbp", quantity: rung.quantity } }
//     ).calculated_amount
//
// (@medusajs/core-flows/dist/cart/workflows/get-variants-and-items-with-prices.js
//  assigns exactly this field to the line item's unit_price.)
//
// So after this migration `metadata.quantity_tiers[i].unit_amount` is BY
// CONSTRUCTION the number the cart will charge at that quantity. It stops being
// an independent price and becomes a cached projection of the price table.
//
// The naive divide is still computed, and the two must AGREE within a
// half-penny, or the product is refused. Two independent derivations, no
// tie-break. A disagreement means metadata and prices have genuinely diverged
// for that product, and dividing would cement a wrong number into the page.
//
// Every variant of a product is probed, not just the first, and they must all
// resolve identically at every rung, that is the assumption
// migrate-quantity-tiers made when it treated the ladder as product-level, and
// it is re-checked here rather than inherited.
//
// -----------------------------------------------------------------------------
// !! THE ORACLE HAS INVERTED: READ THIS BEFORE TRUSTING ANY OLDER COMMENT !!
// -----------------------------------------------------------------------------
// `migrate-quantity-tiers.ts` documents this test:
//
//     ratio = tiers[0].unit_amount / live_gbp_base
//       1   -> live prices MINOR, price-units not yet applied
//       100 -> live prices MAJOR, price-units already applied
//
// That comment describes a world that no longer exists, and a future reader
// WILL be misled by it. It was written when metadata was the fixed reference
// and the price table was the thing that moved. Both have now moved, in
// opposite directions:
//
//   state                                   ratio   meaning
//   ------------------------------------------------------------------------
//   before either migration                 1       both minor, consistent
//   after price-units, before THIS one      100     prices major, metadata
//                                                   minor, THE CURRENT BUG
//   after THIS migration                    1       both major, consistent
//
// So ratio 1 is ambiguous on its own: it means "consistent" both before the
// whole effort and after it. Magnitude cannot separate those two worlds, and
// that is exactly the trap this codebase keeps falling into.
//
// WHAT A FUTURE READER SHOULD CHECK INSTEAD: the unambiguous test is not a
// ratio at all, it is whether quantity-scoped price rows exist:
//
//     SELECT count(*) FROM price
//      WHERE deleted_at IS NULL AND min_quantity IS NOT NULL;
//
//     0    -> migrate-quantity-tiers has not run. ratio 1 means "both minor".
//     >0   -> it has run. ratio 1 means "both major, consistent"; ratio 100
//             means metadata is stale and THIS migration is what you want.
//
// This script uses that test, plus both migration ledgers, plus the per-rung
// resolution above. It refuses to run unless all of them agree.
//
// -----------------------------------------------------------------------------
// IS METADATA THE RIGHT HOME FOR THIS AT ALL? NO. SEE THE REPORT AT THE END.
// -----------------------------------------------------------------------------
// This migration fixes the values. It does not fix the architecture that keeps
// producing this defect: two sources of truth for one price, kept in step by
// hand. The recommended structural fix is a ~40-line custom Store route; the
// argument is at the bottom of this header. Read it before the next reseed.
//
// -----------------------------------------------------------------------------
// IDEMPOTENCY AND ROLLBACK
// -----------------------------------------------------------------------------
// The ledger (`gms_tier_metadata_unit_migration`) stores each product's ENTIRE
// original `quantity_tiers` array as jsonb, so rollback restores the recorded
// original verbatim rather than multiplying back, which would be lossy for any
// value that is not a clean multiple of 100 (24.96 * 100 is fine; a future
// 24.955 would not be). A run aborts if the ledger holds active rows.
//
// Writes touch ONLY the `quantity_tiers` key, via
// jsonb_set(metadata, '{quantity_tiers}', ...). Every other metadata key
// (moq, techniques, print_locations, chips, badges, mockup_*) is preserved
// byte-for-byte by the database, not by this script re-serialising it.
//
// -----------------------------------------------------------------------------
// REPORT: SHOULD metadata.quantity_tiers EXIST AT ALL? NO: SHIP BOTH, IN ORDER
// -----------------------------------------------------------------------------
// Asked directly: is metadata the right home for these prices? No. It is the
// reason this defect exists, and it will cause a third one.
//
// WHY IT GOT USED. Not carelessness, a real gap. The PDP needs a per-quantity
// price to draw its ladder, and the Store API will not give it one.
// @medusajs/medusa/dist/api/utils/middlewares/products/set-pricing-context.js
// builds the entire pricing context as:
//
//     const pricingContext = { region_id: region.id, currency_code: region.currency_code }
//     // + customer.groups when authenticated
//
// There is no `quantity` query parameter on /store/products or
// /store/product-variants. So `variant.calculated_price` is ALWAYS the
// quantity-1 price. Metadata was the workaround, and as a workaround it was
// reasonable. What is not reasonable is keeping it now that
// price.min_quantity/max_quantity holds the same numbers with a resolver behind
// them.
//
// THE COST OF THE DUPLICATION, measured on this catalogue today:
//   defect 1  the ladder was advertised but never charged   (fixed by
//             migrate-quantity-tiers: 1,110 price rows)
//   defect 2  metadata kept minor units while prices became major   (this
//             script)
// Two defects, one day, same root cause: one number, two homes, synchronised by
// hand. There is no rules engine behind metadata, no currency dimension (the
// ladder is GBP-only while every variant is priced in three), and nothing that
// fails when the two drift, they just quietly disagree on a customer's screen.
//
// WHAT I WOULD SHIP, and what it costs:
//
//   NOW: this migration. It is the only thing that fixes the live page today,
//   it is reversible, and it does not require a storefront deploy. Ship it.
//
//   NEXT: a custom Store route, and then metadata stops holding prices.
//   Roughly 40 lines in src/api/store/products/[id]/tier-prices/route.ts:
//
//     1. Read the variant's price_set_id.
//     2. SELECT DISTINCT min_quantity FROM price WHERE price_set_id = $1
//          AND deleted_at IS NULL AND min_quantity IS NOT NULL
//        -> the breakpoints come from the price rows themselves.
//     3. For each breakpoint (plus 1), call
//          pricingModule.calculatePrices({ id: [priceSetId] },
//            { context: { currency_code, region_id, quantity } })
//        and return { quantity, unit_amount: calculated_amount }.
//
//   One request, no N+1, and the PDP renders exactly what the cart will charge
//   because it asked the same resolver the same question. Both halves of the
//   screen then have one source of truth.
//
//   Cost, honestly: ~40 lines of route, a small storefront change to call it
//   instead of reading metadata, and a cache decision (these are per-region and
//   change only when prices change). Against that: metadata.quantity_tiers
//   stops holding money entirely, it keeps at most the breakpoints, or is
//   deleted outright once the route derives them from the price rows. That is
//   the version I would actually want to own.
//
//   I am NOT folding that route into this script. It is a storefront-visible
//   behaviour change and this is a data migration; landing them together would
//   make a bad rollback story. Sequence them.
//
// -----------------------------------------------------------------------------
// !! THE NEXT RESEED WILL REINTRODUCE A DEFECT: FIX seed-merchery-metadata !!
// -----------------------------------------------------------------------------
// seed-merchery-metadata.ts:317-325 builds the ladder as
//
//     unit_amount: Math.round(baseUnitAmount * (1 - discount))
//
// where baseUnitAmount comes from the LIVE gbp price (line ~360, via
// query.graph on variants.price_set.prices.amount). That base is now MAJOR
// (89, not 8900), so a reseed today would:
//
//   * write MAJOR units, which is now correct, the script is accidentally
//     self-correcting on scale; but
//   * Math.round() them to WHOLE POUNDS. Math.round(89 * 0.95) = 85, not 84.55.
//     Every rung would lose its pence, and the metadata ladder would once again
//     disagree with the price table, by up to 99p per unit, at 400 units.
//
// So a reseed does not restore the old 100x bug; it introduces a new rounding
// bug. Either drop the Math.round and keep two decimals, or better, stop
// deriving prices there at all once the Store route above exists.
// =============================================================================

import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

const LEDGER = "gms_tier_metadata_unit_migration"

/** Ledgers of the two migrations that must already have run. Read only. */
const TIER_LEDGER = "gms_quantity_tier_migration"
const PRICE_UNIT_LEDGER = "gms_price_unit_migration"

const CONFIRM_VAR = "MIGRATE_TIER_METADATA_CONFIRM"
const CONFIRM_VALUE = "I-UNDERSTAND-THIS-REWRITES-PRODUCT-METADATA"

/** The ladder is authored in GBP; the PDP renders GBP figures from it. */
const SOURCE_CURRENCY = "gbp"

/** Expected scale between stale metadata and migrated prices. */
const DIVISOR = 100

/**
 * Tolerance when cross-checking the resolver's answer against the naive
 * divide. Half a penny: tighter than any legitimate rounding, loose enough to
 * absorb float representation of values like 84.55.
 */
const EPSILON = 0.005

type TierEntry = { quantity: number; unit_amount: number }

type PlannedProduct = {
  id: string
  handle: string
  before: TierEntry[]
  after: TierEntry[]
  variantsProbed: number
}

// -----------------------------------------------------------------------------

export default async function migrateTierMetadataUnits({
  container,
  args,
}: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const knex: any = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const pricing: any = container.resolve(Modules.PRICING)

  const argv: string[] = [...(args ?? []), ...process.argv.slice(2)]
  const hasFlag = (n: string) => argv.includes(`--${n}`) || argv.includes(n)
  const apply = hasFlag("apply")
  const rollback = hasFlag("rollback")
  const confirmed = process.env[CONFIRM_VAR] === CONFIRM_VALUE

  const readOpt = (n: string): string | null => {
    const hit = argv.find((a) => a.startsWith(`--${n}=`) || a.startsWith(`${n}=`))
    return hit ? hit.slice(hit.indexOf("=") + 1) : null
  }
  const onlyHandles = (readOpt("only") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)

  const say = (m = "") => logger.info(`[migrate-tier-metadata-units] ${m}`)
  const warn = (m: string) => logger.warn(`[migrate-tier-metadata-units] ${m}`)
  const fail: (m: string) => never = (m: string) => {
    logger.error(`[migrate-tier-metadata-units] ABORT: ${m}`)
    throw new Error(m)
  }

  if (apply && rollback) fail("--apply and --rollback are mutually exclusive.")

  say("=".repeat(96))
  say(`mode: ${rollback ? "ROLLBACK" : apply ? "APPLY" : "DRY RUN"}`)
  if (onlyHandles.length) say(`--only: ${onlyHandles.join(", ")}`)
  say("=".repeat(96))

  // ---------------------------------------------------------------------------
  // 0) Ledger helpers.
  // ---------------------------------------------------------------------------
  const tableExists = async (t: string): Promise<boolean> => {
    const r = await knex.raw(`SELECT to_regclass(?) AS t`, [`public.${t}`])
    return Boolean(r?.rows?.[0]?.t)
  }

  const ensureLedger = async (trx: any) => {
    await trx.raw(`
      CREATE TABLE IF NOT EXISTS ${LEDGER} (
        id              BIGSERIAL PRIMARY KEY,
        run_id          TEXT        NOT NULL,
        product_id      TEXT        NOT NULL,
        product_handle  TEXT        NOT NULL,
        tiers_before    JSONB       NOT NULL,
        tiers_after     JSONB       NOT NULL,
        divisor         INTEGER     NOT NULL,
        applied_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
        rolled_back_at  TIMESTAMPTZ
      )
    `)
    await trx.raw(
      `CREATE INDEX IF NOT EXISTS ${LEDGER}_active_idx
         ON ${LEDGER} (product_id) WHERE rolled_back_at IS NULL`,
    )
  }

  const activeLedgerRows = async (): Promise<any[]> => {
    if (!(await tableExists(LEDGER))) return []
    const r = await knex.raw(
      `SELECT * FROM ${LEDGER} WHERE rolled_back_at IS NULL ORDER BY id`,
    )
    return r?.rows ?? []
  }

  // ---------------------------------------------------------------------------
  // ROLLBACK PATH
  // ---------------------------------------------------------------------------
  if (rollback) {
    const rows = await activeLedgerRows()
    if (!rows.length) {
      say("ledger holds no active migration, nothing to roll back.")
      return
    }
    say(`ledger holds ${rows.length} product(s).`)
    say("")
    say("  handle                          restoring first rung   current first rung")
    say("  " + "-".repeat(76))

    const live = await knex.raw(
      `SELECT id, handle, metadata->'quantity_tiers' AS tiers
         FROM product WHERE id = ANY(?)`,
      [rows.map((r: any) => r.product_id)],
    )
    const liveById = new Map(live.rows.map((r: any) => [r.id, r]))
    const missing: string[] = []

    for (const r of rows) {
      const l: any = liveById.get(r.product_id)
      if (!l) {
        missing.push(r.product_handle)
        continue
      }
      const beforeFirst = (r.tiers_before ?? [])[0]?.unit_amount
      const currentFirst = ((l.tiers ?? []) as TierEntry[])[0]?.unit_amount
      say(
        `  ${String(r.product_handle).padEnd(30)} ${String(beforeFirst).padStart(20)} ` +
          `${String(currentFirst).padStart(20)}`,
      )
    }
    if (missing.length) {
      warn(
        `${missing.length} recorded product(s) no longer exist: ${missing.join(", ")}. ` +
          `They will be skipped and their ledger rows closed.`,
      )
    }
    say("")

    if (!confirmed) {
      warn(
        `refusing to roll back: set ${CONFIRM_VAR}=${CONFIRM_VALUE} to proceed. ` +
          `Nothing was changed.`,
      )
      return
    }

    let restored = 0
    await knex.transaction(async (trx: any) => {
      for (const r of rows) {
        if (!liveById.has(r.product_id)) continue
        await trx.raw(
          `UPDATE product
              SET metadata = jsonb_set(
                    COALESCE(metadata, '{}'::jsonb), '{quantity_tiers}', ?::jsonb, true
                  ),
                  updated_at = now()
            WHERE id = ?`,
          [JSON.stringify(r.tiers_before), r.product_id],
        )
        restored++
      }
      await trx.raw(
        `UPDATE ${LEDGER} SET rolled_back_at = now() WHERE rolled_back_at IS NULL`,
      )
    })

    say(`ROLLED BACK: restored quantity_tiers on ${restored} product(s).`)
    say(
      "Reminder: this restores metadata only. It does not touch the price table, " +
        "so the PDP will again quote 100x what the cart charges.",
    )
    return
  }

  // ---------------------------------------------------------------------------
  // 1) Guard: already applied?
  // ---------------------------------------------------------------------------
  const existing = await activeLedgerRows()
  if (existing.length) {
    fail(
      `ledger '${LEDGER}' already holds ${existing.length} active row(s), this ` +
        `migration appears to have been applied on ${existing[0]?.applied_at}. ` +
        `Re-running would divide by ${DIVISOR} a second time. Roll back first ` +
        `(--rollback) if you need to re-apply.`,
    )
  }

  // ---------------------------------------------------------------------------
  // 2) PRECONDITIONS. Three independent signals; all must agree.
  //
  //    This migration only makes sense in exactly one world: quantity-scoped
  //    price rows exist AND prices have been rescaled to major AND metadata has
  //    not. Anything else and we do not know what we are looking at.
  // ---------------------------------------------------------------------------
  const { rows: qtyScopedRows } = await knex.raw(
    `SELECT count(*)::int AS n FROM price
      WHERE deleted_at IS NULL AND min_quantity IS NOT NULL`,
  )
  const qtyScopedCount = qtyScopedRows?.[0]?.n ?? 0

  const ledgerCount = async (t: string): Promise<number | null> => {
    if (!(await tableExists(t))) return null
    const { rows } = await knex.raw(
      `SELECT count(*)::int AS n FROM ${t} WHERE rolled_back_at IS NULL`,
    )
    return rows?.[0]?.n ?? 0
  }
  const tierLedgerN = await ledgerCount(TIER_LEDGER)
  const unitLedgerN = await ledgerCount(PRICE_UNIT_LEDGER)

  say("")
  say("-".repeat(96))
  say("PRECONDITIONS")
  say("-".repeat(96))
  say(`  quantity-scoped price rows live            : ${qtyScopedCount}`)
  say(`  ${TIER_LEDGER} active rows   : ${tierLedgerN ?? "TABLE ABSENT"}`)
  say(`  ${PRICE_UNIT_LEDGER} active rows      : ${unitLedgerN ?? "TABLE ABSENT"}`)

  if (qtyScopedCount === 0) {
    fail(
      `no quantity-scoped price rows exist. migrate-quantity-tiers.ts has not ` +
        `run (or was rolled back), so metadata.quantity_tiers is still the ONLY ` +
        `representation of the ladder and dividing it would break the PDP ` +
        `without anything to replace it. Run that migration first.`,
    )
  }
  if (!unitLedgerN) {
    fail(
      `migrate-price-units.ts has not been applied (${PRICE_UNIT_LEDGER} ` +
        `${unitLedgerN === null ? "does not exist" : "holds no active rows"}). ` +
        `Then prices are still MINOR and metadata already agrees with them, ` +
        `there is nothing to fix, and dividing metadata would CREATE the very ` +
        `defect this script exists to remove.`,
    )
  }
  if (!tierLedgerN) {
    warn(
      `${TIER_LEDGER} holds no active rows even though ${qtyScopedCount} ` +
        `quantity-scoped price row(s) exist. The tier rows may have been created ` +
        `by hand. Proceeding, the per-rung resolution below verifies every ` +
        `value against the live price table regardless of who wrote it.`,
    )
  }

  // ---------------------------------------------------------------------------
  // 3) Load scope.
  // ---------------------------------------------------------------------------
  const { rows: products } = await knex.raw(`
    SELECT p.id, p.handle, p.metadata->'quantity_tiers' AS tiers
      FROM product p
     WHERE p.deleted_at IS NULL AND p.metadata ? 'quantity_tiers'
     ORDER BY p.handle
  `)
  const scoped = onlyHandles.length
    ? products.filter((p: any) => onlyHandles.includes(p.handle))
    : products

  if (onlyHandles.length) {
    const miss = onlyHandles.filter(
      (h) => !products.some((p: any) => p.handle === h),
    )
    if (miss.length) {
      fail(`--only named unknown handle(s): ${miss.join(", ")}`)
    }
  }
  if (!scoped.length) {
    say("no product carries metadata.quantity_tiers, nothing to do.")
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

  // ---------------------------------------------------------------------------
  // 4) Plan. Every value comes from the pricing module and is cross-checked
  //    against the naive divide.
  // ---------------------------------------------------------------------------
  const planned: PlannedProduct[] = []
  const alreadyConsistent: string[] = []

  for (const p of scoped) {
    const before = normaliseTiers(p.tiers)
    if (!before) {
      fail(
        `${p.handle}: metadata.quantity_tiers is not a non-empty array of ` +
          `{ quantity, unit_amount } numbers. Refusing to guess its shape.`,
      )
    }

    const vrows = variantRows.filter((r: any) => r.handle === p.handle)
    if (!vrows.length) {
      fail(
        `${p.handle}: carries quantity_tiers but has no live variant with a ` +
          `price set. Nothing to resolve prices against.`,
      )
    }

    const after: TierEntry[] = []
    let productConsistent = true

    for (const rung of before) {
      // Resolve at this rung's quantity, for EVERY variant. They must agree.
      const resolvedPerVariant: number[] = []
      for (const v of vrows) {
        const res = await pricing.calculatePrices(
          { id: [v.price_set_id] },
          { context: { currency_code: SOURCE_CURRENCY, quantity: rung.quantity } },
        )
        const amt = res?.[0]?.calculated_amount
        if (amt === undefined || amt === null) {
          fail(
            `${p.handle} / ${v.variant_id}: pricing module returned no ` +
              `${SOURCE_CURRENCY.toUpperCase()} price at quantity ${rung.quantity}. The variant may ` +
              `not be priced in that currency.`,
          )
        }
        resolvedPerVariant.push(Number(amt))
      }

      const distinct = [...new Set(resolvedPerVariant.map((n) => n.toFixed(6)))]
      if (distinct.length !== 1) {
        fail(
          `${p.handle}: its variants resolve to DIFFERENT prices at quantity ` +
            `${rung.quantity} (${distinct.join(", ")}). quantity_tiers is a single ` +
            `product-level ladder, so it cannot faithfully represent variants ` +
            `that are priced differently. Re-scope by hand.`,
        )
      }
      const resolved = resolvedPerVariant[0]

      // Independent derivation: the naive divide. Must agree.
      const naive = rung.unit_amount / DIVISOR
      if (Math.abs(resolved - naive) > EPSILON) {
        fail(
          `${p.handle} rung qty ${rung.quantity}: the pricing module resolves ` +
            `${resolved} but metadata/${DIVISOR} is ${naive}. The two derivations ` +
            `disagree, which means metadata and the price table have genuinely ` +
            `diverged for this product rather than merely differing by scale. ` +
            `Writing either number would cement a guess. Reconcile by hand.`,
        )
      }

      if (Math.abs(resolved - rung.unit_amount) > EPSILON) productConsistent = false
      after.push({ quantity: rung.quantity, unit_amount: resolved })
    }

    if (productConsistent) {
      alreadyConsistent.push(p.handle)
      continue
    }
    planned.push({
      id: p.id,
      handle: p.handle,
      before,
      after,
      variantsProbed: vrows.length,
    })
  }

  // ---------------------------------------------------------------------------
  // 5) Before/after report.
  // ---------------------------------------------------------------------------
  say("")
  say("-".repeat(96))
  say(`PRODUCTS TO REWRITE: ${planned.length}   (already consistent: ${alreadyConsistent.length})`)
  say("-".repeat(96))
  for (const p of planned) {
    say(`  ${p.handle}   (${p.variantsProbed} variant(s) probed, all agreed)`)
    say(
      `      qty      before ->     after      (before/after ratio)`,
    )
    for (let i = 0; i < p.before.length; i++) {
      const b = p.before[i].unit_amount
      const a = p.after[i].unit_amount
      say(
        `      ${String(p.before[i].quantity).padStart(5)} ${b.toFixed(2).padStart(11)} -> ` +
          `${a.toFixed(2).padStart(9)}      ${(b / a).toFixed(2)}x`,
      )
    }
  }
  if (alreadyConsistent.length) {
    say("")
    say(`  ALREADY CONSISTENT (left untouched): ${alreadyConsistent.join(", ")}`)
  }

  say("")
  say("ROW COUNTS")
  say(`  products carrying quantity_tiers  ${scoped.length}`)
  say(`  products to rewrite               ${planned.length}`)
  say(`  rungs to rewrite                  ${planned.reduce((n, p) => n + p.after.length, 0)}`)
  say(`  pricing-module probes performed   ${scoped.reduce((n: number, p: any) => {
    const t = normaliseTiers(p.tiers)
    const v = variantRows.filter((r: any) => r.handle === p.handle).length
    return n + (t ? t.length * v : 0)
  }, 0)}   (read-only)`)

  // ---------------------------------------------------------------------------
  // 6) Gates.
  // ---------------------------------------------------------------------------
  say("")
  if (!apply) {
    say("DRY RUN. Nothing was changed.")
    say(
      `To apply: ${CONFIRM_VAR}=${CONFIRM_VALUE} ` +
        `npx medusa exec ./src/scripts/migrate-tier-metadata-units.ts -- --apply`,
    )
    say("")
    say("AFTER APPLYING, re-run the read-only proof:")
    say("  npx medusa exec ./src/scripts/verify-tier-resolution.ts -- --currencies=gbp,eur,usd")
    say("  Its 'metadata says' column must then equal 'resolved'.")
    return
  }
  if (!confirmed) {
    fail(
      `--apply was passed but ${CONFIRM_VAR} is not set to the expected value. ` +
        `Both are required. Nothing was changed.`,
    )
  }
  if (!planned.length) {
    say("nothing to rewrite, every ladder already matches the price table.")
    return
  }

  // ---------------------------------------------------------------------------
  // 7) Apply, in ONE transaction. Only the quantity_tiers key is replaced;
  //    the database preserves every other metadata key untouched.
  // ---------------------------------------------------------------------------
  const runId = `run_${Date.now()}`
  let written = 0

  await knex.transaction(async (trx: any) => {
    await ensureLedger(trx)
    for (const p of planned) {
      await trx.raw(
        `INSERT INTO ${LEDGER}
           (run_id, product_id, product_handle, tiers_before, tiers_after, divisor)
         VALUES (?, ?, ?, ?::jsonb, ?::jsonb, ?)`,
        [
          runId,
          p.id,
          p.handle,
          JSON.stringify(p.before),
          JSON.stringify(p.after),
          DIVISOR,
        ],
      )
      await trx.raw(
        `UPDATE product
            SET metadata = jsonb_set(
                  COALESCE(metadata, '{}'::jsonb), '{quantity_tiers}', ?::jsonb, true
                ),
                updated_at = now()
          WHERE id = ?`,
        [JSON.stringify(p.after), p.id],
      )
      written++
    }
  })

  say(`APPLIED: rewrote quantity_tiers on ${written} product(s).`)
  say(`ledger run_id = ${runId} (table ${LEDGER}): this is the rollback source.`)
  say("")
  say("VERIFY NOW:")
  say("  npx medusa exec ./src/scripts/verify-tier-resolution.ts -- --currencies=gbp,eur,usd")
  say("  Expect: scale [1], and 'metadata says' equal to 'resolved' on every row.")
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/** Validate and sort quantity_tiers. Returns null on any unexpected shape. */
function normaliseTiers(raw: unknown): TierEntry[] | null {
  if (!Array.isArray(raw) || !raw.length) return null
  const out: TierEntry[] = []
  for (const e of raw) {
    if (!e || typeof e !== "object") return null
    const q = (e as any).quantity
    const a = (e as any).unit_amount
    if (typeof q !== "number" || !Number.isInteger(q) || q < 1) return null
    if (typeof a !== "number" || !Number.isFinite(a) || a <= 0) return null
    out.push({ quantity: q, unit_amount: a })
  }
  return out.sort((x, y) => x.quantity - y.quantity)
}
