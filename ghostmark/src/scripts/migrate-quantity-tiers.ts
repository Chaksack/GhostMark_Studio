// =============================================================================
// migrate-quantity-tiers: turns `product.metadata.quantity_tiers`, which is
// display-only decoration today, into REAL quantity-scoped `price` rows so the
// cart charges the ladder the product page advertises.
//
//   DRY RUN (default, safe, this is also the analysis pass):
//     npx medusa exec ./src/scripts/migrate-quantity-tiers.ts
//
//   APPLY (requires BOTH the flag and the env var):
//     MIGRATE_QUANTITY_TIERS_CONFIRM=I-UNDERSTAND-THIS-CREATES-PRICE-ROWS \
//       npx medusa exec ./src/scripts/migrate-quantity-tiers.ts -- --apply
//
//   ROLLBACK (deletes exactly the rows this script recorded creating):
//     MIGRATE_QUANTITY_TIERS_CONFIRM=I-UNDERSTAND-THIS-CREATES-PRICE-ROWS \
//       npx medusa exec ./src/scripts/migrate-quantity-tiers.ts -- --rollback
//
//   Optional narrowing (dry run or apply):
//     -- --only=tech-pouch,studio-tee-cream      one or more product handles
//     -- --currencies=gbp                        default: gbp,eur,usd
//
//   !! `medusa exec` SWALLOWS `--` FLAGS, see "Argument parsing" below. This
//   script reads process.argv as well as ExecArgs.args so both of these work:
//
//     npx medusa exec ./src/scripts/migrate-quantity-tiers.ts -- --apply
//     npx medusa exec ./src/scripts/migrate-quantity-tiers.ts apply
//
//   `migrate-price-units.ts` reads ExecArgs.args ONLY, so its documented
//   `-- --apply` and `-- --rollback` are silently ignored and it dry-runs
//   forever. That is a real blocker for the run order below, see the
//   REPORT section at the end of this header.
//
// -----------------------------------------------------------------------------
// THE DEFECT
// -----------------------------------------------------------------------------
// `metadata.quantity_tiers` is read by the PDP to draw a volume-discount ladder
// and is never transmitted anywhere. Add-to-cart sends `variant_id` and
// `quantity`. The variant's price has no quantity dimension at all, so the cart
// prices every line at the flat base amount.
//
//   tech-pouch  tiers [25->3200, 50->2944, 100->2720, 250->2496]
//               variant calculated_amount 3200 FLAT, min/max_quantity NULL
//
//   PDP quotes 250 pieces at 2496 each = 624000.
//   Cart charges 250 x 3200            = 800000.
//
// A 176000 gap under an on-screen "Save 22%" badge for a discount that exists
// nowhere in the pricing system.
//
// -----------------------------------------------------------------------------
// MEDUSA v2 EXPRESSES THIS NATIVELY. NO PRICE LISTS INVOLVED.
// -----------------------------------------------------------------------------
// Verified against the INSTALLED 2.11.3 source, not from memory.
//
// `min_quantity` / `max_quantity` are first-class nullable columns on the
// `price` table itself, not price_rule rows, not price lists
// (@medusajs/pricing/dist/models/price.js):
//
//     amount:       model.bigNumber(),
//     min_quantity: model.number().nullable(),
//     max_quantity: model.number().nullable(),
//     rules_count:  model.number().default(0).nullable(),
//
// The pricing repository filters on them using `context.quantity`
// (@medusajs/pricing/dist/repositories/pricing.js). NOTE the key is
// `quantity`, NOT `min_quantity` as some published examples show:
//
//     const quantity = context.quantity;
//     delete context.quantity;
//     ...
//     if (quantity !== undefined) {
//       this.where("price.min_quantity", "<=", quantity).andWhere("price.max_quantity", ">=", quantity);
//       this.orWhere("price.min_quantity", "<=", quantity).whereNull("price.max_quantity");
//       this.orWhereNull("price.min_quantity").whereNull("price.max_quantity");
//       this.orWhereNull("price.min_quantity").andWhere("price.max_quantity", ">=", quantity);
//     } else {
//       this.where("price.min_quantity", "<=", 1).orWhereNull("price.min_quantity");
//     }
//
// and the cart supplies that key from the line item's own quantity, with no
// help from the storefront
// (@medusajs/core-flows/dist/cart/workflows/get-variants-and-items-with-prices.js):
//
//     context: { ...baseContext, quantity: item.quantity }
//
// That workflow backs add-to-cart.js, refresh-cart-items.js and create-carts.js.
// So once these rows exist, today's unchanged `{ variant_id, quantity }`
// payload resolves the tier price, and editing a line quantity re-prices it.
//
// -----------------------------------------------------------------------------
// !! WHY THE LADDER MUST BE STRICTLY DECREASING !!
// -----------------------------------------------------------------------------
// The base price row has min_quantity NULL and max_quantity NULL, so it stays
// ELIGIBLE AT EVERY QUANTITY. Among eligible rows the winner is decided by
// (pricing.js, end of calculatePrices):
//
//     .orderByRaw("price.price_list_id IS NOT NULL DESC")
//     .orderByRaw("price.rules_count + COALESCE(pl.rules_count, 0) DESC")
//     .orderBy("price.amount", "asc")
//
// and the module then takes the first non-price-list row as the calculated
// price (pricing-module.js: `defaultPrice = prices.find(p => !p.price_list_id)`).
//
// With no price lists and no rules in play (which is this catalogue) that
// reduces to THE CHEAPEST ELIGIBLE ROW WINS. A tier priced at or above the
// base price can therefore never be selected, however precisely its quantity
// window is drawn.
//
// => This script REFUSES to write a ladder that is not strictly decreasing,
//    rather than emitting rows that would silently never apply. If you need
//    a tier that is more expensive than base, quantity-scoped prices are the
//    wrong mechanism and you want a price list.
//
// -----------------------------------------------------------------------------
// !! THE 100x UNITS LANDMINE: READ THIS BEFORE APPLYING !!
// -----------------------------------------------------------------------------
// `migrate-price-units.ts` is written and NOT YET RUN. It divides by 100 every
// price row reachable from a live product_variant, to fix a v1/v2 minor-vs-major
// unit defect. `quantity_tiers` values (3200, 2944...) are in the SAME minor
// convention as the variant prices they sit beside.
//
// Its scope [A] is expressed as a JOIN, not a frozen id list:
//
//     WHEN lv.variant_id IS NOT NULL THEN 'A_live_variant'
//
// so any row THIS script adds to a live variant's price_set is automatically
// in its scope and will be divided along with the base price it derives from.
// That is the correct outcome, and it is why run order matters:
//
//   ORDER 1 (RECOMMENDED): quantity-tiers FIRST, then price-units.
//     Tier rows are written in the minor convention, matching their siblings.
//     price-units then sweeps base and tier rows together in one audited,
//     rollback-backed transaction. Nothing is ever momentarily inconsistent
//     relative to its own base price, and this script never has to do
//     major-unit arithmetic of its own.
//
//   ORDER 2 (SUPPORTED): price-units FIRST, then quantity-tiers.
//     Base prices are already major (32.00). Tier amounts must then be written
//     DIVIDED BY 100 (24.96). This script detects that and does it.
//
// It detects WHICH regime is live using an exact oracle, never magnitude,
// magnitude is precisely what migrate-price-units.ts proves cannot be trusted
// here, since a `100 ghs` price is genuinely major while a `1000 gbp` one is
// minor. seed-merchery-metadata.ts built the ladder from the live GBP base:
//
//     unit_amount: Math.round(baseUnitAmount * (1 - discount))   // discount 0 for rung 0
//
// so `tiers[0].unit_amount` IS the GBP base price frozen in its original minor
// convention, and metadata is not touched by migrate-price-units.ts. Hence:
//
//     ratio = tiers[0].unit_amount / live_gbp_base
//       1   -> live prices MINOR, price-units not yet applied -> write as-is
//       100 -> live prices MAJOR, price-units already applied -> write / 100
//       else-> ABORT. We do not know, so we do not guess.
//
// The ratio must be identical for EVERY product, and it must AGREE with the
// `gms_price_unit_migration` ledger. Two independent signals; disagreement is
// an abort, not a tie-break.
//
// -----------------------------------------------------------------------------
// EUR / USD: REPRODUCTION, NOT INVENTION
// -----------------------------------------------------------------------------
// Every affected variant carries gbp + eur + usd prices, but `quantity_tiers`
// is GBP-only (seed-merchery-metadata.ts derives it from `baseGbp` alone).
// Writing GBP-only tier rows would leave the exact defect we are fixing alive
// for two of three regions.
//
// seed-curated.ts derived the EUR/USD BASE prices by a documented formula:
//
//     const FX_FROM_GBP = { eur: 1.15, usd: 1.27 }
//     amount: Math.round(p.basePriceGbp * FX_FROM_GBP[cur])
//
// This script applies that same formula to the tier amount. It is reproducing
// the catalogue's own arithmetic one rung further down the ladder, not making
// up prices. To keep that claim honest it VERIFIES at runtime that every
// affected variant's live EUR/USD base still equals round(gbp_base * FX), and
// aborts if any does not, because then the factor demonstrably no longer
// describes this catalogue and deriving from it would be invention.
//
// Pass `--currencies=gbp` to write GBP only and leave EUR/USD flat.
//
// -----------------------------------------------------------------------------
// EXISTING ORDERS AND LIVE CARTS
// -----------------------------------------------------------------------------
// Orders do not move. `order_line_item.unit_price` is a copied historical
// value; Medusa never re-prices a placed order.
//
// Open carts DO re-price on their next refresh, because refresh-cart-items.js
// runs the same workflow that injects `quantity` into the pricing context. A
// cart whose line quantity reaches a tier will get CHEAPER on next touch. It
// can never get more expensive: every row this script writes is strictly below
// the base price it derives from, and the base row remains eligible. The dry
// run prints every open cart line that would move.
//
// -----------------------------------------------------------------------------
// IDEMPOTENCY AND ROLLBACK
// -----------------------------------------------------------------------------
// A durable ledger (`gms_quantity_tier_migration`) records one row per created
// price with its full identity, its amount, the unit regime it was written in,
// and the effective before/after unit price at that tier's quantity. A run
// aborts if the ledger holds un-rolled-back rows, and separately aborts if any
// target price_set already carries quantity-scoped rows (hand-made tiers, or a
// prior application whose ledger was dropped).
//
// Rollback DELETEs exactly the recorded price ids, after checking each row's
// structural fingerprint (price_set_id, currency, min/max quantity) still
// matches what was recorded. It tolerates the AMOUNT having drifted (that is
// what happens if migrate-price-units.ts ran in between) but reports every
// drift rather than passing over it silently.
//
// -----------------------------------------------------------------------------
// REPORT: WHAT WAS MEASURED, AND THE ONE BLOCKER
// -----------------------------------------------------------------------------
// Measured read-only against the live database (see analyze-quantity-tiers.ts):
//
//     products carrying quantity_tiers      22
//     live variants under them              68
//     tier rungs in metadata               116
//     rungs that are real discounts         94   (22 are the discount-0 rung)
//     price rows this migration creates   1110   (94 x variants x 3 currencies)
//     existing quantity-scoped price rows    0   <- the defect, stated numerically
//     open cart lines that would re-price    0
//     placed orders affected                 0
//
// LANDING SEQUENCE
//   1. Take a Neon branch / backup. Non-negotiable, this is a shared database
//      with real orders and customers.
//   2. Run this script with no flags. Read the before/after table.
//   3. Run with --apply (plus the env var).
//   4. Run migrate-price-units.ts. It will divide these 1110 new rows together
//      with the 225 it already had in scope [A], expect that count to read
//      1335. Its header comment still says 225; that comment is stale after
//      step 3, the JOIN that computes the number is not.
//   5. Deploy the storefront commit that removed the ÷100.
//
// BLOCKER ON STEP 4: NOT IN THIS SCRIPT, BUT IT STOPS THE SEQUENCE
//   `migrate-price-units.ts` reads its flags from `ExecArgs.args` only. As
//   probed above, `medusa exec` never puts `--` flags there. So its documented
//   `-- --apply` is silently ignored: it prints "mode: DRY RUN", reports, and
//   exits without writing. Its `-- --rollback` is unreachable for the same
//   reason. It cannot be applied as documented, and if it ever were applied by
//   other means it could not be rolled back by its own command.
//
//   Fix is one line in that file, which this task does not own:
//       const argv = [...(args ?? []), ...process.argv.slice(2)]
//   Until it lands, step 4 cannot run, and the catalogue stays 100x high.
//   Step 3 is still safe and correct on its own, it writes tier rows in the
//   same (minor) convention as the base prices beside them, so the catalogue
//   stays internally consistent either way.
// =============================================================================

import { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  generateEntityId,
} from "@medusajs/framework/utils"

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

/** Ledger table: idempotency marker + rollback source. */
const LEDGER = "gms_quantity_tier_migration"

/** Ledger written by migrate-price-units.ts, read only, never written here. */
const PRICE_UNIT_LEDGER = "gms_price_unit_migration"

/** Env var that must be set (to this exact value) for any write to happen. */
const CONFIRM_VAR = "MIGRATE_QUANTITY_TIERS_CONFIRM"
const CONFIRM_VALUE = "I-UNDERSTAND-THIS-CREATES-PRICE-ROWS"

/**
 * FX factors from seed-curated.ts. Used ONLY to reproduce the existing
 * derivation for EUR/USD, and asserted against every live base price first.
 */
const FX_FROM_GBP: Record<string, number> = { gbp: 1, eur: 1.15, usd: 1.27 }

/** The ladder is authored in GBP; every other currency is derived from it. */
const SOURCE_CURRENCY = "gbp"

const ALL_CURRENCIES = ["gbp", "eur", "usd"] as const

/**
 * Sanity floor. In the MINOR regime every legitimate tier amount observed is
 * >= 900. A derived amount below this would mean the scale detection has gone
 * wrong; abort rather than write a price two orders of magnitude too low.
 * (In the MAJOR regime the equivalent floor is this / 100.)
 */
