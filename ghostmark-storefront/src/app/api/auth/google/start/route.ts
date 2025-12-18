import { NextResponse } from "next/server"

export async function GET() {
  const base = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"
  const url = `${base.replace(/\/$/, "")}/auth/customer/google`
  return NextResponse.redirect(url)
}
