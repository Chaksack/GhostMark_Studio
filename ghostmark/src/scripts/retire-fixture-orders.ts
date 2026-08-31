// =============================================================================
// retire-fixture-orders: soft-deletes six fixture orders and the rows that are
// meaningless without them. The eighth ledgered, restorable unit.
//
//   DRY RUN (default, safe, prints every affected row per table):
//     npx medusa exec ./src/scripts/retire-fixture-orders.ts
//
//   APPLY:
//     RETIRE_FIXTURE_ORDERS_CONFIRM=I-UNDERSTAND-THIS-HIDES-SIX-ORDERS \
//       npx medusa exec ./src/scripts/retire-fixture-orders.ts -- --apply
//
//   ROLLBACK (clears deleted_at on exactly the rows this script set, nothing else):
//     RETIRE_FIXTURE_ORDERS_CONFIRM=I-UNDERSTAND-THIS-HIDES-SIX-ORDERS \
//       npx medusa exec ./src/scripts/retire-fixture-orders.ts -- --rollback
//
// !! THE HYPHENS IN THAT CONFIRM STRING ARE ASCII HYPHEN-MINUS AND ARE COMPARED
//    WITH === AGAINST OPERATOR INPUT. A punctuation sweep that "improves" one to
//    an en or em dash silently disables the apply path. Punctuation: PROSE ONLY.
//
// `medusa exec` does not forward `--` flags into ExecArgs.args (the CLI declares
// `exec [file] [args..]`, a yargs variadic positional). We read process.argv too.
// migrate-price-units.ts shipped with this bug and its --apply silently no-op'd.
//
// -----------------------------------------------------------------------------
// WHAT TRAVELS WITH AN ORDER, AND WHY — THE CASCADE DECISION, STATED
// -----------------------------------------------------------------------------
// Medusa's order module has no delete cascade we can lean on here (we are
// setting deleted_at directly, so nothing fires). Every table is an explicit
// decision. The rule applied: a row travels with the order if and only if it is
// UNREACHABLE except through the order, and is state ABOUT the order rather
// than an independent record the business would still want.
//
// TRAVELS (soft-deleted):
//   order                     the root
//   order_summary             per-order-version totals; meaningless alone
//   order_item                the state half of a line (quantity, fulfilled...)
//   order_line_item           the content half (title, unit_price)
//   order_shipping            the order<->method join
//   order_shipping_method     the chosen method, snapshotted onto this order
//   order_address             reachable ONLY via order.shipping/billing_address_id
//   order_payment_collection  the LINK from the order to its payment collection
//   order_transaction         the order's own money-movement ledger
//
// DOES NOT TRAVEL (left live, deliberately):
//   payment_collection, payment, payment_session, capture, refund
//     These live in the PAYMENT module, not the ORDER module. They are an
//     independent financial record with a counterpart at Stripe. Soft-deleting
//     the order_payment_collection LINK is what removes them from the order's
//     graph and from the admin; soft-deleting the collection itself would
//     destroy reconciliation data to achieve nothing extra. Invisibility is the
//     goal; erasing the money trail is not.
//
//     THIS MATTERS MOST FOR ORDER #4. It is the ONLY captured payment in the
//     database: payment_collection status `completed`, captured_amount 34000,
//     one `capture` row, and one order_transaction referencing that capture id.
//     Under this plan the capture, the payment and the collection all SURVIVE;
//     only the order-side transaction row and the link are hidden. If the
//     operator wants #4's money trail gone too, that is a second, separate
//     decision against the payment module, and it should be argued on its own
//     rather than swept in behind an order cleanup. Stripe is in TEST MODE
//     (sk_test_), so no real money is represented either way.
//
// -----------------------------------------------------------------------------
// THE 25-vs-26 PAYMENT COLLECTION RATIO — EXPLAINED, NOT DISCOVERED AT APPLY
// -----------------------------------------------------------------------------
// The measured figure "payment_collection 25 against 7 orders" is a real signal
// and the ratio is the point. Live payment_collection rows: 31.
//     6  linked to an ORDER   (exactly one per order, all seven minus #1)
//    26  linked to a CART, 26 of which are still-open live carts
// So 26 payment collections belong to carts a customer could still be shopping
// in. They are NOT order debris and are NOT in scope. Any sweep phrased as
// "delete the 25 payment collections" would soft-delete live checkout state.
// This script never selects a payment_collection by anything but an order link,
// and it does not soft-delete them at all. See the block above.
//
// -----------------------------------------------------------------------------
// SAFETY
// -----------------------------------------------------------------------------
//  * Soft delete only. Every write is `SET deleted_at = <run timestamp>`.
//  * Every UPDATE is scoped `AND deleted_at IS NULL`, so a row already
//    soft-deleted by something else is neither touched nor claimed by the
//    ledger, and rollback can never resurrect a row it did not bury.
//  * The ledger records the exact timestamp written. Rollback clears deleted_at
//    only WHERE deleted_at = that recorded value, so a row soft-deleted later by
//    another actor is left alone.
//  * Refuses to write a row it did not display: displayed counters are asserted
//    against planned counts per table, and a mismatch aborts.
//  * Preconditions are re-asserted live immediately before the write. Any drift
//    from the dry run aborts before anything is changed.
//  * KEEP_ORDER_IDS is checked explicitly: if a keep-listed order ever appears
//    in the target set, that is a bug and the script aborts.
//  * All reads end with `deleted_at IS NULL`. A raw count answers "what has ever
//    existed", not "what is live" — the trap that has bitten four lanes today.
// =============================================================================

