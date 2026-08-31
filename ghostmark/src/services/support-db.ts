import { Pool } from 'pg'
import {
  randomCode,
  hashSecret,
  verifySecret,
  timingSafeEqualString,
} from '../utils/secure-token'

/**
 * How long a support ticket's access secret stays valid.
 *
 * A support case is a short-lived interaction; a link that works forever is a
 * credential that can never be revoked by expiry. 30 days comfortably outlasts
 * any real conversation while bounding the value of a secret recovered from an
 * old mailbox, a forwarded email, or a browser history entry.
 */
const SECRET_TTL_DAYS = 30
const SECRET_TTL_MS = SECRET_TTL_DAYS * 24 * 60 * 60 * 1000

/**
 * Length of the access secret, in characters drawn from HUMAN_SAFE_ALPHABET
 * (30 symbols). 16 characters is 30^16 ~= 2^78.5, which is not brute-forceable
 * even without the rate limit in front of it.
 *
 * The previous implementation used `Math.random().toString(36).slice(2,10)`.
 * That is at most 8 characters of base36 (~41 bits) drawn from a NON-
 * CRYPTOGRAPHIC PRNG, and the value was handed straight back to the caller in
 * the HTTP response - so an attacker could harvest consecutive outputs of the
 * process-wide xorshift128+ stream on demand and work back to its internal
 * state, then predict the secrets issued to other customers.
 */
const SECRET_LENGTH = 16

/**
 * Random component of a case ID. The previous 4 characters of base36 from
 * Math.random, appended to a plain date stamp, made case IDs guessable and
 * enumerable in bulk.
 */
const CASE_ID_RANDOM_LENGTH = 10

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

  /**
   * Migration to hashed, expiring secrets.
   *
   * Every statement is idempotent, so this is safe to run on every boot and
   * safe to run against a database that has already been migrated.
   *
   * `secret_code` is kept, nullable, ONLY to keep tickets created before this
   * change working. Nothing writes to it any more. Once the legacy rows have
   * aged past SECRET_TTL_DAYS the column and the legacy branch in
   * verifyTicketAccess() should both be deleted.
   */
  await p.query(`
    ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS secret_hash TEXT;
    ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS secret_expires_at TIMESTAMPTZ;
    ALTER TABLE support_tickets ALTER COLUMN secret_code DROP NOT NULL;
  `)

  initialized = true
}

/**
 * Internal ticket row. Carries the credential columns and MUST NOT be returned
 * from an API route as-is. Use toPublicTicket() at every response boundary.
 */
export type SupportTicket = {
  id: number
  case_id: string
  email: string
  subject: string
  /** Legacy plaintext secret. NULL for every ticket created after the migration. */
  secret_code: string | null
  /** sha256 of the access secret. The secret itself is never stored. */
  secret_hash: string | null
  secret_expires_at: string | null
  status: 'open' | 'closed'
  created_at: string
}

/** Ticket shape that is safe to serialise to any client. */
export type SupportTicketPublic = {
  id: number
  case_id: string
  email: string
  subject: string
  status: 'open' | 'closed'
  created_at: string
  secret_expires_at: string | null
}

/**
 * Strip credential fields before a ticket crosses an API boundary.
 *
 * This exists as a named function rather than an inline object literal so that
 * adding a sensitive column to the table cannot silently start leaking it: the
 * allowlist here is the single place that decides what callers may see.
 */
export function toPublicTicket(t: SupportTicket): SupportTicketPublic {
  return {
    id: t.id,
    case_id: t.case_id,
    email: t.email,
    subject: t.subject,
    status: t.status,
    created_at: t.created_at,
    secret_expires_at: t.secret_expires_at ?? null,
  }
}

export type SupportMessage = {
  id: number
  ticket_id: number
  sender: 'customer' | 'admin'
  message: string
  created_at: string
}

/**
 * Create a support ticket.
 *
 * The returned `secret` is the ONLY time the plaintext exists. It is not
 * stored, it cannot be recovered, and the caller's sole legitimate use for it
 * is to email it to the ticket's owner. Do not log it and do not return it in
 * an HTTP response - possession of the secret is what proves the holder owns
 * the mailbox, so putting it in the response body hands it to whoever made the
 * request rather than to whoever controls the address.
 */
