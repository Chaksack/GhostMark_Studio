import Medusa from "@medusajs/js-sdk"

export const sdk = new Medusa({
  baseUrl: import.meta.env.VITE_BACKEND_URL || "/",
  debug: import.meta.env.DEV,
  auth: {
    type: "session",
  },
})

type ApiFetchInit = Omit<RequestInit, "body"> & { body?: any }

// Small helper to ensure we always get parsed JSON in the Admin UI pages.
// sdk.client.fetch may return a native Response depending on usage; this
// wrapper will parse the response. IMPORTANT: Do NOT JSON.stringify here,
// because Medusa's SDK already stringifies plain object bodies. Doing it here
// too would double-encode and cause body-parser to fail on the backend.
export async function apiFetch<T = any>(
  input: string,
  init?: ApiFetchInit
): Promise<T> {
  const nextInit: ApiFetchInit | undefined = init

  // Leave body as-is. Medusa SDK will handle JSON stringification of plain objects.
  // This prevents double-encoding like '"{\"message\":\"...\"}"'.

  const res: any = await sdk.client.fetch(input, nextInit as any)

  // If this looks like a Fetch Response, parse JSON or text and throw on HTTP errors
  if (res && typeof res === "object" && typeof res.json === "function") {
    let parsed: any = undefined
    let text: string | undefined
    try {
      parsed = await res.json()
    } catch {
      try {
        text = await res.text()
      } catch {}
    }

    if (!("ok" in res) || typeof (res as Response).ok !== "boolean") {
      // Non-standard Response-like object, just return parsed
      return (parsed ?? (text as any)) as T
    }

    if (!(res as Response).ok) {
      const message = (parsed && (parsed.message || parsed.error || parsed.detail)) || text || `Request failed (${(res as Response).status})`
      const err = new Error(String(message)) as Error & { status?: number; data?: any }
      err.status = (res as Response).status
      err.data = parsed ?? text
      throw err
    }

    return parsed as T
  }

  // Otherwise, assume it's already JSON
  return res as T
}
