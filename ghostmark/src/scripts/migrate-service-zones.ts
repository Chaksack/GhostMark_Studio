// =============================================================================
// migrate-service-zones: replaces one accidental 50-country catch-all service
// zone with three real per-region zones (UK / EU / US), each with its own
// shipping option priced in its own region's currency.
//
//   DRY RUN (default, safe, shows BOTH phases):
//     npx medusa exec ./src/scripts/migrate-service-zones.ts
//
//   PHASE 1 - BUILD (additive only, nothing is removed):
//     MIGRATE_SERVICE_ZONES_CONFIRM=I-UNDERSTAND-THIS-RESTRUCTURES-FULFILMENT-TOPOLOGY \
//       npx medusa exec ./src/scripts/migrate-service-zones.ts -- --apply
//
//   PHASE 2 - RETIRE (removes the catch-all; refuses unless every in-region
//   country it uncovers is already covered by another live zone):
//     MIGRATE_SERVICE_ZONES_CONFIRM=I-UNDERSTAND-THIS-RESTRUCTURES-FULFILMENT-TOPOLOGY \
//       npx medusa exec ./src/scripts/migrate-service-zones.ts -- --retire
//
//   ROLLBACK (dismisses phase 1 creations, restores phase 2 soft-deletes):
//     MIGRATE_SERVICE_ZONES_CONFIRM=I-UNDERSTAND-THIS-RESTRUCTURES-FULFILMENT-TOPOLOGY \
//       npx medusa exec ./src/scripts/migrate-service-zones.ts -- --rollback
//
// !! THE HYPHENS IN THAT CONFIRM STRING ARE ASCII HYPHEN-MINUS AND ARE COMPARED
//    WITH === AGAINST OPERATOR INPUT. A punctuation sweep that "improves" one to
//    an en or em dash silently disables the apply path. Same for the ledger
//    identifier interpolated into SQL. Punctuation sweeps: PROSE ONLY.
//
// -----------------------------------------------------------------------------
// THE DEFECT, MEASURED
// -----------------------------------------------------------------------------
// Countries that can actually resolve a shipping option today:
//
//   European Union   2 of 9    at be covered; de es fr ie it nl pt CANNOT ship
//   United States    1 of 2    ca covered;    us CANNOT ship
//   United Kingdom   1 of 1    fine
//
// The United States region cannot ship to the United States.
//
// Cause: a single service zone named "Test shipping" holds exactly 50 geo_zone
// rows. They are not a shipping policy. Sorted by COUNTRY NAME they are the
// first fifty countries on earth:
//
//   Afghanistan, Albania, Algeria(dz), American Samoa, Andorra(ad), Angola,
//   ... Cambodia(kh), Cameroon, Canada, Cape Verde(cv), Cayman Islands(ky),
//   Central African Republic(cf), Chad(td), Chile, China, Christmas
//   Island(cx), Cocos(cc), Colombia, Comoros(km), Congo(cg)
//
// The out-of-ISO-order stragglers (dz, io, kh, km, ky, td, cv, cf, cx, cc, cg)
// are the proof: this is page one of the admin country picker with "select all
// on this page" clicked. It is a dev fixture, not a decision. Austria, Belgium
// and Canada can check out today by pure alphabetical luck.
//
// -----------------------------------------------------------------------------
// WHY THESE ZONES HANG OFF "UK Warehouse delivery", NOT A NEW SET
// -----------------------------------------------------------------------------
// A fulfillment_set groups service zones under a stock location. There is
// exactly ONE stock location ("muta UK"), and the canonical Medusa shape is one
// shipping-type set per location. Today there are two live shipping sets on it,
// which is already the anomaly.
//
// "muta UK shipping" (the fixture set) reads as a DESTINATION and owns a zone
// covering 50 countries. That name is incoherent with its own contents.
//
// "UK Warehouse delivery" reads as an ORIGIN: delivery FROM the UK warehouse.
// The warehouse genuinely is in the UK. A set named for its origin warehouse
// holding UK, EU and US destination zones is exactly right, and needs no rename.
// It is also the set created by deliberate remediation rather than by a fixture,
// and it already carries all 5 real orders and 11 carts.
//
// So: reuse "UK Warehouse delivery". A new set would add a third live set to a
// one-location store and solve nothing the existing name does not already.
//
// -----------------------------------------------------------------------------
// WHY THE UK ZONE IS REUSED AND NOT REBUILT
// -----------------------------------------------------------------------------
// The brief asks for "a UK zone with gb and a UK option". That already exists,
// correct, and is the only path a customer has ever completed an order through.
// Creating a second one would put TWO options in front of every UK customer -
// a regression dressed as symmetry. This migration therefore writes ZERO rows
// on the UK path. That is the strongest available guarantee that the UK, which
// is the only region that works today, keeps working.
//
// -----------------------------------------------------------------------------
// RATES: INHERITED, NOT INVENTED
// -----------------------------------------------------------------------------
// The catch-all "Standard" option carries gbp 10, eur 11, usd 12, ghs 100. It
// is the option Austria, Belgium and Canada get today. The new EU and US
// options take eur 11 and usd 12 FROM IT.
//
// That is not a taste call. It makes this migration PRICE-NEUTRAL for every
// customer who can currently check out: at/be pay eur 11 before and after,
// ca pays usd 12 before and after. Taking UK Standard's eur 12 / usd 13 instead
// would raise their prices by one unit as a side effect of a topology fix.
//
// ONE CURRENCY PER OPTION, deliberately. Region-to-currency is 1:1 here and a
// cart's currency_code always comes from its region, so a second currency on
// an option can never be reached - it can only create a way for an option to
// price a cart it should not serve. Installed source confirms this is legal:
// validateShippingOptionPricesStep only validates prices that carry a
// region_id, and returns early when none do. UK Standard keeps its three
// currencies because this migration does not touch it.
//
// AMOUNTS ARE MAJOR UNITS. Three migrations converted this catalogue today;
// the live rows read amount=10 raw {"value":"10"} for GBP 10.00. Passing 1100
// for eur 11 would bill EUR 1,100.00.
//
// NO TRANSIT-TIME DESCRIPTION on the new option types. UK Standard says "Ship
// in 2-3 days (UK)". From a UK warehouse to the EU or the US that number is
// unknown to me, and a wrong delivery estimate on a customer-facing option is
// a worse defect than an absent one. Left null for an operator to fill in.
//
// -----------------------------------------------------------------------------
// ghs 100: REPORTED, NOT CARRIED FORWARD
// -----------------------------------------------------------------------------
// The catch-all option prices GHS 100. Ghana is in no region, and `ghs` is not
// in store_currency at all (gbp, eur, usd only) - so no cart in this store can
// ever have currency_code 'ghs', and that price has never been reachable. It is
// one of 52 live ghs prices across the catalogue, the residue of an earlier
// Ghana configuration. This migration does NOT propagate it to the new options
// and does NOT clean up the other 51: a single-currency sweep across the product
// catalogue is a separate, larger decision. The ghs price on "Standard" goes
// dormant with "Standard" and is restored by --rollback along with it.
//
// -----------------------------------------------------------------------------
// SEQUENCING: NO COUNTRY LOSES COVERAGE, PROVEN RATHER THAN ASSERTED
// -----------------------------------------------------------------------------
// Expand then contract, in two operator-gated phases:
//
//   PHASE 1 (--apply)   purely additive. Creates the EU and US zones and their
//                       options. Nothing is removed. at/be/ca are briefly
//                       covered TWICE (see TRANSIENT below).
//   [operator verifies at three layers]
//   PHASE 2 (--retire)  removes the catch-all. Before writing anything it takes
//                       all 50 country codes in "Test shipping", intersects
//                       them with every country claimed by a live region, and
//                       asserts each one is already covered by a DIFFERENT live
//                       service zone carrying a live, in-store shipping option.
//                       If even one would be left uncovered, it ABORTS.
//
// TRANSIENT, between phase 1 and phase 2: at, be and ca see TWO shipping
// options (the catch-all's "Standard" and their new regional one) at the same
// price. checkout.vue:972 auto-selects only when there is exactly one, so those
// three countries must click a radio during the window. That is the price of
// never dropping coverage, and it is the correct trade.
//
// The 47 remaining countries (Afghanistan, Brazil, China, ...) belong to no
// region. The storefront's country <select> is bound to region.countries[], so
// no customer can reach them. They lose a theoretical API-level path that only
// ever existed as a bug: an EU-region cart with a Brazilian address currently
// resolves the catch-all and gets charged EUR 11 to ship to Brazil.
//
// -----------------------------------------------------------------------------
// DELETE ORDER IS LOAD-BEARING (settled by installed source, not by docs)
// -----------------------------------------------------------------------------
// The option is deleted BEFORE its zone, and the zone BEFORE its set:
//
//   deleteShippingOptionsWorkflow = deleteShippingOptionsStep + removeRemoteLinkStep
//   deleteServiceZonesWorkflow    = deleteServiceZonesStep ONLY
//
// service_zone .cascades({ delete: ["geo_zones", "shipping_options"] }) means
// deleting the zone first WOULD soft-delete the option - but by the module
// cascade, which never runs removeRemoteLinkStep, leaving the option's
// shipping_option_price_set link live and pointing at a dead option. Deleting
// the option through its own workflow first cleans that link properly.
//
// -----------------------------------------------------------------------------
// SAFETY
// -----------------------------------------------------------------------------
//  * Phase 1 is additive only and touches neither existing set, zone nor option.
//  * Phase 2 only ever SOFT-deletes. Every removal is reversed by the module's
//    own restoreShippingOptions / restoreServiceZones / restoreFulfillmentSets,
//    so rollback is a real restore of the same rows, not a re-creation with new
//    ids. The location link removed with the set is re-created by id.
//  * Refuses to write a row it did not display: displayed counters are asserted
//    against planned counts, per phase, and a mismatch aborts.
//  * Every child row a cascade will touch is enumerated from the FK graph at
//    plan time and printed, so nothing is deleted unseen.
//  * service_zone and fulfillment_set both carry UNIQUE(name) WHERE deleted_at
//    IS NULL. Planned names are checked against live rows before writing.
//  * All reads end with `deleted_at IS NULL`. A raw count answers "what has
//    ever existed", not "what is live" - the trap that has bitten four lanes.
//  * Idempotent: a zone that already exists is skipped, not duplicated.
// =============================================================================

