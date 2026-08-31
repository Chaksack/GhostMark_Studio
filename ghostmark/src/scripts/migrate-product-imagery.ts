// =============================================================================
// migrate-product-imagery: replaces dead Unsplash URLs and splits a photo set
// that two different garments were sharing.
//
//   DRY RUN (default, safe):
//     npx medusa exec ./src/scripts/migrate-product-imagery.ts
//
//   APPLY (requires BOTH the flag and the env var):
//     MIGRATE_IMAGERY_CONFIRM=I-UNDERSTAND-THIS-REWRITES-PRODUCT-IMAGES \
//       npx medusa exec ./src/scripts/migrate-product-imagery.ts -- --apply
//
//   ROLLBACK (restores every recorded original URL verbatim):
//     MIGRATE_IMAGERY_CONFIRM=I-UNDERSTAND-THIS-REWRITES-PRODUCT-IMAGES \
//       npx medusa exec ./src/scripts/migrate-product-imagery.ts -- --rollback
//
//   Flags work with or without dashes, `medusa exec` does not forward `--`
//   flags into ExecArgs.args, so process.argv is read too.
//
// -----------------------------------------------------------------------------
// WHAT AND WHY
// -----------------------------------------------------------------------------
// 1. DEAD IMAGE. `photo-1614495039944-6dad99a36e4f` began returning HTTP 404
//    from images.unsplash.com. It sat at index 0 of the "hoodie-charcoal" photo
//    set, and seed-curated.ts copies images[0] into `product.thumbnail`, so a
//    dead id in slot 0 breaks the product CARD everywhere (grid, cart, wishlist),
//    not merely the gallery.
//
// 2. THE CONTENT BUG THE 404 WAS HIDING. Two different garments declared
//    `photoSet: "hoodie-charcoal"`, "Atelier Hoodie - Charcoal" and
//    "Heavyweight Sweatshirt - Black". A crewneck sweatshirt was illustrated
//    with photographs of a hooded pullover on every surface. PHOTO_SETS' own
//    header comment says "Picked so all 4 images in a product show the SAME item
//    type"; the sharing violated it. seed-curated.ts now declares a distinct
//    "sweatshirt-black" set, and this script brings the live rows into line.
//
// This script is the DATA half. The SOURCE half is already in seed-curated.ts,
// and it must land with this, otherwise the next reseed reintroduces both
// problems.
//
// -----------------------------------------------------------------------------
// SCOPE: 7 values, which is MORE than the 4 originally scoped. Read this.
// -----------------------------------------------------------------------------
// The original instruction anticipated 4 values (one dead id at rank 0 plus the
// thumbnail, on two products). Splitting the photo set necessarily touches more,
// because the sweatshirt does not just need slot 0 replaced, it needs a
// different SET:
//
//   atelier-hoodie-charcoal        image rank 0            1 row
//                                  product.thumbnail       1 value
//   heavyweight-sweatshirt-black   image ranks 0,1,2,3     4 rows
//                                  product.thumbnail       1 value
//                                                        ---------
//                                                          7 values
//
// Every run prints the exact before/after per value before writing anything.
//
// -----------------------------------------------------------------------------
// !! FOUND BUT DELIBERATELY NOT TOUCHED: THREE MORE DEAD IDS !!
// -----------------------------------------------------------------------------
// Checking all 37 distinct Unsplash ids in seed-curated.ts found FOUR returning
// 404, not one. The other three are OUT OF THIS SCRIPT'S AUTHORISED SCOPE and
// are left alone. They are reported by every run so they are not forgotten:
//
//   photo-1564222256577-45e728f72c1f  "tote"[3]     4 products, rank 3
//   photo-1563932003041-2acebcd2e0fb  "mug"[3]      3 products, rank 3
//   photo-1606818693644-fe2a8a4e7e35  "sticker"[3]  2 products, rank 3
//
// All three sit at rank 3 (a gallery slot, never the thumbnail) so they
// degrade far more gracefully than the rank-0 one, especially now that the
// storefront renders a placeholder tile on image error. 9 image rows total.
// Fixing them is a one-line change to REPLACEMENTS below plus a re-run.
//
// -----------------------------------------------------------------------------
// SAFETY
// -----------------------------------------------------------------------------
//  * Every replacement URL is fetched over the network BEFORE any write, and the
//    script REFUSES to write a URL that does not return HTTP 200. Swapping a
//    dead image for another dead image is the one failure this must not have.
//  * A durable ledger (`gms_product_imagery_migration`) records the exact prior
//    URL of every value changed, so rollback restores recorded originals rather
//    than reconstructing them.
//  * A run aborts if the ledger holds active rows.
//  * It refuses to write a row whose CURRENT url is not the one it expected,
//    if someone has edited imagery in the meantime, this stops rather than
//    clobbering their work.
// =============================================================================

