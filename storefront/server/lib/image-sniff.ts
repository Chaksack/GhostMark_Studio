// Magic-byte (content) sniffing for the raster formats this app accepts.
//
// WHY: the `type` field on a multipart part is copied verbatim from the
// `Content-Type` header the *client* wrote into the part. It is an assertion,
// not a fact. Trusting it means arbitrary bytes get written to disk and later
// served under whatever extension that assertion implied.
//
// This module answers a different question: what do the bytes actually say
// they are? The caller then requires sniffed === claimed AND sniffed is on the
// allowlist, so a mismatch is rejected rather than silently "corrected".
//
// Scope note: this establishes format identity, not safety. It does not prove
// the file decodes, and it does not stop a polyglot (a byte string that is a
// valid PNG *and* valid HTML). Polyglots are handled at serve time by the
// server-derived extension plus `X-Content-Type-Options: nosniff`, see
// server/middleware/security-headers.ts.

export const SNIFFABLE_IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/webp'] as const
export type SniffedImageMime = (typeof SNIFFABLE_IMAGE_MIMES)[number]

/** Shortest prefix that can decide any supported format (WebP needs 12). */
const MIN_SNIFF_BYTES = 12

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

/** WebP payload chunk types, in RIFF fourcc form. */
const WEBP_CHUNKS = new Set(['VP8 ', 'VP8L', 'VP8X'])

/**
 * Identify an image by its leading bytes.
 *
 * Returns the sniffed MIME type, or `null` when the content is not one of the
 * supported formats. Never throws, never guesses from the filename.
 */
export function sniffImageMime(buf: Buffer): SniffedImageMime | null {
  if (buf.length < MIN_SNIFF_BYTES) return null

  // PNG: 8-byte signature, and the spec requires IHDR to be the first chunk
  // (length 13 at bytes 8..12, type "IHDR" at 12..16). Checking IHDR as well
  // rules out files that merely start with the signature.
  if (buf.subarray(0, 8).equals(PNG_SIGNATURE)) {
    if (buf.length < 16) return null
    if (buf.readUInt32BE(8) !== 13) return null
    if (buf.toString('latin1', 12, 16) !== 'IHDR') return null
    return 'image/png'
  }

  // JPEG: SOI (FF D8) immediately followed by a marker introducer (FF) and a
  // real marker byte. All JPEG markers are >= 0xC0; 0xFF and 0x00 are stuffing.
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    const marker = buf[3]!
    if (marker >= 0xc0 && marker !== 0xff) return 'image/jpeg'
    return null
  }

  // WebP, RIFF container: "RIFF" <u32le payload size> "WEBP" <chunk fourcc>.
  if (
    buf.toString('latin1', 0, 4) === 'RIFF' &&
    buf.toString('latin1', 8, 12) === 'WEBP'
  ) {
    if (buf.length < 16) return null
    if (!WEBP_CHUNKS.has(buf.toString('latin1', 12, 16))) return null
    // The RIFF size field counts everything after it. A file whose declared
    // size overruns the bytes we actually hold is malformed/truncated.
    const riffSize = buf.readUInt32LE(4)
    if (riffSize + 8 > buf.length) return null
    return 'image/webp'
  }

  return null
}
