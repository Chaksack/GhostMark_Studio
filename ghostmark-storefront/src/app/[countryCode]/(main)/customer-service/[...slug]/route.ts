import { NextResponse } from "next/server"

// Catch-all redirect for any nested customer-service paths to Support
export function GET(
  req: Request,
  { params }: { params: { countryCode: string; slug?: string[] } }
) {
  const { countryCode } = params
  const url = new URL(req.url)
  url.pathname = `/${countryCode}/support`
  url.search = ""
  return NextResponse.redirect(url, 308)
}
