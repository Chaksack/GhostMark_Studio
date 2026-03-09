/**
 * Simple Strapi client for server-side usage in Next.js App Router.
 * Reads STRAPI_URL and STRAPI_API_TOKEN from environment variables.
 * Falls back gracefully if not configured.
 */

type StrapiResponse<T> = {
  data: T
  meta?: Record<string, unknown>
  error?: { status: number; name: string; message: string; details?: unknown }
}

const STRAPI_URL = process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN

export function isStrapiEnabled(): boolean {
  return Boolean(STRAPI_URL)
}

export async function strapiFetch<T = unknown>(path: string, init: RequestInit = {}): Promise<StrapiResponse<T>> {
  if (!STRAPI_URL) {
    return { data: [] as unknown as T, meta: { disabled: true } }
  }

  const url = `${STRAPI_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`

  const headers: HeadersInit = {
    ...(init.headers || {}),
  }

  if (STRAPI_API_TOKEN) {
    ;(headers as Record<string, string>).Authorization = `Bearer ${STRAPI_API_TOKEN}`
  }

  const res = await fetch(url, {
    ...init,
    headers,
    // Always revalidate soon so CMS edits can reflect without redeploys.
    // Adjust as needed per project requirements.
    next: { revalidate: 60 },
  })

  if (!res.ok) {
    return {
      data: [] as unknown as T,
      meta: { status: res.status },
      error: { status: res.status, name: 'StrapiError', message: await res.text() },
    }
  }

  return (await res.json()) as StrapiResponse<T>
}

export type StrapiMedia = {
  id: number
  attributes: {
    url: string
    alternativeText?: string | null
    caption?: string | null
    width?: number
    height?: number
  }
}

export type StrapiCustomerStory = {
  id: number
  attributes: {
    title: string
    excerpt?: string | null
    slug?: string
    publishedAt?: string
    cover?: { data?: StrapiMedia | null }
    content?: string | null
  }
}

export type StrapiHomepage = {
  id: number
  attributes: {
    title?: string | null
    subtitle?: string | null
    description?: string | null
    primaryCtaLabel?: string | null
    secondaryCtaLabel?: string | null
    heroImage?: { data?: StrapiMedia | null }
  }
}

export type StrapiAbout = {
  id: number
  attributes: {
    title?: string | null
    content?: string | null
    heroImage?: { data?: StrapiMedia | null }
  }
}

export type StrapiBanner = {
  id: number
  attributes: {
    title?: string | null
    text?: string | null
    placement?: string | null
    link?: string | null
    backgroundColor?: string | null
    image?: { data?: StrapiMedia | null }
  }
}
