// =============================================================================
// migrate-product-copy: brings two stray product titles onto the catalogue's
// existing separator convention, and removes an em dash from one description.
//
//   DRY RUN (default, safe):
//     npx medusa exec ./src/scripts/migrate-product-copy.ts
//
//   APPLY (requires BOTH the flag and the env var):
//     MIGRATE_PRODUCT_COPY_CONFIRM=I-UNDERSTAND-THIS-REWRITES-PRODUCT-COPY \
//       npx medusa exec ./src/scripts/migrate-product-copy.ts -- --apply
//
//   ROLLBACK (restores every recorded original verbatim):
//     MIGRATE_PRODUCT_COPY_CONFIRM=I-UNDERSTAND-THIS-REWRITES-PRODUCT-COPY \
//       npx medusa exec ./src/scripts/migrate-product-copy.ts -- --rollback
//
// !! THE HYPHENS IN THAT CONFIRM STRING ARE ASCII HYPHEN-MINUS AND ARE COMPARED
//    WITH === AGAINST OPERATOR INPUT. A punctuation sweep that "improves" one to
//    an en or em dash silently disables this migration's apply path, or desyncs
//    the command documented above from the constant below so an operator gets an
//    abort they cannot explain. Same for the ledger identifier interpolated into
//    SQL. Punctuation sweeps apply to PROSE ONLY in this file.
//
// -----------------------------------------------------------------------------
// WHY: A CONSISTENCY FIX, NOT A NAMING DECISION
// -----------------------------------------------------------------------------
// Verified against the live catalogue rather than asserted. Every product title
// carrying a separator:
//
//     ASCII " - "   13   Atelier Hoodie - Charcoal, Ceramic Mug - Sage,
//                        Steel Bottle - 500ml, Studio Notebook - A5, ...
//     em dash " — "  2   Studio Tee — Cream, Studio Tee — Charcoal
//     no separator  11
//
// The two tees are the strays. This brings them onto the convention the other
// thirteen already use; it does not invent one.
//
// -----------------------------------------------------------------------------
// WHY THIS IS SAFE FOR FINANCIAL DOCUMENTS: DO NOT RE-DERIVE THIS
// -----------------------------------------------------------------------------
// Changing product.title CANNOT alter any past invoice, receipt or dispatch
// note. Medusa snapshots the item title onto `order_line_item.title` when the
// order is placed, and reads it back from there forever after, the order never
// re-resolves the product. So historical documents keep the exact wording they
// were issued with, which is the correct behaviour for a financial record and
// the reason this rename needs no order-side migration.
//
// -----------------------------------------------------------------------------
// !! THE SOURCE HALF IS NOT WHERE YOU WOULD EXPECT. BOTH FINDINGS MATTER. !!
// -----------------------------------------------------------------------------
// The standing rule is: fix the data AND the script that writes it, or the next
// reseed undoes the migration. Applying that here turned up two surprises, both
// established by searching every .ts/.tsx/.vue/.json/.sql in the repo:
//
//  1. THE TWO TEE TITLES ARE AUTHORED BY NO SCRIPT AT ALL. The strings
//     "Studio Tee — Cream" / "Studio Tee — Charcoal" do not exist anywhere in
//     the codebase. seed-curated.ts defines 19 product specs and none of them is
//     a studio-tee; seed-sample.ts, seed-badges.ts, seed-commerce-mode.ts,
//     seed-merchery-metadata.ts and add-mockup-metadata.ts all reference the
//     HANDLES but none sets a title. These two titles exist only in the
//     database. So there is NO source half for them, and no reseed can bring
//     the em dashes back.
//
//  2. THE COASTER DESCRIPTION IS IN seed-pod-no-locations.ts, NOT
//     seed-curated.ts. It is the DESCRIPTION constant at ~line 86. That file is
//     the only place it is authored, and it IS fixed alongside this migration.
//
// Net effect on file ownership: this work touches seed-pod-no-locations.ts and
// nothing else in src/scripts. seed-curated.ts is untouched by it and remains
// entirely available to the copy sweep.
//
// -----------------------------------------------------------------------------
// SAFETY
// -----------------------------------------------------------------------------
//  * Every target is matched on its EXACT current value. If a value has changed
//    since this was written, the run aborts rather than clobbering it.
//  * Idempotent: a target already holding its intended value is skipped, so a
//    re-run is safe and reports rather than fails.
//  * The ledger stores the FULL prior string for every field changed, so
//    rollback restores the original verbatim rather than reversing a rule.
//  * Its own ledger table, deliberately separate from the imagery migration, so
//    this can be rolled back alone without disturbing anything else.
//  * Refuses to write a row it did not display.
// =============================================================================

import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

