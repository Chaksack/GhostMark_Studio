import { Pool } from 'pg'

// Storage for admin/staff Web Push subscriptions. Same raw-`pg` +
// CREATE TABLE IF NOT EXISTS convention as reviews-db.ts / support-db.ts.

let pool: Pool | null = null
let initialized = false

function getPool() {
  if (pool) return pool
  const conn = process.env.DATABASE_URL
  if (!conn) {
    throw new Error('DATABASE_URL is not set. Required for push subscription storage.')
  }
  pool = new Pool({ connectionString: conn })
  return pool
}

export async function initPushTables() {
  if (initialized) return
  const p = getPool()
  await p.query(`
    CREATE TABLE IF NOT EXISTS admin_push_subscriptions (
      id SERIAL PRIMARY KEY,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      user_id TEXT,
      user_agent TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `)
  initialized = true
}

export type PushSubscriptionRow = {
  id: number
  endpoint: string
  p256dh: string
  auth: string
  user_id: string | null
  user_agent: string | null
  created_at: string
}

// Upsert on endpoint: re-subscribing from the same browser (or a different
// admin signing in on it) updates the keys/owner instead of duplicating.
export async function saveSubscription(params: {
  endpoint: string
  p256dh: string
  auth: string
  userId?: string | null
  userAgent?: string | null
}) {
  await initPushTables()
  const res = await getPool().query<PushSubscriptionRow>(
    `INSERT INTO admin_push_subscriptions (endpoint, p256dh, auth, user_id, user_agent)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (endpoint) DO UPDATE
       SET p256dh = EXCLUDED.p256dh,
           auth = EXCLUDED.auth,
           user_id = EXCLUDED.user_id,
           user_agent = EXCLUDED.user_agent
     RETURNING *`,
    [params.endpoint, params.p256dh, params.auth, params.userId || null, params.userAgent || null]
  )
  return res.rows[0]
}

export async function deleteSubscription(endpoint: string) {
  await initPushTables()
  await getPool().query(`DELETE FROM admin_push_subscriptions WHERE endpoint = $1`, [endpoint])
}

export async function listSubscriptions(): Promise<PushSubscriptionRow[]> {
  await initPushTables()
  const res = await getPool().query<PushSubscriptionRow>(
    `SELECT * FROM admin_push_subscriptions ORDER BY id`
  )
  return res.rows
}