const MIN_PLAUSIBLE_MINOR_AMOUNT = 100

type TierEntry = { quantity: number; unit_amount: number }

type PlannedRow = {
  product_handle: string
  variant_id: string
  variant_title: string | null
  price_set_id: string
  currency_code: string
  min_quantity: number
  max_quantity: number | null
  /** Amount to write, already in the live regime's units. */
  amount: number
  /** Effective unit price at this tier's quantity BEFORE the migration. */
  before_unit_price: number
  /** Which metadata rung this came from, in the metadata's own minor units. */
  source_tier_quantity: number
  source_tier_unit_amount: number
}

// -----------------------------------------------------------------------------

export default async function migrateQuantityTiers({ container, args }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const knex: any = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)

  // ---------------------------------------------------------------------------
  // Argument parsing.
  //
  // !! `medusa exec` DOES NOT FORWARD `--` FLAGS INTO ExecArgs.args !!
  // The CLI declares the command as `exec [file] [args..]`
  // (@medusajs/cli/dist/create-cli.js), a yargs variadic POSITIONAL. yargs
  // routes anything after a `--` separator into argv["--"], and treats a bare
  // `--apply` as an option, neither reaches the positional. Probed on 2.11.3:
  //
  //     medusa exec ./s.ts -- --apply     ->  args = []        <- silently ignored
  //     medusa exec ./s.ts --apply        ->  args = []
  //     medusa exec ./s.ts apply          ->  args = ["apply"]
  //
  // A script that reads only `args` therefore can NEVER be applied: it dry-runs
  // forever while looking like it accepted the flag. So we read BOTH `args` and
  // the real `process.argv`, and accept the flag with or without dashes. Every
  // documented invocation below works.
  // ---------------------------------------------------------------------------
  const argv: string[] = [...(args ?? []), ...process.argv.slice(2)]
  const hasFlag = (name: string) =>
    argv.includes(`--${name}`) || argv.includes(name)
  const apply = hasFlag("apply")
  const rollback = hasFlag("rollback")
  const confirmed = process.env[CONFIRM_VAR] === CONFIRM_VALUE

  const readOpt = (name: string): string | null => {
    const hit = argv.find(
      (a) => a.startsWith(`--${name}=`) || a.startsWith(`${name}=`),
    )
    if (!hit) return null
    return hit.slice(hit.indexOf("=") + 1)
  }
  const onlyHandles = (readOpt("only") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  const currencies = (readOpt("currencies") ?? ALL_CURRENCIES.join(","))
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)

  const say = (m = "") => logger.info(`[migrate-quantity-tiers] ${m}`)
  const warn = (m: string) => logger.warn(`[migrate-quantity-tiers] ${m}`)
  const fail: (m: string) => never = (m: string) => {
    logger.error(`[migrate-quantity-tiers] ABORT: ${m}`)
    throw new Error(m)
  }

  if (apply && rollback) {
    fail("--apply and --rollback are mutually exclusive.")
  }
  const unknownCur = currencies.filter(
    (c) => !(ALL_CURRENCIES as readonly string[]).includes(c),
  )
  if (unknownCur.length) {
    fail(
      `unknown currency/currencies ${unknownCur.join(", ")}. This script only ` +
        `knows how to derive ${ALL_CURRENCIES.join(", ")}, see FX_FROM_GBP.`,
    )
  }

  say("=".repeat(96))
  say(`mode: ${rollback ? "ROLLBACK" : apply ? "APPLY" : "DRY RUN"}`)
  if (onlyHandles.length) say(`--only: ${onlyHandles.join(", ")}`)
  say(`currencies: ${currencies.join(", ")}`)
  say("=".repeat(96))

  // ---------------------------------------------------------------------------
  // 0) Ledger helpers. The table is created only when we are going to write.
  // ---------------------------------------------------------------------------
  const ledgerExists = async (): Promise<boolean> => {
    const r = await knex.raw(`SELECT to_regclass(?) AS t`, [`public.${LEDGER}`])
    return Boolean(r?.rows?.[0]?.t)
  }

  const ensureLedger = async (trx: any) => {
    await trx.raw(`
      CREATE TABLE IF NOT EXISTS ${LEDGER} (
        id                       BIGSERIAL PRIMARY KEY,
        run_id                   TEXT        NOT NULL,
        price_id                 TEXT        NOT NULL,
        price_set_id             TEXT        NOT NULL,
        variant_id               TEXT        NOT NULL,
        product_handle           TEXT        NOT NULL,
        currency_code            TEXT        NOT NULL,
        min_quantity             INTEGER     NOT NULL,
        max_quantity             INTEGER,
        amount_written           NUMERIC     NOT NULL,
        unit_regime              TEXT        NOT NULL,
        before_unit_price        NUMERIC     NOT NULL,
        after_unit_price         NUMERIC     NOT NULL,
        source_tier_quantity     INTEGER     NOT NULL,
        source_tier_unit_amount  NUMERIC     NOT NULL,
        applied_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
        rolled_back_at           TIMESTAMPTZ
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
    say(`ledger holds ${rows.length} created price row(s).`)

    // -------------------------------------------------------------------------
    // ROLLBACK DEPENDENCY. THIS SCRIPT MUST NOT GO FIRST.
    // -------------------------------------------------------------------------
    // Apply order was quantity-tiers THEN price-units (ORDER 1 in the header),
    // so unwind order is the reverse: price-units FIRST, then this script.
    //
    // The reason is asymmetric destructiveness. This rollback HARD-DELETEs the
    // price rows it created. migrate-price-units' rollback UPDATEs rows in
    // place. Measured 2026-08-30: all 1110 rows this script created are ALSO in
    // the price-unit ledger. Roll this back first and those 1110 rows cease to
    // exist, after which price-units' 1110 UPDATEs each match zero rows.
    //
    // That script now asserts rowCount and will abort rather than report a
    // false success. But aborting mid-unwind is a worse outcome than refusing
    // up front, and the operator would be left with 1110 rows deleted and 228
    // still converted. So this check exists to stop the sequence before the
    // destructive half runs at all.
    const priceUnitLedgerExists = async (): Promise<boolean> => {
      const r = await knex.raw(`SELECT to_regclass(?) AS t`, [`public.${PRICE_UNIT_LEDGER}`])
      return Boolean(r?.rows?.[0]?.t)
    }
    if (await priceUnitLedgerExists()) {
      const overlap = await knex.raw(
        `SELECT count(*)::int AS n
           FROM ${PRICE_UNIT_LEDGER} pu
          WHERE pu.rolled_back_at IS NULL
            AND pu.price_id = ANY(?)`,
        [rows.map((r: any) => r.price_id)],
      )
      const n = overlap?.rows?.[0]?.n ?? 0
      if (n > 0) {
        fail(
          `REFUSING TO ROLL BACK: ${n} of the ${rows.length} price row(s) this ` +
            `script created are still held as ACTIVE by '${PRICE_UNIT_LEDGER}'.\n` +
            `    This rollback HARD-DELETES those rows. migrate-price-units would ` +
            `then have nothing left to restore for them.\n` +
            `    Roll back migrate-price-units FIRST:\n` +
            `      MIGRATE_PRICE_UNITS_CONFIRM=I-UNDERSTAND-THIS-REWRITES-PRICES \\\n` +
            `        npx medusa exec ./src/scripts/migrate-price-units.ts -- --rollback\n` +
            `    then re-run this command. Nothing has been changed.`,
        )
      }
      say(`dependency check: '${PRICE_UNIT_LEDGER}' holds no active row for these`)
      say(`price ids, so price-units has already been rolled back (or never ran).`)
    }

    // Structural fingerprint check. price_set_id / currency / min / max are
    // never touched by migrate-price-units.ts, so they must still match.
    // `amount` legitimately drifts if price-units ran in between, report it.
    const live = await knex.raw(
      `SELECT id, price_set_id, currency_code, min_quantity, max_quantity,
              amount::numeric AS amount, deleted_at
         FROM price WHERE id = ANY(?)`,
      [rows.map((r: any) => r.price_id)],
    )
    const liveById = new Map(live.rows.map((r: any) => [r.id, r]))

    const missing: string[] = []
    const mismatched: string[] = []
    const drifted: Array<{ id: string; recorded: number; actual: number }> = []

    for (const r of rows) {
      const l: any = liveById.get(r.price_id)
      if (!l) {
        missing.push(r.price_id)
        continue
      }
      if (
        l.price_set_id !== r.price_set_id ||
        l.currency_code !== r.currency_code ||
        Number(l.min_quantity) !== Number(r.min_quantity) ||
        String(l.max_quantity ?? "") !== String(r.max_quantity ?? "")
      ) {
        mismatched.push(r.price_id)
        continue
      }
      if (Number(l.amount) !== Number(r.amount_written)) {
        drifted.push({
          id: r.price_id,
          recorded: Number(r.amount_written),
          actual: Number(l.amount),
        })
      }
    }

    say("")
    say(`  rows found live and structurally intact : ${rows.length - missing.length - mismatched.length}`)
    say(`  rows already gone from the price table  : ${missing.length}`)
    say(`  rows whose STRUCTURE no longer matches  : ${mismatched.length}`)
    say(`  rows whose AMOUNT drifted since creation: ${drifted.length}`)
    if (drifted.length) {
      say("")
      say(
        `  Amount drift is EXPECTED if migrate-price-units.ts ran after this ` +
          `migration:`,
      )
      say(`  it divides these rows by 100 along with their base prices.`)
      for (const d of drifted.slice(0, 20)) {
        say(`    ${d.id}  recorded ${d.recorded}  ->  now ${d.actual}`)
      }
      if (drifted.length > 20) say(`    ... and ${drifted.length - 20} more`)
    }
    if (mismatched.length) {
      fail(
        `${mismatched.length} recorded price row(s) no longer match their ` +
          `recorded price_set / currency / quantity window (e.g. ${mismatched[0]}). ` +
          `Something other than this script has edited them. Refusing to delete ` +
          `rows this script may no longer own. Inspect them by hand.`,
      )
    }

    say("")
    say("  price_id                          cur   min    max        amount  handle")
    say("  " + "-".repeat(88))
    for (const r of rows.slice(0, 40)) {
      say(
        `  ${String(r.price_id).padEnd(33)} ${String(r.currency_code).padEnd(5)} ` +
          `${String(r.min_quantity).padStart(4)} ${String(r.max_quantity ?? "inf").padStart(6)} ` +
          `${String(r.amount_written).padStart(13)}  ${r.product_handle}`,
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

    const deletable = rows
      .filter((r: any) => liveById.has(r.price_id))
      .map((r: any) => r.price_id)

    await knex.transaction(async (trx: any) => {
      if (deletable.length) {
        const res = await trx.raw(`DELETE FROM price WHERE id = ANY(?)`, [deletable])
        // Assert the delete removed exactly what was planned. A short count
        // means something removed rows between planning and applying, and the
        // ledger must not close as though this script had handled them.
        if ((res?.rowCount ?? 0) !== deletable.length) {
          throw new Error(
            `expected to delete ${deletable.length} price row(s), deleted ` +
              `${res?.rowCount ?? 0}. Rolling the whole transaction back.`,
          )
        }
      }
      await trx.raw(
        `UPDATE ${LEDGER} SET rolled_back_at = now() WHERE rolled_back_at IS NULL`,
      )
    })

    say(`ROLLED BACK: deleted ${deletable.length} price row(s) this script created.`)
    if (missing.length) {
      say(`${missing.length} row(s) were already absent; ledger closed for them too.`)
    }
    say(
      "Reminder: this removes `price` rows only. A cart that was priced at a " +
        "tier while the migration was live keeps its own copied unit_price " +
        "until its next refresh.",
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
        `Re-running would create a second set of overlapping quantity windows. ` +
        `Roll back first (--rollback) if you need to re-apply.`,
    )
  }

  // ---------------------------------------------------------------------------
  // 2) Load the catalogue.
  // ---------------------------------------------------------------------------
  const { rows: products } = await knex.raw(
    `
    SELECT p.id, p.handle, p.metadata->'quantity_tiers' AS tiers, p.metadata->>'moq' AS moq
      FROM product p
     WHERE p.deleted_at IS NULL AND p.metadata ? 'quantity_tiers'
     ORDER BY p.handle
  `,
  )
  const scoped = onlyHandles.length
    ? products.filter((p: any) => onlyHandles.includes(p.handle))
    : products

  if (onlyHandles.length) {
    const missingHandles = onlyHandles.filter(
      (h) => !products.some((p: any) => p.handle === h),
    )
    if (missingHandles.length) {
      fail(
        `--only named handle(s) that carry no quantity_tiers or do not exist: ` +
          `${missingHandles.join(", ")}`,
      )
    }
  }
  if (!scoped.length) {
    say("no product carries metadata.quantity_tiers, nothing to do.")
    return
  }

  const { rows: priceRows } = await knex.raw(
    `
    SELECT p.handle,
           v.id AS variant_id, v.title AS variant_title,
           vps.price_set_id,
           pr.id AS price_id, pr.currency_code, pr.amount::numeric AS amount,
           pr.min_quantity, pr.max_quantity, pr.price_list_id
      FROM product p
      JOIN product_variant v             ON v.product_id = p.id AND v.deleted_at IS NULL
      JOIN product_variant_price_set vps ON vps.variant_id = v.id AND vps.deleted_at IS NULL
      JOIN price pr                      ON pr.price_set_id = vps.price_set_id AND pr.deleted_at IS NULL
     WHERE p.deleted_at IS NULL AND p.metadata ? 'quantity_tiers'
     ORDER BY p.handle, v.id, pr.currency_code
  `,
  )

  // ---------------------------------------------------------------------------
  // 3) UNIT REGIME. Two independent signals; they must agree.
  // ---------------------------------------------------------------------------
  const reg = await knex.raw(`SELECT to_regclass(?) AS t`, [
    `public.${PRICE_UNIT_LEDGER}`,
  ])
  let priceUnitsApplied = false
  if (reg?.rows?.[0]?.t) {
    const { rows } = await knex.raw(
      `SELECT count(*)::int AS n FROM ${PRICE_UNIT_LEDGER} WHERE rolled_back_at IS NULL`,
    )
    priceUnitsApplied = (rows?.[0]?.n ?? 0) > 0
  }

  const ratioByHandle = new Map<string, number>()
  for (const p of scoped) {
    const tiers = normaliseTiers(p.tiers)
    if (!tiers) {
      fail(
        `${p.handle}: metadata.quantity_tiers is not a non-empty array of ` +
          `{ quantity, unit_amount } numbers. This script will not guess its ` +
          `shape. Fix the metadata or exclude the product with --only.`,
      )
    }
    const gbpBases = new Set(
      priceRows
        .filter(
          (r: any) =>
            r.handle === p.handle &&
            r.currency_code === SOURCE_CURRENCY &&
            !r.price_list_id,
        )
        .map((r: any) => Number(r.amount)),
    )
    if (gbpBases.size === 0) {
      fail(
        `${p.handle}: no ${SOURCE_CURRENCY.toUpperCase()} base price on any live variant, but the ` +
          `ladder is authored in ${SOURCE_CURRENCY.toUpperCase()}. Nothing to derive from.`,
      )
    }
    if (gbpBases.size > 1) {
      fail(
        `${p.handle}: its variants do not share one ${SOURCE_CURRENCY.toUpperCase()} base price ` +
          `(found ${[...gbpBases].join(", ")}). quantity_tiers is a ` +
          `PRODUCT-level ladder derived from a single base, so it cannot be ` +
          `applied to variants priced differently. Re-scope by hand.`,
      )
    }
    const base = [...gbpBases][0] as number
    if (!(base > 0)) fail(`${p.handle}: base price is ${base}.`)
    ratioByHandle.set(p.handle, tiers[0].unit_amount / base)
  }

  const distinctRatios = [...new Set(ratioByHandle.values())]
  say("")
  say("-".repeat(96))
  say("UNIT REGIME DETECTION (exact oracle, never magnitude)")
  say("-".repeat(96))
  say(`  ${PRICE_UNIT_LEDGER} says price-units applied : ${priceUnitsApplied}`)
  say(`  tiers[0].unit_amount / live gbp base           : ${JSON.stringify(distinctRatios)}`)

  if (distinctRatios.length !== 1) {
    const detail = [...ratioByHandle.entries()]
      .map(([h, r]) => `${h}=${r}`)
      .join(", ")
    fail(
      `products disagree on the scale between metadata and live prices: ` +
        `${detail}. That means some products' prices have been rescaled and ` +
        `others' have not, or a ladder's first rung is not the base price. ` +
        `This script will not write prices at a scale it cannot establish for ` +
        `the whole population.`,
    )
  }

  const ratio = distinctRatios[0]
  let regime: "MINOR" | "MAJOR"
  if (ratio === 1) regime = "MINOR"
  else if (ratio === 100) regime = "MAJOR"
  else {
    return fail(
      `scale ratio between metadata and live prices is ${ratio}; only 1 ` +
        `(prices still MINOR, migrate-price-units.ts not yet run) and 100 ` +
        `(prices already MAJOR, migrate-price-units.ts already run) are ` +
        `understood. A ratio of ${ratio} means the first ladder rung is not ` +
        `the base price, or the prices were rescaled by something else. ` +
        `Refusing to guess the unit convention, getting this wrong creates a ` +
        `second 100x defect.`,
    )
  }

  const expectApplied = regime === "MAJOR"
  if (expectApplied !== priceUnitsApplied) {
    fail(
      `the two unit signals disagree. The metadata oracle says live prices are ` +
        `${regime} (ratio ${ratio}), which implies migrate-price-units.ts ` +
        `${expectApplied ? "HAS" : "has NOT"} been applied, but the ` +
        `${PRICE_UNIT_LEDGER} ledger says applied=${priceUnitsApplied}. One of ` +
        `them is wrong and this script cannot tell which. Resolve by hand ` +
        `before writing any price row.`,
    )
  }

  const scale = regime === "MINOR" ? 1 : 100
  say(`  => live variant prices are ${regime}; both signals AGREE`)
  say(`  => tier amounts will be written ${scale === 1 ? "AS-IS" : "DIVIDED BY 100"}`)
  say(
    `  => run order: ${
      regime === "MINOR"
        ? "this migration FIRST, then migrate-price-units.ts (recommended)"
        : "migrate-price-units.ts already ran; this migration lands after it"
    }`,
  )

  // ---------------------------------------------------------------------------
  // 4) Per-variant validation and row planning.
  // ---------------------------------------------------------------------------
  const planned: PlannedRow[] = []
  const noopTiers: string[] = []
  let skippedCurrencies = 0

  for (const p of scoped) {
    const tiers = normaliseTiers(p.tiers)!
    const rowsForProduct = priceRows.filter(
      (r: any) => r.handle === p.handle && !r.price_list_id,
    )

    // -- ladder shape ---------------------------------------------------------
    for (let i = 1; i < tiers.length; i++) {
      if (tiers[i].quantity <= tiers[i - 1].quantity) {
        fail(
          `${p.handle}: quantity_tiers quantities are not strictly increasing ` +
            `(${tiers[i - 1].quantity} then ${tiers[i].quantity}). Quantity ` +
            `windows would overlap ambiguously.`,
        )
      }
    }

    const gbpBaseMinor =
      Number(
        rowsForProduct.find((r: any) => r.currency_code === SOURCE_CURRENCY)!.amount,
      ) * scale

    // Rungs at or above base can never win the amount-ASC tie-break, because
    // the base row stays eligible at every quantity. Drop them explicitly.
    const effective = tiers.filter((t) => {
      const isNoop = t.unit_amount >= gbpBaseMinor
      if (isNoop) {
        noopTiers.push(
          `${p.handle} qty>=${t.quantity} @ ${t.unit_amount} (base ${gbpBaseMinor})`,
        )
      }
      return !isNoop
    })

    for (let i = 1; i < effective.length; i++) {
      if (effective[i].unit_amount >= effective[i - 1].unit_amount) {
        fail(
          `${p.handle}: ladder is not strictly decreasing ` +
            `(qty ${effective[i - 1].quantity} @ ${effective[i - 1].unit_amount} ` +
            `then qty ${effective[i].quantity} @ ${effective[i].unit_amount}). ` +
            `Medusa selects the CHEAPEST eligible price row ` +
            `(pricing.js: ORDER BY price.amount ASC; pricing-module.js takes ` +
            `the first non-price-list row), and the base row is eligible at ` +
            `every quantity, so a rung that is not cheaper than the rung ` +
            `below it can never be selected. Quantity-scoped prices cannot ` +
            `express this ladder; you want a price list.`,
        )
      }
    }
    if (!effective.length) continue

    // -- per variant ----------------------------------------------------------
    const variantIds: string[] = Array.from(
      new Set<string>(rowsForProduct.map((r: any) => String(r.variant_id))),
    )
    for (const vid of variantIds) {
      const vrows = rowsForProduct.filter((r: any) => r.variant_id === vid)

      const alreadyScoped = vrows.filter(
        (r: any) => r.min_quantity !== null || r.max_quantity !== null,
      )
      if (alreadyScoped.length) {
        fail(
          `${p.handle} / ${vid}: price_set already carries ` +
            `${alreadyScoped.length} quantity-scoped price row(s) (e.g. ` +
            `${alreadyScoped[0].price_id} min=${alreadyScoped[0].min_quantity}). ` +
            `Either this migration already ran and its ledger was dropped, or ` +
            `someone authored tiers by hand. Adding more would create ` +
            `overlapping windows. Resolve by hand.`,
        )
      }

      const gbpRow = vrows.find((r: any) => r.currency_code === SOURCE_CURRENCY)
      if (!gbpRow) {
        fail(`${p.handle} / ${vid}: no ${SOURCE_CURRENCY.toUpperCase()} price row to derive from.`)
      }
      const gbpBaseLive = Number(gbpRow.amount)

      for (const cur of currencies) {
        const baseRow = vrows.find((r: any) => r.currency_code === cur)
        if (!baseRow) {
          // No base price in this currency: writing a tier row would make the
          // variant purchasable in a currency it is not otherwise priced in.
          skippedCurrencies++
          continue
        }
        const baseLive = Number(baseRow.amount)

        // FX assertion: makes "reproduction, not invention" checkable.
        if (cur !== SOURCE_CURRENCY) {
          const expected = Math.round(gbpBaseLive * FX_FROM_GBP[cur] * scale) / scale
          if (Math.abs(baseLive - expected) > 1e-9) {
            fail(
              `${p.handle} / ${vid}: live ${cur.toUpperCase()} base is ${baseLive} but ` +
                `round(${SOURCE_CURRENCY.toUpperCase()} ${gbpBaseLive} x ${FX_FROM_GBP[cur]}) is ${expected}. ` +
                `The FX factor from seed-curated.ts no longer describes this ` +
                `catalogue, so deriving ${cur.toUpperCase()} tier prices from it would be ` +
                `inventing prices rather than reproducing the existing ` +
                `derivation. Re-scope by hand, or pass --currencies=${SOURCE_CURRENCY}.`,
            )
          }
        }

        effective.forEach((t, i) => {
          const next = effective[i + 1]
          // Derive in the metadata's own MINOR units, then scale into the live
          // regime. Doing it in this order means the arithmetic is identical to
          // the seed's regardless of which regime we are writing into.
          const minorAmount =
            cur === SOURCE_CURRENCY
              ? t.unit_amount
              : Math.round(t.unit_amount * FX_FROM_GBP[cur])

          if (minorAmount < MIN_PLAUSIBLE_MINOR_AMOUNT) {
            fail(
              `${p.handle} / ${vid} / ${cur}: derived tier amount ${minorAmount} ` +
                `(minor units) is below the sanity floor ` +
                `${MIN_PLAUSIBLE_MINOR_AMOUNT}. Refusing to write it.`,
            )
          }
          if (minorAmount >= baseLive * scale) {
            fail(
              `${p.handle} / ${vid} / ${cur}: derived tier amount ${minorAmount} ` +
                `is not below the base ${baseLive * scale}. It could never be ` +
                `selected. Refusing to write a row that cannot apply.`,
            )
          }

          planned.push({
            product_handle: p.handle,
            variant_id: vid,
            variant_title: vrows[0].variant_title ?? null,
            price_set_id: vrows[0].price_set_id,
            currency_code: cur,
            min_quantity: t.quantity,
            max_quantity: next ? next.quantity - 1 : null,
            amount: minorAmount / scale,
            before_unit_price: baseLive,
            source_tier_quantity: t.quantity,
            source_tier_unit_amount: t.unit_amount,
          })
        })
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 5) Auditable before/after report. Always printed, before anything is written.
  // ---------------------------------------------------------------------------
  say("")
  say("-".repeat(96))
  say(`PLANNED PRICE ROWS: ${planned.length}`)
  say("-".repeat(96))
  say(
    "  handle                    variant                cur   min    max     before ->    after   line total delta",
  )
  say("  " + "-".repeat(92))
  for (const r of planned.slice(0, 80)) {
    const q = r.min_quantity
    const delta = (r.amount - r.before_unit_price) * q
    say(
      `  ${r.product_handle.padEnd(25)} ${String(r.variant_id).slice(-18).padEnd(20)} ` +
        `${r.currency_code.padEnd(5)} ${String(r.min_quantity).padStart(4)} ` +
        `${String(r.max_quantity ?? "inf").padStart(6)} ` +
        `${r.before_unit_price.toFixed(2).padStart(10)} -> ${r.amount.toFixed(2).padStart(8)} ` +
        `${delta.toFixed(2).padStart(18)}`,
    )
  }
  if (planned.length > 80) say(`  ... and ${planned.length - 80} more`)

  say("")
  const byCur = new Map<string, number>()
  for (const r of planned) byCur.set(r.currency_code, (byCur.get(r.currency_code) ?? 0) + 1)
  say("ROW COUNTS")
  say(`  products in scope        ${scoped.length}`)
  say(`  variants touched         ${new Set(planned.map((r) => r.variant_id)).size}`)
  say(`  price rows to create     ${planned.length}`)
  for (const [c, n] of [...byCur].sort()) say(`    ${c.padEnd(4)} ${String(n).padStart(6)}`)
  say(`  no-op rungs skipped      ${noopTiers.length}   (rung price >= base price)`)
  if (skippedCurrencies) {
    say(`  currency slots skipped   ${skippedCurrencies}   (variant has no base price in that currency)`)
  }
  if (noopTiers.length) {
    say("")
    say("  SKIPPED NO-OP RUNGS (these are the discount-0 first rung of each ladder):")
    for (const n of noopTiers.slice(0, 25)) say(`    ${n}`)
    if (noopTiers.length > 25) say(`    ... and ${noopTiers.length - 25} more`)
  }

  // ---------------------------------------------------------------------------
  // 6) Downstream effect: open carts. Orders are never re-priced.
  // ---------------------------------------------------------------------------
  const { rows: openCartLines } = await knex.raw(
    `
    SELECT c.id AS cart_id, c.updated_at, c.currency_code,
           li.id AS line_id, li.title, li.quantity, li.unit_price::numeric AS unit_price,
           li.variant_id
      FROM cart c
      JOIN cart_line_item li ON li.cart_id = c.id AND li.deleted_at IS NULL
     WHERE c.deleted_at IS NULL AND c.completed_at IS NULL
       AND li.variant_id = ANY(?)
     ORDER BY c.updated_at DESC
  `,
    [[...new Set(planned.map((r) => r.variant_id))]],
  )

  const movingLines = openCartLines
    .map((l: any) => {
      const candidates = planned.filter(
        (r) =>
          r.variant_id === l.variant_id &&
          r.currency_code === l.currency_code &&
          r.min_quantity <= Number(l.quantity) &&
          (r.max_quantity === null || r.max_quantity >= Number(l.quantity)),
      )
      if (!candidates.length) return null
      const best = candidates.sort((a, b) => a.amount - b.amount)[0]
      if (best.amount >= Number(l.unit_price)) return null
      return { ...l, new_unit_price: best.amount }
    })
    .filter(Boolean)

  say("")
  say("-".repeat(96))
  say("DOWNSTREAM EFFECT")
  say("-".repeat(96))
  say(`  open (uncompleted) cart lines on affected variants : ${openCartLines.length}`)
  say(`  of those, lines that would RE-PRICE on next refresh: ${movingLines.length}`)
  for (const l of movingLines.slice(0, 20)) {
    say(
      `    ${l.cart_id}  ${String(l.title).slice(0, 24).padEnd(24)} qty ${String(l.quantity).padStart(4)}  ` +
        `${Number(l.unit_price).toFixed(2)} -> ${Number(l.new_unit_price).toFixed(2)}`,
    )
  }
  say(
    `  Every planned row is strictly below its base price and the base row stays`,
  )
  say(
    `  eligible, so a cart can only ever get CHEAPER here, never more expensive.`,
  )
  say(
    `  Placed orders are unaffected: order_line_item.unit_price is a copied`,
  )
  say(`  historical value and Medusa does not re-price a placed order.`)

  // ---------------------------------------------------------------------------
  // 7) Gates.
  // ---------------------------------------------------------------------------
  say("")
  if (!apply) {
    say("DRY RUN. Nothing was changed.")
    say(
      `To apply: ${CONFIRM_VAR}=${CONFIRM_VALUE} ` +
        `npx medusa exec ./src/scripts/migrate-quantity-tiers.ts -- --apply`,
    )
    if (regime === "MINOR") {
      say("")
      say(
        "REMINDER: prices are still in MINOR units. Run migrate-price-units.ts " +
          "AFTER this one; it will divide these new rows along with their base " +
          "prices, which is the intended outcome. Expect its scope [A] count to " +
          `rise by ${planned.length}.`,
      )
    }
    return
  }
  if (!confirmed) {
    fail(
      `--apply was passed but ${CONFIRM_VAR} is not set to the expected value. ` +
        `Both are required. Nothing was changed.`,
    )
  }
  if (!planned.length) {
    say("nothing in scope, nothing to do.")
    return
  }

  // ---------------------------------------------------------------------------
  // 8) Apply, in ONE transaction, ledger and price rows together.
  //
  //    `raw_amount` is written alongside `amount` because Medusa's BigNumber
  //    hydrates from `raw_amount`; a row with only the numeric column set reads
  //    back wrong through the module. Shape copied from live rows:
  //        {"value": "3200", "precision": 20}
  // ---------------------------------------------------------------------------
  const runId = `run_${Date.now()}`
  let written = 0

  await knex.transaction(async (trx: any) => {
    await ensureLedger(trx)

    for (const r of planned) {
      const priceId = generateEntityId("", "price")
      const amountStr = String(r.amount)

      await trx.raw(
        `INSERT INTO price
           (id, price_set_id, currency_code, amount, raw_amount,
            min_quantity, max_quantity, rules_count, price_list_id,
            created_at, updated_at)
         VALUES (?, ?, ?, ?, jsonb_build_object('value', ?::text, 'precision', 20),
                 ?, ?, 0, NULL, now(), now())`,
        [
          priceId,
          r.price_set_id,
          r.currency_code,
          r.amount,
          amountStr,
          r.min_quantity,
          r.max_quantity,
        ],
      )

      await trx.raw(
        `INSERT INTO ${LEDGER}
           (run_id, price_id, price_set_id, variant_id, product_handle,
            currency_code, min_quantity, max_quantity, amount_written,
            unit_regime, before_unit_price, after_unit_price,
            source_tier_quantity, source_tier_unit_amount)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          runId,
          priceId,
          r.price_set_id,
          r.variant_id,
          r.product_handle,
          r.currency_code,
          r.min_quantity,
          r.max_quantity,
          r.amount,
          regime,
          r.before_unit_price,
          r.amount,
          r.source_tier_quantity,
          r.source_tier_unit_amount,
        ],
      )
      written++
    }
  })

  say(`APPLIED: created ${written} quantity-scoped price row(s).`)
  say(`ledger run_id = ${runId} (table ${LEDGER}): this is the rollback source.`)
  say("")
  say("VERIFY: add 250 of tech-pouch to a GBP cart and confirm the line unit")
  say("        price is the 250+ rung, not the base price.")
  if (regime === "MINOR") {
    say("")
    say("NEXT: migrate-price-units.ts has NOT run. Run it now, it will divide")
    say(`      these ${written} new rows together with their base prices.`)
    say("      Do not deploy a storefront that expects major units until it has.")
  }
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Validate and sort `metadata.quantity_tiers`. Returns null on any shape this
 * script is not prepared to reason about, callers abort rather than guess.
 */
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
