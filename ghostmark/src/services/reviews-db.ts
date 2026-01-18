import { Pool } from 'pg'

let pool: Pool | null = null
let initialized = false

function getPool() {
  if (pool) return pool
  const conn = process.env.DATABASE_URL
  if (!conn) {
    throw new Error('DATABASE_URL is not set. Required for reviews storage.')
  }
  pool = new Pool({ connectionString: conn })
  return pool
}

export async function initReviewTables() {
  if (initialized) return
  const p = getPool()
  await p.query(`
    CREATE TABLE IF NOT EXISTS product_reviews (
      id SERIAL PRIMARY KEY,
      product_id TEXT NOT NULL,
      rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
      title TEXT,
      body TEXT,
      email TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_product_reviews_product ON product_reviews(product_id);
  `)
  initialized = true
}

export type ProductReview = {
  id: number
  product_id: string
  rating: number
  title: string | null
  body: string | null
  email: string | null
  created_at: string
}

export async function addReview(params: {
  productId: string
  rating: number
  title?: string
  body?: string
  email?: string
}) {
  await initReviewTables()
  const p = getPool()
  const res = await p.query<ProductReview>(
    `INSERT INTO product_reviews (product_id, rating, title, body, email)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING *`,
    [params.productId, params.rating, params.title || null, params.body || null, params.email || null]
  )
  return res.rows[0]
}

export async function listReviews(productId: string) {
  await initReviewTables()
  const p = getPool()
  const res = await p.query<ProductReview>(
    `SELECT * FROM product_reviews WHERE product_id=$1 ORDER BY created_at DESC`,
    [productId]
  )
  return res.rows
}

export async function getReviewStats(productId: string) {
  await initReviewTables()
  const p = getPool()
  const res = await p.query<{ count: string; avg: string }>(
    `SELECT COUNT(*)::text as count, COALESCE(ROUND(AVG(rating)::numeric, 2), 0)::text as avg FROM product_reviews WHERE product_id=$1`,
    [productId]
  )
  const row = res.rows[0] || { count: '0', avg: '0' }
  return { count: parseInt(row.count || '0', 10), average: parseFloat(row.avg || '0') }
}
