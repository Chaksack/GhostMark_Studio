import {
  CustomisationError,
  chargedLocationKeys,
  isUploadPath,
  locationFees,
  minimumFor,
  readPrintLocations,
  validateQuantity,
} from "../print-pricing"

const meta = {
  print_locations: [
    { key: "front", label: "Front (chest)", surcharge: { gbp: 8, EUR: "9.5", usd: 10 } },
    { key: "back", label: "Back (full)", surcharge: { gbp: 12 } },
    { key: "sleeve", label: "Sleeve" },
  ],
}
const locs = readPrintLocations(meta)
const design = (designs: Record<string, unknown>) => JSON.stringify({ designs })
const side = (url = "/uploads/designs/a.png") => ({ originalUrl: url, imageUrl: url })

describe("readPrintLocations", () => {
  it("normalises currency keys and numeric strings, and treats a missing surcharge as unpriced", () => {
    expect(locs).toEqual([
      { key: "front", label: "Front (chest)", surcharge: { gbp: 8, eur: 9.5, usd: 10 } },
      { key: "back", label: "Back (full)", surcharge: { gbp: 12 } },
      { key: "sleeve", label: "Sleeve", surcharge: null },
    ])
  })
  it("accepts seeded string JSON and ignores garbage", () => {
    expect(readPrintLocations({ print_locations: JSON.stringify(meta.print_locations) })).toHaveLength(3)
    expect(readPrintLocations({ print_locations: "not json" })).toEqual([])
    expect(readPrintLocations({ print_locations: [{ label: "no key" }, null] })).toEqual([])
  })
  it("drops negative and non-numeric fees", () => {
    const [l] = readPrintLocations({ print_locations: [{ key: "f", surcharge: { gbp: -1, eur: "x" } }] })
    expect(l.surcharge).toBeNull()
  })
})

describe("chargedLocationKeys", () => {
  it("charges only sides that carry artwork", () => {
    expect(chargedLocationKeys(design({ front: side(), back: null }), locs)).toEqual(["front"])
    expect(chargedLocationKeys(design({ front: side(), back: side() }), locs)).toEqual(["front", "back"])
  })
  it("refuses a payload with no artwork at all", () => {
    expect(() => chargedLocationKeys(design({ front: null }), locs)).toThrow(CustomisationError)
  })
  it("refuses a location the product does not have", () => {
    expect(() => chargedLocationKeys(design({ pocket: side() }), locs)).toThrow(/not a print location/)
  })
  it("refuses artwork URLs that are not our uploads, including the old blob: handle", () => {
    for (const bad of ["blob:http://localhost:3000/x", "https://evil.example/x.png", "//evil.example/x", "/uploads/../etc/passwd"]) {
      expect(() => chargedLocationKeys(design({ front: side(bad) }), locs)).toThrow(/uploaded file path/)
    }
  })
  it("refuses malformed and oversized payloads", () => {
    expect(() => chargedLocationKeys("{", locs)).toThrow(/valid JSON/)
    expect(() => chargedLocationKeys(undefined, locs)).toThrow(/non-empty/)
    expect(() => chargedLocationKeys(JSON.stringify({ designs: {}, pad: "x".repeat(250_000) }), locs)).toThrow(/too large/)
  })
})

describe("locationFees", () => {
  it("prices each charged side in the cart currency", () => {
    expect(locationFees(locs, ["front", "back"], "GBP")).toEqual([
      { key: "front", label: "Front (chest)", amount: 8 },
      { key: "back", label: "Back (full)", amount: 12 },
    ])
  })
  it("charges nothing for a side the merchant has not priced at all", () => {
    expect(locationFees(locs, ["sleeve"], "eur")).toEqual([{ key: "sleeve", label: "Sleeve", amount: 0 }])
  })
  it("refuses, never zeroes, a side priced in other currencies but not this one", () => {
    expect(() => locationFees(locs, ["back"], "eur")).toThrow(/not priced in EUR/)
  })
})

describe("quantity and minimum", () => {
  it("validates quantity", () => {
    expect(validateQuantity(1)).toBe(1)
    expect(validateQuantity("3")).toBe(3)
    for (const bad of [0, -1, 1.5, "x", 10_001, null]) expect(() => validateQuantity(bad)).toThrow()
  })
  it("keeps the minimum for made-to-order products only", () => {
    expect(minimumFor({ commerce_mode: "shop", moq: 25 })).toBe(1)
    expect(minimumFor({ commerce_mode: "studio", moq: 25 })).toBe(25)
    expect(minimumFor({ commerce_mode: "studio" })).toBe(1)
  })
})

describe("isUploadPath", () => {
  it("accepts only our own upload paths", () => {
    expect(isUploadPath("/uploads/designs/2026-11/01/a.png")).toBe(true)
    expect(isUploadPath(null)).toBe(false)
    expect(isUploadPath("uploads/a.png")).toBe(false)
  })
})
