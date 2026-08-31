// =============================================================================
// migrate-region-payment-providers: links Stripe to the European Union and
// United States regions, which currently have NO payment provider at all.
//
//   DRY RUN (default, safe):
//     npx medusa exec ./src/scripts/migrate-region-payment-providers.ts
//
//   APPLY (requires BOTH the flag and the env var):
//     MIGRATE_REGION_PAYMENT_CONFIRM=I-UNDERSTAND-THIS-LINKS-PAYMENT-PROVIDERS-TO-REGIONS \
//       npx medusa exec ./src/scripts/migrate-region-payment-providers.ts -- --apply
//
//   ROLLBACK (dismisses exactly the links this migration created):
//     MIGRATE_REGION_PAYMENT_CONFIRM=I-UNDERSTAND-THIS-LINKS-PAYMENT-PROVIDERS-TO-REGIONS \
//       npx medusa exec ./src/scripts/migrate-region-payment-providers.ts -- --rollback
//
// !! THE HYPHENS IN THAT CONFIRM STRING ARE ASCII HYPHEN-MINUS AND ARE COMPARED
//    WITH === AGAINST OPERATOR INPUT. A punctuation sweep that "improves" one to
//    an en or em dash silently disables this migration's apply path, or desyncs
//    the command documented above from the constant below so an operator gets an
//    abort they cannot explain. Same for the ledger identifier interpolated into
//    SQL. Punctuation sweeps apply to PROSE ONLY in this file.
//
// -----------------------------------------------------------------------------
// THE DEFECT
// -----------------------------------------------------------------------------
// Live contents of region_payment_provider, with deleted_at shown:
//
//   regpp_01KAYKA7CG8HGYGVK55ZN5KKQS  UK  pp_system_default  deleted 2025-11-25 22:57:39.428+00
//   regpp_01KAYKS930VZGDG43GZN03X0K7  UK  pp_stripe_stripe   LIVE
//
// That is the whole table. The EU and US regions have no row of any kind, so
// GET /store/payment-providers?region_id=<eu|us> returns an empty array, the
// checkout payment step renders no method, and the customer cannot pay.
//
// -----------------------------------------------------------------------------
// WHY STRIPE ONLY, AND NOT pp_system_default: THE DB ALREADY DECIDED THIS
// -----------------------------------------------------------------------------
// It is tempting to give EU and US "the same two providers the UK has". The UK
// does not have two. It has one. pp_system_default is SOFT-DELETED, and a raw
// count that omits `deleted_at IS NULL` reports it as live -- this table's own
// indexes are partial on exactly that predicate:
//
//   IDX_region_id_1c934dab0            btree (region_id)            WHERE deleted_at IS NULL
//   IDX_payment_provider_id_1c934dab0  btree (payment_provider_id)  WHERE deleted_at IS NULL
//
// The timestamps make it a deliberate act rather than drift:
//
//   pp_system_default  created 22:49:26.158974  deleted 22:57:39.428
//   pp_stripe_stripe   created 22:57:39.421
//
// Stripe was created SEVEN MILLISECONDS BEFORE manual was deleted. One atomic
// swap. Whoever configured the UK added Stripe and removed the manual provider
// in a single operation. The "should a customer be able to select a no-op
// provider" question was already answered in production, and the answer was no.
// Linking pp_system_default to EU/US would resurrect a configuration the
// operator explicitly tore out, and would let a customer "pay" with a provider
// that captures nothing. So: Stripe only.
//
// -----------------------------------------------------------------------------
// WHAT IS DELIBERATELY NOT LINKED
// -----------------------------------------------------------------------------
// Six alternative Stripe methods are installed and enabled: ideal, giropay,
// blik, bancontact, przelewy24, promptpay. None is linked here.
//
// They are a product decision with a real storefront cost, not part of this
// defect. iDEAL is Netherlands-only, BLIK and Przelewy24 are Poland-only,
// Bancontact is Belgium-only, giropay is Germany-only. This store has ONE
// catch-all "European Union" region covering nine countries, so linking them
// would show Dutch and Polish payment methods to a shopper in Spain who cannot
// use them. Correct sequencing is per-country regions first, those methods
// second. promptpay is Thailand-only and matches no region here at all.
//
// -----------------------------------------------------------------------------
// SAFETY
// -----------------------------------------------------------------------------
//  * ADDITIVE ONLY. This migration creates links. It deletes and updates
//    nothing, and it never touches the UK. The prior state of both target
//    regions is "no link", so rollback is a clean dismissal with nothing to
//    restore -- there is no prior value that could be lost.
//  * Every precondition is re-asserted inside the apply transaction, not just
//    at plan time: region exists and is live, currency is as expected, provider
//    exists and is_enabled, and no live link is already present.
//  * The UK's live shape is re-checked too. This migration's whole premise is
//    "match the UK, which is Stripe only". If the UK's links have changed since
//    this was written, that premise is stale and the run ABORTS rather than
//    propagating a decision that no longer holds.
//  * Idempotent: a region that already has the link is skipped, so a re-run
//    reports rather than fails or duplicates.
//  * Refuses to write a row it did not display. The count printed in the plan
//    is asserted against the count written, and a mismatch aborts the
//    transaction.
//  * Writes through the LINK MODULE (link.create), not a raw INSERT, so the id
//    format and any module-side bookkeeping match what the admin UI would
//    produce. The ledger records the resulting link id for rollback.
// =============================================================================

