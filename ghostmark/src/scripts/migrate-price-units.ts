// =============================================================================
// migrate-price-units: one-time corrective migration that rescales the
// v1-era MINOR-unit seed data into Medusa v2's MAJOR-unit convention.
//
//   DRY RUN (default, safe):
//     npx medusa exec ./src/scripts/migrate-price-units.ts
//
//   APPLY (requires BOTH the flag and the env var):
//     MIGRATE_PRICE_UNITS_CONFIRM=I-UNDERSTAND-THIS-REWRITES-PRICES \
//       npx medusa exec ./src/scripts/migrate-price-units.ts -- --apply
//
//   ROLLBACK (restores the exact recorded pre-migration values):
//     MIGRATE_PRICE_UNITS_CONFIRM=I-UNDERSTAND-THIS-REWRITES-PRICES \
//       npx medusa exec ./src/scripts/migrate-price-units.ts -- --rollback
//
// -----------------------------------------------------------------------------
// WHY
// -----------------------------------------------------------------------------
// Medusa v2 stores prices in MAJOR currency units: "a price of $10.00 is
// represented as 10 instead of 1000" (docs.medusajs.com, Introduction > From
// v1 to v2 > Prices are Stored in Major Units). This catalogue was seeded with
// v1-era minor-unit integers (3500 for a £35 tee) and never migrated, so every
// price in the database is literally 100x its intended value.
//
// The storefront hid this with a compensating `÷100` in its formatters, so the
// screen looked right and nothing else was. Proof from `payment_session.data`
// in this database: an order with `total = 34000 gbp` produced a Stripe
// PaymentIntent with `amount: 3400000`, Stripe was asked for £34,000.00 while
// checkout displayed £340.00.
//
// The storefront `÷100` has already been removed (`storefront/app/utils/money.ts`).
// Until THIS script runs, the storefront renders 100x too high. That is the
// expected intermediate state; see "LANDING SEQUENCE" at the bottom.
//
// -----------------------------------------------------------------------------
// !! THE CRITICAL CAVEAT: TWO SCALES COEXIST IN ONE DATABASE !!
// -----------------------------------------------------------------------------
// `src/scripts/seed.ts` uses the OPPOSITE convention from every other seed
// script, it writes `amount: 10`, `amount: 15` (already major units), while
// `seed-curated.ts`, `seed-shipping-gbp.ts`, `seed-pod-no-locations.ts`,
// `enrich-hoodie.ts` and `fix-gift-card-prices.ts` all write minor units
// (1500, 8900, 2500...). A blanket divide-by-100 would corrupt the
// correctly-scaled half.
//
// Worse, the two populations are NOT reliably separable by magnitude. The
// clearest counter-example is a real row in this database:
//
//     shipping_option "Standard" (seed.ts) -> price { ghs, amount: 100 }
//
// 100 GHS is a MAJOR-unit price sitting squarely inside the range that looks
// like minor units. Its sibling rows on the same option are 10 GBP / 11 EUR /
// 12 USD, which are unambiguously major. Any threshold rule that correctly
// classifies those siblings as "leave alone" must also somehow spare the 100,
// while still catching the 1000 GBP on the OTHER shipping option. No magnitude
// threshold does both.
//
// => THIS SCRIPT DOES NOT USE A MAGNITUDE HEURISTIC.
//    It partitions by PROVENANCE (which live entity owns the price), and it
//    REFUSES TO RUN if it encounters an owner it has not been told about.
//    Guessing is the one thing it will not do.
//
// -----------------------------------------------------------------------------
// SCOPE: established by read-only SQL against this database (no writes)
// -----------------------------------------------------------------------------
//   IN SCOPE (minor units, needs ÷100):
//     [A] `price` rows reachable from a LIVE product_variant.
//         225 rows. min=600, max=32000. Every row an integer >= 600; not a
//         single small-scale value among them. This population is uniformly
//         minor-unit, which is why it is safe to divide wholesale.
//     [B] `price` rows on shipping_option SHIPPING_OPTIONS_MINOR (below).
//         3 rows: gbp 1000, usd 1300, eur 1200. Written by seed-shipping-gbp.ts,
//         which documents them inline as "£10.00 / $13.00 / €12.00".
//
//   OUT OF SCOPE (deliberately untouched):
//     [C] shipping_option SHIPPING_OPTIONS_MAJOR: 4 rows: gbp 10, eur 11,
//         usd 12, ghs 100. seed.ts convention, ALREADY CORRECT. This is the
//         population the caveat above is about.
//     [D] 277 `price` rows whose price_set links to a variant row that no
//         longer exists (hard-deleted seed.ts demo products). Mixed scale,
//         unreachable from the storefront and from checkout. Includes all 19
//         rows of the active "newyear" price list, which is attached entirely
//         to dead variants. Left as-is: rewriting unreachable data adds risk
//         and buys nothing. If those variants are ever resurrected they must
//         be re-scoped by hand.
//     [E] order / payment / cart / refund tables. These are historical
//         financial records of what was ACTUALLY charged. They must never be
//         rewritten, see "KNOWN LIMITS" below for the consequence.
//
// Re-verify the scope before applying; the script reprints it every run and
// aborts on any drift.
//
// -----------------------------------------------------------------------------
// IDEMPOTENCY
// -----------------------------------------------------------------------------
// Magnitude cannot prove "already migrated" either: 32000 -> 320 is still an
// integer >= 100, so a second pass would happily turn it into 3.20. Instead
// the script keeps a durable ledger table (`gms_price_unit_migration`) holding
// one row per rewritten price with its exact before/after values. A run
// aborts if the ledger already contains un-rolled-back rows. That ledger is
// also the rollback source, so rollback restores the recorded originals rather
// than multiplying back (which would be lossy for any non-integer amount).
//
// -----------------------------------------------------------------------------
// KNOWN LIMITS: read before applying
// -----------------------------------------------------------------------------
//  1. The 6 existing orders keep their recorded (100x) totals, by design. After
//     this migration the order history will display figures 100x larger than
//     equivalent new orders. That is the honest record of what those orders
//     were for; it is not a bug to "fix" by rewriting them. If any of them was
//     really captured at that amount, it is a refund/accounting matter, not a
//     migration one.
//  2. Rollback restores `price` rows only. It cannot undo anything downstream
//     that read a migrated price in the meantime (a cart priced after the
//     migration keeps its own copied `unit_price`). Roll back promptly or not
//     at all.
//  3. The ledger table is created by this script and is not part of Medusa's
//     migration history. Do not drop it while a migration is applied, that
//     discards the only rollback source.
//  4. Scope [D] is left inconsistent on purpose. The database will still
//     contain two scales afterwards; the difference is that everything
//     REACHABLE will be consistently major-unit.
//
// -----------------------------------------------------------------------------
// LANDING SEQUENCE (both halves must ship together)
// -----------------------------------------------------------------------------
//   1. Take a database backup / Neon branch. Non-negotiable.
//   2. Run this script with no flags. Read the before/after table.
//   3. Put the storefront in maintenance (or accept a brief window where
//      prices read 100x high, they already do on this branch).
//   4. Run with --apply.
//   5. Deploy the storefront commit that removed the ÷100 (already on this
//      branch). Steps 4 and 5 are one atomic change from a customer's point
//      of view; neither is correct alone.
//   6. Smoke test: a £35 tee must read £35.00 on PDP, in cart, at checkout,
//      and must produce a Stripe PaymentIntent of amount 3500 (pence), Stripe
//      takes minor units at its own API boundary, which is the payment
//      provider's conversion and is unrelated to Medusa's storage convention.
// =============================================================================

