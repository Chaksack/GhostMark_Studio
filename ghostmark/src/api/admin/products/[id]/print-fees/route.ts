// =============================================================================
// GET  /admin/products/:id/print-fees
// POST /admin/products/:id/print-fees
//
// Read and set the per-print-location surcharge a customer pays to have their
// artwork printed on this product. See utils/print-pricing.ts for how the
// storefront's customised lines are priced from these.
//
//   POST body: { fees: { [locationKey]: { gbp?: number, eur?: number, usd?: number } | null } }
//
// Only `surcharge` on each `print_locations` entry is written; area, label,
// mockup_url and every other metadata key are carried through untouched.
// `null` (or an empty object) for a location clears its fee, which makes
// printing there free again.
// =============================================================================

import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"

import { money2, readPrintLocations } from "../../../../../utils/print-pricing"

const MAX_FEE = 1000

async function loadProduct(req: MedusaRequest) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    fields: ["id", "title", "metadata"],
    filters: { id: req.params.id },
  })
  const product = data?.[0]
  if (!product) throw new MedusaError(MedusaError.Types.NOT_FOUND, `Product ${req.params.id} not found.`)
  return product
}

async function storeCurrencies(req: MedusaRequest): Promise<string[]> {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "region", fields: ["currency_code"] })
  return [...new Set((data ?? []).map((r: any) => String(r.currency_code).toLowerCase()))].sort()
}

function view(product: any, currencies: string[]) {
  return {
    product_id: product.id,
    currencies,
    customisable: product.metadata?.is_customizable === true || product.metadata?.is_customizable === "true",
    locations: readPrintLocations(product.metadata).map((l) => ({ key: l.key, label: l.label, surcharge: l.surcharge })),
  }
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const [product, currencies] = await Promise.all([loadProduct(req), storeCurrencies(req)])
  return res.json(view(product, currencies))
}

export async function POST(req: MedusaRequest<{ fees?: unknown }>, res: MedusaResponse) {
  const product = await loadProduct(req)
  const currencies = await storeCurrencies(req)
  const fees = (req.body as any)?.fees
  if (!fees || typeof fees !== "object" || Array.isArray(fees)) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Body must be { fees: { [locationKey]: { [currency]: amount } | null } }.")
  }

  // Work on the stored shape, so nothing but `surcharge` changes.
  let raw: any = product.metadata?.print_locations
  const wasString = typeof raw === "string"
  if (wasString) raw = JSON.parse(raw)
  if (!Array.isArray(raw) || !raw.length) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "This product has no print locations to price.")
  }

  const known = new Set(raw.map((l: any) => l?.key).filter(Boolean))
  for (const key of Object.keys(fees)) {
    if (!known.has(key)) throw new MedusaError(MedusaError.Types.INVALID_DATA, `"${key}" is not a print location on this product.`)
  }

  const next = raw.map((loc: any) => {
    if (!loc?.key || !(loc.key in fees)) return loc
    const incoming = (fees as any)[loc.key]
    const { surcharge: _drop, ...rest } = loc
    if (incoming === null || (typeof incoming === "object" && !Object.keys(incoming).length)) return rest
    if (typeof incoming !== "object" || Array.isArray(incoming)) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, `Fees for "${loc.key}" must be an object of currency: amount.`)
    }
    const surcharge: Record<string, number> = {}
    for (const [cur, amt] of Object.entries(incoming)) {
      const c = cur.toLowerCase()
      if (!currencies.includes(c)) {
        throw new MedusaError(MedusaError.Types.INVALID_DATA, `${cur.toUpperCase()} is not a currency this store sells in (${currencies.join(", ")}).`)
      }
      const n = typeof amt === "number" ? amt : Number(amt)
      if (!Number.isFinite(n) || n < 0 || n > MAX_FEE) {
        throw new MedusaError(MedusaError.Types.INVALID_DATA, `Fee for "${loc.key}" in ${c.toUpperCase()} must be between 0 and ${MAX_FEE}.`)
      }
      surcharge[c] = money2(n)
    }
    return { ...rest, surcharge }
  })

  await updateProductsWorkflow(req.scope).run({
    input: {
      selector: { id: product.id },
      update: { metadata: { ...(product.metadata ?? {}), print_locations: wasString ? JSON.stringify(next) : next } },
    },
  })

  return res.json(view(await loadProduct(req), currencies))
}
