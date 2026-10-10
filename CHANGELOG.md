# Changelog

## Update 01 — Working Roomly baseline

Author: Artem (AI-assisted implementation)
Date: 2026-09-16

Added:

- Room search, filters, direct links, check-in, joining and leaving.
- Holder transfer, expiration and independent appearance settings.
- Supplied campus illustration/monogram and 27 demo rooms over five floors.

Changed:

- Product name to Roomly; CBS light green and deep purple themes.

## Update 02 — GitHub team preparation

Author: Codex, at Artem's request
Date: 2026-09-20

Added:

- Pull-request CI: locked install, TypeScript, domain tests, contrast and build.
- Contribution guide, PR template and repository setup checklist.
- Shared Node.js version and generated-cache exclusion.

Changed:

- README expanded with branch and PR workflow.

Application behavior, deployment, backend and authentication are unchanged.
Remote repository settings must be verified separately on GitHub.

<!-- Next iteration: Update 03, actual author/date, Added/Changed/Fixed items. -->

## Update 03 — Engineering cleanup and shared backend preparation

Author: Codex, at Artem's request
Date: 2026-09-21

Added:

- Supabase email sign-in, authenticated RPC repository, private PostgreSQL schema,
  transactional occupancy, account watches and durable availability alerts.
- Database authorization/regression tests, browser E2E tests, lint in CI,
  dependency updates and Dependabot, CSP and response security headers.
- Stable room ID URLs, legacy redirects, true 404 pages and an error boundary.

Fixed:

- Lint errors, README encoding, historical validation wording and dark-theme flash.
- Removed unused UI/template modules, unused dependencies and header-based auth.
- Formatted application and domain code for review.

The Supabase connection is not live yet. Default local demo behavior is preserved;
hosted authentication, email delivery and cross-device testing remain setup gates.

Repository setup note: private Dosorniu/Roomly created; main rule saved but Not enforced on the current plan. The source import is reviewed through the codex/roomly-github-setup pull request; remote CI results are recorded on GitHub.

## Update 04 — Live Supabase deployment and public browsing

Author: ChatGPT, at Artem's request
Date: 2026-10-01

Added:

- Live Supabase project with the existing Roomly schema, 27-room catalog,
  authenticated occupancy RPCs, Realtime revision publication and the first
  verified/approved test account.
- Public read-only room snapshots so visitors can browse room availability,
  occupant counts and estimated end times without signing in.
- Passwordless interaction flow: email verification, persistent Supabase session
  and a one-time campus access code for newly approved accounts.
- Private campus invite-code storage and claim RPC. Invite codes are database
  data and are intentionally not committed to GitHub.
- Public Realtime revision access containing only the revision counter; room
  identities and student data remain private.

Changed:

- Shared-mode UI no longer blocks the whole application behind authentication.
  Sign-in appears only when a visitor tries to check in, join, update a session
  or watch a room.
- Account controls now distinguish signed-out, verified-but-not-approved and
  fully approved states.
- Supabase repository now keeps anonymous visitors synchronized through the
  privacy-safe public projection and preserves private account watches/notices
  only for approved users.
- Shared setup documentation now records the live Cloudflare Workers deployment
  at `https://roomly.dosorniu.workers.dev` and the production auth flow.

Security / privacy:

- Public snapshots expose no email addresses, user IDs or membership rows.
- Mutations still require an authenticated, verified and campus-approved actor.
- Passwords are not collected by Roomly; Supabase email OTP/magic-link
  verification is used instead.

Completed hosted-auth setup:

- Configured custom SMTP with the project-only Gmail sender
  `Roomly <roomlysp@gmail.com>`.
- Updated both Confirm signup and Magic Link/OTP templates to send
  `{{ .Token }}` instead of relying on a sign-in link.
- Set live email OTP length to 6 digits and expiration to 900 seconds
  (15 minutes).
- Completed a fresh-account end-to-end test: email delivery → OTP verification →
  campus access code → approved Roomly account access.
- Replaced the shared campus access code with university-domain sign-in
  (`@cbs-mail.de`) plus personal single-use guest codes; disabled the old
  shared code. No access code is committed to the repository.
- The Gmail App Password, Supabase secrets and service-role credentials remain
  outside the repository.

