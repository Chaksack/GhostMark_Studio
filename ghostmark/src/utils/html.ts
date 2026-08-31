/**
 * HTML output encoding for email and server-rendered pages.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Several routes built HTML email bodies with raw template literals and
 * interpolated caller-supplied strings straight in:
 *
 *   `<p>Subject: ${ticket.subject}</p>`         // support ticket ack
 *   `<strong>${interestsList}</strong>`         // newsletter welcome
 *
 * An unauthenticated caller controlled those strings, so they could inject
 * arbitrary markup - most usefully an <a href> to their own domain - into an
 * email sent from our verified sending domain, with our branding around it.
 *
 * ENCODE AT THE SINK, NOT AT THE SOURCE
 * -------------------------------------
 * The tempting fix is to strip dangerous characters when the value arrives.
 * src/api/support/[caseId]/route.ts does exactly that:
 *
 *   const safeCaseId = caseId.replace(/[<>"']/g, "")
 *
 * That is a blacklist applied at the source, and it is the wrong shape of fix
 * for three reasons:
 *
 *   - It is only correct for the sinks that exist the day it is written. The
 *     same "sanitised" value is safe in an HTML text node and unsafe the
 *     moment someone drops it into a URL, a JS string, or a CSS block.
 *   - It silently corrupts legitimate data. A customer whose ticket subject is
 *     `Order #12 <urgent>` gets it mangled in our records.
 *   - It encodes a guess about the character set that matters. Encoding at the
 *     sink needs no such guess: the sink defines the escaping.
 *
 * So: values are stored and passed around verbatim, and encoded at the exact
 * point they are written into markup.
 *
 * USE THE `html` TAGGED TEMPLATE. It escapes every interpolation by default,
 * which makes the safe thing the default thing and means the next person to
 * touch these templates cannot reintroduce the bug by forgetting a call.
 */

/**
 * Marker for a string that is already known-safe HTML and must NOT be escaped
 * again. Only ever produced by `html` itself or by an explicit `raw()` call.
 */
export class RawHtml {
  constructor(private readonly value: string) {}
  toString(): string {
    return this.value
  }
  /** Unwrap to a plain string for passing to a mailer. */
  toHtmlString(): string {
    return this.value
  }
}

/**
 * Mark a string as trusted HTML, exempting it from escaping.
 *
 * Every use of this is a place where you are personally asserting the string
 * cannot contain attacker-controlled markup. Only pass literals or output that
 * was itself built with `html`.
 */
export function raw(value: string): RawHtml {
  return new RawHtml(value)
}

/**
 * Escape a value for insertion into an HTML text node or a QUOTED attribute
 * value.
 *
 * Escapes the OWASP-recommended set. `&` must be replaced first or it would
 * double-escape the entities introduced by the later replacements.
 *
 * NOT SUFFICIENT for: unquoted attribute values (a space or slash ends the
 * attribute), inside <script> or <style> blocks, or for a URL in an href/src -
 * use `safeUrl` for that. All attributes in this codebase's templates are
 * quoted.
 */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) {
    return ""
  }
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/`/g, "&#96;")
}

/**
 * Escape for a quoted attribute value. Same rules as text content given that
 * our attributes are always quoted; kept as a separate name so the intent at
 * each call site is legible.
 */
export function escapeHtmlAttr(value: unknown): string {
  return escapeHtml(value)
}

/**
 * Escape for an HTML text node while preserving line breaks as <br/>.
 * Escaping happens FIRST, so a literal "<br/>" typed by a user is displayed as
 * text rather than becoming a tag.
 */
export function escapeHtmlMultiline(value: unknown): string {
  return escapeHtml(value).replace(/\r?\n/g, "<br/>")
}

/**
 * Only these schemes may appear in an href/src we render.
 *
 * The dangerous ones are `javascript:` (script execution in any client that
 * honours it), and `data:` (a whole attacker-authored document behind a link
 * that looks like ours).
 */
const ALLOWED_URL_SCHEMES = new Set(["http:", "https:", "mailto:"])

/**
 * Validate and escape a URL for an href/src attribute.
 *
 * Returns "#" for anything not on the scheme allowlist, so a rejected URL
 * produces a dead link rather than a live exploit. Allowlist, not blacklist:
 * the set of URL schemes a mail client might honour is long and not fully
 * knowable, so we name the three we actually use.
 *
 * Relative URLs are permitted and returned escaped - they cannot change origin.
 */
export function safeUrl(value: unknown): string {
  const s = String(value ?? "").trim()
  if (!s) {
    return "#"
  }
  // A scheme-relative or absolute URL: parse and check the scheme.
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(s) || s.startsWith("//")) {
    try {
      const parsed = new URL(s, "https://placeholder.invalid")
      if (!ALLOWED_URL_SCHEMES.has(parsed.protocol)) {
        return "#"
      }
    } catch {
      return "#"
    }
  }
  return escapeHtml(s)
}

/**
 * Tagged template that HTML-escapes every interpolated value.
 *
 *   html`<p>Subject: ${subject}</p>`
 *
 * Values that are already RawHtml (a nested `html` result, or an explicit
 * `raw()`) pass through unescaped. Arrays are joined with no separator, so a
 * list of nested `html` fragments composes naturally.
 *
 * Returns RawHtml so that nesting works without double-escaping. Call
 * `.toString()` when handing it to the mailer.
 */
export function html(
  strings: TemplateStringsArray,
  ...values: unknown[]
): RawHtml {
  let out = strings[0]
  for (let i = 0; i < values.length; i++) {
    out += renderValue(values[i]) + strings[i + 1]
  }
  return new RawHtml(out)
}

function renderValue(value: unknown): string {
  if (value instanceof RawHtml) {
    return value.toString()
  }
  if (Array.isArray(value)) {
    return value.map(renderValue).join("")
  }
  return escapeHtml(value)
}

export default {
  RawHtml,
  raw,
  html,
  escapeHtml,
  escapeHtmlAttr,
  escapeHtmlMultiline,
  safeUrl,
}
