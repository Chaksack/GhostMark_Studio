import { getQuery, createError } from 'h3'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const baseUrl = String(config.public.cmsBaseUrl || '').replace(/\/$/, '')
  if (!baseUrl) {
    throw createError({ statusCode: 500, statusMessage: 'CMS base URL is not configured' })
  }

  const rawPath = (event.context.params?.path || '').toString()
  const query = getQuery(event)

  const token = String(config.cmsToken || '')
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  const url = `${baseUrl}/api/${rawPath}`
  return await $fetch(url, { query, headers })
})
