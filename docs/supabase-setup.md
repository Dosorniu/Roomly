# Shared Roomly setup

Status: the hosted Supabase project is connected and the production Roomly Worker
is live at `https://roomly.dosorniu.workers.dev` (2026-10-01). The core schema,
27-room catalog and public-browsing/auth migration have been applied. One owner
test account has completed hosted email verification successfully.

Custom SMTP and OTP-only email templates are configured and verified. The live
project sends six-digit codes with a 15-minute expiry through the project-only
sender `Roomly <roomlysp@gmail.com>`.

## Database migrations

Run the committed SQL files in filename order on a fresh project:

1. `supabase/migrations/202609210001_roomly.sql`
2. `supabase/migrations/202609210002_catalog.sql`
3. `supabase/migrations/202610010003_public_browse_auth.sql`
4. `supabase/migrations/202610050004_auth_hardening.sql`
5. `supabase/migrations/202610050005_bookings.sql`
6. `supabase/migrations/202610050006_booking_names.sql` (superseded by 8)
7. `supabase/migrations/202610050007_my_bookings.sql`
8. `supabase/migrations/202610100008_reservations_privacy.sql`
9. `supabase/migrations/202610100009_free_checkin_shared_bookings.sql`
10. `supabase/migrations/202610110010_access_code_for_everyone.sql`
11. `supabase/migrations/202610110011_notify_when_free.sql`

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

Any email address can receive a sign-in code. Every new account then enters the
shared demo access code once (university addresses included); approved accounts
skip this step afterwards. The code lives only in Supabase
(`roomly_private.invite_codes`, unlimited uses) and is never stored in the
repository. It is entered case-insensitively (the form upper-cases it).

Create or rotate a campus code in Supabase SQL, for example:

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

The live project currently has the documented classroom code provisioned and
enabled in the database.

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

The live project is configured with:

- **Email OTP length:** 6 digits
- **Email OTP expiration:** 900 seconds (15 minutes)
- **Minimum resend interval per user:** 60 seconds

## Custom SMTP

Custom SMTP is enabled in **Authentication → Emails → SMTP Settings** using
Brevo's SMTP relay (`smtp-relay.brevo.com`, port 587) with the project sender
`roomlysp@gmail.com`. Brevo rewrites a free-mail sender to its own
`…brevosend.com` address. The Brevo SMTP key is stored only in Supabase and is not
committed to GitHub. Delivery can be checked in **Brevo → Transactional → Logs**.

Known limitation: the university mailbox (Microsoft 365) moves Roomly emails to
quarantine, so `@cbs-mail.de` addresses may not receive the code. For the demo,
students sign in with any other address. Production use with university
addresses needs the CBS IT team to allow the Roomly sender. Both email templates (Confirm sign up, Magic
link or OTP) are in English and contain only the six-digit `{{ .Token }}` code.

Before a larger presentation, review **Authentication → Rate Limits** and make
sure the configured email/OTP limits cover the expected number of students plus
a few retries.

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
- a new email receives a six-digit OTP from the Roomly project sender,
- the OTP expires after 15 minutes,
- a wrong guest code is rejected,
- a verified `@cbs-mail.de` address still needs the access code once,
- a personal single-use guest code grants access once, then is spent,
- a returning approved email skips the code step,
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
