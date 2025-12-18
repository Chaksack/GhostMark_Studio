import { NextRequest, NextResponse } from "next/server"
import { setAuthToken } from "@lib/data/cookies"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get("token")
  const next = searchParams.get("next") || "/us/account" // default dashboard path

  if (token) {
    await setAuthToken(token)
  }

  return NextResponse.redirect(new URL(next, req.url))
}
