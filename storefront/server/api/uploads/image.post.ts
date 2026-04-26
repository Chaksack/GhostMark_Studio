// Server route to receive a design preview image and persist it under
// /public/uploads/designs/YYYY-MM/DD/<random>.<ext>. The Nuxt static server
// will then serve those files at the same URL path.
//
// MVP-grade: writes to local FS. Production should swap the body of this
// handler for an S3/R2/Cloudinary client — keep the request/response shape
// stable so the client never has to know which backend is in use.
//
// Hardening:
//   - 10 MB hard cap (mirrors nuxt-security.requestSizeLimiter.maxUploadFile).
//   - MIME allow-list (PNG / JPEG / WebP only).
//   - Date-bucketed directory layout to avoid 100k-files-in-a-folder pain.
//   - Random suffix on the filename to prevent guessing / collisions.
import { defineEventHandler, readMultipartFormData, createError } from 'h3'
import { promises as fs, existsSync } from 'node:fs'
import { join } from 'node:path'

const MAX_BYTES = 10 * 1024 * 1024 // 10 MB
const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/webp'] as const
type AllowedMime = (typeof ALLOWED_MIME)[number]

const isAllowedMime = (m: string | undefined): m is AllowedMime =>
  !!m && (ALLOWED_MIME as readonly string[]).includes(m)

const extFor = (mime: AllowedMime): string =>
  mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg'

export default defineEventHandler(async (event) => {
  const form = await readMultipartFormData(event)
  if (!form) {
    throw createError({ statusCode: 400, statusMessage: 'No form data' })
  }

  const file = form.find((f) => f.name === 'image' && f.data)
  if (!file?.data) {
    throw createError({ statusCode: 400, statusMessage: 'No image field' })
  }
  if (file.data.length > MAX_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'Image too large (max 10MB)' })
  }
  if (!isAllowedMime(file.type)) {
    throw createError({ statusCode: 415, statusMessage: 'Unsupported image type' })
  }

  const date = new Date()
  const yyyymm = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  const dd = String(date.getDate()).padStart(2, '0')
  const dir = join(process.cwd(), 'public', 'uploads', 'designs', yyyymm, dd)
  if (!existsSync(dir)) {
    await fs.mkdir(dir, { recursive: true })
  }

  const ext = extFor(file.type)
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const absPath = join(dir, name)
  await fs.writeFile(absPath, file.data)

  const publicPath = `/uploads/designs/${yyyymm}/${dd}/${name}`
  return { url: publicPath, bytes: file.data.length, mime: file.type }
})