## Update 05 — Redesign, advance bookings and My bookings

Author: Maks (AI-assisted, Claude)
Date: 2026-10-03 – 2026-10-04

Added:

- Advance room bookings: week calendar on each room page (Mon–Fri, 30-minute
  grid, 30 min – 2 h), confirmation step, cancel your own slot
  (`202610050005_bookings.sql`).
- "My bookings" page (`/bookings`) listing your upcoming reservations with
  cancel (`202610050007_my_bookings.sql`).
- Quick-filter circles (Free now, To share, Quiet, Group, Floors), campus-closed
  notice, loading skeletons and empty states.

Changed:

- Room list redesigned as cards; header with navigation; Campus (CBS) palette
  set as the default theme; default text size Large; R badge logo.
- A room with no active check-in is shown as Free.

Note: the room calendar briefly showed booker display names to signed-in
students (`202610050006_booking_names.sql`); this was reverted in Update 06.

## Update 06 — Bookings and check-in work together, anonymity, sign-in fixes

Author: Maks (AI-assisted, Claude)
Date: 2026-10-10

Fixed:

- Check-in ignored bookings: you could check into a room someone had reserved
  for that time. Check-in and extending a stay are now rejected when they run
  into another student's booking; your own booking never blocks you.
- Booking ignored check-ins: you could reserve a slot while someone was checked
  in. Reserving now respects active check-ins (except your own).
- A room with a booking running right now showed as Free; it now shows
  "Reserved" with the end time.
- Booking rules were enforced only by the interface. The server now enforces
  Monday–Friday, 08:00–20:00 campus time and a 30 min – 2 h duration (the
  server previously allowed 15 min – 4 h at any hour).
- Sign-in sent a code to any email address. The university domain
  (`@cbs-mail.de`) is now checked before a code is sent; guests with a personal
  code tick "I have a guest code".
- Mobile: all five quick-filter circles now fit on a phone without sideways
  scrolling.

Privacy:

- Roomly is anonymous again: no student names anywhere. Bookings show "You" or
  "Booked"; shared rooms show only a headcount. The name-deriving database
  function is removed. Privacy policy and guide updated.

Security:

- Dependency audit: updated `source-map-js` to 1.2.2 and pinned `sharp` 0.35.5
  for `next` via `overrides` (two new high-severity advisories). The existing
  dev-only `miniflare` pin is unchanged.

Database: run `supabase/migrations/202610100008_reservations_privacy.sql` in the
Supabase SQL Editor (safe to re-run).

Tests: database test covers campus hours, duration, anonymity and
reservations vs check-in; domain tests cover reservation blocking; the mobile
e2e test asserts the filter row fits.

## Update 07 — Check-in fix and shared bookings

Author: Maks (AI-assisted, Claude)
Date: 2026-10-10

Fixed:

- Check In failed with "Confirm the room is empty in person before checking
  in." on every room without a recent update, on any day of the week. The
  interface shows such rooms as Free and never offered the confirmation, but
  the server still required it. Free now means free: the confirmation step is
  removed on the server and in the app.
- The check-in dialog said the room becomes "Unknown" after a session; it now
  says the room shows as Free again.

Added:

- Calendar bookings can be shared: "Can others join you?" in the booking
  sheet. While a shared booking runs the room shows "Open to Share"; other
  students may check in, but their session has to stay open to others. When the
  booker arrives and someone is already inside, Check In adds them to that
  session. Private bookings still hold the whole room.
- A shared booking can be made next to a session that is open to share.
- Shared bookings are marked "open" in the calendar and "Others can join" in
  My bookings.

Privacy policy corrected:

- Watched rooms and alerts are stored on the server (the page said "in your
  browser"); alerts are deleted after 30 days, check-ins when they end.
- Names the service providers (Supabase, Cloudflare, Gmail) instead of
  claiming no third parties; mentions guest access codes.
- Contact is now roomlysp@gmail.com (the old address did not exist).

Database: run `supabase/migrations/202610100009_free_checkin_shared_bookings.sql`
in the Supabase SQL Editor after merging (safe to re-run).

Tests: domain and database tests cover check-in without confirmation, rooms
returning to Free when a check-in or booking ends, and shared bookings.