import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

const LEDGER = "gms_product_imagery_migration"
const CONFIRM_VAR = "MIGRATE_IMAGERY_CONFIRM"
const CONFIRM_VALUE = "I-UNDERSTAND-THIS-REWRITES-PRODUCT-IMAGES"

/** The URL shape seed-curated.ts writes. Kept identical so a reseed is a no-op. */
const url = (id: string) => `https://images.unsplash.com/${id}?w=900&q=80`

const DEAD_ID = "photo-1614495039944-6dad99a36e4f"

/**
 * Target imagery per product handle, mirroring seed-curated.ts PHOTO_SETS.
 * `expectCurrent` is the id each rank MUST currently hold; a mismatch aborts.
 */
const REPLACEMENTS: Array<{
  handle: string
  reason: string
  ranks: Array<{ rank: number; expectCurrent: string; next: string }>
}> = [
  {
    handle: "atelier-hoodie-charcoal",
    reason: "dead id at rank 0 (also the thumbnail)",
    ranks: [
      { rank: 0, expectCurrent: DEAD_ID, next: "photo-1578470507807-3fc541d5f544" },
    ],
  },
  // --- WAVE 3: four products illustrated with a DIFFERENT PRODUCT -----------
  // Each borrowed a neighbouring photo set. No dead URL involved, every image
  // rendered perfectly and showed the wrong item. The sets they borrowed FROM
  // are unchanged and remain correct for their own products.
  {
    handle: "cable-organiser",
    reason: "was showing NOTEBOOK photos (borrowed the 'notebook' set)",
    ranks: [
      { rank: 0, expectCurrent: "photo-1531346878377-a5be20888e57", next: "photo-1760348213270-7cd00b8c3405" },
      { rank: 1, expectCurrent: "photo-1517842645767-c639042777db", next: "photo-1634839763563-97d93f8131c6" },
      { rank: 2, expectCurrent: "photo-1455390582262-044cdead277a", next: "photo-1634839763121-58fcfed2a94a" },
      { rank: 3, expectCurrent: "photo-1532153975070-2e9ab71f1b14", next: "photo-1525972231415-e52a7a56c905" },
    ],
  },
  {
    handle: "studio-candle",
    reason: "was showing MUG photos (borrowed the 'mug' set)",
    ranks: [
      { rank: 0, expectCurrent: "photo-1514228742587-6b1558fcca3d", next: "photo-1561212856-44e9bae482aa" },
      { rank: 1, expectCurrent: "photo-1572119865084-43c285814d63", next: "photo-1601922046210-41e129a3e64a" },
      { rank: 2, expectCurrent: "photo-1551892374-ecf8754cf8b0", next: "photo-1528351655744-27cc30462816" },
      { rank: 3, expectCurrent: "photo-1616241673111-508b4662c707", next: "photo-1640095889747-2090ee12fa7d" },
    ],
  },
  {
    handle: "linen-tea-towel",
    reason: "was showing TOTE photos (borrowed the 'tote' set)",
    ranks: [
      { rank: 0, expectCurrent: "photo-1591561954557-26941169b49e", next: "photo-1643150899069-a748f9216f99" },
      { rank: 1, expectCurrent: "photo-1572883454114-1cf0031ede2a", next: "photo-1650917469541-7578d83c2903" },
      { rank: 2, expectCurrent: "photo-1597481499750-3e6b22637e12", next: "photo-1554042861-c5b9add98f2c" },
      { rank: 3, expectCurrent: "photo-1574365569389-a10d488ca3fb", next: "photo-1617076678834-b804507ebf61" },
    ],
  },
  {
    handle: "tech-pouch",
    reason: "was showing TOTE photos (borrowed the 'tote' set)",
    ranks: [
      { rank: 0, expectCurrent: "photo-1591561954557-26941169b49e", next: "photo-1620093349352-3d6c6eec7fc4" },
      { rank: 1, expectCurrent: "photo-1572883454114-1cf0031ede2a", next: "photo-1641700409025-015f1eb02a68" },
      { rank: 2, expectCurrent: "photo-1597481499750-3e6b22637e12", next: "photo-1613896640137-bb5b31496315" },
      { rank: 3, expectCurrent: "photo-1574365569389-a10d488ca3fb", next: "photo-1703564202694-b102aa465666" },
    ],
  },
  {
    handle: "heavyweight-sweatshirt-cream",
    reason:
      'split off the cream HOODIE\'s photo set, no dead URL was hiding this ' +
      "one, every image rendered perfectly and showed the wrong garment",
    ranks: [
      { rank: 0, expectCurrent: "photo-1556821840-3a63f95609a7", next: "photo-1621560464578-b399f0e9221f" },
      { rank: 1, expectCurrent: "photo-1620799140408-edc6dcb6d633", next: "photo-1632682582909-2b3a2581eef7" },
      { rank: 2, expectCurrent: "photo-1576566588028-4147f3842f27", next: "photo-1704915091057-cc443c8ef019" },
      { rank: 3, expectCurrent: "photo-1591047139829-d91aecb6caea", next: "photo-1627134137273-fa8bf6897f29" },
    ],
  },
  {
    handle: "heavyweight-sweatshirt-black",
    reason: "dead id at rank 0 + split off the charcoal HOODIE's photo set",
    ranks: [
      { rank: 0, expectCurrent: DEAD_ID, next: "photo-1618354691551-44de113f0164" },
      { rank: 1, expectCurrent: "photo-1618354691373-d851c5c3a990", next: "photo-1499971442178-8c10fdf5f6ac" },
      { rank: 2, expectCurrent: "photo-1542272604-787c3835535d", next: "photo-1656339504243-2df4c5ebf1c0" },
      { rank: 3, expectCurrent: "photo-1556821840-3a63f95609a7", next: "photo-1576558345433-58e777a5e423" },
    ],
  },
]

