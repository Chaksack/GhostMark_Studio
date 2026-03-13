const NOVU_API_BASE = process.env.NOVU_API_URL || "https://api.novu.co/v1"

export function isNovuEnabled() {
  return Boolean(process.env.NOVU_API_KEY)
}

function authHeaders() {
  const apiKey = process.env.NOVU_API_KEY
  if (!apiKey) throw new Error("NOVU_API_KEY is not set")
  return {
    Authorization: `ApiKey ${apiKey}`,
    "Content-Type": "application/json",
  }
}

export async function upsertSubscriber(params: {
  subscriberId: string
  email?: string
  firstName?: string
  lastName?: string
}) {
  const { subscriberId, email, firstName, lastName } = params
  if (!subscriberId) return
  const url = `${NOVU_API_BASE}/subscribers/${encodeURIComponent(subscriberId)}`
  await fetch(url, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      subscriberId,
      email,
      firstName,
      lastName,
    }),
  }).catch(() => {})
}

export async function triggerInAppEvent(params: {
  eventName?: string
  subscriberId: string
  payload?: Record<string, any>
}) {
  const { subscriberId, payload } = params
  const name = params.eventName || process.env.NOVU_EVENT_NAME || "order_placed"
  if (!subscriberId) return
  const url = `${NOVU_API_BASE}/events/trigger`
  await fetch(url, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      name: name,
      to: [{ subscriberId }],
      payload: payload || {},
    }),
  }).catch(() => {})
}