import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

const LEDGER = "gms_order_retire_migration"
const CONFIRM_VAR = "RETIRE_FIXTURE_ORDERS_CONFIRM"
const CONFIRM_VALUE = "I-UNDERSTAND-THIS-HIDES-SEVEN-ORDERS"

/** The seven fixture orders. display_id is carried for the drift assertion. */
const TARGETS: Array<{ id: string; display_id: number; note: string }> = [
  // #1 was originally KEPT on the strength of its @outlook.com address. The
  // MEDUSA-AUDIT lane checked what the address could not tell us: it is
  // `is_draft_order = true`, status `draft`, zero payment links, placeholder
  // titles, and unit_price 1680 x2 - the same minor-unit fixture data as the
  // rest. Its address city is Weija, Accra, tying it to the dead `ghs`
  // currency residue. It is the sixth of six, not a survivor of another class.
  { id: "order_01KKVS6DQX0CA311E3T59QB2P7", display_id: 1, note: "draft-order fixture, Ghana config residue, last 100x order" },
  { id: "order_01KTD339F18F9A9C7NQ62AC14G", display_id: 2, note: "June fixture" },
  { id: "order_01KTD3WAPW1S99VDWFP789Z455", display_id: 3, note: "June fixture" },
  { id: "order_01KTD49XXBWM5NW5GNEWDF802N", display_id: 4, note: "June fixture, ONLY CAPTURE IN DB" },
  { id: "order_01KTD4WNGPK2N4XC4MFP223HE8", display_id: 5, note: "June fixture" },
  { id: "order_01KTDM9GADK8YHPAYQMVBJV41Z", display_id: 6, note: "June fixture" },
  { id: "order_01M1AAXAEDSDR72S2E1Q140X11", display_id: 9, note: "test order placed 21:58 today" },
]

/** Explicitly NOT in scope. Asserted, not assumed. Empty by design: the
 *  keep-list mechanism stays so a future run can exempt an order, and the
 *  assertion below still fires if a keep-listed id ever appears in TARGETS. */
const KEEP_ORDER_IDS = new Set<string>([])

type Plan = { table: string; ids: string[]; why: string }

