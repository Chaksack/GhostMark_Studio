import { Pool } from 'pg'

let pool: Pool | null = null
let initialized = false

function getPool() {
  if (pool) return pool
  const conn = process.env.DATABASE_URL
  if (!conn) {
    throw new Error('DATABASE_URL is not set. Required for support ticket storage.')
  }
  pool = new Pool({ connectionString: conn })
  return pool
}

export async function initSupportTables() {
  if (initialized) return
  const p = getPool()
  // Create tables if not exist
  await p.query(`
    CREATE TABLE IF NOT EXISTS support_tickets (
      id SERIAL PRIMARY KEY,
      case_id TEXT UNIQUE NOT NULL,
      email TEXT NOT NULL,
      subject TEXT NOT NULL,
      secret_code TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS support_messages (
      id SERIAL PRIMARY KEY,
      ticket_id INTEGER NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
      sender TEXT NOT NULL CHECK (sender IN ('customer','admin')),
      message TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_support_messages_ticket ON support_messages(ticket_id);
  `)
  initialized = true
}

export type SupportTicket = {
  id: number
  case_id: string
  email: string
  subject: string
  secret_code: string
  status: 'open' | 'closed'
  created_at: string
}

export type SupportMessage = {
  id: number
  ticket_id: number
  sender: 'customer' | 'admin'
  message: string
  created_at: string
}

export async function createTicket(params: { email: string; subject: string; message: string }) {
  await initSupportTables()
  const p = getPool()
  const caseId = `GM-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.random().toString(36).slice(2,6).toUpperCase()}`
  const secret = Math.random().toString(36).slice(2,10)
  const client = await p.connect()
  try {
    await client.query('BEGIN')
    const ins = await client.query<SupportTicket>(
      `INSERT INTO support_tickets (case_id, email, subject, secret_code)
       VALUES ($1,$2,$3,$4)
       RETURNING *`,
      [caseId, params.email, params.subject, secret]
    )
    const t = ins.rows[0]
    await client.query(
      `INSERT INTO support_messages (ticket_id, sender, message) VALUES ($1,'customer',$2)`,
      [t.id, params.message]
    )
    await client.query('COMMIT')
    return { ticket: t, secret }
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}

export async function getTicketByCaseId(caseId: string) {
  await initSupportTables()
  const p = getPool()
  const tRes = await p.query<SupportTicket>(`SELECT * FROM support_tickets WHERE case_id=$1`, [caseId])
  if (!tRes.rowCount) return null
  const ticket = tRes.rows[0]
  const mRes = await p.query<SupportMessage>(
    `SELECT * FROM support_messages WHERE ticket_id=$1 ORDER BY created_at ASC`,
    [ticket.id]
  )
  return { ticket, messages: mRes.rows }
}

export async function addMessage(caseId: string, sender: 'customer' | 'admin', message: string) {
  await initSupportTables()
  const p = getPool()
  const tRes = await p.query<SupportTicket>(`SELECT * FROM support_tickets WHERE case_id=$1`, [caseId])
  if (!tRes.rowCount) return null
  const ticket = tRes.rows[0]
  await p.query(
    `INSERT INTO support_messages (ticket_id, sender, message) VALUES ($1,$2,$3)`,
    [ticket.id, sender, message]
  )
  return ticket
}

export async function listTickets(limit = 50, offset = 0) {
  await initSupportTables()
  const p = getPool()
  const res = await p.query<SupportTicket>(
    `SELECT * FROM support_tickets ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  )
  return res.rows
}

export async function closeTicket(caseId: string) {
  await initSupportTables()
  const p = getPool()
  await p.query(`UPDATE support_tickets SET status='closed' WHERE case_id=$1`, [caseId])
}
