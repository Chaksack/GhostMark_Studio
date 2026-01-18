import { Pool } from 'pg'

let pool: Pool | null = null
let initialized = false

// Enable an in-memory fallback when DATABASE_URL is not provided (e.g., local dev)
let memoryMode = !process.env.DATABASE_URL

// Simple in-memory store to avoid 500s in environments without a DB
type MemTicket = Omit<SupportTicket, 'created_at'> & { created_at: string }
type MemMessage = Omit<SupportMessage, 'created_at'> & { created_at: string }
const mem = {
  tickets: [] as MemTicket[],
  messages: [] as MemMessage[],
  seq: { ticket: 1, message: 1 },
}

function getPool() {
  if (pool) return pool
  const conn = process.env.DATABASE_URL
  if (!conn) {
    // Switch to memory mode silently for non-production environments
    memoryMode = true
    return null as unknown as Pool
  }
  pool = new Pool({ connectionString: conn })
  return pool
}

export async function initSupportTables() {
  if (initialized) return
  if (memoryMode) {
    initialized = true
    return
  }
  const p = getPool()
  if (!p) {
    // Should not happen, but guard anyway
    initialized = true
    return
  }
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
  const caseId = `GM-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.random().toString(36).slice(2,6).toUpperCase()}`
  const secret = Math.random().toString(36).slice(2,10)
  if (memoryMode) {
    const t: MemTicket = {
      id: mem.seq.ticket++,
      case_id: caseId,
      email: params.email,
      subject: params.subject,
      secret_code: secret,
      status: 'open',
      created_at: new Date().toISOString(),
    }
    mem.tickets.push(t)
    mem.messages.push({
      id: mem.seq.message++,
      ticket_id: t.id,
      sender: 'customer',
      message: params.message,
      created_at: new Date().toISOString(),
    })
    return { ticket: t as SupportTicket, secret }
  }
  const p = getPool()
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
  const normalized = (caseId || "").trim()
  if (memoryMode) {
    const ticket = mem.tickets.find(t => t.case_id.toLowerCase() === normalized.toLowerCase())
    if (!ticket) return null
    const messages = mem.messages
      .filter(m => m.ticket_id === ticket.id)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
    return { ticket: ticket as SupportTicket, messages: messages as SupportMessage[] }
  }
  const p = getPool()
  const tRes = await p.query<SupportTicket>(
    `SELECT * FROM support_tickets WHERE LOWER(case_id)=LOWER($1)`,
    [normalized]
  )
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
  const normalized = (caseId || "").trim()
  if (memoryMode) {
    const ticket = mem.tickets.find(t => t.case_id.toLowerCase() === normalized.toLowerCase())
    if (!ticket) return null
    mem.messages.push({
      id: mem.seq.message++,
      ticket_id: ticket.id,
      sender,
      message,
      created_at: new Date().toISOString(),
    })
    return ticket as SupportTicket
  }
  const p = getPool()
  const tRes = await p.query<SupportTicket>(
    `SELECT * FROM support_tickets WHERE LOWER(case_id)=LOWER($1)`,
    [normalized]
  )
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
  if (memoryMode) {
    const rows = [...mem.tickets]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(offset, offset + limit)
    return rows as SupportTicket[]
  }
  const p = getPool()
  const res = await p.query<SupportTicket>(
    `SELECT * FROM support_tickets ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  )
  return res.rows
}

export async function closeTicket(caseId: string) {
  await initSupportTables()
  const normalized = (caseId || "").trim()
  if (memoryMode) {
    const t = mem.tickets.find(t => t.case_id.toLowerCase() === normalized.toLowerCase())
    if (t) t.status = 'closed'
    return
  }
  const p = getPool()
  await p.query(`UPDATE support_tickets SET status='closed' WHERE LOWER(case_id)=LOWER($1)`, [normalized])
}

export async function updateTicketStatus(caseId: string, status: 'open' | 'closed') {
  await initSupportTables()
  const normalized = (caseId || "").trim()
  const next = (status || 'open').toLowerCase() as 'open' | 'closed'
  if (next !== 'open' && next !== 'closed') {
    throw new Error("Invalid status. Allowed: 'open' | 'closed'")
  }
  if (memoryMode) {
    const t = mem.tickets.find(t => t.case_id.toLowerCase() === normalized.toLowerCase())
    if (!t) return null
    t.status = next
    return t as SupportTicket
  }
  const p = getPool()
  const res = await p.query<SupportTicket>(
    `UPDATE support_tickets SET status=$1 WHERE LOWER(case_id)=LOWER($2) RETURNING *`,
    [next, normalized]
  )
  if (!res.rowCount) return null
  return res.rows[0]
}
