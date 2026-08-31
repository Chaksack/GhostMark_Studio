/**
 * Input validation helpers.
 *
 * These are ALLOWLIST validators: they answer "is this one of the shapes we
 * accept", not "does this contain something bad". A blacklist has to enumerate
 * every dangerous input and is wrong the moment someone finds one you missed.
 */

/**
 * Practical email syntax check.
 *
 * Deliberately NOT RFC 5322 complete - a fully conformant regex is famously
 * enormous and accepts addresses no mail provider will route. This accepts the
 * shape every real address takes and rejects the things that cause trouble
 * downstream: whitespace, control characters, header-injection characters
 * (CR/LF), multiple @, and missing TLD.
 *
 * The length cap matters independently of syntax: an unbounded string here
 * becomes an unbounded rate-limit map key and an unbounded value in an SMTP
 * header. 254 is the RFC 5321 maximum for a forward path.
 */
export function isValidEmail(value: unknown): boolean {
  if (typeof value !== "string") {
    return false
  }
  const s = value.trim()
  if (!s || s.length > 254) {
    return false
  }
  // CR/LF would allow SMTP header injection if this value ever reaches a
  // header unescaped. Reject outright rather than relying on the mail library.
  if (/[\r\n\t\0]/.test(s)) {
    return false
  }
  return /^[^\s@<>()[\]\\,;:"]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/.test(s)
}

/**
 * Canonical form used for storage, comparison and rate-limit keys.
 *
 * Lowercased only. We deliberately do NOT strip dots or +tags: those are
 * Gmail-specific conventions, treating them as canonical would wrongly merge
 * distinct addresses on providers that consider them significant, and it would
 * mean refusing mail to an address the user legitimately owns.
 */
export function normalizeEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase()
}

/**
 * Clamp a free-text field to a maximum length.
 *
 * Length limits are a real control, not cosmetics: unbounded strings become
 * unbounded database rows, unbounded email bodies and unbounded memory.
 * Truncation is silent by design at the storage layer; routes that want to
 * reject instead should check the length themselves first.
 */
export function clampText(value: unknown, maxLength: number): string {
  const s = String(value ?? "")
  return s.length > maxLength ? s.slice(0, maxLength) : s
}

export default { isValidEmail, normalizeEmail, clampText }