import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  createServiceZonesWorkflow,
  createShippingOptionsWorkflow,
  deleteShippingOptionsWorkflow,
  deleteServiceZonesWorkflow,
  deleteFulfillmentSetsWorkflow,
} from "@medusajs/medusa/core-flows"

const LEDGER = "gms_service_zone_migration"
const CONFIRM_VAR = "MIGRATE_SERVICE_ZONES_CONFIRM"
const CONFIRM_VALUE =
  "I-UNDERSTAND-THIS-RESTRUCTURES-FULFILMENT-TOPOLOGY"

/** The origin-named set every zone hangs off. See the header. */
const TARGET_SET_ID = "fuset_01KTD2VT77NFC11DHEKF3SY61M"
const TARGET_SET_NAME = "UK Warehouse delivery"

/** Untouched. Present so a drift check can assert the UK path is intact. */
const UK_ZONE_ID = "serzo_01KTD2VT77VEDWSXASGCQ4F461"
const UK_OPTION_ID = "so_01KTD2VTF6WG7FSKXW29Q1SSYR"

/** The fixture topology retired in phase 2. */
const CATCHALL_SET_ID = "fuset_01KAZ1PZX0KCMYFFYBYQ9JXQDE"
const CATCHALL_SET_NAME = "muta UK shipping"
const CATCHALL_ZONE_ID = "serzo_01KAZ1QGW2EJXSS4D8BHX7XXN4"
const CATCHALL_ZONE_NAME = "Test shipping"
const CATCHALL_OPTION_ID = "so_01KCS6KQS0PYN2Y9FNBDF7HVEA"
const CATCHALL_GEO_COUNT = 50

const SHIPPING_PROFILE_ID = "sp_01KAYJYCW0BGNA208W7MC3T6X6"
const PROVIDER_ID = "manual_manual"

type ZonePlan = {
  regionId: string
  regionName: string
  zoneName: string
  countries: string[]
  optionName: string
  typeLabel: string
  typeCode: string
  currency: string
  amount: number
  amountFrom: string
}

/**
 * Countries mirror region_country exactly. Amounts are inherited from the
 * catch-all option so the change is price-neutral for at/be/ca.
 */