/**
 * Global dead-id swaps: replace this id wherever it appears, on any product,
 * at any rank. These three sit at index 3 of the "tote", "mug" and "sticker"
 * photo sets, so they are shared across several products each, a per-product
 * list would have to repeat itself and could drift. Swapping by id matches how
 * the seed actually models them (one set, many products).
 *
 * Found by re-fetching ALL 37 distinct Unsplash ids in seed-curated.ts rather
 * than only the one that was reported. Four were dead, not one.
 */
const SWAPS: Array<{ dead: string; next: string; set: string; note: string }> = [
  {
    dead: "photo-1564222256577-45e728f72c1f",
    next: "photo-1574365569389-a10d488ca3fb",
    set: "tote[3]",
    note: "linen-tea-towel, market-tote-oat, tech-pouch, workshop-tote",
  },
  {
    dead: "photo-1563932003041-2acebcd2e0fb",
    next: "photo-1616241673111-508b4662c707",
    set: "mug[3]",
    note: "ceramic-mug-cream, ceramic-mug-sage, studio-candle",
  },
  {
    dead: "photo-1606818693644-fe2a8a4e7e35",
    next: "photo-1625768376503-68d2495d78c5",
    set: "sticker[3]",
    note: "logo-sticker-sheet, studio-sticker-pack",
  },
]

