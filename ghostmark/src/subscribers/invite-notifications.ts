// =============================================================================
// invite-notifications: send the admin staff-invite email via Resend.
//
// Why this exists
// ---------------
// Medusa v2's `createInvitesWorkflow` (the one the admin "Invite user" button
// triggers via POST /admin/invites) creates the DB record and emits the
// `invite.created` event, but it explicitly does NOT send an email. The
// event is the documented seam for delivering the invite to the user. Without
// a subscriber on that seam, the invite token rots in the database and the
// invitee never knows they were invited.
//
// We hook the event here and pipe through the same `resend-notification`
// module that already handles order-confirmation + quote-request emails.
//
// Event payload
// -------------
// Medusa emits `invite.created` with an ARRAY of `{ id }` objects, only the
// invite id is carried, NOT the full invite record. We resolve the rest
// (email + token + expires_at) via remote-query before constructing the
// email payload. This matches Medusa's published guidance:
// https://docs.medusajs.com/resources/integrations/guides/send-invite
//
// Accept URL
// ----------
// The admin dashboard accepts `/app/invite?token=<jwt>` (and forwards to the
// finalisation page). The token is the JWT stored on `invite.token`. We
// include the URL prominently in the email, the invitee clicks it, enters
// their name + password, and POST /admin/invites/accept lands them in admin.
// =============================================================================
import { SubscriberArgs, type SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"

// `invite.created` emits `Array<{ id: string }>` (the workflow batches
// invite creations). We resolve each id to its full record + send.
type InvitePayload =
  | { id: string }
  | Array<{ id: string }>

const normalise = (data: InvitePayload): Array<{ id: string }> =>
  Array.isArray(data) ? data : [data]

export default async function inviteCreatedHandler({
  event: { data },
  container,
}: SubscriberArgs<InvitePayload>) {
  const notificationModuleService = container.resolve(Modules.NOTIFICATION)
  const query = container.resolve("query")

  const invites = normalise(data)
  if (!invites.length) return

  // Admin origin for the accept-invite link. Defaults to the local dev
  // server; in production set MEDUSA_BACKEND_URL (or MEDUSA_ADMIN_URL)
  // to https://admin.ghostmark.studio (or wherever admin is hosted).
  const adminBaseUrl = (
    process.env.MEDUSA_ADMIN_URL ||
    process.env.MEDUSA_BACKEND_URL ||
    "http://localhost:9000"
  ).replace(/\/$/, "")

  for (const { id } of invites) {
    try {
      // Fetch the full invite record. Only `id` is on the event payload.
      const { data: [invite] } = await query.graph({
        entity: "invite",
        fields: ["id", "email", "token", "expires_at", "accepted"],
        filters: { id },
      })

      if (!invite) {
        console.warn(`[invite-notifications] invite ${id} not found, skipping send.`)
        continue
      }

      // Don't email already-accepted invites. The workflow shouldn't emit
      // `created` for these, but defence in depth, a buggy admin
      // operation that re-fires the event won't pester the user.
      if ((invite as any).accepted) {
        console.warn(`[invite-notifications] invite ${id} already accepted, skipping resend.`)
        continue
      }

      // Medusa's admin dashboard accepts the token at `/app/invite?token=…`.
      // That page collects first/last name + password and POSTs
      // /admin/invites/accept under the hood.
      const acceptUrl = `${adminBaseUrl}/app/invite?token=${encodeURIComponent(invite.token as string)}`

      // Expiry copy for the email. Falls back gracefully if expires_at is
      // missing / not parseable.
      let expiresInDays: number | null = null
      const expiresAt = (invite as any).expires_at
      if (expiresAt) {
        const ms = new Date(expiresAt).getTime() - Date.now()
        if (Number.isFinite(ms) && ms > 0) {
          expiresInDays = Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)))
        }
      }

      await notificationModuleService.createNotifications({
        to: invite.email as string,
        channel: "email",
        template: "invite-created",
        data: {
          invite_email: invite.email,
          accept_url: acceptUrl,
          expires_in_days: expiresInDays ?? 7, // matches Medusa's default
        },
      })

      console.log(
        `[invite-notifications] sent invite email to ${invite.email} (id=${id})`,
      )
    } catch (e) {
      console.error(
        `[invite-notifications] failed to send invite ${id}:`,
        e,
      )
    }
  }
}

export const config: SubscriberConfig = {
  event: "invite.created",
}