const LEDGER = "gms_product_copy_migration"
const CONFIRM_VAR = "MIGRATE_PRODUCT_COPY_CONFIRM"
const CONFIRM_VALUE = "I-UNDERSTAND-THIS-REWRITES-PRODUCT-COPY"

/** Exact-match rewrites. `before` must equal the live value or the run aborts. */
const TARGETS: Array<{
  handle: string
  field: "title" | "description"
  before: string
  after: string
  why: string
}> = [
  {
    handle: "studio-tee-cream",
    field: "title",
    before: "Studio Tee — Cream",
    after: "Studio Tee - Cream",
    why: "em dash -> ASCII hyphen, matching the other 13 separator titles",
  },
  {
    handle: "studio-tee-charcoal",
    field: "title",
    before: "Studio Tee — Charcoal",
    after: "Studio Tee - Charcoal",
    why: "em dash -> ASCII hyphen, matching the other 13 separator titles",
  },
  {
    handle: "studio-laser-coaster",
    field: "description",
    before:
      "Solid 4mm walnut coaster, hand-finished and laser-engraved with your logo or studio mark. " +
      "Print zones for this product aren't published in the self-serve customizer yet — " +
      "email the artwork team after checkout and we'll send a proof in 48 hours.",
    after:
      "Solid 4mm walnut coaster, hand-finished and laser-engraved with your logo or studio mark. " +
      "Print zones for this product aren't published in the self-serve customizer yet. " +
      "Email the artwork team after checkout and we'll send a proof in 48 hours.",
    why:
      "em dash -> full stop. Both halves are independent clauses, so a comma " +
      "would be a splice. Nothing else in the description changes.",
  },
]

type Planned = {
  handle: string
  productId: string
  field: "title" | "description"
  before: string
  after: string
  why: string
}

