/**
 * SECURITY LANE regression tests.
 *
 * These exist because a security fix without a test is a hypothesis. Each
 * assertion below corresponds to a specific defect that was live in
 * production, and several deliberately assert against the ORIGINAL attack
 * payload rather than a synthetic one.
 *
 * Run: npm run test:unit
 */
import { html, raw, escapeHtml, escapeHtmlAttr, escapeHtmlMultiline, safeUrl, RawHtml } from "../html"

describe('html', () => {

  // escapeHtml
  it("escapes angle brackets", () => { expect(escapeHtml("<script>") === "&lt;script&gt;").toBe(true) })
  it("escapes double quote", () => { expect(escapeHtml('"') === "&quot;").toBe(true) })
  it("escapes single quote", () => { expect(escapeHtml("'") === "&#39;").toBe(true) })
  it("escapes backtick", () => { expect(escapeHtml("`") === "&#96;").toBe(true) })
  it("escapes ampersand", () => { expect(escapeHtml("a & b") === "a &amp; b").toBe(true) })
  it("ampersand escaped first, no double-encoding", () => { expect(escapeHtml("<&>") === "&lt;&amp;&gt;").toBe(true) })
  it("pre-existing entity is escaped, not passed through", () => { expect(escapeHtml("&lt;") === "&amp;lt;").toBe(true) })
  it("null/undefined -> empty string", () => { expect(escapeHtml(null) === "" && escapeHtml(undefined) === "").toBe(true) })
  it("numbers survive", () => { expect(escapeHtml(0) === "0").toBe(true) })
  it("attribute breakout neutralised", () => { expect(escapeHtmlAttr('" onload="x') === "&quot; onload=&quot;x").toBe(true) })

  // the ACTUAL payloads from the two vulnerable routes
  const linkInjection = `</p><a href="https://evil.test/steal">Verify your account</a><p>`
  const e1 = escapeHtml(linkInjection)
  it("phishing anchor cannot survive escaping", () => { expect(!e1.includes("<a ")).toBe(true) })
  it("tag closure cannot survive escaping", () => { expect(!e1.includes("</p>")).toBe(true) })
  it("payload rendered as visible text instead", () => { expect(e1.includes("&lt;a href=&quot;")).toBe(true) })

  const imgTracker = `<img src="https://evil.test/pixel.gif">`
  it("tracking pixel injection neutralised", () => { expect(!escapeHtml(imgTracker).includes("<img")).toBe(true) })

  // html`` tagged template: escapes by default
  const subject = `<img src=x onerror=alert(1)>`
  const out = html`<p>Subject: ${subject}</p>`.toString()
  it("html`` escapes interpolations by default", () => { expect(!out.includes("<img")).toBe(true) })
  it("surrounding literal markup preserved", () => { expect(out.startsWith("<p>Subject: &lt;img")).toBe(true) })
  it("closing literal preserved", () => { expect(out.endsWith("</p>")).toBe(true) })

  // raw() opt-out and nesting
  it("raw() opts out of escaping", () => { expect(html`<b>${raw("<i>ok</i>")}</b>`.toString() === "<b><i>ok</i></b>").toBe(true) })
  const nested = html`<i>${subject}</i>`
  it("nested html`` not double-escaped but still safe", () => { expect(!html`<div>${nested}</div>`.toString().includes("<img")).toBe(true) })
  it("nested fragment composes correctly", () => { expect(html`<div>${nested}</div>`.toString().includes("<i>&lt;img")).toBe(true) })
  it("arrays join", () => { expect(html`${["a", "b"]}`.toString() === "ab").toBe(true) })
  it("arrays of fragments compose", () => { expect(html`${[html`<i>x</i>`, html`<i>y</i>`]}`.toString() === "<i>x</i><i>y</i>").toBe(true) })
  it("html`` returns RawHtml", () => { expect(html`x` instanceof RawHtml).toBe(true) })
  it("multiple interpolations in order", () => { expect(html`a${1}b${2}c`.toString() === "a1b2c").toBe(true) })
  it("empty template", () => { expect(html``.toString() === "").toBe(true) })

  // multiline
  it("newline -> br", () => { expect(escapeHtmlMultiline("a\nb") === "a<br/>b").toBe(true) })
  it("user-typed <br/> shown as text, not a tag", () => { expect(escapeHtmlMultiline("<br/>") === "&lt;br/&gt;").toBe(true) })
  it("escape happens before newline conversion", () => { expect(escapeHtmlMultiline("<p>\n</p>") === "&lt;p&gt;<br/>&lt;/p&gt;").toBe(true) })

  // safeUrl
  it("https allowed", () => { expect(safeUrl("https://ghostmarkstudio.com/x") === "https://ghostmarkstudio.com/x").toBe(true) })
  it("http allowed", () => { expect(safeUrl("http://a.test") === "http://a.test").toBe(true) })
  it("mailto allowed", () => { expect(safeUrl("mailto:a@b.test") === "mailto:a@b.test").toBe(true) })
  it("javascript: rejected", () => { expect(safeUrl("javascript:alert(1)") === "#").toBe(true) })
  it("javascript: rejected case-insensitively", () => { expect(safeUrl("JaVaScRiPt:alert(1)") === "#").toBe(true) })
  it("data: rejected", () => { expect(safeUrl("data:text/html,<script>alert(1)</script>") === "#").toBe(true) })
  it("vbscript: rejected", () => { expect(safeUrl("vbscript:msgbox") === "#").toBe(true) })
  it("empty/null -> #", () => { expect(safeUrl("") === "#" && safeUrl(null) === "#").toBe(true) })
  it("relative path allowed", () => { expect(safeUrl("/support/GM-1") === "/support/GM-1").toBe(true) })
  it("allowed scheme still escaped for the attribute", () => { expect(safeUrl('https://a.test/"><script>') === "https://a.test/&quot;&gt;&lt;script&gt;").toBe(true) })
  it("scheme-relative resolves to https and is allowed", () => { expect(safeUrl("//evil.test") === "//evil.test").toBe(true) })


})
