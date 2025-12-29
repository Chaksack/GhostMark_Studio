import { NextResponse } from "next/server"

// Redirect legacy/alias customer service route to the Support page
export function GET(
  req: Request,
  { params }: { params: { countryCode: string } }
) {
  const { countryCode } = params
  const url = new URL(req.url)
  url.pathname = `/${countryCode}/support`
  url.search = ""
  return NextResponse.redirect(url, 308)
}