export default async function migrateProductCopy({ container, args }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const knex: any = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)

  // `medusa exec` does not forward `--` flags into ExecArgs.args (the CLI
  // declares `exec [file] [args..]`, a yargs variadic positional). Read
  // process.argv too, and accept flags with or without dashes.
  const argv: string[] = [...(args ?? []), ...process.argv.slice(2)]
  const hasFlag = (n: string) => argv.includes(`--${n}`) || argv.includes(n)
  const apply = hasFlag("apply")
  const rollback = hasFlag("rollback")
  const confirmed = process.env[CONFIRM_VAR] === CONFIRM_VALUE

  const say = (m = "") => logger.info(`[migrate-product-copy] ${m}`)
  const warn = (m: string) => logger.warn(`[migrate-product-copy] ${m}`)
  const fail: (m: string) => never = (m: string) => {
    logger.error(`[migrate-product-copy] ABORT: ${m}`)
    throw new Error(m)
  }
  if (apply && rollback) fail("--apply and --rollback are mutually exclusive.")

  say("=".repeat(92))
  say(`mode: ${rollback ? "ROLLBACK" : apply ? "APPLY" : "DRY RUN"}`)
  say("=".repeat(92))

  const tableExists = async (t: string) => {
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
        field           TEXT        NOT NULL,
        value_before    TEXT        NOT NULL,
        value_after     TEXT        NOT NULL,
        applied_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
        rolled_back_at  TIMESTAMPTZ
      )
    `)
    // Recorded here so a future reader does not have to re-derive it: changing
    // product.title cannot alter a past invoice or receipt. Medusa snapshots the
    // title onto order_line_item.title at order time and reads it back from
    // there forever; the order never re-resolves the product.
    await trx.raw(
      `COMMENT ON TABLE ${LEDGER} IS ` +
        `'Product copy rewrites (em dash -> ASCII hyphen / full stop). Safe for ` +
        `financial documents: order_line_item snapshots its own title at order ` +
        `time, so historical invoices and receipts keep their original wording ` +
        `and cannot change retroactively.'`,
    )
  }
  const activeLedger = async (): Promise<any[]> => {
    if (!(await tableExists(LEDGER))) return []
    const r = await knex.raw(
      `SELECT * FROM ${LEDGER} WHERE rolled_back_at IS NULL ORDER BY id`,
    )
    return r?.rows ?? []
  }

  // ---------------------------------------------------------------------------
  // ROLLBACK
  // ---------------------------------------------------------------------------
  if (rollback) {
    const rows = await activeLedger()
    if (!rows.length) {
      say("ledger holds no active migration, nothing to roll back.")
      return
    }
    say(`ledger holds ${rows.length} changed value(s).`)
    for (const r of rows) {
      say(`  ${r.product_handle}.${r.field}`)
      say(`     restoring: ${JSON.stringify(r.value_before)}`)
    }
    if (!confirmed) {
      warn(`refusing: set ${CONFIRM_VAR}=${CONFIRM_VALUE} to proceed. Nothing changed.`)
      return
    }
    await knex.transaction(async (trx: any) => {
      for (const r of rows) {
        await trx.raw(
          `UPDATE product SET ${r.field === "title" ? "title" : "description"} = ?, updated_at = now() WHERE id = ?`,
          [r.value_before, r.product_id],
        )
      }
      await trx.raw(`UPDATE ${LEDGER} SET rolled_back_at = now() WHERE rolled_back_at IS NULL`)
    })
    say(`ROLLED BACK ${rows.length} value(s) to their recorded originals.`)
    return
  }

  // ---------------------------------------------------------------------------
  // Plan: exact match, idempotent
  // ---------------------------------------------------------------------------
  const existing = await activeLedger()
  if (existing.length) {
    say(
      `ledger holds ${existing.length} row(s) from ${existing[0]?.applied_at}, ` +
        `planning is idempotent, already-applied targets will be skipped.`,
    )
  }

  const planned: Planned[] = []
  const alreadyApplied: string[] = []

  for (const t of TARGETS) {
    const { rows } = await knex.raw(
      `SELECT id, handle, title, description FROM product
        WHERE handle = ? AND deleted_at IS NULL`,
      [t.handle],
    )
    if (!rows.length) fail(`${t.handle}: no live product with that handle.`)
    if (rows.length > 1) fail(`${t.handle}: ${rows.length} live products share this handle.`)
    const row = rows[0]
    const current: string = row[t.field] ?? ""

    if (current === t.after) {
      alreadyApplied.push(`${t.handle}.${t.field}`)
      continue
    }
    if (current !== t.before) {
      fail(
        `${t.handle}.${t.field} does not hold the expected value.\n` +
          `    expected: ${JSON.stringify(t.before)}\n` +
          `    found:    ${JSON.stringify(current)}\n` +
          `  Someone has edited this copy since this migration was written. ` +
          `Refusing to clobber it.`,
      )
    }
    planned.push({
      handle: t.handle,
      productId: row.id,
      field: t.field,
      before: t.before,
      after: t.after,
      why: t.why,
    })
  }

  // ---------------------------------------------------------------------------
  // Report: every row, in full, before anything is written
  // ---------------------------------------------------------------------------
  say("")
  say("-".repeat(92))
  say(`PLANNED CHANGES: ${planned.length}`)
  say("-".repeat(92))
  for (const p of planned) {
    say(`  ${p.handle}.${p.field}`)
    say(`     why     ${p.why}`)
    say(`     before  ${JSON.stringify(p.before)}`)
    say(`     after   ${JSON.stringify(p.after)}`)
    say("")
  }
  if (alreadyApplied.length) {
    say(`ALREADY APPLIED, SKIPPED: ${alreadyApplied.length}`)
    for (const a of alreadyApplied) say(`  ${a}`)
    say("")
  }

  if (planned.length !== new Set(planned.map((p) => `${p.handle}.${p.field}`)).size) {
    fail("duplicate target detected; refusing to write.")
  }

  say("SAFE FOR FINANCIAL DOCUMENTS: order_line_item snapshots its own title at")
  say("order time, so no past invoice or receipt can change retroactively.")
  say("")

  if (!apply) {
    say("DRY RUN. Nothing was changed.")
    say(
      `To apply: ${CONFIRM_VAR}=${CONFIRM_VALUE} ` +
        `npx medusa exec ./src/scripts/migrate-product-copy.ts -- --apply`,
    )
    return
  }
  if (!confirmed) {
    fail(`--apply was passed but ${CONFIRM_VAR} is not set correctly. Nothing changed.`)
  }
  if (!planned.length) {
    say("nothing to change, every target already holds its intended value.")
    return
  }

  const runId = `run_${Date.now()}`
  let written = 0
  await knex.transaction(async (trx: any) => {
    await ensureLedger(trx)
    for (const p of planned) {
      await trx.raw(
        `INSERT INTO ${LEDGER}
           (run_id, product_id, product_handle, field, value_before, value_after)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [runId, p.productId, p.handle, p.field, p.before, p.after],
      )
      await trx.raw(
        `UPDATE product SET ${p.field === "title" ? "title" : "description"} = ?, updated_at = now() WHERE id = ?`,
        [p.after, p.productId],
      )
      written++
    }
  })
  say(`APPLIED: ${written} value(s) rewritten.`)
  say(`ledger run_id = ${runId} (table ${LEDGER}): this is the rollback source.`)
  say("")
  say("SOURCE HALF: the coaster description is authored in")
  say("  src/scripts/seed-pod-no-locations.ts (DESCRIPTION const, ~line 86)")
  say("and is fixed alongside this. The two tee titles are authored by NO script")
  say("(they exist only in the database) so no reseed can reintroduce them.")
}