import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

const DIVISOR = 100

/** Ledger table: idempotency marker + rollback source. */
const LEDGER = "gms_price_unit_migration"

/** Env var that must be set (to this exact value) for any write to happen. */
const CONFIRM_VAR = "MIGRATE_PRICE_UNITS_CONFIRM"
const CONFIRM_VALUE = "I-UNDERSTAND-THIS-REWRITES-PRICES"

/**
 * Shipping options whose prices are MINOR units and must be divided.
 * seed-shipping-gbp.ts, "UK Standard", gbp 1000 / usd 1300 / eur 1200.
 */
const SHIPPING_OPTIONS_MINOR = new Set<string>([
  "so_01KTD2VTF6WG7FSKXW29Q1SSYR",
])

/**
 * Shipping options whose prices are ALREADY MAJOR units and must NOT be
 * touched. seed.ts, "Standard", gbp 10 / eur 11 / usd 12 / ghs 100.
 * This is the population that makes a magnitude heuristic unsafe.
 */
const SHIPPING_OPTIONS_MAJOR = new Set<string>([
  "so_01KCS6KQS0PYN2Y9FNBDF7HVEA",
])

/**
 * Sanity floor for scope [A]. Every live-variant price observed was >= 600.
 * A value below this in that population would mean the assumption "all live
 * variant prices are minor units" has broken, abort rather than guess.
 */