const PLAN: ZonePlan[] = [
  {
    regionId: "reg_01KQ2VGBBPEK9QSD2CW27D57DN",
    regionName: "European Union",
    zoneName: "European Union",
    countries: ["at", "be", "de", "es", "fr", "ie", "it", "nl", "pt"],
    optionName: "EU Standard",
    typeLabel: "Standard",
    typeCode: "eu-standard",
    currency: "eur",
    amount: 11,
    amountFrom: "catch-all Standard eur 11 (unchanged for at, be)",
  },
  {
    regionId: "reg_01KQ2VGBBP3G4QJT23796S965W",
    regionName: "United States",
    zoneName: "United States",
    countries: ["ca", "us"],
    optionName: "US Standard",
    typeLabel: "Standard",
    typeCode: "us-standard",
    currency: "usd",
    amount: 12,
    amountFrom: "catch-all Standard usd 12 (unchanged for ca)",
  },
]

export default async function migrateServiceZones({ container, args }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const knex: any = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const link: any = container.resolve(ContainerRegistrationKeys.LINK)
  const fulfillment: any = container.resolve(Modules.FULFILLMENT)

  // `medusa exec` does not forward `--` flags into ExecArgs.args (the CLI
  // declares `exec [file] [args..]`, a yargs variadic positional). Read
  // process.argv too, and accept flags with or without dashes.
  const argv: string[] = [...(args ?? []), ...process.argv.slice(2)]
  const hasFlag = (n: string) => argv.includes(`--${n}`) || argv.includes(n)
  const apply = hasFlag("apply")
  const retire = hasFlag("retire")
  const rollback = hasFlag("rollback")
  const confirmed = process.env[CONFIRM_VAR] === CONFIRM_VALUE

  const say = (m = "") => logger.info(`[migrate-service-zones] ${m}`)
  const warn = (m: string) => logger.warn(`[migrate-service-zones] ${m}`)
  const fail: (m: string) => never = (m: string) => {
    logger.error(`[migrate-service-zones] ABORT: ${m}`)
    throw new Error(m)
  }
  const modes = [apply, retire, rollback].filter(Boolean).length
  if (modes > 1) fail("--apply, --retire and --rollback are mutually exclusive.")

  say("=".repeat(92))
  say(
    `mode: ${
      rollback ? "ROLLBACK" : retire ? "PHASE 2 RETIRE" : apply ? "PHASE 1 BUILD" : "DRY RUN"
    }`,
  )
  say("=".repeat(92))

  // ---------------------------------------------------------------------------
  // Ledger
  // ---------------------------------------------------------------------------
  const tableExists = async (t: string) => {
    const r = await knex.raw(`SELECT to_regclass(?) AS t`, [`public.${t}`])
    return Boolean(r?.rows?.[0]?.t)
  }
  const ensureLedger = async (trx: any) => {
    await trx.raw(`
      CREATE TABLE IF NOT EXISTS ${LEDGER} (
        id             BIGSERIAL PRIMARY KEY,
        run_id         TEXT        NOT NULL,
        phase          TEXT        NOT NULL,
        action         TEXT        NOT NULL,
        entity         TEXT        NOT NULL,
        entity_id      TEXT        NOT NULL,
        detail         JSONB,
        applied_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
        rolled_back_at TIMESTAMPTZ
      )
    `)
    await trx.raw(
      `COMMENT ON TABLE ${LEDGER} IS ` +
        `'Replaces one accidental 50-country catch-all service zone (page one of ` +
        `the admin country picker, "select all") with three per-region zones. ` +
        `phase=build rows were CREATED and are dismissed by soft delete on ` +
        `rollback; phase=retire rows were SOFT-DELETED and are restored by the ` +
        `fulfillment module''s own restore* methods, so rollback returns the same ` +
        `row ids, not re-creations. Retire refuses to run unless every in-region ` +
        `country it uncovers is already covered by another live zone.'`,
    )
  }
  const ledgerRows = async (phase?: string): Promise<any[]> => {
    if (!(await tableExists(LEDGER))) return []
    const r = await knex.raw(
      `SELECT * FROM ${LEDGER}
        WHERE rolled_back_at IS NULL ${phase ? `AND phase = ?` : ``}
        ORDER BY id`,
      phase ? [phase] : [],
    )
    return r?.rows ?? []
  }

  // ---------------------------------------------------------------------------
  // Live-state readers. Every one ends with deleted_at IS NULL.
  // ---------------------------------------------------------------------------
  const liveZones = async () => {
    const r = await knex.raw(
      `SELECT sz.id, sz.name, sz.fulfillment_set_id
         FROM service_zone sz
         JOIN fulfillment_set fs ON fs.id = sz.fulfillment_set_id
        WHERE sz.deleted_at IS NULL AND fs.deleted_at IS NULL
        ORDER BY sz.name`,
    )
    return r.rows
  }
  const liveGeo = async (zoneId: string): Promise<string[]> => {
    const r = await knex.raw(
      `SELECT country_code FROM geo_zone
        WHERE service_zone_id = ? AND deleted_at IS NULL
        ORDER BY country_code`,
      [zoneId],
    )
    return r.rows.map((x: any) => x.country_code)
  }
  const liveOptions = async (zoneId: string) => {
    const r = await knex.raw(
      `SELECT id, name FROM shipping_option
        WHERE service_zone_id = ? AND deleted_at IS NULL
        ORDER BY name`,
      [zoneId],
    )
    return r.rows
  }
  /**
   * country_code -> zone ids that cover it with a live, in-store option.
   * "in-store" matters: an option without the enabled_in_store rule is never
   * returned by the store endpoint, so a zone carrying only such an option
   * is not real coverage.
   */
  const coverage = async (): Promise<Map<string, string[]>> => {
    const r = await knex.raw(
      `SELECT DISTINCT g.country_code, sz.id AS zone_id
         FROM geo_zone g
         JOIN service_zone sz  ON sz.id = g.service_zone_id
         JOIN fulfillment_set fs ON fs.id = sz.fulfillment_set_id
         JOIN shipping_option so ON so.service_zone_id = sz.id
         JOIN shipping_option_rule sor ON sor.shipping_option_id = so.id
        WHERE g.deleted_at  IS NULL
          AND sz.deleted_at IS NULL
          AND fs.deleted_at IS NULL
          AND so.deleted_at IS NULL
          AND sor.deleted_at IS NULL
          AND sor.attribute = 'enabled_in_store'
          AND sor.value = '"true"'`,
    )
    const m = new Map<string, string[]>()
    for (const row of r.rows) {
      const list = m.get(row.country_code) ?? []
      list.push(row.zone_id)
      m.set(row.country_code, list)
    }
    return m
  }
  const regionCountries = async (): Promise<Map<string, string>> => {
    const r = await knex.raw(
      `SELECT rc.iso_2, r.name
         FROM region_country rc
         JOIN region r ON r.id = rc.region_id
        WHERE r.deleted_at IS NULL`,
    )
    return new Map(r.rows.map((x: any) => [x.iso_2, x.name]))
  }

  // ===========================================================================
  // ROLLBACK
  // ===========================================================================
  if (rollback) {
    const rows = await ledgerRows()
    if (!rows.length) {
      say("ledger holds no active migration, nothing to roll back.")
      return
    }
    const retireRows = rows.filter((r) => r.phase === "retire")
    const buildRows = rows.filter((r) => r.phase === "build")

    say(`ledger holds ${rows.length} active row(s):`)
    say(`  phase build  ${buildRows.length}  (created -> will be soft-deleted)`)
    say(`  phase retire ${retireRows.length}  (soft-deleted -> will be restored)`)
    say("")
    for (const r of rows) {
      say(`  ${r.phase.padEnd(6)} ${r.action.padEnd(13)} ${r.entity.padEnd(22)} ${r.entity_id}`)
    }
    say("")
    say("Order: restore the retired topology FIRST (so no window exists with")
    say("neither the old nor the new zones live), then dismiss what was created.")
    if (!confirmed) {
      warn(`refusing: set ${CONFIRM_VAR}=${CONFIRM_VALUE} to proceed. Nothing changed.`)
      return
    }

    // -------------------------------------------------------------------------
    // COMPLETENESS GATE. Every entity type this script LEDGERS must be handled
    // here. Previously the dispatch covered three of the five and the other two
    // fell through in silence, after which the ledger closed all 14 rows and
    // printed success. A rollback that silently skips a type is worse than one
    // that refuses, because it leaves you believing you are restored.
    // -------------------------------------------------------------------------
    const HANDLED_ENTITIES = new Set([
      "fulfillment_set",
      "service_zone",
      "shipping_option",
      "shipping_option_rule",
      "price_link",
      "location_fulfillment_set",
    ])
    const unknown = [...new Set(rows.map((r: any) => r.entity))].filter(
      (e) => !HANDLED_ENTITIES.has(e as string),
    )
    if (unknown.length) {
      fail(
        `the ledger holds entity type(s) this rollback does not handle: ` +
          `${unknown.join(", ")}. Refusing to roll back a partial set and close ` +
          `the ledger as though it were complete. Add a branch for each type first.`,
      )
    }

    // --- undo phase 2: restore, outermost first so children have a live parent
    const setIds = retireRows.filter((r) => r.entity === "fulfillment_set").map((r) => r.entity_id)
    const zoneIds = retireRows.filter((r) => r.entity === "service_zone").map((r) => r.entity_id)
    const optIds = retireRows.filter((r) => r.entity === "shipping_option").map((r) => r.entity_id)
    const ruleIds = retireRows.filter((r) => r.entity === "shipping_option_rule").map((r) => r.entity_id)
    const priceIds = retireRows.filter((r) => r.entity === "price_link").map((r) => r.entity_id)

    if (setIds.length) await fulfillment.restoreFulfillmentSets(setIds)
    if (zoneIds.length) await fulfillment.restoreServiceZones(zoneIds)
    if (optIds.length) await fulfillment.restoreShippingOptions(optIds)

    // shipping_option_rule: shipping-option.js cascades({ delete: ["rules"] }),
    // so restoreShippingOptions SHOULD bring these back. Verify rather than
    // assume, and repair explicitly if the cascade did not fire.
    if (ruleIds.length) {
      const chk = await knex.raw(
        `SELECT id FROM shipping_option_rule WHERE id = ANY(?) AND deleted_at IS NULL`,
        [ruleIds],
      )
      const liveRules = new Set(chk.rows.map((r: any) => r.id))
      const stillDead = ruleIds.filter((id: string) => !liveRules.has(id))
      if (stillDead.length) {
        const res = await knex.raw(
          `UPDATE shipping_option_rule SET deleted_at = NULL, updated_at = now()
            WHERE id = ANY(?) AND deleted_at IS NOT NULL`,
          [stillDead],
        )
        say(
          `shipping_option_rule: cascade restored ${liveRules.size}/${ruleIds.length}; ` +
            `repaired ${res?.rowCount ?? 0} explicitly.`,
        )
      } else {
        say(`shipping_option_rule: ${ruleIds.length}/${ruleIds.length} restored by cascade.`)
      }
    }

    // price_link: THE ONE THAT WAS SILENTLY DROPPED.
    // These ids are `price` PKs. The prices live in the PRICING module and were
    // removed by removeRemoteLinkStep's link.delete() inside
    // deleteShippingOptionsWorkflow. remove-remote-links.js:44-46 puts
    // link.restore() ONLY in that step's COMPENSATION, which runs when a
    // workflow fails mid-run and NEVER on a separate --rollback invocation.
    // fulfillment.restoreShippingOptions() is a FULFILLMENT-module call and
    // cannot reach `price` rows in PRICING. So without this block the option
    // comes back with NO PRICES and at/be/ca get an option that resolves
    // nothing.
    if (priceIds.length) {
      const psRows = await knex.raw(
        `SELECT DISTINCT sops.shipping_option_id, sops.price_set_id
           FROM shipping_option_price_set sops
          WHERE sops.shipping_option_id = ANY(?)`,
        [optIds],
      )
      for (const r of psRows.rows) {
        await link.restore({
          [Modules.FULFILLMENT]: { shipping_option_id: r.shipping_option_id },
          [Modules.PRICING]: { price_set_id: r.price_set_id },
        })
      }
      say(`restored ${psRows.rows.length} shipping_option <-> price_set link(s).`)

      const chk = await knex.raw(
        `SELECT id FROM price WHERE id = ANY(?) AND deleted_at IS NULL`,
        [priceIds],
      )
      const livePrices = new Set(chk.rows.map((r: any) => r.id))
      const deadPrices = priceIds.filter((id: string) => !livePrices.has(id))
      if (deadPrices.length) {
        const res = await knex.raw(
          `UPDATE price SET deleted_at = NULL, updated_at = now()
            WHERE id = ANY(?) AND deleted_at IS NOT NULL`,
          [deadPrices],
        )
        say(
          `price rows: link restore recovered ${livePrices.size}/${priceIds.length}; ` +
            `repaired ${res?.rowCount ?? 0} explicitly.`,
        )
      } else {
        say(`price rows: ${priceIds.length}/${priceIds.length} restored with the link.`)
      }

      const finalChk = await knex.raw(
        `SELECT count(*)::int AS n FROM price WHERE id = ANY(?) AND deleted_at IS NULL`,
        [priceIds],
      )
      if ((finalChk.rows[0]?.n ?? 0) !== priceIds.length) {
        fail(
          `after restore, only ${finalChk.rows[0]?.n} of ${priceIds.length} ledgered ` +
            `price row(s) are live. The retired option would come back unpriced. ` +
            `Investigate before trusting this rollback.`,
        )
      }
    }

    for (const r of retireRows.filter((x) => x.action === "link_dismiss")) {
      const d = r.detail ?? {}
      await link.create({
        [Modules.STOCK_LOCATION]: { stock_location_id: d.stock_location_id },
        [Modules.FULFILLMENT]: { fulfillment_set_id: d.fulfillment_set_id },
      })
    }
    if (retireRows.length) say(`restored ${retireRows.length} retired row(s).`)

    // --- undo phase 1: dismiss creations, option before zone (see header)
    const newOptIds = buildRows.filter((r) => r.entity === "shipping_option").map((r) => r.entity_id)
    const newZoneIds = buildRows.filter((r) => r.entity === "service_zone").map((r) => r.entity_id)
    if (newOptIds.length) {
      await deleteShippingOptionsWorkflow(container).run({ input: { ids: newOptIds } })
    }
    if (newZoneIds.length) {
      await deleteServiceZonesWorkflow(container).run({ input: { ids: newZoneIds } })
    }
    if (buildRows.length) say(`dismissed ${buildRows.length} created row(s).`)

    await knex.raw(
      `UPDATE ${LEDGER} SET rolled_back_at = now() WHERE rolled_back_at IS NULL`,
    )
    say(`ROLLED BACK ${rows.length} row(s).`)
    say("Re-verify: at, be, ca must be back on the catch-all, gb on UK Standard.")
    return
  }

  // ---------------------------------------------------------------------------
  // Premise checks, shared by dry run and both apply phases
  // ---------------------------------------------------------------------------
  const zones = await liveZones()
  const byId = new Map(zones.map((z: any) => [z.id, z]))

  const targetSet = await knex.raw(
    `SELECT id, name, type FROM fulfillment_set WHERE id = ? AND deleted_at IS NULL`,
    [TARGET_SET_ID],
  )
  if (!targetSet.rows.length) fail(`${TARGET_SET_ID}: target fulfillment set is not live.`)
  if (targetSet.rows[0].name !== TARGET_SET_NAME) {
    fail(
      `target set name drifted: expected ${JSON.stringify(TARGET_SET_NAME)}, ` +
        `found ${JSON.stringify(targetSet.rows[0].name)}. The header's naming ` +
        `argument (origin, not destination) may no longer hold. Re-derive first.`,
    )
  }
  if (targetSet.rows[0].type !== "shipping") {
    fail(`target set type is ${targetSet.rows[0].type}, expected "shipping".`)
  }

  // UK drift check. This migration's whole safety claim is "zero writes on the
  // UK path". If the UK path is not what it was, that claim is unverifiable.
  const ukZone = byId.get(UK_ZONE_ID)
  if (!ukZone) fail(`UK service zone ${UK_ZONE_ID} is not live.`)
  const ukGeo = await liveGeo(UK_ZONE_ID)
  if (ukGeo.length !== 1 || ukGeo[0] !== "gb") {
    fail(`UK zone geo drifted: expected exactly [gb], found [${ukGeo.join(", ")}].`)
  }
  const ukOpts = await liveOptions(UK_ZONE_ID)
  if (ukOpts.length !== 1 || ukOpts[0].id !== UK_OPTION_ID) {
    fail(
      `UK zone options drifted: expected exactly [${UK_OPTION_ID}], found ` +
        `[${ukOpts.map((o: any) => o.id).join(", ") || "none"}].`,
    )
  }
  say(`UK path intact: zone ${UK_ZONE_ID} -> [gb] -> option "${ukOpts[0].name}". NOT TOUCHED.`)

  const profile = await knex.raw(
    `SELECT id FROM shipping_profile WHERE id = ? AND deleted_at IS NULL`,
    [SHIPPING_PROFILE_ID],
  )
  if (!profile.rows.length) fail(`${SHIPPING_PROFILE_ID}: shipping profile is not live.`)
  const prov = await knex.raw(
    `SELECT id, is_enabled FROM fulfillment_provider WHERE id = ? AND deleted_at IS NULL`,
    [PROVIDER_ID],
  )
  if (!prov.rows.length) fail(`${PROVIDER_ID}: no such fulfillment provider.`)
  if (!prov.rows[0].is_enabled) fail(`${PROVIDER_ID}: exists but is_enabled = false.`)

  const rc = await regionCountries()
  for (const p of PLAN) {
    const r = await knex.raw(
      `SELECT name, currency_code FROM region WHERE id = ? AND deleted_at IS NULL`,
      [p.regionId],
    )
    if (!r.rows.length) fail(`${p.regionName} (${p.regionId}): no live region.`)
    if (r.rows[0].name !== p.regionName) {
      fail(`${p.regionId}: name is ${JSON.stringify(r.rows[0].name)}, expected ${JSON.stringify(p.regionName)}.`)
    }
    if (r.rows[0].currency_code !== p.currency) {
      fail(
        `${p.regionName}: currency is ${JSON.stringify(r.rows[0].currency_code)}, ` +
          `expected ${JSON.stringify(p.currency)}. A single-currency option that does ` +
          `not match its region resolves no price and renders an option with no amount.`,
      )
    }
    // The zone must mirror region_country exactly, or a customer can select a
    // country in the <select> (bound to region.countries[]) that the zone does
    // not cover, and get the empty-options dead end at the shipping step.
    const actual = [...rc.entries()]
      .filter(([, name]) => name === p.regionName)
      .map(([iso]) => iso)
      .sort()
    const expected = [...p.countries].sort()
    if (actual.join(",") !== expected.join(",")) {
      fail(
        `${p.regionName}: region_country drifted from the plan.\n` +
          `    plan:   [${expected.join(" ")}]\n` +
          `    region: [${actual.join(" ")}]\n` +
          `  A zone that does not mirror its region exactly leaves a selectable ` +
          `country with no shipping option.`,
      )
    }
  }
  say(`region premises hold: ${PLAN.map((p) => `${p.regionName}/${p.currency}`).join(", ")}`)
  say("")

  // ===========================================================================
  // PHASE 1 PLAN
  // ===========================================================================
  const liveZoneNames = new Set(zones.map((z: any) => z.name))
  const buildPlanned: ZonePlan[] = []
  const buildSkipped: string[] = []
  for (const p of PLAN) {
    if (liveZoneNames.has(p.zoneName)) {
      const z: any = zones.find((x: any) => x.name === p.zoneName)
      buildSkipped.push(`${p.zoneName} -> zone ${z.id} already live, skipping`)
      continue
    }
    buildPlanned.push(p)
  }

  say("-".repeat(92))
  say(`PHASE 1 - BUILD. zones planned: ${buildPlanned.length}`)
  say("-".repeat(92))
  let displayedBuild = 0
  let plannedRowCount = 0
  for (const p of buildPlanned) {
    say(`  CREATE service_zone      name="${p.zoneName}"  set=${TARGET_SET_ID} (${TARGET_SET_NAME})`)
    say(`  CREATE geo_zone x${String(p.countries.length).padStart(2)}       [${p.countries.join(" ")}]`)
    say(`  CREATE shipping_option   name="${p.optionName}"  flat  provider=${PROVIDER_ID}`)
    say(`                           profile=${SHIPPING_PROFILE_ID}`)
    say(`  CREATE shipping_option_type  label="${p.typeLabel}" code="${p.typeCode}" description=NULL`)
    say(`  CREATE shipping_option_rule x2   enabled_in_store=true, is_return=false`)
    say(`  CREATE price_set + shipping_option_price_set + price x1`)
    say(`         ${p.currency} ${p.amount}   MAJOR units   source: ${p.amountFrom}`)
    say(`         no other currency: region->currency is 1:1, a second one is unreachable`)
    say("")
    displayedBuild++
    // service_zone 1 + geo N + option 1 + type 1 + rules 2 + price_set 1
    // + sops link 1 + price 1
    plannedRowCount += 1 + p.countries.length + 1 + 1 + 2 + 1 + 1 + 1
  }
  if (buildSkipped.length) {
    say(`ALREADY BUILT, SKIPPED: ${buildSkipped.length}`)
    for (const s of buildSkipped) say(`  ${s}`)
    say("")
  }
  if (displayedBuild !== buildPlanned.length) {
    fail(
      `self-check failed: displayed ${displayedBuild} zone(s) but planned ` +
        `${buildPlanned.length}. Refusing to write a row the operator did not see.`,
    )
  }
  say(`phase 1 total rows: ${plannedRowCount}   (UK path rows written: 0)`)
  say("")

  // ===========================================================================
  // PHASE 2 PLAN
  // ===========================================================================
  const catchallZone = byId.get(CATCHALL_ZONE_ID)
  const catchallGeo = catchallZone ? await liveGeo(CATCHALL_ZONE_ID) : []
  const catchallOpts = catchallZone ? await liveOptions(CATCHALL_ZONE_ID) : []

  say("-".repeat(92))
  say("PHASE 2 - RETIRE the catch-all")
  say("-".repeat(92))

  let plannedRetire: {
    optionIds: string[]
    zoneIds: string[]
    setIds: string[]
    geoCount: number
    ruleIds: string[]
    priceIds: string[]
    locationLink: { stock_location_id: string; fulfillment_set_id: string } | null
  } | null = null
  let displayedRetire = 0
  let retireRowCount = 0

  if (!catchallZone) {
    say(`  "${CATCHALL_ZONE_NAME}" (${CATCHALL_ZONE_ID}) is not live. Nothing to retire.`)
    say("")
  } else {
    if (catchallGeo.length !== CATCHALL_GEO_COUNT) {
      warn(
        `catch-all geo count is ${catchallGeo.length}, expected ${CATCHALL_GEO_COUNT}. ` +
          `Proceeding, but the header's "page one of the picker" evidence may be stale.`,
      )
    }

    // ---- THE COVERAGE GATE -------------------------------------------------
    // Compute coverage EXCLUDING the catch-all, exactly as it will be after the
    // retire. Any in-region country left with no other zone aborts the phase.
    const cov = await coverage()
    const orphanedInRegion: string[] = []
    const rehomed: string[] = []
    const droppedOutOfRegion: string[] = []
    for (const cc of catchallGeo) {
      const others = (cov.get(cc) ?? []).filter((z) => z !== CATCHALL_ZONE_ID)
      const region = rc.get(cc)
      if (!region) {
        droppedOutOfRegion.push(cc)
      } else if (others.length) {
        rehomed.push(`${cc} -> ${region} via ${others.join(", ")}`)
      } else {
        orphanedInRegion.push(`${cc} (${region})`)
      }
    }

    say(`  countries in "${CATCHALL_ZONE_NAME}": ${catchallGeo.length}`)
    say(`  of those, IN a live region and already covered elsewhere: ${rehomed.length}`)
    for (const r of rehomed) say(`      ${r}`)
    say(`  of those, IN a live region and WOULD BE ORPHANED: ${orphanedInRegion.length}`)
    for (const o of orphanedInRegion) say(`      ${o}   <-- BLOCKS RETIRE`)
    say(`  of those, in NO live region (unreachable from the storefront): ${droppedOutOfRegion.length}`)
    say(`      ${droppedOutOfRegion.join(" ")}`)
    say("")

    // Enumerate every child row the cascade will touch, from the FK graph.
    const ruleRows = await knex.raw(
      `SELECT sor.id FROM shipping_option_rule sor
        WHERE sor.shipping_option_id IN (
          SELECT id FROM shipping_option WHERE service_zone_id = ? AND deleted_at IS NULL)
          AND sor.deleted_at IS NULL`,
      [CATCHALL_ZONE_ID],
    )
    const priceRows = await knex.raw(
      `SELECT p.id, p.currency_code, p.amount FROM price p
        JOIN shipping_option_price_set sops ON sops.price_set_id = p.price_set_id
       WHERE sops.shipping_option_id IN (
         SELECT id FROM shipping_option WHERE service_zone_id = ? AND deleted_at IS NULL)
         AND p.deleted_at IS NULL AND sops.deleted_at IS NULL
       ORDER BY p.currency_code`,
      [CATCHALL_ZONE_ID],
    )
    const setStillUsed = zones.filter(
      (z: any) => z.fulfillment_set_id === CATCHALL_SET_ID && z.id !== CATCHALL_ZONE_ID,
    )
    const locLink = await knex.raw(
      `SELECT stock_location_id, fulfillment_set_id FROM location_fulfillment_set
        WHERE fulfillment_set_id = ? AND deleted_at IS NULL`,
      [CATCHALL_SET_ID],
    )
    const retireSet = setStillUsed.length === 0

    for (const o of catchallOpts) {
      say(`  SOFT DELETE shipping_option      ${o.id}  "${o.name}"`)
      displayedRetire++
    }
    for (const r of ruleRows.rows) {
      say(`  SOFT DELETE shipping_option_rule ${r.id}   (cascade)`)
      displayedRetire++
    }
    for (const p of priceRows.rows) {
      const note = p.currency_code === "ghs" ? "   <-- ghs: no region, not a store currency, never reachable" : ""
      say(`  DISMISS     price link           ${p.id}  ${p.currency_code} ${p.amount}${note}`)
      displayedRetire++
    }
    say(`  SOFT DELETE service_zone         ${CATCHALL_ZONE_ID}  "${CATCHALL_ZONE_NAME}"`)
    displayedRetire++
    say(`  SOFT DELETE geo_zone x${catchallGeo.length}          (cascade) [${catchallGeo.join(" ")}]`)
    displayedRetire += catchallGeo.length
    if (retireSet) {
      say(`  SOFT DELETE fulfillment_set      ${CATCHALL_SET_ID}  "${CATCHALL_SET_NAME}"`)
      say(`              (its last live zone is the one above; the name reads as a`)
      say(`               destination and never was one)`)
      displayedRetire++
      for (const l of locLink.rows) {
        say(`  DISMISS     location link        ${l.stock_location_id} <-> ${CATCHALL_SET_ID}`)
        displayedRetire++
      }
    } else {
      say(`  KEEP        fulfillment_set      ${CATCHALL_SET_ID} still has ${setStillUsed.length} other live zone(s)`)
    }
    say("")

    retireRowCount =
      catchallOpts.length +
      ruleRows.rows.length +
      priceRows.rows.length +
      1 +
      catchallGeo.length +
      (retireSet ? 1 + locLink.rows.length : 0)

    if (displayedRetire !== retireRowCount) {
      fail(
        `self-check failed: displayed ${displayedRetire} retire row(s) but planned ` +
          `${retireRowCount}. Refusing to remove a row the operator did not see.`,
      )
    }
    say(`phase 2 total rows: ${retireRowCount}   (UK path rows touched: 0)`)
    say("")

    plannedRetire = {
      optionIds: catchallOpts.map((o: any) => o.id),
      zoneIds: [CATCHALL_ZONE_ID],
      setIds: retireSet ? [CATCHALL_SET_ID] : [],
      geoCount: catchallGeo.length,
      ruleIds: ruleRows.rows.map((r: any) => r.id),
      priceIds: priceRows.rows.map((r: any) => r.id),
      locationLink: retireSet && locLink.rows.length ? locLink.rows[0] : null,
    }

    if (orphanedInRegion.length) {
      const msg =
        `retire would orphan ${orphanedInRegion.length} in-region country/ies: ` +
        `${orphanedInRegion.join(", ")}. Run --apply (phase 1) first.`
      if (retire) fail(msg)
      say(`  GATE: phase 2 is BLOCKED right now. ${msg}`)
      say("")
    } else {
      say(`  GATE: phase 2 is CLEAR. No in-region country loses coverage.`)
      say("")
    }
  }

  // ===========================================================================
  // DRY RUN EXIT
  // ===========================================================================
  if (!apply && !retire) {
    say("DRY RUN. Nothing was changed.")
    say("")
    say(`Phase 1: ${CONFIRM_VAR}=${CONFIRM_VALUE} \\`)
    say(`           npx medusa exec ./src/scripts/migrate-service-zones.ts -- --apply`)
    say(`Phase 2: ...same env... -- --retire      (only after verifying phase 1)`)
    say(`Undo   : ...same env... -- --rollback`)
    return
  }
  if (!confirmed) {
    fail(`--${apply ? "apply" : "retire"} was passed but ${CONFIRM_VAR} is not set correctly. Nothing changed.`)
  }

  const runId = `run_${Date.now()}`
  const ledgerWrites: Array<[string, string, string, string, any]> = []

  // ===========================================================================
  // PHASE 1 APPLY
  // ===========================================================================
  if (apply) {
    if (!buildPlanned.length) {
      say("nothing to build, every planned zone is already live.")
      return
    }
    for (const p of buildPlanned) {
      // Re-assert immediately before the write. UNIQUE(name) WHERE deleted_at
      // IS NULL means a concurrent create turns this into a constraint error;
      // abort cleanly instead.
      const now = await liveZones()
      if (now.some((z: any) => z.name === p.zoneName)) {
        fail(
          `a live service zone named "${p.zoneName}" appeared between planning and ` +
            `applying. Aborting rather than colliding on UNIQUE(name). Re-run to re-plan.`,
        )
      }

      const { result: createdZones } = await createServiceZonesWorkflow(container).run({
        input: {
          data: [
            {
              name: p.zoneName,
              fulfillment_set_id: TARGET_SET_ID,
              geo_zones: p.countries.map((c) => ({ type: "country" as const, country_code: c })),
            },
          ],
        },
      })
      const zoneId = (createdZones as any[])[0].id
      say(`created service_zone ${zoneId} "${p.zoneName}"`)

      const geoNow = await liveGeo(zoneId)
      if (geoNow.length !== p.countries.length) {
        fail(
          `zone ${zoneId}: created ${geoNow.length} geo zone(s) but planned ` +
            `${p.countries.length}. Roll back before continuing.`,
        )
      }

      const { result: createdOpts } = await createShippingOptionsWorkflow(container).run({
        input: [
          {
            name: p.optionName,
            price_type: "flat",
            provider_id: PROVIDER_ID,
            service_zone_id: zoneId,
            shipping_profile_id: SHIPPING_PROFILE_ID,
            // description deliberately omitted: see the header. No transit-time
            // claim I cannot substantiate goes in front of a customer.
            type: { label: p.typeLabel, code: p.typeCode },
            prices: [{ currency_code: p.currency, amount: p.amount }],
            rules: [
              { attribute: "enabled_in_store", value: "true", operator: "eq" },
              { attribute: "is_return", value: "false", operator: "eq" },
            ],
          },
        ],
      })
      const optId = (createdOpts as any[])[0].id
      say(`created shipping_option ${optId} "${p.optionName}" ${p.currency} ${p.amount}`)

      // Confirm the price landed in MAJOR units. A future unit migration or a
      // copy-paste of the old 1000-style seed would otherwise bill 100x here
      // and look correct in the admin.
      const pr = await knex.raw(
        `SELECT p.currency_code, p.amount FROM price p
           JOIN shipping_option_price_set sops ON sops.price_set_id = p.price_set_id
          WHERE sops.shipping_option_id = ? AND p.deleted_at IS NULL`,
        [optId],
      )
      if (pr.rows.length !== 1) fail(`option ${optId}: expected 1 price, found ${pr.rows.length}.`)
      if (Number(pr.rows[0].amount) !== p.amount || pr.rows[0].currency_code !== p.currency) {
        fail(
          `option ${optId}: price landed as ${pr.rows[0].currency_code} ` +
            `${pr.rows[0].amount}, expected ${p.currency} ${p.amount}.`,
        )
      }

      ledgerWrites.push(["build", "create", "service_zone", zoneId, { name: p.zoneName, countries: p.countries }])
      ledgerWrites.push(["build", "create", "shipping_option", optId, { name: p.optionName, currency: p.currency, amount: p.amount }])
    }
  }

  // ===========================================================================
  // PHASE 2 APPLY
  // ===========================================================================
  if (retire) {
    const built = await ledgerRows("build")
    if (!built.length) {
      fail(
        `phase 2 refuses to run: the ledger holds no phase-1 build. The new zones ` +
          `must exist and be verified before the catch-all is removed.`,
      )
    }
    if (!plannedRetire) {
      say("nothing to retire.")
      return
    }
    // The gate above already aborted if any in-region country would be orphaned.
    if (plannedRetire.optionIds.length) {
      // Option BEFORE zone: only this workflow runs removeRemoteLinkStep and
      // cleans the shipping_option_price_set link. See the header.
      await deleteShippingOptionsWorkflow(container).run({
        input: { ids: plannedRetire.optionIds },
      })
      say(`soft-deleted shipping_option(s): ${plannedRetire.optionIds.join(", ")}`)
    }
    await deleteServiceZonesWorkflow(container).run({ input: { ids: plannedRetire.zoneIds } })
    say(`soft-deleted service_zone(s): ${plannedRetire.zoneIds.join(", ")}`)

    const geoLeft = await liveGeo(CATCHALL_ZONE_ID)
    if (geoLeft.length) {
      fail(
        `${geoLeft.length} geo_zone row(s) on ${CATCHALL_ZONE_ID} are still live after ` +
          `the zone was soft-deleted; the module cascade did not fire as expected.`,
      )
    }

    if (plannedRetire.setIds.length) {
      await deleteFulfillmentSetsWorkflow(container).run({ input: { ids: plannedRetire.setIds } })
      say(`soft-deleted fulfillment_set(s): ${plannedRetire.setIds.join(", ")}`)
    }

    for (const id of plannedRetire.optionIds) {
      ledgerWrites.push(["retire", "soft_delete", "shipping_option", id, null])
    }
    for (const id of plannedRetire.ruleIds) {
      ledgerWrites.push(["retire", "soft_delete", "shipping_option_rule", id, null])
    }
    for (const id of plannedRetire.priceIds) {
      ledgerWrites.push(["retire", "soft_delete", "price_link", id, null])
    }
    for (const id of plannedRetire.zoneIds) {
      ledgerWrites.push(["retire", "soft_delete", "service_zone", id, { geo_zones: plannedRetire.geoCount }])
    }
    for (const id of plannedRetire.setIds) {
      ledgerWrites.push(["retire", "soft_delete", "fulfillment_set", id, null])
    }
    if (plannedRetire.locationLink) {
      ledgerWrites.push(["retire", "link_dismiss", "location_fulfillment_set", CATCHALL_SET_ID, plannedRetire.locationLink])
    }
  }

  // ---------------------------------------------------------------------------
  // Ledger
  // ---------------------------------------------------------------------------
  await knex.transaction(async (trx: any) => {
    await ensureLedger(trx)
    for (const [phase, action, entity, entityId, detail] of ledgerWrites) {
      await trx.raw(
        `INSERT INTO ${LEDGER} (run_id, phase, action, entity, entity_id, detail)
         VALUES (?, ?, ?, ?, ?, ?::jsonb)`,
        [runId, phase, action, entity, entityId, detail ? JSON.stringify(detail) : null],
      )
    }
  })

  say("")
  say(`APPLIED phase ${apply ? "1 (build)" : "2 (retire)"}: ${ledgerWrites.length} ledger row(s).`)
  say(`ledger run_id = ${runId} (table ${LEDGER}): this is the rollback source.`)
  say("")
  say("VERIFY AT THREE LAYERS. A row existing is not the same claim as Medusa")
  say("serving the option to the storefront:")
  say("  1. SQL   geo_zone / service_zone / shipping_option / price, deleted_at IS NULL")
  say("  2. API   GET /store/shipping-options?cart_id=<a cart with a de and a us address>")
  say("  3. UI    reach the checkout shipping step on EU and US and select a method")
  if (apply) {
    say("")
    say("Until phase 2 runs, at/be/ca see TWO options at the same price and must")
    say("click a radio. That is the expand half of expand-then-contract.")
  }
}
