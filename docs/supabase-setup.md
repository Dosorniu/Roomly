# Shared Roomly setup

Status: the hosted Supabase project is connected and the production Roomly Worker
is live at `https://roomly.dosorniu.workers.dev` (2026-10-01). The core schema,
27-room catalog and public-browsing/auth migration have been applied. One owner
test account has completed hosted email verification successfully.

Custom SMTP and OTP-only email templates are still a production gate before
inviting a class-sized group.

## Database migrations

Run the committed SQL files in filename order on a fresh project:

1. `supabase/migrations/202609210001_roomly.sql`
2. `supabase/migrations/202609210002_catalog.sql`
3. `supabase/migrations/202610010003_public_browse_auth.sql`

The migrations create:

- private university/building/room hierarchy and occupancy data,
- authenticated check-in/join/leave/update RPCs,
- account watches and durable in-app availability alerts,
- privacy-safe public room snapshots,
- a public Realtime revision counter,
- private campus invite codes and self-service access claiming.

Private tables live in `roomly_private`. Browser roles do not receive direct
schema/table access. The browser talks to the database only through the intended
public RPC surface.

## Production URLs and client variables

Production Site URL:

`https://roomly.dosorniu.workers.dev`

Supabase Authentication URL Configuration should use the production Worker URL
as the Site URL and include the Worker origin in the allowed redirect URLs.

The client requires only public values:

```env
NEXT_PUBLIC_ROOMLY_MODE=supabase
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Never put a secret/service-role key or database password in browser variables,
GitHub, Cloudflare build variables intended for the client, or documentation.

## Visitor and account flow

Shared mode deliberately separates browsing from interaction.

1. A signed-out visitor opens Roomly and calls `roomly_public_snapshot()`.
   They can see room status, occupant count and estimated session end.
2. The public projection contains no emails, user IDs or membership rows.
3. Check-in, Join, Update, Leave and Watch are protected actions.
4. A protected action opens the passwordless sign-in dialog.
5. The visitor enters an email and Supabase sends a one-time verification email.
6. The client verifies the six-digit OTP with `verifyOtp(..., type: "email")`.
7. Returning approved users continue immediately.
8. A newly verified user enters the shared campus access code once.
   `roomly_claim_access()` validates the private code and adds that verified
   email to `roomly_private.allowed_students`.
9. Supabase persists the browser session, so the user normally does not need a
   new email code every time they reopen Roomly on the same browser/device.

A different browser/device has its own Supabase session and therefore performs
email verification separately. The campus code is not needed again after the
email has already been approved.

## Campus access codes

Invite codes are operational secrets/data, not source code. Do not commit a real
classroom code to GitHub.

Create or rotate one in Supabase SQL, for example:

```sql
insert into roomly_private.invite_codes(
  code, university_id, enabled, max_uses
)
values ('REPLACE-WITH-A-SHARED-CODE', 'cbs', true, 100);
```

Disable an old code without deleting approved student accounts:

```sql
update roomly_private.invite_codes
set enabled=false
where code='OLD-CODE';
```

The live project currently has an active private classroom code provisioned in
the database. It is intentionally absent from this repository.

## Configure six-digit email OTP

Roomly already sends and verifies email OTP requests in the client. Supabase
chooses whether the email shows a link or a code from the email template content.

In **Authentication → Email Templates**, update both templates used by new and
returning users:

- **Confirm signup**
- **Magic Link / OTP**

Include `{{ .Token }}` in both, for example:

```html
<h2>Your Roomly sign-in code</h2>
<p>Enter this six-digit code in Roomly:</p>
<p><strong>{{ .Token }}</strong></p>
<p>This code expires shortly and can be used only once.</p>
```

The client accepts the six-digit code with `verifyOtp`. During transition, a
working Supabase sign-in link can still establish the session if a legacy email
template sends one.

Set **Authentication → Providers → Email → Email OTP Expiration** to a short
window appropriate for the demo. About 10–15 minutes is a reasonable classroom
choice; Supabase recommends keeping OTP validity at one hour or less.

## Custom SMTP before class-wide testing

Do not rely on Supabase's built-in mailer for a classroom launch. Configure a
custom SMTP provider in **Authentication → Emails → SMTP Settings** so normal
student addresses can receive verification emails and the project has a usable
auth-email rate limit.

Keep SMTP credentials only in Supabase. They must never be added to the Roomly
repository or browser environment.

After custom SMTP is connected, review **Authentication → Rate Limits** before a
presentation and make sure the configured email/OTP limits cover the expected
number of students plus a few retries.

## Authorization and transactions

`roomly_public_snapshot()` is the anonymous read-only API. It returns only a
privacy-safe projection.

`roomly_snapshot()`, `roomly_command()` and `roomly_watch()` are the
approved-account API surface. The actor comes from `auth.uid()` and a confirmed
entry in `auth.users`; browser-supplied user IDs are ignored for authorization.

Occupancy commands execute in one transaction under an advisory lock. Unique
constraints enforce one active session per room and one membership per user.
Capacity, duration, sharing and holder permissions are checked in SQL.

Only `public.roomly_revision` is published to Supabase Realtime. Anonymous and
approved clients may subscribe to that counter; after a revision change they
refetch the appropriate projection. A five-second poll and focus refresh recover
missed/disconnected events.

## Hosted verification checklist

Before a class demo:

- public browser with no account can browse the 27 rooms,
- public JSON/state contains no email or user IDs,
- protected actions open the sign-in dialog,
- a new email receives the six-digit OTP,
- a wrong campus code is rejected,
- the correct campus code grants access once,
- a returning approved email skips campus-code enrollment,
- two independent browsers/devices see the same room status,
- A checks in, B sees and joins, A leaves, B becomes holder,
- B leaves and the room becomes Free,
- a watching account receives the in-app alert after reconnecting,
- an anonymous client cannot call mutation RPCs,
- a non-holder cannot update another holder's session,
- deployed CSP permits the configured Supabase HTTPS/WebSocket origin,
- no secret/service-role key appears in the browser bundle or GitHub.

References: [Supabase passwordless email auth](https://supabase.com/docs/guides/auth/auth-email-passwordless),
[email templates](https://supabase.com/docs/guides/auth/auth-email-templates),
[SMTP](https://supabase.com/docs/guides/auth/auth-smtp),
[Realtime](https://supabase.com/docs/guides/realtime/postgres-changes),
[RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