export async function createTicket(params: { email: string; subject: string; message: string }) {
  await initSupportTables()

  // Case ID: still human-quotable, but the random component is now CSPRNG
  // output over a 30-symbol alphabet (30^10 ~= 2^49) instead of 4 base36
  // characters from Math.random.
  const caseId = `GM-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomCode(CASE_ID_RANDOM_LENGTH)}`
  const secret = randomCode(SECRET_LENGTH)
  const secretHash = hashSecret(secret)
  const expiresAt = new Date(Date.now() + SECRET_TTL_MS).toISOString()

  if (memoryMode) {
    const t: MemTicket = {
      id: mem.seq.ticket++,
      case_id: caseId,
      email: params.email,
      subject: params.subject,
      secret_code: null,
      secret_hash: secretHash,
      secret_expires_at: expiresAt,
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
      `INSERT INTO support_tickets (case_id, email, subject, secret_hash, secret_expires_at)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [caseId, params.email, params.subject, secretHash, expiresAt]
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

export type TicketAccessResult =
  | { ok: true; ticket: SupportTicket; messages: SupportMessage[] }
  | { ok: false; reason: 'not_found' | 'invalid' | 'expired' }

/**
 * Authorise access to a ticket by (caseId, email, secret).
 *
 * SINGLE IMPLEMENTATION ON PURPOSE. Two routes previously each carried their
 * own copy of:
 *
 *   if (ticket.email.toLowerCase() !== email.toLowerCase() ||
 *       ticket.secret_code !== secret) { ... }
 *
 * which was wrong in three ways, twice over. `!==` on the secret is a
 * short-circuiting comparison that leaks, through timing, how many leading
 * characters matched. There was no expiry. And duplicating the check means a
 * fix has to be remembered in every copy. Centralising it means the next route
 * that needs this cannot get it subtly wrong.
 *
 * Failure reasons are distinguished for the CALLER'S logging. Routes must not
 * reflect the distinction between 'not_found' and 'invalid' back to an
 * unauthenticated client: doing so confirms whether a given case ID exists,
 * which is exactly the oracle that makes enumeration worthwhile.
 */
export async function verifyTicketAccess(
  caseId: string,
  email: string,
  secret: string
): Promise<TicketAccessResult> {
  const data = await getTicketByCaseId(caseId)
  if (!data) {
    return { ok: false, reason: 'not_found' }
  }

  const { ticket, messages } = data

  const emailMatches =
    String(ticket.email || '').toLowerCase() === String(email || '').trim().toLowerCase()

  /**
   * Secret comparison.
   *
   * Preferred path: the stored sha256 hash, compared in constant time.
   *
   * Legacy path: tickets created before the hashing migration still hold a
   * plaintext `secret_code`. Those are compared with timingSafeEqualString
   * rather than `!==`, so even the deprecated branch does not leak a prefix.
   * Delete this branch, and the column, once no unexpired legacy ticket
   * remains.
   */
  let secretMatches = false
  if (ticket.secret_hash) {
    secretMatches = verifySecret(secret, ticket.secret_hash)
  } else if (ticket.secret_code) {
    secretMatches = timingSafeEqualString(String(secret), String(ticket.secret_code))
  }

  // Evaluate both factors before branching so the response time does not
  // reveal which one failed.
  if (!emailMatches || !secretMatches) {
    return { ok: false, reason: 'invalid' }
  }

  /**
   * Expiry. Legacy rows have no secret_expires_at, so their lifetime is
   * derived from created_at instead of being treated as "never expires" - an
   * unbounded credential is exactly what this change exists to remove.
   */
  const expiresAt = ticket.secret_expires_at
    ? new Date(ticket.secret_expires_at).getTime()
    : new Date(ticket.created_at).getTime() + SECRET_TTL_MS

  if (Number.isFinite(expiresAt) && expiresAt < Date.now()) {
    return { ok: false, reason: 'expired' }
  }

  return { ok: true, ticket, messages }
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

/**
 * List tickets for the admin dashboard.
 *
 * Returns SupportTicketPublic - NO secret material.
 *
 * The previous implementation was `SELECT *`, and the admin route returned the
 * rows verbatim, so GET /admin/support/tickets handed back every customer's
 * email alongside their plaintext access secret. Because those secrets never
 * expired, a single leaked admin API key yielded permanent per-customer access
 * that SURVIVED REVOKING THE KEY - the attacker keeps working credentials for
 * every ticket that existed at the time of the leak.
 *
 * Columns are now named explicitly rather than `SELECT *`, so a future
 * sensitive column is excluded by default instead of being published the
 * moment it is added.
 *
 * `limit` is clamped because it is caller-supplied; an unbounded LIMIT is a
 * cheap way to make the database do unbounded work.
 */
export async function listTickets(limit = 50, offset = 0): Promise<SupportTicketPublic[]> {
  await initSupportTables()

  const safeLimit = Math.min(Math.max(Number.isFinite(limit) ? limit : 50, 1), 200)
  const safeOffset = Math.max(Number.isFinite(offset) ? offset : 0, 0)

  if (memoryMode) {
    return [...mem.tickets]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(safeOffset, safeOffset + safeLimit)
      .map((t) => toPublicTicket(t as SupportTicket))
  }
  const p = getPool()
  const res = await p.query<SupportTicketPublic>(
    `SELECT id, case_id, email, subject, status, created_at, secret_expires_at
       FROM support_tickets
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2`,
    [safeLimit, safeOffset]
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
    return toPublicTicket(t as SupportTicket)
  }
  const p = getPool()
  // Named columns, not RETURNING *, so the secret material cannot ride back
  // out to the admin route and into an HTTP response.
  const res = await p.query<SupportTicketPublic>(
    `UPDATE support_tickets SET status=$1 WHERE LOWER(case_id)=LOWER($2)
     RETURNING id, case_id, email, subject, status, created_at, secret_expires_at`,
    [next, normalized]
  )
  if (!res.rowCount) return null
  return res.rows[0]
}
