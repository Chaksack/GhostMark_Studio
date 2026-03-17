import Medusa from "@medusajs/js-sdk"

// Defaults to standard port for Medusa server
// Resolve base URL from environment, preferring server var then public var
// Normalize by removing any trailing slash to avoid double slashes in requests
const resolveBackendUrl = (): string => {
  const candidate =
    process.env.MEDUSA_BACKEND_URL || process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || ""
  const normalized = String(candidate).replace(/\/$/, "")
  if (normalized) return normalized
  // Safe defaults per environment
  return process.env.NODE_ENV === "production"
    ? "https://admin.ghostmarkstudio.com"
    : "http://localhost:9000"
}

const MEDUSA_BACKEND_URL = resolveBackendUrl()

export const sdk = new Medusa({
  baseUrl: MEDUSA_BACKEND_URL,
  debug: process.env.NODE_ENV === "development",
  publishableKey: process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY,
})
