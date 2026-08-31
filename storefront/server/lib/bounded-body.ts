// Bounded request-body reader for Nitro/h3 route handlers.
//
// WHY THIS EXISTS
// ---------------
// `readMultipartFormData(event)` (and everything else built on h3's
// `readRawBody`) buffers the **entire** request body into a Buffer before the
// handler regains control. Any size check performed after that call is
// cosmetic: the memory has already been allocated. On an unauthenticated
// endpoint that is a trivially exploitable OOM: one anonymous
// `POST` of a multi-gigabyte body kills the Node process for every user.
//
// h3 v2 ships `assertBodySize()` for exactly this. We are pinned to h3
// **1.15.8** (verified: storefront/node_modules/.pnpm/h3@1.15.8), which has no
// such utility, so the cap is implemented here.
//
// TWO LAYERS, DELIBERATELY
//   1. `Content-Length` is rejected *before* a single body byte is read. This
//      is the cheap path and covers every honest client.
//   2. The body is then read chunk-by-chunk off the raw Node stream with a
//      running byte counter, because `Content-Length` is client-controlled: it
//      can be understated, or omitted entirely with
//      `Transfer-Encoding: chunked`. Layer 2 is the one that actually holds.
//
// HAND-OFF TO h3
// --------------
// Once we have a bounded Buffer we publish it into the two slots h3 1.15.8's
// `readRawBody()` consults first (`event._requestBody`, then
// `event.node.req[Symbol.for('h3RawBody')]`, see h3 dist/index.mjs:363-368).
// That lets the caller go on to use `readMultipartFormData(event)` normally:
// it finds the already-read, already-bounded buffer instead of trying to
// re-read a drained stream (which would hang until the socket timed out).
// We do NOT reimplement multipart parsing: hand-rolled parsers are their own
// vulnerability class.
import { createError, getRequestHeader, getRequestWebStream, type H3Event } from 'h3'

/** h3 1.15.8's own raw-body cache slot. `Symbol.for` is globally registered,
 *  so this is the same symbol instance h3 uses internally. */
const H3_RAW_BODY = Symbol.for('h3RawBody')

/** Abort a body that has gone silent. Guards against a slowloris-style client
 *  that opens a request, sends one byte, and holds the socket forever. This is
 *  an *idle* timeout, not a total one, so a genuinely slow 10 MB mobile upload
 *  is unaffected as long as bytes keep arriving. */
const DEFAULT_IDLE_TIMEOUT_MS = 30_000

export interface BoundedBodyOptions {
  /** Hard ceiling, in bytes, for the whole request body (envelope included). */
  maxBytes: number
  /** Milliseconds of no inbound data before the read is aborted. */
  idleTimeoutMs?: number
}

/**
 * Read the raw request body, refusing anything over `maxBytes`.
 *
 * Throws 413 before allocating when `Content-Length` already exceeds the cap,
 * and again mid-stream if the actual byte count does. Throws 408 on an idle
 * stall. The returned Buffer is guaranteed to be <= `maxBytes`.
 */