export default async function retireFixtureOrders({ container, args }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const knex: any = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)

  const argv: string[] = [...(args ?? []), ...process.argv.slice(2)]
  const hasFlag = (n: string) => argv.includes(`--${n}`) || argv.includes(n)
  const apply = hasFlag("apply")
  const rollback = hasFlag("rollback")
  const confirmed = process.env[CONFIRM_VAR] === CONFIRM_VALUE

  const say = (m = "") => logger.info(`[retire-fixture-orders] ${m}`)
  const warn = (m: string) => logger.warn(`[retire-fixture-orders] ${m}`)
  const fail: (m: string) => never = (m: string) => {
    logger.error(`[retire-fixture-orders] ABORT: ${m}`)
    throw new Error(m)
  }
  if (apply && rollback) fail("--apply and --rollback are mutually exclusive.")

  const ids = TARGETS.map((t) => t.id)
  for (const t of TARGETS) {
    if (KEEP_ORDER_IDS.has(t.id)) {
      fail(`${t.id} is in KEEP_ORDER_IDS but also in TARGETS. Refusing to proceed.`)
    }
  }

  say("=".repeat(92))
  say(`mode: ${rollback ? "ROLLBACK" : apply ? "APPLY" : "DRY RUN"}`)
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
        order_id       TEXT        NOT NULL,
        order_display  INTEGER     NOT NULL,
        table_name     TEXT        NOT NULL,
        row_id         TEXT        NOT NULL,
        deleted_at_set TIMESTAMPTZ NOT NULL,
        applied_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
        rolled_back_at TIMESTAMPTZ
      )
    `)
    await trx.raw(
      `CREATE INDEX IF NOT EXISTS ${LEDGER}_active_idx ` +
        `ON ${LEDGER} (table_name, row_id) WHERE rolled_back_at IS NULL`,
    )
    await trx.raw(
      `COMMENT ON TABLE ${LEDGER} IS ` +
        `'Soft-deletes six fixture orders (display_id 2,3,4,5,6,9) and the rows ` +
        `unreachable except through them. Payment-module rows (payment_collection, ` +
        `payment, payment_session, capture) are deliberately NOT touched: the ` +
        `order_payment_collection LINK is what hides them from the admin, and the ` +
        `financial record is an independent one with a Stripe counterpart. ` +
        `Rollback clears deleted_at only WHERE it still equals the recorded ` +
        `timestamp, so a row buried later by another actor is left alone.'`,
    )
  }
  const activeLedger = async (): Promise<any[]> => {
    if (!(await tableExists(LEDGER))) return []
    const r = await knex.raw(
      `SELECT * FROM ${LEDGER} WHERE rolled_back_at IS NULL ORDER BY id`,
    )
    return r?.rows ?? []
  }

  // ===========================================================================
  // ROLLBACK
  // ===========================================================================
  if (rollback) {
    const rows = await activeLedger()
    if (!rows.length) {
      say("ledger holds no active retirement, nothing to roll back.")
      return
    }
    const byTable = new Map<string, any[]>()
    for (const r of rows) {
      byTable.set(r.table_name, [...(byTable.get(r.table_name) ?? []), r])
    }
    say(`ledger holds ${rows.length} soft-deleted row(s) across ${byTable.size} table(s):`)
    for (const [t, rs] of [...byTable.entries()].sort()) {
      say(`  ${String(rs.length).padStart(3)}  ${t}`)
    }
    say("")
    say("Rollback clears deleted_at ONLY where it still equals the value this")
    say("script wrote. A row re-buried by anything else is left as it is, and")
    say("reported below rather than silently skipped.")
    if (!confirmed) {
      warn(`refusing: set ${CONFIRM_VAR}=${CONFIRM_VALUE} to proceed. Nothing changed.`)
      return
    }

    let restored = 0
    const notRestored: string[] = []
    await knex.transaction(async (trx: any) => {
      for (const [table, rs] of byTable.entries()) {
        for (const r of rs) {
          const res = await trx.raw(
            `UPDATE ${quoteIdent(table)} SET deleted_at = NULL, updated_at = now()
              WHERE id = ? AND deleted_at = ?`,
            [r.row_id, r.deleted_at_set],
          )
          const n = res?.rowCount ?? 0
          if (n === 1) restored++
          else notRestored.push(`${table} ${r.row_id}`)
        }
      }
      await trx.raw(`UPDATE ${LEDGER} SET rolled_back_at = now() WHERE rolled_back_at IS NULL`)
    })

    say("")
    say(`RESTORED ${restored} of ${rows.length} recorded row(s).`)
    if (notRestored.length) {
      warn(
        `${notRestored.length} row(s) were NOT restored because their deleted_at ` +
          `no longer matches what this script wrote (re-deleted, or hard-deleted ` +
          `since). They are listed below and the ledger is closed for them; they ` +
          `need a hand.`,
      )
      for (const s of notRestored.slice(0, 40)) say(`    ${s}`)
      if (notRestored.length > 40) say(`    ... and ${notRestored.length - 40} more`)
    }
    say("")
    say("Verify: 7 live orders, 0 soft-deleted, and the SAME query without the")
    say("deleted_at filter must still return 7. If both numbers do not move as")
    say("expected, stop and investigate.")
    return
  }

  // ===========================================================================
  // PLAN — every row, per table, selected live
  // ===========================================================================
  const q = async (sql: string, binds: any[] = []) => (await knex.raw(sql, binds)).rows

  // Preconditions: every target must be live, and its display_id must match.
  const orders = await q(
    `SELECT id, display_id, status, currency_code, email, created_at, is_draft_order
       FROM "order" WHERE id = ANY(?) AND deleted_at IS NULL ORDER BY display_id`,
    [ids],
  )
  if (orders.length !== TARGETS.length) {
    const found = new Set(orders.map((o: any) => o.id))
    fail(
      `expected ${TARGETS.length} live target order(s), found ${orders.length}. ` +
        `Missing: ${ids.filter((i) => !found.has(i)).join(", ")}. Re-derive before running.`,
    )
  }
  for (const t of TARGETS) {
    const o = orders.find((x: any) => x.id === t.id)
    if (Number(o.display_id) !== t.display_id) {
      fail(
        `${t.id}: display_id is ${o.display_id}, expected ${t.display_id}. ` +
          `The target list no longer describes this database.`,
      )
    }
  }
  const keepLive = await q(
    `SELECT id, display_id FROM "order" WHERE id = ANY(?) AND deleted_at IS NULL`,
    [[...KEEP_ORDER_IDS]],
  )
  if (keepLive.length !== KEEP_ORDER_IDS.size) {
    fail(
      `the keep-list order(s) ${[...KEEP_ORDER_IDS].join(", ")} are not all live. ` +
        `This script's premise is "retire six, keep one". Re-derive.`,
    )
  }

  const orderItems = await q(
    `SELECT id, order_id, item_id, quantity FROM order_item
      WHERE order_id = ANY(?) AND deleted_at IS NULL ORDER BY order_id, id`,
    [ids],
  )
  const lineItems = await q(
    `SELECT li.id, oi.order_id, li.title, li.unit_price
       FROM order_line_item li
       JOIN order_item oi ON oi.item_id = li.id AND oi.deleted_at IS NULL
      WHERE oi.order_id = ANY(?) AND li.deleted_at IS NULL ORDER BY oi.order_id, li.id`,
    [ids],
  )
  const summaries = await q(
    `SELECT id, order_id FROM order_summary
      WHERE order_id = ANY(?) AND deleted_at IS NULL ORDER BY order_id`,
    [ids],
  )
  const orderShipping = await q(
    `SELECT id, order_id, shipping_method_id FROM order_shipping
      WHERE order_id = ANY(?) AND deleted_at IS NULL ORDER BY order_id`,
    [ids],
  )
  const shipMethods = await q(
    `SELECT sm.id, os.order_id, sm.name, sm.amount
       FROM order_shipping_method sm
       JOIN order_shipping os ON os.shipping_method_id = sm.id AND os.deleted_at IS NULL
      WHERE os.order_id = ANY(?) AND sm.deleted_at IS NULL ORDER BY os.order_id`,
    [ids],
  )
  const addresses = await q(
    `SELECT a.id, o.id AS order_id,
            CASE WHEN o.shipping_address_id = a.id THEN 'shipping' ELSE 'billing' END AS role
       FROM order_address a
       JOIN "order" o ON o.shipping_address_id = a.id OR o.billing_address_id = a.id
      WHERE o.id = ANY(?) AND a.deleted_at IS NULL ORDER BY o.id, role`,
    [ids],
  )
  const pcLinks = await q(
    `SELECT id, order_id, payment_collection_id FROM order_payment_collection
      WHERE order_id = ANY(?) AND deleted_at IS NULL ORDER BY order_id`,
    [ids],
  )
  const txns = await q(
    `SELECT id, order_id, amount, currency_code, reference, reference_id
       FROM order_transaction WHERE order_id = ANY(?) AND deleted_at IS NULL ORDER BY order_id`,
    [ids],
  )
  const taxLines = await q(
    `SELECT tl.id FROM order_line_item_tax_line tl
       JOIN order_line_item li ON li.id = tl.item_id
       JOIN order_item oi ON oi.item_id = li.id AND oi.deleted_at IS NULL
      WHERE oi.order_id = ANY(?) AND tl.deleted_at IS NULL`,
    [ids],
  )
  const creditLines = await q(
    `SELECT id FROM order_credit_line WHERE order_id = ANY(?) AND deleted_at IS NULL`,
    [ids],
  )
  const fulfilments = await q(
    `SELECT f.id FROM fulfillment f
       JOIN order_fulfillment ofl ON ofl.fulfillment_id = f.id AND ofl.deleted_at IS NULL
      WHERE ofl.order_id = ANY(?) AND f.deleted_at IS NULL`,
    [ids],
  )

  // ---- rows we deliberately LEAVE, read so they can be printed with a reason
  const payCollections = await q(
    `SELECT pc.id, opc.order_id, pc.status, pc.amount, pc.authorized_amount, pc.captured_amount
       FROM payment_collection pc
       JOIN order_payment_collection opc ON opc.payment_collection_id = pc.id
        AND opc.deleted_at IS NULL
      WHERE opc.order_id = ANY(?) AND pc.deleted_at IS NULL ORDER BY opc.order_id`,
    [ids],
  )
  const payments = await q(
    `SELECT p.id, opc.order_id, p.provider_id, p.amount, p.captured_at
       FROM payment p
       JOIN order_payment_collection opc ON opc.payment_collection_id = p.payment_collection_id
        AND opc.deleted_at IS NULL
      WHERE opc.order_id = ANY(?) AND p.deleted_at IS NULL ORDER BY opc.order_id`,
    [ids],
  )
  const captures = await q(
    `SELECT c.id, c.payment_id, c.amount FROM capture c
       JOIN payment p ON p.id = c.payment_id
       JOIN order_payment_collection opc ON opc.payment_collection_id = p.payment_collection_id
        AND opc.deleted_at IS NULL
      WHERE opc.order_id = ANY(?) AND c.deleted_at IS NULL`,
    [ids],
  )
  // A completed cart keeps its cart_payment_collection link AND gains an
  // order_payment_collection link, so the two sets OVERLAP. Counting
  // "cart-linked" naively double-counts every order's collection. Report the
  // cart-linked rows that are NOT reachable from any order — those are the ones
  // a sweep would wrongly take.
  const cartPcs = await q(
    `SELECT count(*)::int AS n FROM payment_collection pc
       JOIN cart_payment_collection cpc ON cpc.payment_collection_id = pc.id
        AND cpc.deleted_at IS NULL
      WHERE pc.deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM order_payment_collection opc
           WHERE opc.payment_collection_id = pc.id AND opc.deleted_at IS NULL)`,
  )
  const cartPcsOpen = await q(
    `SELECT count(*)::int AS n FROM payment_collection pc
       JOIN cart_payment_collection cpc ON cpc.payment_collection_id = pc.id
        AND cpc.deleted_at IS NULL
       JOIN cart c ON c.id = cpc.cart_id AND c.deleted_at IS NULL
      WHERE pc.deleted_at IS NULL
        AND c.completed_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM order_payment_collection opc
           WHERE opc.payment_collection_id = pc.id AND opc.deleted_at IS NULL)`,
  )
  const orphanPcs = await q(
    `SELECT count(*)::int AS n FROM payment_collection pc
      WHERE pc.deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM order_payment_collection opc
           WHERE opc.payment_collection_id = pc.id AND opc.deleted_at IS NULL)
        AND NOT EXISTS (
          SELECT 1 FROM cart_payment_collection cpc
           WHERE cpc.payment_collection_id = pc.id AND cpc.deleted_at IS NULL)`,
  )
  const totalLivePcs = await q(
    `SELECT count(*)::int AS n FROM payment_collection WHERE deleted_at IS NULL`,
  )

  const plan: Plan[] = [
    { table: "order", ids: orders.map((r: any) => r.id), why: "the root" },
    { table: "order_summary", ids: summaries.map((r: any) => r.id), why: "per-order-version totals, meaningless alone" },
    { table: "order_item", ids: orderItems.map((r: any) => r.id), why: "line state, reachable only via order_id" },
    { table: "order_line_item", ids: lineItems.map((r: any) => r.id), why: "line content, reachable only via order_item" },
    { table: "order_shipping", ids: orderShipping.map((r: any) => r.id), why: "order<->method join" },
    { table: "order_shipping_method", ids: shipMethods.map((r: any) => r.id), why: "method snapshotted onto this order" },
    { table: "order_address", ids: addresses.map((r: any) => r.id), why: "reachable only via order.shipping/billing_address_id" },
    { table: "order_payment_collection", ids: pcLinks.map((r: any) => r.id), why: "the LINK; hiding it is what removes the collection from the order graph" },
    { table: "order_transaction", ids: txns.map((r: any) => r.id), why: "the order's own money-movement ledger" },
    { table: "order_line_item_tax_line", ids: taxLines.map((r: any) => r.id), why: "tax lines on retired items" },
    { table: "order_credit_line", ids: creditLines.map((r: any) => r.id), why: "credit lines on retired orders" },
  ]

  // ===========================================================================
  // DISPLAY — every row, per table, with its id
  // ===========================================================================
  const byOrder = (rows: any[], oid: string) => rows.filter((r) => r.order_id === oid)

  say("")
  say("-".repeat(92))
  say("TARGET ORDERS")
  say("-".repeat(92))
  for (const o of orders) {
    const t = TARGETS.find((x) => x.id === o.id)!
    say(
      `  #${String(o.display_id).padStart(2)}  ${o.id}  ${String(o.status).padEnd(9)} ` +
        `${o.currency_code}  draft=${o.is_draft_order}  ${String(o.created_at).slice(0, 10)}  ${t.note}`,
    )
  }
  say("")
  say(`  KEPT, NOT IN SCOPE: ${keepLive.map((k: any) => `#${k.display_id} ${k.id}`).join(", ")}`)
  say("")

  say("-".repeat(92))
  say("SOFT DELETE — every row, per table, with its id")
  say("-".repeat(92))
  let displayed = 0
  for (const p of plan) {
    say(`  ${p.table}   (${p.ids.length})   -- ${p.why}`)
    if (!p.ids.length) {
      say(`      (none)`)
    }
    for (const rowId of p.ids) {
      say(`      SOFT DELETE  ${rowId}`)
      displayed++
    }
    say("")
  }

  say("-".repeat(92))
  say("LEFT LIVE — deliberately, with the argument")
  say("-".repeat(92))
  say(`  payment_collection (${payCollections.length}) -- PAYMENT module, independent financial`)
  say(`      record with a Stripe counterpart. The order_payment_collection LINK`)
  say(`      above is what removes it from the order graph and the admin.`)
  for (const pc of payCollections) {
    const o = orders.find((x: any) => x.id === pc.order_id)
    const flag = Number(pc.captured_amount) > 0 ? "   <-- CAPTURED" : ""
    say(
      `      LEAVE  ${pc.id}  order #${o?.display_id}  ${String(pc.status).padEnd(10)} ` +
        `amount ${pc.amount}  auth ${pc.authorized_amount}  captured ${pc.captured_amount}${flag}`,
    )
  }
  say("")
  say(`  payment (${payments.length}) -- same argument`)
  for (const p of payments) {
    const o = orders.find((x: any) => x.id === p.order_id)
    say(
      `      LEAVE  ${p.id}  order #${o?.display_id}  ${p.provider_id}  amount ${p.amount}` +
        `${p.captured_at ? `  captured_at ${String(p.captured_at).slice(0, 19)}` : ""}`,
    )
  }
  say("")
  say(`  capture (${captures.length}) -- same argument`)
  for (const c of captures) say(`      LEAVE  ${c.id}  payment ${c.payment_id}  amount ${c.amount}`)
  say("")
  say(`  fulfillment (${fulfilments.length}) -- none exist on any target order`)
  say("")

  // ---- ORDER #4, CALLED OUT ------------------------------------------------
  const four = orders.find((o: any) => Number(o.display_id) === 4)
  if (four) {
    const pc4 = payCollections.find((p: any) => p.order_id === four.id)
    const pay4 = payments.find((p: any) => p.order_id === four.id)
    const cap4 = captures.find((c: any) => c.payment_id === pay4?.id)
    const txn4 = txns.find((t: any) => t.order_id === four.id)
    say("-".repeat(92))
    say("ORDER #4 — THE ONLY CAPTURE IN THE DATABASE, CALLED OUT")
    say("-".repeat(92))
    say(`  order              ${four.id}   status ${four.status}`)
    say(`  payment_collection ${pc4?.id}   status ${pc4?.status}  captured ${pc4?.captured_amount}   -> LEFT LIVE`)
    say(`  payment            ${pay4?.id}   amount ${pay4?.amount}   -> LEFT LIVE`)
    say(`  capture            ${cap4?.id ?? "(none)"}   amount ${cap4?.amount ?? "-"}   -> LEFT LIVE`)
    say(`  order_transaction  ${txn4?.id ?? "(none)"}   ${txn4?.reference} ${txn4?.reference_id ?? ""}   -> SOFT DELETED`)
    say("")
    say("  ARGUMENT. The capture is the single most informative row in this")
    say("  cleanup and the one least replaceable. It is also NOT order-module")
    say("  state: it is a payment-module record whose counterpart lives at")
    say("  Stripe, and it remains reconcilable by id after the order is hidden.")
    say("  Soft-deleting it would buy nothing (the order already vanishes from")
    say("  the admin once its link is hidden) and would cost the only evidence")
    say("  that a capture path in this store has ever executed end to end.")
    say("  The order_transaction row DOES travel, because it is the ORDER's")
    say("  ledger of that movement and is unreachable except through the order.")
    say("  Net effect: the money trail survives in the payment module; the")
    say("  order-side view of it goes away with the order.")
    say("  Stripe is TEST MODE (sk_test_). No real money is represented.")
    say("")
  }

  // ---- the payment_collection ratio ---------------------------------------
  say("-".repeat(92))
  say("BLAST RADIUS — measured figure confirmed or corrected")
  say("-".repeat(92))
  say(`  reported: order_line_item 10 · order_item 10 · payment_collection 25 ·`)
  say(`            payment 6 · order_shipping_method 6 · fulfillment 0`)
  say("")
  say(`  order_line_item        measured ${String(lineItems.length).padStart(3)}`)
  say(`  order_item             measured ${String(orderItems.length).padStart(3)}`)
  say(`      The reported 10 was right for a SEVEN-order scope and wrong for the`)
  say(`      six-order scope it was quoted against: order #1 holds 2 of the 10 and`)
  say(`      was originally on the keep-list. Now that #1 is a target, 10 is`)
  say(`      correct again. The figure never changed; the scope under it did.`)
  say(`  order_shipping_method  measured ${String(shipMethods.length).padStart(3)}  CONFIRMED (order #1 has none).`)
  say(`  payment                measured ${String(payments.length).padStart(3)}  CONFIRMED.`)
  say(`  fulfillment            measured ${String(fulfilments.length).padStart(3)}  CONFIRMED.`)
  say("")
  say(`  payment_collection     measured ${String(payCollections.length).padStart(3)} in scope, NOT 25. THIS IS THE FINDING.`)
  say(`      live payment_collection rows total    : ${totalLivePcs[0]?.n}`)
  say(`      linked to an ORDER                    : ${payCollections.length}   (one per target)`)
  say(`      cart-linked and NOT order-linked      : ${cartPcs[0]?.n}   <-- NOT order debris`)
  say(`         of those, on a still-OPEN live cart: ${cartPcsOpen[0]?.n}`)
  say(`      linked to NEITHER a cart nor an order : ${orphanPcs[0]?.n}`)
  say(`      NOTE the sets OVERLAP: a completed cart keeps its cart link AND`)
  say(`      gains an order link, so a naive "cart-linked" count double-counts`)
  say(`      every order's collection. The figure above excludes order-linked ones.`)
  say(`      The cart-only rows belong to live, still-open carts. A sweep phrased`)
  say(`      as "delete the 25 payment collections" would soft-delete live`)
  say(`      checkout state for customers who are still shopping. This script`)
  say(`      never selects a payment_collection except through an ORDER link,`)
  say(`      and does not soft-delete them at all.`)
  say(`      This total is also MOVING while you read it: it was 31 at 22:5x and`)
  say(`      ${totalLivePcs[0]?.n} now, because carts are being created against the live`)
  say(`      dev server. Any figure quoted from a prior session is already stale.`)
  say("")
  say(`  NOT IN THE REPORTED FIGURE AT ALL, and in scope:`)
  say(`      order_summary            ${summaries.length}`)
  say(`      order_shipping           ${orderShipping.length}`)
  say(`      order_address            ${addresses.length}`)
  say(`      order_payment_collection ${pcLinks.length}   (the link, distinct from the collection)`)
  say(`      order_transaction        ${txns.length}   (order #4's capture record)`)
  say("")

  // ---- self-check ----------------------------------------------------------
  const planned = plan.reduce((n, p) => n + p.ids.length, 0)
  say("-".repeat(92))
  say("SELF-CHECK")
  say("-".repeat(92))
  say(`  rows displayed : ${displayed}`)
  say(`  rows planned   : ${planned}`)
  if (displayed !== planned) {
    fail(
      `self-check failed: displayed ${displayed} row(s) but planned ${planned}. ` +
        `Refusing to soft-delete a row the operator did not see.`,
    )
  }
  say(`  MATCH. ${planned} row(s) across ${plan.filter((p) => p.ids.length).length} table(s).`)
  say("")

  say("-".repeat(92))
  say("WHAT --rollback WOULD RESTORE, PRECISELY")
  say("-".repeat(92))
  say(`  Exactly the ${planned} row ids listed above, and nothing else, by`)
  say(`  clearing deleted_at WHERE it still equals the timestamp this run wrote.`)
  say(`  A row re-buried by another actor between apply and rollback keeps its`)
  say(`  deleted_at and is REPORTED, not silently skipped.`)
  say(`  It restores NOTHING in the payment module, because nothing there is`)
  say(`  touched. payment_collection / payment / capture never change state.`)
  say(`  Post-rollback expectation: 7 live orders, and the same query without`)
  say(`  the deleted_at filter still returns 7.`)
  say("")

  const existing = await activeLedger()
  if (existing.length) {
    say(
      `NOTE: ledger '${LEDGER}' already holds ${existing.length} active row(s) from ` +
        `${existing[0]?.applied_at}. Planning is live, so already-deleted rows are ` +
        `not re-selected; but you probably want --rollback, not a second --apply.`,
    )
    say("")
  }

  // ===========================================================================
  // DRY RUN EXIT
  // ===========================================================================
  if (!apply) {
    say("DRY RUN. Nothing was changed.")
    say("")
    say(`Apply : ${CONFIRM_VAR}=${CONFIRM_VALUE} \\`)
    say(`          npx medusa exec ./src/scripts/retire-fixture-orders.ts -- --apply`)
    say(`Undo  : ...same env... -- --rollback`)
    return
  }
  if (!confirmed) {
    fail(`--apply was passed but ${CONFIRM_VAR} is not set correctly. Nothing changed.`)
  }

  // ===========================================================================
  // APPLY
  // ===========================================================================
  const runId = `run_${Date.now()}`
  const stamp = new Date().toISOString()

  // Baseline taken BEFORE the write, so the post-write check can assert a
  // RELATIONSHIP rather than a snapshot. See the note at the verification block.
  const beforeLive = (await q(`SELECT count(*)::int AS n FROM "order" WHERE deleted_at IS NULL`))[0].n
  const beforeGone = (await q(`SELECT count(*)::int AS n FROM "order" WHERE deleted_at IS NOT NULL`))[0].n
  const beforeEver = (await q(`SELECT count(*)::int AS n FROM "order"`))[0].n
  const orderCount = plan.find((p) => p.table === "order")?.ids.length ?? 0

  await knex.transaction(async (trx: any) => {
    await ensureLedger(trx)

    // Re-assert live, inside the transaction, immediately before writing.
    const recheck = await trx.raw(
      `SELECT id, display_id FROM "order" WHERE id = ANY(?) AND deleted_at IS NULL`,
      [ids],
    )
    if (recheck.rows.length !== TARGETS.length) {
      throw new Error(
        `precondition drifted between plan and apply: ${recheck.rows.length} of ` +
          `${TARGETS.length} target orders are live. Nothing changed.`,
      )
    }
    const keepRecheck = await trx.raw(
      `SELECT id FROM "order" WHERE id = ANY(?) AND deleted_at IS NULL`,
      [[...KEEP_ORDER_IDS]],
    )
    if (keepRecheck.rows.length !== KEEP_ORDER_IDS.size) {
      throw new Error(`keep-list order(s) are no longer live. Nothing changed.`)
    }

    let written = 0
    for (const p of plan) {
      for (const rowId of p.ids) {
        const res = await trx.raw(
          `UPDATE ${quoteIdent(p.table)} SET deleted_at = ?, updated_at = now()
            WHERE id = ? AND deleted_at IS NULL`,
          [stamp, rowId],
        )
        if ((res?.rowCount ?? 0) !== 1) {
          throw new Error(
            `${p.table} ${rowId}: expected to soft-delete exactly 1 row, affected ` +
              `${res?.rowCount ?? 0}. Rolling the whole transaction back.`,
          )
        }
        written++
        const oid =
          p.table === "order"
            ? rowId
            : (orders.find((o: any) =>
                [
                  ...byOrder(orderItems, o.id),
                  ...byOrder(lineItems, o.id),
                  ...byOrder(summaries, o.id),
                  ...byOrder(orderShipping, o.id),
                  ...byOrder(shipMethods, o.id),
                  ...byOrder(addresses, o.id),
                  ...byOrder(pcLinks, o.id),
                  ...byOrder(txns, o.id),
                ].some((r: any) => r.id === rowId),
              )?.id ?? "unknown")
        const disp = orders.find((o: any) => o.id === oid)?.display_id ?? 0
        await trx.raw(
          `INSERT INTO ${LEDGER}
             (run_id, order_id, order_display, table_name, row_id, deleted_at_set)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [runId, oid, disp, p.table, rowId, stamp],
        )
      }
    }
    if (written !== planned) {
      throw new Error(`wrote ${written} row(s) but planned ${planned}. Rolling back.`)
    }
  })

  // ---- post-write verification, both sides of the deleted_at filter --------
  const live = await q(`SELECT count(*)::int AS n FROM "order" WHERE deleted_at IS NULL`)
  const gone = await q(`SELECT count(*)::int AS n FROM "order" WHERE deleted_at IS NOT NULL`)
  const ever = await q(`SELECT count(*)::int AS n FROM "order"`)
  say("")
  say(`APPLIED. ${planned} row(s) soft-deleted, ledger ${LEDGER} run_id ${runId}.`)
  say("")
  // THIS CHECK IS RELATIONAL, AND THAT IS THE WHOLE POINT.
  //
  // It was originally hard-coded `1 / 6 / 7`, then corrected to `0 / 7 / 7` when
  // the scope grew from six orders to seven. Both are SNAPSHOTS of the world at
  // the moment someone wrote them, and a snapshot assertion goes stale the
  // instant anything else touches the table. It did: order #10 was placed at
  // 22:36 on 2026-08-30, after this script had run, making the world 1 / 7 / 8
  // and the `0 / 7 / 7` assertion guaranteed to abort on any future run.
  //
  // Correcting a stale constant to a fresh constant repeats the defect. What
  // this script actually knows is a RELATIONSHIP: it soft-deleted `orderCount`
  // orders, so live must fall by exactly that, soft-deleted must rise by
  // exactly that, and the unfiltered total must NOT MOVE AT ALL. That last one
  // is the real assertion — it is what distinguishes a soft delete from a
  // removal — and it holds no matter how many unrelated orders exist.
  const expLive = beforeLive - orderCount
  const expGone = beforeGone + orderCount
  say("VERIFICATION — relational, not a snapshot. The instrument must be able to fail:")
  say(`  orders soft-deleted by this run              : ${orderCount}`)
  say(`  live orders     (deleted_at IS NULL)     : ${live[0].n}   expected ${expLive}  (was ${beforeLive})`)
  say(`  soft-deleted    (deleted_at IS NOT NULL) : ${gone[0].n}   expected ${expGone}  (was ${beforeGone})`)
  say(`  ever existed    (no filter)              : ${ever[0].n}   expected ${beforeEver}  (MUST NOT MOVE)`)
  if (live[0].n !== expLive || gone[0].n !== expGone || ever[0].n !== beforeEver) {
    fail(
      `post-write counts are ${live[0].n} / ${gone[0].n} / ${ever[0].n}, expected ` +
        `${expLive} / ${expGone} / ${beforeEver}. The write landed but the world is ` +
        `not what this script expected. Investigate before doing anything else.`,
    )
  }
  say("  All three as expected. The unfiltered count did NOT move, which is the")
  say("  proof this was a soft delete and not a removal.")
}

/** Whitelist-quote a table identifier. Never interpolate an unchecked name. */
function quoteIdent(t: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(t)) throw new Error(`unsafe table identifier: ${t}`)
  return `"${t}"`
}
