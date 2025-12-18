import { NextRequest, NextResponse } from "next/server"
import path from "path"
import fs from "fs/promises"

function parseDataUrl(dataUrl: string): { mime: string; data: Buffer; ext: string } {
  const match = /^data:(.*?);base64,(.*)$/.exec(dataUrl)
  if (!match) throw new Error("Invalid data URL")
  const mime = match[1]
  const base64 = match[2]
  const data = Buffer.from(base64, "base64")
  // derive file extension from mime
  const ext = (() => {
    if (mime === "image/png") return "png"
    if (mime === "image/jpeg") return "jpg"
    if (mime === "image/webp") return "webp"
    if (mime === "image/svg+xml") return "svg"
    // default to png when unknown image type
    return "bin"
  })()
  return { mime, data, ext }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 })
    }

    const { dataUrl, filename } = body as { dataUrl?: string; filename?: string }

    if (!dataUrl || typeof dataUrl !== "string") {
      return NextResponse.json({ message: "dataUrl is required" }, { status: 400 })
    }

    const { mime, data, ext } = parseDataUrl(dataUrl)

    // sanitize filename and ensure extension
    const safeBase = (filename && typeof filename === 'string' ? filename : `upload-${Date.now()}.${ext}`)
      .replace(/[^a-zA-Z0-9._-]/g, "_")
    const finalName = safeBase.endsWith(`.${ext}`) ? safeBase : `${safeBase}.${ext}`

    // Save under public/uploads/mockups/yyyy-mm/dd/ for simple partitioning
    const now = new Date()
    const yyyy = now.getFullYear()
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const dd = String(now.getDate()).padStart(2, '0')
    const relDir = path.join("uploads", "mockups", `${yyyy}-${mm}`, dd)
    const publicDir = path.join(process.cwd(), "public", relDir)
    await fs.mkdir(publicDir, { recursive: true })

    const filePath = path.join(publicDir, finalName)
    await fs.writeFile(filePath, data)

    // Public URL relative to Next.js app's public folder
    const urlPath = "/" + path.join(relDir, finalName).replace(/\\/g, "/")

    return NextResponse.json({ url: urlPath, mime }, { status: 200 })
  } catch (e: any) {
    const message = e?.message || "Failed to upload image"
    return NextResponse.json({ message }, { status: 500 })
  }
}
