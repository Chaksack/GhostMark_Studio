import { redirect } from "next/navigation"

type Props = {
  params: Promise<{ caseId: string }>
}

function resolveBackendBase(): string {
  const cand =
    process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.MEDUSA_BACKEND_URL ||
    process.env.BACKEND_URL ||
    "http://localhost:9000"
  return String(cand).replace(/\/$/, "")
}

export default async function SupportCaseRedirectPage(props: Props) {
  const { caseId } = await props.params
  const base = resolveBackendBase()
  const target = `${base}/support/${encodeURIComponent(caseId || "")}`
  // Server-side redirect to the backend's public support page
  redirect(target)
}