export async function readBoundedRawBody(
  event: H3Event,
  { maxBytes, idleTimeoutMs = DEFAULT_IDLE_TIMEOUT_MS }: BoundedBodyOptions,
): Promise<Buffer> {
  // --- Layer 1: pre-read Content-Length check -------------------------------
  const declared = getRequestHeader(event, 'content-length')
  if (declared !== undefined && declared !== '') {
    const declaredBytes = Number(declared)
    if (!Number.isInteger(declaredBytes) || declaredBytes < 0) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid Content-Length' })
    }
    if (declaredBytes > maxBytes) {
      throw payloadTooLarge(event, maxBytes)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const req = event.node?.req as any

  // If something upstream already read the body, respect it but still enforce
  // the cap: we have no guarantee it was read under a limit.
  const cached = req?.[H3_RAW_BODY]
  if (cached) {
    const buf = Buffer.from(await cached)
    if (buf.length > maxBytes) throw payloadTooLarge(event, maxBytes)
    return buf
  }

  // --- Layer 2: bounded streaming read --------------------------------------
  const body =
    req && typeof req.on === 'function'
      ? await readFromNodeStream(event, req, maxBytes, idleTimeoutMs)
      : await readFromWebStream(event, maxBytes)

  publishToH3(event, req, body)
  return body
}

/** Node `IncomingMessage` path: the node-server Nitro preset (dev server and
 *  the ECS container both use it). Reading the socket directly is what lets us
 *  stop consuming the moment the cap is passed. */
function readFromNodeStream(
  event: H3Event,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  req: any,
  maxBytes: number,
  idleTimeoutMs: number,
): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []
    let received = 0
    let settled = false
    let idleTimer: ReturnType<typeof setTimeout> | undefined

    const clearIdle = () => {
      if (idleTimer) clearTimeout(idleTimer)
      idleTimer = undefined
    }
    const detach = () => {
      clearIdle()
      req.off?.('data', onData)
      req.off?.('end', onEnd)
      req.off?.('error', onError)
      req.off?.('aborted', onAborted)
    }
    const armIdle = () => {
      clearIdle()
      idleTimer = setTimeout(() => {
        abort(createError({ statusCode: 408, statusMessage: 'Request body timed out' }))
      }, idleTimeoutMs)
      // Don't hold the event loop open on an idle socket.
      ;(idleTimer as unknown as { unref?: () => void }).unref?.()
    }
    /** Reject *and* stop draining the client. */
    const abort = (err: unknown) => {
      if (settled) return
      settled = true
      detach()
      chunks.length = 0 // release what we buffered; we are not returning it
      stopConsuming(event, req)
      reject(err)
    }
    const onData = (chunk: Buffer) => {
      if (settled) return
      received += chunk.length
      if (received > maxBytes) {
        abort(payloadTooLarge(event, maxBytes))
        return
      }
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
      armIdle()
    }
    const onEnd = () => {
      if (settled) return
      settled = true
      detach()
      resolve(Buffer.concat(chunks, received))
    }
    const onError = (err: Error) => {
      if (settled) return
      settled = true
      detach()
      reject(err)
    }
    const onAborted = () => {
      if (settled) return
      settled = true
      detach()
      reject(createError({ statusCode: 400, statusMessage: 'Request aborted' }))
    }

    req.on('data', onData)
    req.on('end', onEnd)
    req.on('error', onError)
    req.on('aborted', onAborted)
    armIdle()
  })
}

/**
 * Stop reading an over-sized request without immediately killing the socket,
 * so the 413 still reaches the client.
 *
 * Pausing (rather than destroying) means we stop draining the kernel receive
 * buffer; TCP backpressure then stalls the sender, so the attacker cannot keep
 * pushing bytes into our heap. `Connection: close` plus a socket teardown once
 * the response has been flushed stops them holding the connection open.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stopConsuming(event: H3Event, req: any): void {
  try {
    req.pause?.()
  } catch {
    /* stream already gone */
  }
  try {
    req.unpipe?.()
  } catch {
    /* not piped */
  }

  const res = event.node?.res
  const destroy = () => {
    try {
      req.destroy?.()
    } catch {
      /* already destroyed */
    }
    try {
      req.socket?.destroy?.()
    } catch {
      /* already destroyed */
    }
  }

  if (!res) {
    destroy()
    return
  }
  if (!res.headersSent) {
    try {
      res.setHeader('Connection', 'close')
    } catch {
      /* headers already flushed */
    }
  }
  res.once('finish', destroy)
  res.once('close', destroy)
}

/** Web-stream fallback for non-Node runtimes (edge/workers presets). Kept so
 *  the cap does not silently vanish if the deploy target ever changes. */
async function readFromWebStream(event: H3Event, maxBytes: number): Promise<Buffer> {
  const stream = getRequestWebStream(event)
  if (!stream) return Buffer.alloc(0)

  const reader = stream.getReader()
  const chunks: Buffer[] = []
  let received = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue
      received += value.byteLength
      if (received > maxBytes) {
        chunks.length = 0
        await reader.cancel('payload too large').catch(() => {})
        throw payloadTooLarge(event, maxBytes)
      }
      chunks.push(Buffer.from(value))
    }
  } finally {
    try {
      reader.releaseLock()
    } catch {
      /* already released by cancel() */
    }
  }
  return Buffer.concat(chunks, received)
}

/** Make the bounded buffer visible to h3's body utils so the caller can use
 *  `readMultipartFormData(event)` without re-reading the (now drained) stream.
 *  Slot precedence per h3 1.15.8 dist/index.mjs:368. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function publishToH3(event: H3Event, req: any, body: Buffer): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(event as any)._requestBody = body
  if (req) {
    try {
      req[H3_RAW_BODY] = Promise.resolve(body)
    } catch {
      /* frozen request object; _requestBody is enough */
    }
  }
}

function payloadTooLarge(event: H3Event, maxBytes: number) {
  const res = event.node?.res
  if (res && !res.headersSent) {
    try {
      res.setHeader('Connection', 'close')
    } catch {
      /* headers already flushed */
    }
  }
  return createError({
    statusCode: 413,
    statusMessage: `Payload too large (max ${maxBytes} bytes)`,
  })
}