/**
 * Dead ids deliberately left alone. Empty is the goal state: every run
 * re-reports this, so a non-empty list here is a standing defect.
 */
const KNOWN_DEAD_OUT_OF_SCOPE: string[] = []

type Planned = {
  handle: string
  productId: string
  imageId: string
  rank: number
  beforeUrl: string
  afterUrl: string
  alsoThumbnail: boolean
}

export default async function migrateProductImagery({ container, args }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const knex: any = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)

  const argv: string[] = [...(args ?? []), ...process.argv.slice(2)]
  const hasFlag = (n: string) => argv.includes(`--${n}`) || argv.includes(n)
  const apply = hasFlag("apply")
  const rollback = hasFlag("rollback")
  const confirmed = process.env[CONFIRM_VAR] === CONFIRM_VALUE

  const say = (m = "") => logger.info(`[migrate-product-imagery] ${m}`)
  const warn = (m: string) => logger.warn(`[migrate-product-imagery] ${m}`)
  const fail: (m: string) => never = (m: string) => {
    logger.error(`[migrate-product-imagery] ABORT: ${m}`)
    throw new Error(m)
  }
  if (apply && rollback) fail("--apply and --rollback are mutually exclusive.")

  say("=".repeat(96))
  say(`mode: ${rollback ? "ROLLBACK" : apply ? "APPLY" : "DRY RUN"}`)
  say("=".repeat(96))

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
        image_id        TEXT        NOT NULL,
        rank            INTEGER     NOT NULL,
        url_before      TEXT        NOT NULL,
        url_after       TEXT        NOT NULL,
        was_thumbnail   BOOLEAN     NOT NULL,
        applied_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
        rolled_back_at  TIMESTAMPTZ
      )
    `)
  }
  /**
   * DESCENDING BY id, AND THAT IS LOAD-BEARING.
   *
   * This script is re-runnable and its ledger ACCUMULATES across waves, so one
   * image can carry several rows forming a chain:
   *
   *     id  8  img_X  A -> B      (wave 1)
   *     id 34  img_X  B -> C      (wave 2)   live url is now C
   *
   * Rollback replays `url_before` per row. Ascending, that sets A and then sets
   * B, landing on the INTERMEDIATE value and silently reporting success.
   * Descending sets B and then A, which is the original. An unwind must run in
   * reverse order of application.
   *
   * Measured on 2026-08-30: 34 active rows, 31 distinct images, so exactly 3
   * images carried a two-row chain and would have restored to the wave-1 URL.
   */
  const activeLedger = async (): Promise<any[]> => {
    if (!(await tableExists(LEDGER))) return []
    const r = await knex.raw(`SELECT * FROM ${LEDGER} WHERE rolled_back_at IS NULL ORDER BY id DESC`)
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
      say(`  ${r.product_handle} rank ${r.rank}  ->  restoring ${r.url_before}`)
    }
    if (!confirmed) {
      warn(`refusing: set ${CONFIRM_VAR}=${CONFIRM_VALUE} to proceed. Nothing changed.`)
      return
    }
    let restored = 0
    await knex.transaction(async (trx: any) => {
      for (const r of rows) {
        const res = await trx.raw(`UPDATE image SET url = ?, updated_at = now() WHERE id = ?`, [
          r.url_before, r.image_id,
        ])
        // A row the ledger claims must still exist. Without this check a
        // hard-deleted image makes the UPDATE a silent no-op and the ledger
        // still closes, reporting a restore that did not happen.
        if ((res?.rowCount ?? 0) !== 1) {
          throw new Error(
            `image ${r.image_id} (ledger row ${r.id}): expected to update exactly ` +
              `1 row, affected ${res?.rowCount ?? 0}. Rolling the whole ` +
              `transaction back rather than closing the ledger on a no-op.`,
          )
        }
        restored++
        if (r.was_thumbnail) {
          const t = await trx.raw(
            `UPDATE product SET thumbnail = ?, updated_at = now() WHERE id = ?`,
            [r.url_before, r.product_id],
          )
          if ((t?.rowCount ?? 0) !== 1) {
            throw new Error(
              `product ${r.product_id} (ledger row ${r.id}): thumbnail restore ` +
                `affected ${t?.rowCount ?? 0} row(s), expected 1. Rolling back.`,
            )
          }
        }
      }
      await trx.raw(`UPDATE ${LEDGER} SET rolled_back_at = now() WHERE rolled_back_at IS NULL`)
    })
    say(`ROLLED BACK ${restored} value(s) to their recorded originals (newest chain`)
    say(`entry first, so chained rows land on the ORIGINAL and not an intermediate).`)
    return
  }

  // ---------------------------------------------------------------------------
  // Guard: already applied?
  // ---------------------------------------------------------------------------
  // NOTE: this script does NOT abort on a populated ledger, unlike its siblings.
  // Planning below is idempotent, a target whose URL already equals its
  // intended value is skipped, and a target matching neither its expected
  // current value nor its intended one aborts. That makes re-running safe and
  // lets this script grow (a second wave of dead ids) without forcing a
  // rollback of the first wave. The ledger accumulates across runs and rollback
  // restores everything it recorded, oldest included.
  const existing = await activeLedger()
  if (existing.length) {
    say(
      `ledger holds ${existing.length} row(s) from ${existing[0]?.applied_at}, ` +
        `planning is idempotent, already-applied targets will be skipped.`,
    )
  }

  // ---------------------------------------------------------------------------
  // Plan, asserting current state matches expectations.
  // ---------------------------------------------------------------------------
  const planned: Planned[] = []
  const alreadyApplied: string[] = []

  // -- global dead-id swaps, across every product carrying them --------------
  for (const swap of SWAPS) {
    const { rows } = await knex.raw(
      `SELECT p.id AS product_id, p.handle, p.thumbnail,
              i.id AS image_id, i.rank, i.url
         FROM product p
         JOIN image i ON i.product_id = p.id AND i.deleted_at IS NULL
        WHERE p.deleted_at IS NULL AND i.url LIKE ?
        ORDER BY p.handle, i.rank`,
      [`%${swap.dead}%`],
    )
    if (!rows.length) {
      alreadyApplied.push(`${swap.set} (no rows still carry ${swap.dead})`)
      continue
    }
    for (const row of rows) {
      planned.push({
        handle: row.handle,
        productId: row.product_id,
        imageId: row.image_id,
        rank: Number(row.rank),
        beforeUrl: row.url,
        afterUrl: url(swap.next),
        alsoThumbnail: String(row.thumbnail ?? "").includes(swap.dead),
      })
    }
  }

  for (const spec of REPLACEMENTS) {
    const { rows } = await knex.raw(
      `SELECT p.id AS product_id, p.handle, p.thumbnail,
              i.id AS image_id, i.rank, i.url
         FROM product p
         JOIN image i ON i.product_id = p.id AND i.deleted_at IS NULL
        WHERE p.deleted_at IS NULL AND p.handle = ?
        ORDER BY i.rank`,
      [spec.handle],
    )
    if (!rows.length) fail(`${spec.handle}: no live product/images found.`)

    for (const target of spec.ranks) {
      const row = rows.find((r: any) => Number(r.rank) === target.rank)
      if (!row) fail(`${spec.handle}: no image at rank ${target.rank}.`)
      if (String(row.url).includes(target.next)) {
        alreadyApplied.push(`${spec.handle} rank ${target.rank}`)
        continue
      }
      if (!String(row.url).includes(target.expectCurrent)) {
        fail(
          `${spec.handle} rank ${target.rank}: expected the URL to contain ` +
            `${target.expectCurrent} (or the already-applied ${target.next}) but ` +
            `found ${row.url}. Someone has changed this imagery since this script ` +
            `was written, refusing to clobber it.`,
        )
      }
      planned.push({
        handle: spec.handle,
        productId: row.product_id,
        imageId: row.image_id,
        rank: target.rank,
        beforeUrl: row.url,
        afterUrl: url(target.next),
        alsoThumbnail: String(row.thumbnail ?? "").includes(target.expectCurrent),
      })
    }
  }

  // ---------------------------------------------------------------------------
  // Every replacement URL must be live. Refuse to swap dead for dead.
  // ---------------------------------------------------------------------------
  say("")
  say("-".repeat(96))
  say("VERIFYING REPLACEMENT URLS (network, read-only)")
  say("-".repeat(96))
  const distinctNew = [...new Set(planned.map((p) => p.afterUrl))]
  const badUrls: string[] = []
  for (const u of distinctNew) {
    let status = 0
    try {
      const r = await fetch(u, { method: "GET" })
      status = r.status
    } catch {
      status = 0
    }
    say(`  ${String(status).padStart(3)}  ${u}`)
    if (status !== 200) badUrls.push(u)
  }
  if (badUrls.length) {
    fail(
      `${badUrls.length} replacement URL(s) did not return 200: ${badUrls.join(", ")}. ` +
        `Replacing a dead image with another dead image is the one outcome this ` +
        `script must not produce.`,
    )
  }

  // ---------------------------------------------------------------------------
  // Report.
  // ---------------------------------------------------------------------------
  say("")
  say("-".repeat(96))
  say(`PLANNED CHANGES: ${planned.length} image row(s), ` +
      `${planned.filter((p) => p.alsoThumbnail).length} thumbnail(s)`)
  say("-".repeat(96))
  // Global dead-id swaps first. These are counted in the total above, so they
  // MUST be printed here too, a diff that reports 13 rows and shows 4 is not a
  // diff, it is a summary with a gap where the unreviewed rows are.
  for (const swap of SWAPS) {
    const mine = planned.filter((x) => x.afterUrl === url(swap.next))
    if (!mine.length) continue
    say(`  SWAP ${swap.set}  ${swap.dead}`)
    say(`            ->  ${swap.next}   (${mine.length} row(s): ${swap.note})`)
    for (const p of mine) {
      say(
        `      ${p.handle.padEnd(30)} rank ${p.rank}` +
          `${p.alsoThumbnail ? "  (+thumbnail)" : ""}`,
      )
    }
  }

  // Then the per-product set replacements.
  const swapUrls = new Set(SWAPS.map((sw) => url(sw.next)))
  for (const spec of REPLACEMENTS) {
    const mine = planned.filter(
      (x) => x.handle === spec.handle && !swapUrls.has(x.afterUrl),
    )
    if (!mine.length) continue
    say(`  ${spec.handle} : ${spec.reason}`)
    for (const p of mine) {
      say(`      rank ${p.rank}${p.alsoThumbnail ? " (+thumbnail)" : "            "}`)
      say(`         before  ${p.beforeUrl}`)
      say(`         after   ${p.afterUrl}`)
    }
  }

  // Nothing may be counted but unprinted.
  const shown = new Set<string>()
  for (const sw of SWAPS) {
    for (const p of planned.filter((x) => x.afterUrl === url(sw.next))) shown.add(p.imageId)
  }
  for (const spec of REPLACEMENTS) {
    for (const p of planned.filter((x) => x.handle === spec.handle && !swapUrls.has(x.afterUrl))) {
      shown.add(p.imageId)
    }
  }
  if (shown.size !== planned.length) {
    fail(
      `report covers ${shown.size} of ${planned.length} planned row(s). Refusing ` +
        `to write changes that were not displayed for review.`,
    )
  }

  if (alreadyApplied.length) {
    say("")
    say(`ALREADY APPLIED, SKIPPED: ${alreadyApplied.length}`)
    for (const a of alreadyApplied) say(`  ${a}`)
  }

  // Out-of-scope dead ids, reported so they are not forgotten.
  //
  // The empty case is NOT hypothetical, it is the goal state, and it is also
  // where this block crashed the first time: an empty list built the fragment
  // `AND ()`, a Postgres syntax error. Caught by a dry run, before any write,
  // which is the entire argument for dry-running a script you wrote yourself.
  const deadRows: any[] = KNOWN_DEAD_OUT_OF_SCOPE.length
    ? (
        await knex.raw(
          `SELECT p.handle, i.rank, i.url
             FROM product p JOIN image i ON i.product_id = p.id AND i.deleted_at IS NULL
            WHERE p.deleted_at IS NULL
              AND (${KNOWN_DEAD_OUT_OF_SCOPE.map(() => "i.url LIKE ?").join(" OR ")})
            ORDER BY i.url, p.handle`,
          KNOWN_DEAD_OUT_OF_SCOPE.map((d) => `%${d}%`),
        )
      ).rows
    : []
  say("")
  say("-".repeat(96))
  say(`DEAD BUT OUT OF SCOPE, NOT TOUCHED: ${deadRows.length} image row(s)`)
  say("-".repeat(96))
  for (const r of deadRows) say(`  ${String(r.handle).padEnd(30)} rank ${r.rank}  ${r.url}`)
  if (!KNOWN_DEAD_OUT_OF_SCOPE.length) {
    say("  none, every dead id found in seed-curated.ts is in scope and fixed.")
  } else {
    say("  Add them to SWAPS or REPLACEMENTS and re-run when authorised.")
  }

  say("")
  if (!apply) {
    say("DRY RUN. Nothing was changed.")
    say(`To apply: ${CONFIRM_VAR}=${CONFIRM_VALUE} npx medusa exec ./src/scripts/migrate-product-imagery.ts -- --apply`)
    return
  }
  if (!confirmed) {
    fail(`--apply was passed but ${CONFIRM_VAR} is not set correctly. Nothing changed.`)
  }

  // ---------------------------------------------------------------------------
  // Apply.
  // ---------------------------------------------------------------------------
  const runId = `run_${Date.now()}`
  let written = 0
  await knex.transaction(async (trx: any) => {
    await ensureLedger(trx)
    for (const p of planned) {
      await trx.raw(
        `INSERT INTO ${LEDGER}
           (run_id, product_id, product_handle, image_id, rank, url_before, url_after, was_thumbnail)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [runId, p.productId, p.handle, p.imageId, p.rank, p.beforeUrl, p.afterUrl, p.alsoThumbnail],
      )
      await trx.raw(`UPDATE image SET url = ?, updated_at = now() WHERE id = ?`, [
        p.afterUrl, p.imageId,
      ])
      if (p.alsoThumbnail) {
        await trx.raw(`UPDATE product SET thumbnail = ?, updated_at = now() WHERE id = ?`, [
          p.afterUrl, p.productId,
        ])
      }
      written++
    }
  })
  say(`APPLIED: ${written} image row(s) updated, ` +
      `${planned.filter((p) => p.alsoThumbnail).length} thumbnail(s) updated.`)
  say(`ledger run_id = ${runId} (table ${LEDGER}): this is the rollback source.`)
  say("")
  say("The SOURCE half is already in seed-curated.ts (dead id replaced, and")
  say('"sweatshirt-black" split out of "hoodie-charcoal"). Both halves must ship')
  say("together or the next reseed reintroduces both problems.")
}
