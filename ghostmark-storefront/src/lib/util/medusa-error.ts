export default function medusaError(error: any): never {
  // Normalize url/method if available (works for both axios-like and fetch-like errors)
  const url: string | undefined =
    error?.config?.url || error?.response?.url || error?.request?.url
  const baseURL: string | undefined = error?.config?.baseURL
  const method: string | undefined =
    error?.config?.method || error?.request?.method || error?.response?.method

  const fullUrl = (() => {
    try {
      if (url && baseURL) return new URL(url, baseURL).toString()
      if (url) return new URL(url, typeof window === "undefined" ? "http://localhost" : window.location.origin).toString()
    } catch (_) {}
    return url
  })()

  if (error?.response) {
    // The request was made and the server responded with a non-2xx status
    const status = error.response.status
    const statusText = error.response.statusText || ""
    const data = error.response.data

    // Derive a human-friendly message from diverse response shapes
    let msg: string | undefined
    if (data) {
      if (typeof data === "string") {
        msg = data
      } else if (typeof data?.message === "string") {
        msg = data.message
      } else if (Array.isArray(data?.errors)) {
        msg = data.errors
          .map((e: any) => (typeof e === "string" ? e : e?.message))
          .filter(Boolean)
          .join("; ")
      } else {
        try {
          msg = JSON.stringify(data)
        } catch {
          msg = String(data)
        }
      }
    }

    const prefix = [method?.toUpperCase(), fullUrl].filter(Boolean).join(" ")
    const statusPart = [status, statusText].filter(Boolean).join(" ")
    const finalMessage = [prefix, statusPart, msg]
      .filter(Boolean)
      .join(" – ")

    throw new Error(finalMessage || "Request failed with an unknown error.")
  } else if (error?.request) {
    // The request was made but no response was received (network/CORS/offline)
    const prefix = [method?.toUpperCase(), fullUrl].filter(Boolean).join(" ")
    const base = prefix || "Network error"
    throw new Error(`${base} – No response received from server.`)
  } else {
    // Something happened in setting up the request that triggered an Error
    const prefix = [method?.toUpperCase(), fullUrl].filter(Boolean).join(" ")
    const message =
      (typeof error?.message === "string" && error.message) ||
      (typeof error === "string" ? error : "Unexpected error occurred")
    const code = error?.code ? ` (${error.code})` : ""
    const base = prefix ? `${prefix} – ${message}` : message
    throw new Error(`${base}${code}`)
  }
}
