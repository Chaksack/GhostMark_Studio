import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

// Minimal in-memory design store for demo/prototyping. Replace with DB/service in production.
const designStore: {
  [key: string]: {
    id: string
    product_id: string
    variant_id?: string
    side: 'front' | 'back' | 'left_sleeve' | 'right_sleeve'
    print_area_version: number
    design_version: number
    canvas_json: any
    preview_url?: string
    created_at: string
    updated_at: string
  }[]
} = {}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const body = (req as any).body || {}
    const {
      product_id,
      variant_id,
      side,
      print_area_version,
      canvas_json,
      preview_url,
    } = body

    if (!product_id || !side || typeof print_area_version !== 'number' || !canvas_json) {
      return res.status(400).json({
        message: 'Missing required fields: product_id, side, print_area_version, canvas_json',
      })
    }

    const key = `${product_id}:${variant_id || 'default'}:${side}`
    const existing = designStore[key] || []
    const nextVersion = (existing[existing.length - 1]?.design_version || 0) + 1
    const id = `${key}:${Date.now()}:${nextVersion}`
    const now = new Date().toISOString()

    const record = {
      id,
      product_id,
      variant_id,
      side,
      print_area_version,
      design_version: nextVersion,
      canvas_json,
      preview_url,
      created_at: now,
      updated_at: now,
    }

    if (!designStore[key]) designStore[key] = []
    designStore[key].push(record)

    return res.status(201).json({
      design: record,
      message: 'Design saved',
    })
  } catch (e: any) {
    return res.status(500).json({ message: 'Failed to save design', error: e?.message })
  }
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  // Query designs by product/variant/side
  const { product_id, variant_id, side } = (req.query || {}) as any
  if (!product_id || !side) {
    return res.status(400).json({ message: 'product_id and side are required' })
  }
  const key = `${product_id}:${variant_id || 'default'}:${side}`
  const list = designStore[key] || []
  return res.json({ designs: list, count: list.length })
}