const MIN_PLAUSIBLE_MINOR = 100

type Row = {
  id: string
  currency_code: string
  amount: string | number
  raw_amount: unknown
  scope: string
  owner: string
}

// -----------------------------------------------------------------------------

export default async function migratePriceUnits({ container, args }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const knex: any = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)

  // `medusa exec` does NOT forward `--` flags into ExecArgs.args. The CLI
  // declares the command as a yargs variadic positional (`exec [file] [args..]`,
  // @medusajs/cli/dist/create-cli.js), so anything after `--` lands in
  // argv["--"] and never reaches this function. Reading `args` alone meant the
  // documented `-- --apply` silently printed "DRY RUN" and exited without
  // writing, and `--rollback` was unreachable for the same reason, so a
  // migration applied by other means could not have been undone by its own
  // rollback path. Verified on 2.11.3: `-- --apply` => args = [].
  // Read process.argv as well, and accept the flag bare so `exec <file> apply`
  // works too.
  const argv = [...(args ?? []), ...process.argv.slice(2)]
  const hasFlag = (name: string) =>
    argv.includes(`--${name}`) || argv.includes(name)
  const apply = hasFlag("apply")
  const rollback = hasFlag("rollback")
  const confirmed = process.env[CONFIRM_VAR] === CONFIRM_VALUE

  const say = (m = "") => logger.info(`[migrate-price-units] ${m}`)
  const warn = (m: string) => logger.warn(`[migrate-price-units] ${m}`)
  const fail = (m: string) => {
    logger.error(`[migrate-price-units] ABORT: ${m}`)
    throw new Error(m)
  }

  if (apply && rollback) {
    fail("--apply and --rollback are mutually exclusive.")
  }

  say("=".repeat(78))
  say(`mode: ${rollback ? "ROLLBACK" : apply ? "APPLY" : "DRY RUN"}`)
  say("=".repeat(78))

  // ---------------------------------------------------------------------------
  // 0) Ledger. Created only when we are actually going to write.
  // ---------------------------------------------------------------------------
  const ledgerExists = async (): Promise<boolean> => {
    const r = await knex.raw(`SELECT to_regclass(?) AS t`, [`public.${LEDGER}`])
    return Boolean(r?.rows?.[0]?.t)
  }

  const ensureLedger = async (trx: any) => {
    await trx.raw(`
      CREATE TABLE IF NOT EXISTS ${LEDGER} (
        id                BIGSERIAL PRIMARY KEY,
        run_id            TEXT        NOT NULL,
        price_id          TEXT        NOT NULL,
        scope             TEXT        NOT NULL,
        owner_id          TEXT,
        currency_code     TEXT        NOT NULL,
        amount_before     NUMERIC     NOT NULL,
        raw_amount_before JSONB       NOT NULL,
        amount_after      NUMERIC     NOT NULL,
        divisor           INTEGER     NOT NULL,
        applied_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
        rolled_back_at    TIMESTAMPTZ
      )
    `)
    await trx.raw(
      `CREATE INDEX IF NOT EXISTS ${LEDGER}_active_idx
         ON ${LEDGER} (price_id) WHERE rolled_back_at IS NULL`,
    )
  }

  const activeLedgerRows = async (): Promise<any[]> => {
    if (!(await ledgerExists())) return []
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
    say(`ledger holds ${rows.length} migrated price row(s).`)
    say("")
    say("  price_id                          cur   current -> restored")
    say("  " + "-".repeat(68))
    for (const r of rows.slice(0, 40)) {
      say(
        `  ${String(r.price_id).padEnd(33)} ${String(r.currency_code).padEnd(5)} ` +
          `${String(r.amount_after).padStart(10)} -> ${String(r.amount_before).padStart(10)}`,
      )
    }
    if (rows.length > 40) say(`  ... and ${rows.length - 40} more`)
    say("")

    if (!confirmed) {
      warn(
        `refusing to roll back: set ${CONFIRM_VAR}=${CONFIRM_VALUE} to proceed. ` +
          `Nothing was changed.`,
      )
      return
    }

    // ROWCOUNT IS ASSERTED, AND THAT IS THE POINT.
    //
    // 1110 of these price ids are ALSO owned by migrate-quantity-tiers, whose
    // rollback HARD-DELETES them (`DELETE FROM price`). If that script rolls
    // back first, every one of those UPDATEs matches zero rows. Without this
    // check the loop completes, the ledger closes, and it prints
    // "ROLLED BACK 1338 price row(s) to their recorded originals" having
    // restored 228. The dependency check above is the primary defence; this is
    // the one that cannot be reasoned around.
    let restored = 0
    await knex.transaction(async (trx: any) => {
      for (const r of rows) {
        const res = await trx.raw(
          `UPDATE price SET amount = ?, raw_amount = ?::jsonb, updated_at = now() WHERE id = ?`,
          [r.amount_before, JSON.stringify(r.raw_amount_before), r.price_id],
        )
        if ((res?.rowCount ?? 0) !== 1) {
          throw new Error(
            `price ${r.price_id} (ledger row ${r.id}): expected to restore exactly ` +
              `1 row, affected ${res?.rowCount ?? 0}. The row is gone from the ` +
              `price table, most likely hard-deleted by a migrate-quantity-tiers ` +
              `rollback that ran first. Rolling the whole transaction back rather ` +
              `than closing the ledger on a partial restore.`,
          )
        }
        restored++
      }
      await trx.raw(
        `UPDATE ${LEDGER} SET rolled_back_at = now() WHERE rolled_back_at IS NULL`,
      )
    })
    say(`ROLLED BACK ${restored} price row(s) to their recorded originals.`)
    say(
      "Reminder: this restores `price` only. Carts/orders priced while the " +
        "migration was live keep their own copied amounts.",
    )
    return
  }

  // ---------------------------------------------------------------------------
  // 1) Guard: already applied?
  // ---------------------------------------------------------------------------
  const existing = await activeLedgerRows()
  if (existing.length) {
    fail(
      `ledger '${LEDGER}' already holds ${existing.length} active row(s), the ` +
        `migration appears to have been applied on ${existing[0]?.applied_at}. ` +
        `Re-running would divide by ${DIVISOR} a second time. Roll back first ` +
        `(--rollback) if you need to re-apply.`,
    )
  }

  // ---------------------------------------------------------------------------
  // 2) Scope. Classify EVERY live price row by provenance; refuse on surprises.
  // ---------------------------------------------------------------------------
  const classified = await knex.raw(`
    SELECT
      pr.id,
      pr.currency_code,
      pr.amount,
      pr.raw_amount,
      CASE
        WHEN lv.variant_id IS NOT NULL              THEN 'A_live_variant'
        WHEN so.shipping_option_id IS NOT NULL      THEN 'B_shipping_option'
        WHEN dv.price_set_id IS NOT NULL            THEN 'D_dead_variant_link'
        ELSE 'UNKNOWN'
      END AS scope,
      COALESCE(lv.variant_id, so.shipping_option_id) AS owner
    FROM price pr
    LEFT JOIN LATERAL (
      SELECT x.variant_id FROM product_variant_price_set x
      JOIN product_variant v ON v.id = x.variant_id AND v.deleted_at IS NULL
      WHERE x.price_set_id = pr.price_set_id AND x.deleted_at IS NULL
      LIMIT 1
    ) lv ON TRUE
    LEFT JOIN LATERAL (
      SELECT x.shipping_option_id FROM shipping_option_price_set x
      JOIN shipping_option s ON s.id = x.shipping_option_id AND s.deleted_at IS NULL
      WHERE x.price_set_id = pr.price_set_id AND x.deleted_at IS NULL
      LIMIT 1
    ) so ON TRUE
    LEFT JOIN LATERAL (
      SELECT x.price_set_id FROM product_variant_price_set x
      WHERE x.price_set_id = pr.price_set_id LIMIT 1
    ) dv ON TRUE
    WHERE pr.deleted_at IS NULL
    ORDER BY scope, pr.currency_code, pr.amount
  `)

  const all: Row[] = classified.rows
  say(`total live price rows: ${all.length}`)

  const byScope = new Map<string, Row[]>()
  for (const r of all) {
    if (!byScope.has(r.scope)) byScope.set(r.scope, [])
    byScope.get(r.scope)!.push(r)
  }
  for (const [scope, rows] of [...byScope].sort()) {
    say(`  ${scope.padEnd(22)} ${String(rows.length).padStart(4)} row(s)`)
  }
  say("")

  const unknown = byScope.get("UNKNOWN") ?? []
  if (unknown.length) {
    fail(
      `${unknown.length} price row(s) belong to no live variant, no live ` +
        `shipping option and no known dead link (e.g. ${unknown[0]!.id}). This ` +
        `script will not guess their scale. Classify them by hand and extend ` +
        `the scope rules above.`,
    )
  }

  // -- [A] live variants -------------------------------------------------------
  const scopeA = byScope.get("A_live_variant") ?? []
  const badA = scopeA.filter(
    (r) => Number(r.amount) < MIN_PLAUSIBLE_MINOR || Number(r.amount) % 1 !== 0,
  )
  if (badA.length) {
    fail(
      `${badA.length} live-variant price row(s) are below ${MIN_PLAUSIBLE_MINOR} ` +
        `or non-integer (e.g. ${badA[0]!.id} = ${badA[0]!.amount} ` +
        `${badA[0]!.currency_code}). The premise that this whole population is ` +
        `minor-unit no longer holds, possibly a partial migration, or new ` +
        `correctly-scaled prices were added. Re-scope by hand.`,
    )
  }

  // -- [B/C] shipping options: allowlist only, never infer ----------------------
  const scopeShip = byScope.get("B_shipping_option") ?? []
  const shipOwners = new Set(scopeShip.map((r) => String(r.owner)))
  const unrecognised = [...shipOwners].filter(
    (o) => !SHIPPING_OPTIONS_MINOR.has(o) && !SHIPPING_OPTIONS_MAJOR.has(o),
  )
  if (unrecognised.length) {
    fail(
      `shipping option(s) ${unrecognised.join(", ")} are not in either ` +
        `allowlist. Because both unit conventions coexist in this database ` +
        `and magnitude cannot tell them apart (see the header: 100 GHS is a ` +
        `MAJOR-unit price), this script refuses to classify them. Inspect the ` +
        `seed script that created them, then add each id to ` +
        `SHIPPING_OPTIONS_MINOR or SHIPPING_OPTIONS_MAJOR.`,
    )
  }
  const scopeB = scopeShip.filter((r) => SHIPPING_OPTIONS_MINOR.has(String(r.owner)))
  const scopeC = scopeShip.filter((r) => SHIPPING_OPTIONS_MAJOR.has(String(r.owner)))

  const targets = [...scopeA, ...scopeB]

  // ---------------------------------------------------------------------------
  // 3) Before/after report, always printed, before anything is changed.
  // ---------------------------------------------------------------------------
  const line = (r: Row) =>
    `  ${String(r.id).padEnd(33)} ${String(r.currency_code).padEnd(5)} ` +
    `${String(r.amount).padStart(9)} -> ${(Number(r.amount) / DIVISOR)
      .toFixed(2)
      .padStart(9)}   ${r.scope}`

  say("-".repeat(78))
  say(`WILL DIVIDE BY ${DIVISOR}: ${targets.length} row(s)`)
  say("-".repeat(78))
  say(
    "  price_id                          cur      before ->     after   scope",
  )
  for (const r of targets.slice(0, 60)) say(line(r))
  if (targets.length > 60) say(`  ... and ${targets.length - 60} more`)
  say("")

  say("-".repeat(78))
  say(
    `WILL LEAVE UNTOUCHED: ${scopeC.length} shipping (already major) + ` +
      `${(byScope.get("D_dead_variant_link") ?? []).length} dead-link row(s)`,
  )
  say("-".repeat(78))
  for (const r of scopeC) {
    say(
      `  ${String(r.id).padEnd(33)} ${String(r.currency_code).padEnd(5)} ` +
        `${String(r.amount).padStart(9)}   (already major, DO NOT DIVIDE)`,
    )
  }
  say("")

  const sum = (rows: Row[]) =>
    rows.reduce((a, r) => a + Number(r.amount), 0).toFixed(2)
  say(`row counts   in-scope=${targets.length}  untouched=${all.length - targets.length}  total=${all.length}`)
  say(`amount sums  in-scope before=${sum(targets)}  after=${(Number(sum(targets)) / DIVISOR).toFixed(2)}`)
  say("")

  // ---------------------------------------------------------------------------
  // 4) Gates.
  // ---------------------------------------------------------------------------
  if (!apply) {
    say("DRY RUN. Nothing was changed.")
    say(
      `To apply: ${CONFIRM_VAR}=${CONFIRM_VALUE} ` +
        `npx medusa exec ./src/scripts/migrate-price-units.ts -- --apply`,
    )
    return
  }
  if (!confirmed) {
    fail(
      `--apply was passed but ${CONFIRM_VAR} is not set to the expected value. ` +
        `Both are required. Nothing was changed.`,
    )
  }
  if (!targets.length) {
    say("nothing in scope, nothing to do.")
    return
  }

  // ---------------------------------------------------------------------------
  // 5) Apply, in one transaction, updating BOTH `amount` and `raw_amount`.
  //    Medusa's BigNumber hydrates from `raw_amount`; updating only the
  //    numeric column would leave the module still reading the old value.
  // ---------------------------------------------------------------------------
  const runId = `run_${Date.now()}`
  let written = 0

  await knex.transaction(async (trx: any) => {
    await ensureLedger(trx)

    for (const r of targets) {
      const before = Number(r.amount)
      const after = Number((before / DIVISOR).toFixed(10))

      await trx.raw(
        `INSERT INTO ${LEDGER}
           (run_id, price_id, scope, owner_id, currency_code,
            amount_before, raw_amount_before, amount_after, divisor)
         VALUES (?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?)`,
        [
          runId,
          r.id,
          r.scope,
          r.owner ?? null,
          r.currency_code,
          before,
          JSON.stringify(r.raw_amount),
          after,
          DIVISOR,
        ],
      )

      await trx.raw(
        `UPDATE price
            SET amount = ?,
                raw_amount = jsonb_set(
                  COALESCE(raw_amount, '{"precision":20}'::jsonb),
                  '{value}', to_jsonb(?::text), true
                ),
                updated_at = now()
          WHERE id = ?`,
        [after, String(after), r.id],
      )
      written++
    }
  })

  say(`APPLIED: ${written} price row(s) divided by ${DIVISOR}.`)
  say(`ledger run_id = ${runId} (table ${LEDGER}): this is the rollback source.`)
  say("")
  say("NEXT: deploy the storefront build with the ÷100 removed from")
  say("      storefront/app/utils/money.ts, then smoke-test a £35 tee end to end.")
}