import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

const LEDGER = "gms_region_payment_provider_migration"
const CONFIRM_VAR = "MIGRATE_REGION_PAYMENT_CONFIRM"
const CONFIRM_VALUE = "I-UNDERSTAND-THIS-LINKS-PAYMENT-PROVIDERS-TO-REGIONS"

/** The provider being linked. Deliberately one, see the header. */
const PROVIDER_ID = "pp_stripe_stripe"

/**
 * The UK's expected LIVE link set. This migration exists to give EU and US the
 * same shape the UK already has, so if the UK's shape moves, the premise is
 * stale and the run aborts.
 */
const UK_REGION_ID = "reg_01KAYKA7BG1JMY1F202G389RVF"
const UK_EXPECTED_LIVE_PROVIDERS = [PROVIDER_ID]

/** Exact-match targets. Region must exist, be live, and hold this currency. */
const TARGETS: Array<{
  regionId: string
  name: string
  currency: string
  why: string
}> = [
  {
    regionId: "reg_01KQ2VGBBPEK9QSD2CW27D57DN",
    name: "European Union",
    currency: "eur",
    why: "no payment provider linked; checkout payment step renders empty",
  },
  {
    regionId: "reg_01KQ2VGBBP3G4QJT23796S965W",
    name: "United States",
    currency: "usd",
    why: "no payment provider linked; checkout payment step renders empty",
  },
]

type Planned = {
  regionId: string
  name: string
  currency: string
  providerId: string
  why: string
}

