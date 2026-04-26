import { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

export default async function getPublishableKey({ container }: ExecArgs) {
  const apiKeyService = container.resolve(Modules.API_KEY)
  const keys = await apiKeyService.listApiKeys({ type: "publishable" })
  if (!keys.length) {
    console.log("NO_PUBLISHABLE_KEY_FOUND")
    return
  }
  // Print the most recently created key so the storefront can grab the active one
  const latest = keys.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )[0]
  console.log(`PUBLISHABLE_KEY=${latest.token}`)
}