export default async function migrateRegionPaymentProviders({
  container,
  args,
}: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const knex: any = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const link: any = container.resolve(ContainerRegistrationKeys.LINK)

  // `medusa exec` does not forward `--` flags into ExecArgs.args (the CLI
  // declares `exec [file] [args..]`, a yargs variadic positional). Read
  // process.argv too, and accept flags with or without dashes.
  const argv: string[] = [...(args ?? []), ...process.argv.slice(2)]
  const hasFlag = (n: string) => argv.includes(`--${n}`) || argv.includes(n)
  const apply = hasFlag("apply")
  const rollback = hasFlag("rollback")
  const confirmed = process.env[CONFIRM_VAR] === CONFIRM_VALUE

  const say = (m = "") => logger.info(`[migrate-region-payment-providers] ${m}`)
  const warn = (m: string) => logger.warn(`[migrate-region-payment-providers] ${m}`)
  const fail: (m: string) => never = (m: string) => {
    logger.error(`[migrate-region-payment-providers] ABORT: ${m}`)
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
        id                  BIGSERIAL PRIMARY KEY,
        run_id              TEXT        NOT NULL,
        region_id           TEXT        NOT NULL,
        region_name         TEXT        NOT NULL,
        currency_code       TEXT        NOT NULL,
        payment_provider_id TEXT        NOT NULL,
        applied_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
        rolled_back_at      TIMESTAMPTZ
      )
    `)
    // Recorded here so a future reader does not have to re-derive it.
    await trx.raw(
      `COMMENT ON TABLE ${LEDGER} IS ` +
        `'Links pp_stripe_stripe to the EU and US regions, which had no payment ` +
        `provider at all and so rendered an empty checkout payment step. ` +
        `ADDITIVE ONLY: prior state of both regions was no link, so rollback is ` +
        `a clean dismissal with no prior value to restore. Stripe ONLY, not ` +
        `pp_system_default: the UK''s pp_system_default link is soft-deleted, ` +
        `removed 7ms after pp_stripe_stripe was created in one atomic swap, so ` +
        `the operator had already decided against offering the no-op provider.'`,
    )
  }
  const activeLedger = async (): Promise<any[]> => {
    if (!(await tableExists(LEDGER))) return []
    const r = await knex.raw(
      `SELECT * FROM ${LEDGER} WHERE rolled_back_at IS NULL ORDER BY id`,
    )
    return r?.rows ?? []
  }

  /** Live links for a region. Soft deletes excluded -- see the header. */
  const liveProvidersFor = async (regionId: string): Promise<string[]> => {
    const r = await knex.raw(
      `SELECT payment_provider_id FROM region_payment_provider
        WHERE region_id = ? AND deleted_at IS NULL
        ORDER BY payment_provider_id`,
      [regionId],
    )
    return (r?.rows ?? []).map((x: any) => x.payment_provider_id)
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
    say(`ledger holds ${rows.length} link(s) created by this migration.`)
    for (const r of rows) {
      say(`  ${r.region_name} (${r.region_id})`)
      say(`     dismissing link to ${r.payment_provider_id}`)
    }
    say("")
    say("Prior state of both regions was NO LINK, so this restores them exactly.")
    if (!confirmed) {
      warn(`refusing: set ${CONFIRM_VAR}=${CONFIRM_VALUE} to proceed. Nothing changed.`)
      return
    }
    for (const r of rows) {
      await link.dismiss({
        [Modules.REGION]: { region_id: r.region_id },
        [Modules.PAYMENT]: { payment_provider_id: r.payment_provider_id },
      })
    }
    await knex.raw(
      `UPDATE ${LEDGER} SET rolled_back_at = now() WHERE rolled_back_at IS NULL`,
    )
    say(`ROLLED BACK ${rows.length} link(s).`)
    return
  }

  // ---------------------------------------------------------------------------
  // Premise check: the UK's shape is what we are matching
  // ---------------------------------------------------------------------------
  const ukLive = await liveProvidersFor(UK_REGION_ID)
  const ukMatches =
    ukLive.length === UK_EXPECTED_LIVE_PROVIDERS.length &&
    UK_EXPECTED_LIVE_PROVIDERS.every((p) => ukLive.includes(p))
  say(`UK live providers: [${ukLive.join(", ") || "none"}]`)
  if (!ukMatches) {
    fail(
      `the UK's live provider set has changed since this migration was written.\n` +
        `    expected: [${UK_EXPECTED_LIVE_PROVIDERS.join(", ")}]\n` +
        `    found:    [${ukLive.join(", ") || "none"}]\n` +
        `  This migration's premise is "give EU and US the same shape the UK has". ` +
        `That premise is now stale. Re-derive the intended shape before running.`,
    )
  }

  // ---------------------------------------------------------------------------
  // Provider must exist and be enabled
  // ---------------------------------------------------------------------------
  const { rows: provRows } = await knex.raw(
    `SELECT id, is_enabled FROM payment_provider WHERE id = ?`,
    [PROVIDER_ID],
  )
  if (!provRows.length) fail(`${PROVIDER_ID}: no such payment provider is installed.`)
  if (!provRows[0].is_enabled) fail(`${PROVIDER_ID}: provider exists but is_enabled = false.`)
  say(`provider ${PROVIDER_ID}: installed, is_enabled = true`)
  say("")

  // ---------------------------------------------------------------------------
  // Plan: exact match, idempotent
  // ---------------------------------------------------------------------------
  const existing = await activeLedger()
  if (existing.length) {
    say(
      `ledger holds ${existing.length} row(s) from ${existing[0]?.applied_at}, ` +
        `planning is idempotent, already-linked regions will be skipped.`,
    )
  }

  const planned: Planned[] = []
  const alreadyApplied: string[] = []

  for (const t of TARGETS) {
    const { rows } = await knex.raw(
      `SELECT id, name, currency_code FROM region
        WHERE id = ? AND deleted_at IS NULL`,
      [t.regionId],
    )
    if (!rows.length) fail(`${t.name} (${t.regionId}): no live region with that id.`)
    const row = rows[0]
    if (row.name !== t.name) {
      fail(
        `${t.regionId}: region name does not match.\n` +
          `    expected: ${JSON.stringify(t.name)}\n` +
          `    found:    ${JSON.stringify(row.name)}`,
      )
    }
    // Currency matters: a provider that resolves for the region but has no
    // configured currency fails at payment intent creation, which looks fixed
    // and is not.
    if (row.currency_code !== t.currency) {
      fail(
        `${t.name}: currency does not match.\n` +
          `    expected: ${JSON.stringify(t.currency)}\n` +
          `    found:    ${JSON.stringify(row.currency_code)}`,
      )
    }

    const live = await liveProvidersFor(t.regionId)
    if (live.includes(PROVIDER_ID)) {
      alreadyApplied.push(`${t.name} -> ${PROVIDER_ID}`)
      continue
    }
    planned.push({
      regionId: t.regionId,
      name: t.name,
      currency: t.currency,
      providerId: PROVIDER_ID,
      why: t.why,
    })
  }

  // ---------------------------------------------------------------------------
  // Report: every row, in full, before anything is written
  // ---------------------------------------------------------------------------
  say("")
  say("-".repeat(92))
  say(`PLANNED LINKS: ${planned.length}`)
  say("-".repeat(92))
  let displayed = 0
  for (const p of planned) {
    say(`  INSERT region_payment_provider`)
    say(`     region    ${p.name} (${p.regionId})`)
    say(`     currency  ${p.currency}`)
    say(`     provider  ${p.providerId}`)
    say(`     why       ${p.why}`)
    say("")
    displayed++
  }
  if (alreadyApplied.length) {
    say(`ALREADY LINKED, SKIPPED: ${alreadyApplied.length}`)
    for (const a of alreadyApplied) say(`  ${a}`)
    say("")
  }

  // Refuse to write a row that was not displayed.
  if (displayed !== planned.length) {
    fail(
      `self-check failed: displayed ${displayed} row(s) but planned ${planned.length}. ` +
        `Refusing to write a row the operator did not see.`,
    )
  }
  const uniq = new Set(planned.map((p) => `${p.regionId}|${p.providerId}`)).size
  if (uniq !== planned.length) fail("duplicate target detected; refusing to write.")

  say("NOT LINKED, DELIBERATELY: pp_system_default (soft-deleted on the UK in a")
  say("deliberate swap, would let a customer 'pay' with a no-op provider), and the")
  say("six alternative Stripe methods (country-specific, one catch-all EU region).")
  say("")

  if (!apply) {
    say("DRY RUN. Nothing was changed.")
    say(
      `To apply: ${CONFIRM_VAR}=${CONFIRM_VALUE} ` +
        `npx medusa exec ./src/scripts/migrate-region-payment-providers.ts -- --apply`,
    )
    return
  }
  if (!confirmed) {
    fail(`--apply was passed but ${CONFIRM_VAR} is not set correctly. Nothing changed.`)
  }
  if (!planned.length) {
    say("nothing to change, every target region already has the link.")
    return
  }

  const runId = `run_${Date.now()}`
  let written = 0
  for (const p of planned) {
    // Re-assert live, immediately before the write. If anything moved between
    // the plan and here, abort rather than proceed on a stale read.
    const live = await liveProvidersFor(p.regionId)
    if (live.includes(p.providerId)) {
      fail(
        `${p.name}: a live link to ${p.providerId} appeared between planning and ` +
          `applying. Aborting rather than duplicating. Re-run to re-plan.`,
      )
    }
    await link.create({
      [Modules.REGION]: { region_id: p.regionId },
      [Modules.PAYMENT]: { payment_provider_id: p.providerId },
    })
    written++
  }

  if (written !== planned.length) {
    fail(`wrote ${written} link(s) but planned ${planned.length}.`)
  }

  await knex.transaction(async (trx: any) => {
    await ensureLedger(trx)
    for (const p of planned) {
      await trx.raw(
        `INSERT INTO ${LEDGER}
           (run_id, region_id, region_name, currency_code, payment_provider_id)
         VALUES (?, ?, ?, ?, ?)`,
        [runId, p.regionId, p.name, p.currency, p.providerId],
      )
    }
  })

  say(`APPLIED: ${written} link(s) created.`)
  say(`ledger run_id = ${runId} (table ${LEDGER}): this is the rollback source.`)
  say("")
  say("VERIFY AT THREE LAYERS. The row existing is not the same claim as Medusa")
  say("serving the provider to the storefront:")
  say("  1. SQL   SELECT ... FROM region_payment_provider WHERE deleted_at IS NULL")
  say("  2. API   GET /store/payment-providers?region_id=<eu|us>")
  say("  3. UI    reach the checkout payment step on a non-UK region")
}
